import raw from './scams.json';
import { ScamRecord, ScamStats } from './types';

/**
 * In-memory scam store. Seeded from the bundled 5000-row dataset and extended
 * at runtime by user incident reports (Report screen) so that reports land in
 * the SAME table as the mockup data, exactly as the wireframe specifies.
 *
 * The dataset is bundled with the app and kept in memory, so search and reports
 * work offline and instantly in Expo Go.
 */
let records: ScamRecord[] = (raw as ScamRecord[]).slice();

/** Listeners notified whenever the dataset changes (e.g. after a report). */
type Listener = () => void;
const listeners = new Set<Listener>();
const notify = () => listeners.forEach((l) => l());

export const scamStore = {
  all(): ScamRecord[] {
    return records;
  },

  count(): number {
    return records.length;
  },

  /**
   * Append a user's incident report to the shared dataset.
   *
   * The row lands in the same table as the 5000 seed records, but with
   * `verified: false`. A public report is an ALLEGATION until the police have
   * investigated it; only then would someone flip the Verified column to Yes.
   * The seed rows are all Yes precisely because they represent already-verified
   * historical cases.
   *
   * Consequence worth knowing: because the Search screen defaults to "Show
   * verified cases only", a fresh report will not appear in the default results.
   * That is correct — it keeps unconfirmed claims out of the statistics people
   * rely on — and turning the switch off reveals it.
   */
  addReport(input: {
    dateReported: string;
    scamType: string;
    town: string;
    description: string;
  }): ScamRecord {
    const keywords = extractKeywords(input.description);
    const rec: ScamRecord = {
      id: `user-report-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      dateReported: input.dateReported,
      scamType: input.scamType,
      keywords,
      town: input.town,
      specificPlace: input.town,
      source: 'user-report',
      // Pending police investigation. Never true at creation time.
      verified: false,
      year: parseInt(input.dateReported.slice(0, 4), 10),
    };
    records = [rec, ...records];
    notify();
    return rec;
  },

  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  /** Reset to the seeded dataset (used by tests). */
  _reset(): void {
    records = (raw as ScamRecord[]).slice();
    notify();
  },
};

/** Naive keyword extraction from free text for report enrichment. */
export function extractKeywords(text: string): string[] {
  const stop = new Set([
    'the', 'a', 'an', 'and', 'or', 'to', 'of', 'in', 'on', 'for', 'was', 'were',
    'is', 'are', 'i', 'me', 'my', 'he', 'she', 'they', 'it', 'that', 'this',
    'with', 'at', 'from', 'by', 'as', 'but', 'so', 'then', 'had', 'have',
  ]);
  return Array.from(
    new Set(
      text
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length > 3 && !stop.has(w))
    )
  ).slice(0, 8);
}

export interface SearchFilters {
  from?: string; // ISO date inclusive
  to?: string; // ISO date inclusive
  keywords?: string[]; // any-match, case-insensitive
  scamType?: string;
  town?: string;
  verifiedOnly?: boolean;
}

/** Filter the shared dataset by the wireframe's search criteria. */
export function searchScams(filters: SearchFilters): ScamRecord[] {
  const kw = (filters.keywords ?? []).map((k) => k.toLowerCase()).filter(Boolean);
  return scamStore.all().filter((r) => {
    if (filters.from && r.dateReported < filters.from) return false;
    if (filters.to && r.dateReported > filters.to) return false;
    if (filters.verifiedOnly && !r.verified) return false;
    if (filters.scamType && r.scamType !== filters.scamType) return false;
    if (filters.town && r.town !== filters.town) return false;
    if (kw.length) {
      const hay = (r.keywords.join(' ') + ' ' + r.scamType).toLowerCase();
      if (!kw.some((k) => hay.includes(k))) return false;
    }
    return true;
  });
}

/** Aggregate a result set into dashboard-friendly statistics. */
export function computeStats(list: ScamRecord[]): ScamStats {
  const typeMap = new Map<string, number>();
  const townMap = new Map<string, number>();
  const yearMap = new Map<number, number>();
  const kwMap = new Map<string, number>();

  for (const r of list) {
    typeMap.set(r.scamType, (typeMap.get(r.scamType) ?? 0) + 1);
    townMap.set(r.town, (townMap.get(r.town) ?? 0) + 1);
    yearMap.set(r.year, (yearMap.get(r.year) ?? 0) + 1);
    for (const k of r.keywords) kwMap.set(k, (kwMap.get(k) ?? 0) + 1);
  }

  const sortDesc = <K,>(m: Map<K, number>) =>
    Array.from(m.entries()).sort((a, b) => b[1] - a[1]);

  return {
    total: list.length,
    byType: sortDesc(typeMap).map(([type, count]) => ({ type, count })),
    byTown: sortDesc(townMap).map(([town, count]) => ({ town, count })),
    byYear: Array.from(yearMap.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([year, count]) => ({ year, count })),
    topKeywords: sortDesc(kwMap)
      .slice(0, 15)
      .map(([keyword, count]) => ({ keyword, count })),
  };
}

/**
 * Compact statistics describing the whole dataset, for the chatbot.
 *
 * The dataset lives in the app, not on the server, and grows as users file
 * reports — so the figures travel with each chat request rather than being
 * duplicated server-side. Deliberately small (a few hundred tokens): full rows
 * would be far too large to send per message and the model only needs aggregates
 * to answer questions like "top 3 scam types in 2023".
 */
export interface DatasetSummary {
  totalCases: number;
  verifiedCases: number;
  userReports: number;
  byYear: Record<string, number>;
  /** Every scam type, most common first. */
  byType: Array<{ type: string; count: number }>;
  /** Top types within each year, so year-specific questions can be answered. */
  byTypePerYear: Record<string, Array<{ type: string; count: number }>>;
  topTowns: Array<{ town: string; count: number }>;
  topKeywords: Array<{ keyword: string; count: number }>;
}

export function datasetSummary(): DatasetSummary {
  const all = scamStore.all();
  const stats = computeStats(all);

  const byYear: Record<string, number> = {};
  for (const row of stats.byYear) byYear[String(row.year)] = row.count;

  // Per-year type counts, trimmed to the leading few for each year.
  const perYear = new Map<number, Map<string, number>>();
  for (const r of all) {
    const forYear = perYear.get(r.year) ?? new Map<string, number>();
    forYear.set(r.scamType, (forYear.get(r.scamType) ?? 0) + 1);
    perYear.set(r.year, forYear);
  }

  const byTypePerYear: Record<string, Array<{ type: string; count: number }>> = {};
  for (const [year, counts] of Array.from(perYear.entries()).sort((a, b) => a[0] - b[0])) {
    byTypePerYear[String(year)] = Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([type, count]) => ({ type, count }));
  }

  return {
    totalCases: all.length,
    verifiedCases: all.filter((r) => r.verified).length,
    userReports: all.filter((r) => r.source === 'user-report').length,
    byYear,
    byType: stats.byType,
    byTypePerYear,
    topTowns: stats.byTown.slice(0, 12),
    topKeywords: stats.topKeywords.slice(0, 12),
  };
}

/** Distinct scam types present in the dataset (for dropdowns). */
export function scamTypes(): string[] {
  return Array.from(new Set(scamStore.all().map((r) => r.scamType))).sort();
}

/** Distinct towns present in the dataset (for dropdowns). */
export function towns(): string[] {
  return Array.from(new Set(scamStore.all().map((r) => r.town))).sort();
}

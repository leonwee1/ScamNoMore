/** A single verified scam record from the Singapore scam dataset. */
export interface ScamRecord {
  /** Stable unique id (source URL is unique per row). */
  id: string;
  dateReported: string; // ISO date, e.g. "2025-01-13"
  scamType: string; // e.g. "Romance Scam"
  keywords: string[]; // parsed from the quoted keyword list
  town: string; // e.g. "Orchard"
  specificPlace: string; // e.g. "Orchard Road"
  source: string; // advisory URL
  verified: boolean;
  year: number;
}

/** Aggregated stats used by the dashboard. */
export interface ScamStats {
  total: number;
  byType: Array<{ type: string; count: number }>;
  byTown: Array<{ town: string; count: number }>;
  byYear: Array<{ year: number; count: number }>;
  topKeywords: Array<{ keyword: string; count: number }>;
}

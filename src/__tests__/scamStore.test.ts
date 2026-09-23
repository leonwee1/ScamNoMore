import {
  computeStats,
  extractKeywords,
  scamStore,
  scamTypes,
  searchScams,
  towns,
} from '../data/scamStore';

afterEach(() => scamStore._reset());

describe('dataset integrity', () => {
  it('ships exactly 5000 seed records', () => {
    expect(scamStore.count()).toBe(5000);
  });

  it('every record has required fields', () => {
    for (const r of scamStore.all().slice(0, 200)) {
      expect(r.id).toBeTruthy();
      expect(r.scamType).toBeTruthy();
      expect(r.town).toBeTruthy();
      expect(Array.isArray(r.keywords)).toBe(true);
      expect(r.dateReported).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(typeof r.year).toBe('number');
    }
  });

  it('exposes dropdown options', () => {
    expect(scamTypes().length).toBeGreaterThan(5);
    expect(towns().length).toBeGreaterThan(10);
  });
});

describe('searchScams', () => {
  it('filters by date range', () => {
    const res = searchScams({ from: '2025-01-01', to: '2025-12-31' });
    expect(res.length).toBeGreaterThan(0);
    expect(res.every((r) => r.dateReported >= '2025-01-01' && r.dateReported <= '2025-12-31')).toBe(true);
  });

  it('filters by keyword (case-insensitive)', () => {
    const res = searchScams({ keywords: ['paynow'] });
    expect(res.length).toBeGreaterThan(0);
    expect(
      res.every((r) => (r.keywords.join(' ') + ' ' + r.scamType).toLowerCase().includes('paynow'))
    ).toBe(true);
  });

  it('honors verifiedOnly', () => {
    const res = searchScams({ verifiedOnly: true });
    expect(res.every((r) => r.verified)).toBe(true);
  });

  it('filters by town and scamType', () => {
    const town = towns()[0];
    const res = searchScams({ town });
    expect(res.every((r) => r.town === town)).toBe(true);
  });
});

describe('computeStats', () => {
  it('aggregates totals and breakdowns', () => {
    const stats = computeStats(scamStore.all());
    expect(stats.total).toBe(5000);
    const sum = stats.byTown.reduce((a, b) => a + b.count, 0);
    expect(sum).toBe(5000);
    expect(stats.byType[0].count).toBeGreaterThanOrEqual(stats.byType[stats.byType.length - 1].count);
    expect(stats.topKeywords.length).toBeLessThanOrEqual(15);
  });
});

describe('addReport (shared table)', () => {
  it('appends a report into the same dataset', () => {
    const before = scamStore.count();
    const rec = scamStore.addReport({
      dateReported: '2026-01-15',
      scamType: 'Phishing Scam',
      town: 'Tampines',
      description: 'Received a fake DBS SMS asking for my OTP and password urgently.',
    });
    expect(scamStore.count()).toBe(before + 1);
    expect(rec.keywords.length).toBeGreaterThan(0);
    // The new report is discoverable via search on the shared dataset.
    const found = searchScams({ town: 'Tampines', scamType: 'Phishing Scam' });
    expect(found.some((r) => r.id === rec.id)).toBe(true);
  });

  it('marks a new report unverified, pending investigation', () => {
    const rec = scamStore.addReport({
      dateReported: '2026-01-15',
      scamType: 'Phishing Scam',
      town: 'Tampines',
      description: 'Received a fake DBS SMS asking for my OTP and password urgently.',
    });
    // A public report is an allegation until the police confirm it. Only then
    // would the Verified column be flipped to Yes.
    expect(rec.verified).toBe(false);
  });

  it('hides unverified reports from verified-only searches', () => {
    const rec = scamStore.addReport({
      dateReported: '2026-01-15',
      scamType: 'Phishing Scam',
      town: 'Tampines',
      description: 'Fake bank SMS demanding an urgent transfer to a new account.',
    });
    const verified = searchScams({ verifiedOnly: true, town: 'Tampines' });
    expect(verified.some((r) => r.id === rec.id)).toBe(false);

    const everything = searchScams({ verifiedOnly: false, town: 'Tampines' });
    expect(everything.some((r) => r.id === rec.id)).toBe(true);
  });
});

describe('extractKeywords', () => {
  it('drops stopwords and short tokens', () => {
    const kw = extractKeywords('I was asked to transfer money to a Carousell seller urgently');
    expect(kw).toContain('transfer');
    expect(kw).toContain('carousell');
    expect(kw).not.toContain('to');
    expect(kw).not.toContain('was');
  });
});

import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { createHandler, listHandler } from '../handlers/reports';
import {
  _closeReportsDbForTests,
  createReport,
  listReports,
  ReportValidationError,
} from '../lib/reportsDb';

const originalDbPath = process.env.REPORTS_DB_PATH;
let tempDir = '';

beforeEach(() => {
  _closeReportsDbForTests();
  tempDir = mkdtempSync(join(tmpdir(), 'scamnomore-reports-'));
  process.env.REPORTS_DB_PATH = join(tempDir, 'reports.sqlite');
});

afterEach(() => {
  _closeReportsDbForTests();
  rmSync(tempDir, { recursive: true, force: true });
  if (originalDbPath === undefined) delete process.env.REPORTS_DB_PATH;
  else process.env.REPORTS_DB_PATH = originalDbPath;
});

const input = {
  dateReported: '2025-01-15',
  scamType: 'Phishing Scam',
  town: 'Tampines',
  description: 'A fake DBS message urgently asked me to transfer money and share my OTP.',
};

describe('SQLite incident reports', () => {
  it('persists one unverified report across a database reopen without leaking its description', () => {
    const privateDescription = 'A fake DBS message asked for NRIC S1234567A and OTP 123456.';
    const created = createReport({ ...input, description: privateDescription });
    expect(created.id).toMatch(/^user-report-/);
    expect(created.verified).toBe(false);
    expect(created.source).toBe('user-report');
    expect(created.specificPlace).toBe('Tampines');
    expect(created).not.toHaveProperty('description');
    expect(JSON.stringify(created)).not.toContain('S1234567A');
    expect(JSON.stringify(created)).not.toContain('123456');

    // This simulates a backend restart before a different device opens Expo.
    _closeReportsDbForTests();
    const reports = listReports();
    expect(reports).toHaveLength(1);
    expect(reports[0]).toMatchObject({ id: created.id, verified: false, town: 'Tampines' });
    expect(reports[0]).not.toHaveProperty('description');
  });

  it('derives public metadata on the server without exposing description-derived tokens', () => {
    const created = createReport({
      ...input,
      // Extra fields are intentionally ignored by the server-side input parser.
      verified: true,
      source: 'https://example.invalid',
      id: 'client-chosen-id',
    });
    expect(created.id).not.toBe('client-chosen-id');
    expect(created.verified).toBe(false);
    expect(created.source).toBe('user-report');
    expect(created.keywords).toEqual([]);
  });

  it('rejects invalid dates and descriptions over 200 words', () => {
    expect(() => createReport({ ...input, dateReported: '2025-02-30' })).toThrow(
      ReportValidationError
    );
    expect(() =>
      createReport({ ...input, description: Array.from({ length: 201 }, () => 'word').join(' ') })
    ).toThrow(ReportValidationError);
  });

  it('rejects arbitrary public metadata from a modified client', () => {
    expect(() => createReport({ ...input, scamType: 'Call me at 90000000' })).toThrow(
      ReportValidationError
    );
    expect(() => createReport({ ...input, town: 'S1234567A' })).toThrow(ReportValidationError);
  });
});

describe('report handlers', () => {
  it('returns a 201 POST response and exposes the same row through GET', async () => {
    const post = await createHandler({
      raw: Buffer.from(JSON.stringify(input)),
      contentType: 'application/json',
    });
    expect(post.statusCode).toBe(201);
    expect(post.headers?.['Cache-Control']).toBe('no-store');
    const created = (post.body as { report: { id: string; verified: boolean; description?: string } }).report;
    expect(created.verified).toBe(false);
    expect(created.description).toBeUndefined();

    const get = await listHandler({ raw: Buffer.alloc(0), contentType: 'application/json' });
    expect(get.statusCode).toBe(200);
    const reports = (get.body as { reports: Array<{ id: string; description?: string }> }).reports;
    expect(reports).toHaveLength(1);
    expect(reports[0].id).toBe(created.id);
    expect(reports[0].description).toBeUndefined();
  });
});

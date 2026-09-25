import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { createHandler, listHandler } from '../handlers/community';
import {
  _closeReportsDbForTests,
  createCommunityMessage,
  listCommunityMessagePage,
  listCommunityMessages,
  ReportValidationError,
} from '../lib/reportsDb';
import { SCAM_TYPES } from '../lib/types';

const originalDbPath = process.env.REPORTS_DB_PATH;
let tempDir = '';

beforeEach(() => {
  _closeReportsDbForTests();
  tempDir = mkdtempSync(join(tmpdir(), 'scamnomore-community-'));
  process.env.REPORTS_DB_PATH = join(tempDir, 'community.sqlite');
});

afterEach(() => {
  _closeReportsDbForTests();
  rmSync(tempDir, { recursive: true, force: true });
  if (originalDbPath === undefined) delete process.env.REPORTS_DB_PATH;
  else process.env.REPORTS_DB_PATH = originalDbPath;
});

const input = { roomKey: 'Phishing Scam', text: 'Do not click the link. Call the bank directly.' };

describe('SQLite community messages', () => {
  it('has a distinct starter conversation in every room', () => {
    for (const room of SCAM_TYPES) {
      const messages = listCommunityMessages(room);
      expect(messages.length).toBeGreaterThanOrEqual(3);
      expect(new Set(messages.map((message) => message.text)).size).toBe(messages.length);
    }
  });

  it('survives a database reopen and remains in its own room', () => {
    const created = createCommunityMessage(input);
    createCommunityMessage({ roomKey: 'Job Scam', text: 'Never pay a deposit for a job.' });

    // Simulates a Render restart before the user exits and re-enters the room.
    _closeReportsDbForTests();
    const phishing = listCommunityMessages('Phishing Scam');
    expect(phishing.length).toBeGreaterThan(1);
    expect(phishing).toContainEqual(expect.objectContaining({ id: created.id, text: input.text, roomKey: input.roomKey }));
    expect(listCommunityMessages('Job Scam').length).toBeGreaterThan(1);
  });

  it('rejects unknown rooms and messages over 500 characters', () => {
    expect(() => createCommunityMessage({ roomKey: 'Made up room', text: 'Hello' })).toThrow(
      ReportValidationError
    );
    expect(() => createCommunityMessage({ ...input, text: 'x'.repeat(501) })).toThrow(
      ReportValidationError
    );
  });

  it('keeps older messages reachable through a cursor instead of silently dropping them', () => {
    for (let i = 0; i < 52; i++) {
      createCommunityMessage({ roomKey: 'Phishing Scam', text: `Message ${i}` });
    }
    const first = listCommunityMessagePage('Phishing Scam');
    expect(first.messages).toHaveLength(50);
    expect(first.nextBefore).toBeDefined();

    const older = listCommunityMessagePage(
      'Phishing Scam',
      first.nextBefore?.createdAt,
      first.nextBefore?.id
    );
    expect(older.messages).toHaveLength(5);
    expect(new Set([...first.messages, ...older.messages].map((message) => message.id)).size).toBe(55);
  });

  it('keeps a stable anonymous label for the same participant in one room', () => {
    const first = createCommunityMessage({ ...input, participantId: 'device-token-a' });
    const second = createCommunityMessage({
      ...input,
      text: 'I checked with the bank directly.',
      participantId: 'device-token-a',
    });
    const other = createCommunityMessage({
      ...input,
      text: 'I received a similar message too.',
      participantId: 'device-token-b',
    });

    expect(first.participantKey).toBe(second.participantKey);
    expect(other.participantKey).not.toBe(first.participantKey);
  });
});

describe('community handlers', () => {
  it('POSTs then GETs a server-confirmed message with no-store caching', async () => {
    const post = await createHandler({
      raw: Buffer.from(JSON.stringify(input)),
      contentType: 'application/json',
    });
    expect(post.statusCode).toBe(201);
    expect(post.headers?.['Cache-Control']).toBe('no-store');
    const created = (post.body as { message: { id: string } }).message;

    const get = await listHandler({
      raw: Buffer.alloc(0),
      contentType: 'application/json',
      query: { roomKey: 'Phishing Scam' },
    });
    expect(get.statusCode).toBe(200);
    const messages = (get.body as { messages: Array<{ id: string }> }).messages;
    expect(messages.map((message) => message.id)).toContain(created.id);
  });
});

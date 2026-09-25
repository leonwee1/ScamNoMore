import { createHash, randomUUID } from 'crypto';
import { mkdirSync } from 'fs';
import { dirname, resolve } from 'path';
import Database from 'better-sqlite3';
import { SCAM_TYPES } from './types';

/** The public, description-free shape consumed by the Expo app. */
export interface PersistedReport {
  id: string;
  dateReported: string;
  scamType: string;
  keywords: string[];
  town: string;
  specificPlace: string;
  source: 'user-report';
  verified: boolean;
  year: number;
}

export interface ReportInput {
  dateReported: string;
  scamType: string;
  town: string;
  description: string;
}

interface StoredReport {
  id: string;
  date_reported: string;
  scam_type: string;
  town: string;
  keywords_json: string;
  verified: number;
}

interface StoredCommunityMessage {
  id: string;
  room_key: string;
  body: string;
  created_at: string;
  participant_hash: string;
}

/** Public anonymous discussion row. There is deliberately no account/profile data. */
export interface CommunityMessage {
  id: string;
  roomKey: string;
  text: string;
  createdAt: string;
  participantKey: string;
}

export interface CommunityMessageCursor {
  createdAt: string;
  id: string;
}

export interface CommunityMessagePage {
  messages: CommunityMessage[];
  /** Cursor for older rows, omitted once the user has reached room history. */
  nextBefore?: CommunityMessageCursor;
}

/** A client mistake that should be returned as HTTP 400, not treated as a server failure. */
export class ReportValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReportValidationError';
  }
}

let database: Database.Database | undefined;
let openedPath: string | undefined;

const MAX_FIELD_CHARS = 100;
const MAX_DESCRIPTION_CHARS = 4_000;
const MAX_DESCRIPTION_WORDS = 200;
const MAX_COMMUNITY_MESSAGE_CHARS = 500;
const MAX_PARTICIPANT_ID_CHARS = 128;

/** Natural-looking starter conversations shown in each room on first startup. */
const COMMUNITY_SEED_MESSAGES: Record<string, readonly string[]> = {
  'Phishing Scam': [
    'I received a message saying my bank account would be frozen unless I opened a link. I did not tap it.',
    'That is a common phishing tactic. I checked the bank app directly and there was no alert at all.',
    'Good call. For anything involving an account, I now use the number on my bank card instead of the message link.',
  ],
  'Investment Scam': [
    'A Telegram group is promising guaranteed returns if I deposit at least $500 today. Has anyone seen this?',
    'The guarantee and the rush are major red flags. Legitimate investments can lose value and do not need a same-day deposit.',
    'They also asked me to pay a fee before withdrawing my “profits”. I stopped replying and reported the account.',
  ],
  'Job Scam': [
    'A recruiter offered easy online tasks, but wants a deposit before I can receive the first assignment.',
    'Do not pay to get paid. I would verify the company through its official website and contact details.',
    'The recruiter kept changing the group name and would not arrange a proper interview, so I blocked the number.',
  ],
  'Romance Scam': [
    'Someone I met online says they are overseas and needs an urgent loan for a medical bill.',
    'Have you had a live video call with them? A sudden emergency followed by a money request is a familiar pattern.',
    'We have never met in person. I will not send money or identity documents, even though the messages sound caring.',
  ],
  'E-commerce Scam': [
    'The seller offered a new phone at half price and asked for PayNow before meeting. The listing disappeared after I asked questions.',
    'Do not pay outside the platform or before checking the item. A very large discount can be a warning sign.',
    'I reported the listing and saved the chat screenshots. The seller had copied photos from another shop.',
  ],
  'Government Officials Impersonation Scam': [
    'The caller claimed to be from the police and said I must transfer money to a safe account to clear my name.',
    'The police will not ask you to transfer money to protect an account. Hang up and call the official number yourself.',
    'The caller became threatening when I asked for a case reference, so I ended the call and contacted 1799.',
  ],
  'Loan Scam': [
    'A loan advertisement says approval is guaranteed, but asks for an upfront processing fee and my Singpass login.',
    'Never share Singpass credentials or pay an upfront fee. Check that the lender is licensed through official sources.',
    'I reported the advertisement. The “agent” also asked me to install an app from a link sent over WhatsApp.',
  ],
  'Fake Friend Call Scam': [
    'I got a call from someone claiming to be a friend with a new number and asking me to send money urgently.',
    'Call your friend back using the old saved number or another channel. Do not rely on the caller ID or new number.',
    'I asked a personal question only my friend would know and then checked with their family. It was not them.',
  ],
  'Tech Support Scam': [
    'A pop-up said my computer was infected and told me to call a support number immediately.',
    'Close the pop-up and contact the device maker through its official website. Do not install remote-control software for a stranger.',
    'The caller wanted access to my banking screen, so I disconnected and ran a trusted security check instead.',
  ],
  'Social Media Impersonation': [
    'A second account using my colleague’s photo asked me to vote in a contest and send an OTP.',
    'Verify through a separate channel. An OTP should never be shared for a social-media vote or contest.',
    'The real colleague confirmed the account was fake and reported it. I removed the link from my messages too.',
  ],
  'Rental Scam': [
    'The room looks attractive and cheap, but the “agent” wants a deposit before allowing a viewing.',
    'Do not transfer a deposit before seeing the place and checking the agent and listing independently.',
    'The photos were copied from an old listing in another neighbourhood. I reported it to the platform.',
  ],
  'Inheritance Scam': [
    'An email says I inherited money from someone overseas, but I must pay a lawyer fee before the funds are released.',
    'Unexpected inheritances that require advance fees are usually scams. Do not send money or identity documents.',
    'The sender asked for my bank details and a copy of my passport, so I deleted the email and reported it.',
  ],
  'Lottery Scam': [
    'I was told I won a prize in a draw I never entered and need to pay tax before collecting it.',
    'A real prize does not require you to pay a fee through an unexpected message. Do not click the payment link.',
    'The message used a familiar brand logo but came from a strange address. I checked the official website and found no such draw.',
  ],
  Others: [
    'The message asks me to scan a QR code to “verify” my identity before a delivery can be completed.',
    'I would verify the delivery in the official app instead. QR codes can lead to fake payment or login pages.',
    'There is no matching order in my account, so I did not scan it and reported the message as suspicious.',
  ],
};
// These are the canonical town values offered by the Expo report picker. Do
// not let a modified public client publish arbitrary location text into Search.
const SUPPORTED_TOWNS = [
  'Ang Mo Kio', 'Balestier', 'Bedok', 'Bishan', 'Boon Lay', 'Bugis', 'Bukit Merah',
  'Bukit Timah', 'Changi', 'Chinatown', 'Clementi', 'Dhoby Ghaut', 'Geylang',
  'Holland Village', 'Hougang', 'Jurong East', 'Jurong West', 'Kallang', 'Katong',
  'Marina Bay', 'Newton', 'Novena', 'Orchard', 'Others', 'Outram', 'Pasir Ris',
  'Paya Lebar', 'Punggol', 'Queenstown', 'Raffles Place', 'Redhill', 'Sengkang',
  'Serangoon', 'Somerset', 'Tampines', 'Tanjong Pagar', 'Telok Blangah',
  'Toa Payoh', 'Woodlands', 'Yishun',
] as const;

/**
 * The Render service sets REPORTS_DB_PATH to its persistent disk. Locally, keep
 * the database beside the backend rather than in the Expo app, so every phone
 * reaches the same rows through the API.
 */
function reportsDbPath(): string {
  const configured = process.env.REPORTS_DB_PATH?.trim();
  return configured || resolve(process.cwd(), 'data', 'scamnomore.sqlite');
}

function openDatabase(): Database.Database {
  const path = reportsDbPath();
  if (database && openedPath === path) return database;

  // This only occurs in tests when the configured DB changes between cases.
  if (database) {
    database.close();
    database = undefined;
    openedPath = undefined;
  }

  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });

  const next = new Database(path);
  // WAL keeps readers responsive while another phone submits a report. The
  // timeout turns a short concurrent write into a wait rather than SQLITE_BUSY.
  next.pragma('journal_mode = WAL');
  next.pragma('busy_timeout = 5000');
  next.pragma('foreign_keys = ON');
  next.exec(`
    CREATE TABLE IF NOT EXISTS incident_reports (
      id TEXT PRIMARY KEY,
      date_reported TEXT NOT NULL,
      scam_type TEXT NOT NULL,
      town TEXT NOT NULL,
      description TEXT NOT NULL,
      keywords_json TEXT NOT NULL,
      verified INTEGER NOT NULL DEFAULT 0 CHECK (verified IN (0, 1)),
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_incident_reports_created_at
      ON incident_reports (created_at DESC);

    CREATE TABLE IF NOT EXISTS community_messages (
      id TEXT PRIMARY KEY,
      room_key TEXT NOT NULL,
      body TEXT NOT NULL,
      created_at TEXT NOT NULL,
      participant_hash TEXT NOT NULL DEFAULT ''
    );

    CREATE INDEX IF NOT EXISTS idx_community_messages_room_created_at
      ON community_messages (room_key, created_at DESC, id DESC);

    -- Older development builds derived public keywords from report descriptions.
    -- Clear them during every idempotent startup migration so an existing Render
    -- disk cannot continue exposing a phone number, OTP, NRIC, or other token.
    UPDATE incident_reports SET keywords_json = '[]' WHERE keywords_json <> '[]';
  `);

  // Migrate databases created before anonymous participant labels existed.
  // Only a one-way room-scoped hash is retained; the client token and any
  // personal identity never reach SQLite.
  const communityColumns = next
    .prepare('PRAGMA table_info(community_messages)')
    .all() as Array<{ name: string }>;
  if (!communityColumns.some((column) => column.name === 'participant_hash')) {
    next.exec('ALTER TABLE community_messages ADD COLUMN participant_hash TEXT');
  }
  const legacyRows = next
    .prepare(
      `SELECT id, room_key
       FROM community_messages
       WHERE participant_hash IS NULL OR participant_hash = ''`
    )
    .all() as Array<{ id: string; room_key: string }>;
  if (legacyRows.length > 0) {
    const updateParticipant = next.prepare(
      'UPDATE community_messages SET participant_hash = @participant_hash WHERE id = @id'
    );
    const migrateParticipants = next.transaction(() => {
      for (const row of legacyRows) {
        const seedMatch = /^community-seed-.+-(\d+)$/.exec(row.id);
        const participantId = seedMatch
          ? `seed-${((Number(seedMatch[1]) - 1) % 3) + 1}`
          : `legacy-${row.id}`;
        updateParticipant.run({
          id: row.id,
          participant_hash: participantHash(row.room_key, participantId),
        });
      }
    });
    migrateParticipants();
  }

  seedCommunityMessages(next);

  database = next;
  openedPath = path;
  return next;
}

/** Insert deterministic starter rows without duplicating them on restart. */
function seedCommunityMessages(db: Database.Database): void {
  const insert = db.prepare(
    `INSERT OR IGNORE INTO community_messages
      (id, room_key, body, created_at, participant_hash)
     VALUES (@id, @room_key, @body, @created_at, @participant_hash)`
  );
  const seed = db.transaction(() => {
    for (const [roomKey, messages] of Object.entries(COMMUNITY_SEED_MESSAGES)) {
      const slug = roomKey.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      messages.forEach((body, index) => {
        insert.run({
          id: `community-seed-${slug}-${index + 1}`,
          room_key: roomKey,
          body,
          created_at: new Date(Date.now() - (messages.length - index) * 60_000).toISOString(),
          participant_hash: participantHash(roomKey, `seed-${(index % 3) + 1}`),
        });
      });
    }
  });
  seed();
}

/** Create/migrate the database at service startup (the Render disk is runtime-only). */
export function initializeReportsDb(): void {
  openDatabase();
}

function requiredText(value: unknown, name: string, maxChars: number): string {
  if (typeof value !== 'string') throw new ReportValidationError(`Missing "${name}"`);
  const trimmed = value.trim();
  if (!trimmed) throw new ReportValidationError(`Missing "${name}"`);
  if (trimmed.length > maxChars) {
    throw new ReportValidationError(`"${name}" must be at most ${maxChars} characters`);
  }
  return trimmed;
}

function validateDate(value: unknown): string {
  const date = requiredText(value, 'dateReported', 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new ReportValidationError('"dateReported" must use YYYY-MM-DD');
  }

  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    throw new ReportValidationError('"dateReported" is not a real calendar date');
  }
  if (date > new Date().toISOString().slice(0, 10)) {
    throw new ReportValidationError('"dateReported" cannot be in the future');
  }
  return date;
}

function supportedValue(value: unknown, name: string, allowed: readonly string[]): string {
  const text = requiredText(value, name, MAX_FIELD_CHARS);
  if (!allowed.includes(text)) {
    throw new ReportValidationError(`"${name}" is not a supported value`);
  }
  return text;
}

function validateInput(value: unknown): ReportInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ReportValidationError('Request body must be an object');
  }

  const input = value as Record<string, unknown>;
  const description = requiredText(input.description, 'description', MAX_DESCRIPTION_CHARS);
  const words = description.split(/\s+/).filter(Boolean).length;
  if (words > MAX_DESCRIPTION_WORDS) {
    throw new ReportValidationError(`"description" must be at most ${MAX_DESCRIPTION_WORDS} words`);
  }

  return {
    dateReported: validateDate(input.dateReported),
    scamType: supportedValue(input.scamType, 'scamType', SCAM_TYPES),
    town: supportedValue(input.town, 'town', SUPPORTED_TOWNS),
    description,
  };
}

function toPublicReport(row: StoredReport): PersistedReport {
  let keywords: string[] = [];
  try {
    const parsed = JSON.parse(row.keywords_json) as unknown;
    if (Array.isArray(parsed)) keywords = parsed.filter((keyword): keyword is string => typeof keyword === 'string');
  } catch {
    // A corrupt keyword column should not make every device unable to fetch reports.
    keywords = [];
  }

  return {
    id: row.id,
    dateReported: row.date_reported,
    scamType: row.scam_type,
    keywords,
    town: row.town,
    specificPlace: row.town,
    source: 'user-report',
    verified: Boolean(row.verified),
    year: Number.parseInt(row.date_reported.slice(0, 4), 10),
  };
}

/** Persist one report. The server—not the phone—assigns every public metadata field. */
export function createReport(value: unknown): PersistedReport {
  const input = validateInput(value);
  const row: StoredReport = {
    id: `user-report-${randomUUID()}`,
    date_reported: input.dateReported,
    scam_type: input.scamType,
    town: input.town,
    // Descriptions may contain personal data. Store them for a future private
    // review workflow, but never derive free-text tokens that GET /reports
    // could expose to every Expo user.
    keywords_json: '[]',
    verified: 0,
  };

  openDatabase()
    .prepare(
      `INSERT INTO incident_reports
        (id, date_reported, scam_type, town, description, keywords_json, verified, created_at)
       VALUES (@id, @date_reported, @scam_type, @town, @description, @keywords_json, @verified, @created_at)`
    )
    .run({ ...row, description: input.description, created_at: new Date().toISOString() });

  return toPublicReport(row);
}

/** Return every server-persisted report, newest first, without its private description. */
export function listReports(): PersistedReport[] {
  const rows = openDatabase()
    .prepare(
      `SELECT id, date_reported, scam_type, town, keywords_json, verified
       FROM incident_reports
       ORDER BY created_at DESC, id DESC`
    )
    .all() as StoredReport[];
  return rows.map(toPublicReport);
}

function validateCommunityRoom(value: unknown): string {
  const roomKey = requiredText(value, 'roomKey', MAX_FIELD_CHARS);
  if (!(SCAM_TYPES as readonly string[]).includes(roomKey)) {
    throw new ReportValidationError('"roomKey" is not a supported community room');
  }
  return roomKey;
}

/** Hash the device token separately for each room to limit cross-room linking. */
function participantHash(roomKey: string, participantId: string): string {
  return createHash('sha256').update(`${roomKey}\u0000${participantId}`).digest('hex');
}

function participantKey(hash: string): string {
  return hash.slice(0, 4).toUpperCase();
}

function toCommunityMessage(row: StoredCommunityMessage): CommunityMessage {
  return {
    id: row.id,
    roomKey: row.room_key,
    text: row.body,
    createdAt: row.created_at,
    participantKey: participantKey(row.participant_hash),
  };
}

/** Persist an anonymous, shared room message. No user identity is collected. */
export function createCommunityMessage(value: unknown): CommunityMessage {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ReportValidationError('Request body must be an object');
  }
  const input = value as Record<string, unknown>;
  const roomKey = validateCommunityRoom(input.roomKey);
  const text = requiredText(input.text, 'text', MAX_COMMUNITY_MESSAGE_CHARS);
  const participantId =
    input.participantId === undefined
      ? `legacy-${randomUUID()}`
      : requiredText(input.participantId, 'participantId', MAX_PARTICIPANT_ID_CHARS);

  const row: StoredCommunityMessage = {
    id: `community-message-${randomUUID()}`,
    room_key: roomKey,
    body: text,
    created_at: new Date().toISOString(),
    participant_hash: participantHash(roomKey, participantId),
  };
  openDatabase()
    .prepare(
      `INSERT INTO community_messages
        (id, room_key, body, created_at, participant_hash)
       VALUES (@id, @room_key, @body, @created_at, @participant_hash)`
    )
    .run(row);
  return toCommunityMessage(row);
}

function communityCursor(createdAtValue: unknown, idValue: unknown): CommunityMessageCursor | undefined {
  if (createdAtValue === undefined && idValue === undefined) return undefined;
  const createdAt = requiredText(createdAtValue, 'beforeCreatedAt', 40);
  const id = requiredText(idValue, 'beforeId', 100);
  if (Number.isNaN(Date.parse(createdAt))) {
    throw new ReportValidationError('"beforeCreatedAt" must be an ISO timestamp');
  }
  return { createdAt, id };
}

/** Fetch one chronological page of a discussion room, newest page first. */
export function listCommunityMessagePage(
  roomValue: unknown,
  beforeCreatedAt?: unknown,
  beforeId?: unknown
): CommunityMessagePage {
  const roomKey = validateCommunityRoom(roomValue);
  const before = communityCursor(beforeCreatedAt, beforeId);
  const rows = (before
    ? openDatabase()
        .prepare(
          `SELECT id, room_key, body, created_at, participant_hash
           FROM community_messages
           WHERE room_key = ? AND (created_at < ? OR (created_at = ? AND id < ?))
           ORDER BY created_at DESC, id DESC
           LIMIT 51`
        )
        .all(roomKey, before.createdAt, before.createdAt, before.id)
    : openDatabase()
        .prepare(
          `SELECT id, room_key, body, created_at, participant_hash
           FROM community_messages
           WHERE room_key = ?
           ORDER BY created_at DESC, id DESC
           LIMIT 51`
        )
        .all(roomKey)) as StoredCommunityMessage[];

  const window = rows.slice(0, 50);
  const oldestReturned = window[window.length - 1];
  return {
    messages: window.reverse().map(toCommunityMessage),
    ...(rows.length > window.length && oldestReturned
      ? { nextBefore: { createdAt: oldestReturned.created_at, id: oldestReturned.id } }
      : {}),
  };
}

/** Convenience first page, retained for internal callers/tests. */
export function listCommunityMessages(roomValue: unknown): CommunityMessage[] {
  return listCommunityMessagePage(roomValue).messages;
}

/** Test-only cleanup so each test can open a fresh database path. */
export function _closeReportsDbForTests(): void {
  if (database) database.close();
  database = undefined;
  openedPath = undefined;
}

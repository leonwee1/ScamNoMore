/**
 * In-memory rate limiting — two layers that protect your OpenAI bill:
 *
 *   1. BURST  : per-client requests in a short sliding window (stops hammering).
 *   2. DAILY  : total requests per client per day.
 *   3. GLOBAL : an absolute service-wide cap, so a caller cannot evade the
 *               per-client bucket by presenting invented forwarded-IP values.
 *
 * In-memory state is fine for a single Render instance. If you ever scale to
 * multiple instances, move these counters to Redis — each instance would
 * otherwise keep its own tally.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Read limits from the environment on each call rather than at module load, so
 * configuration is picked up reliably (and tests stay deterministic instead of
 * depending on whatever was in the environment when the module was first
 * imported).
 */
function limits() {
  const num = (name: string, fallback: number) => {
    const v = Number(process.env[name]);
    return Number.isFinite(v) && v > 0 ? v : fallback;
  };
  return {
    burstMax: num('RATE_LIMIT_BURST_MAX', 15),
    burstWindowMs: num('RATE_LIMIT_BURST_WINDOW_MS', 60_000),
    dailyMax: num('RATE_LIMIT_DAILY_MAX', 200),
    globalBurstMax: num('RATE_LIMIT_GLOBAL_BURST_MAX', 60),
    globalDailyMax: num('RATE_LIMIT_GLOBAL_DAILY_MAX', 250),
  };
}

interface Bucket {
  /** Timestamps within the burst window. */
  recent: number[];
  /** Count since dayStart. */
  dayCount: number;
  dayStart: number;
}

const buckets = new Map<string, Bucket>();
let globalBucket: Bucket | undefined;

/** Drop idle clients so the map cannot grow without bound. */
function prune(now: number): void {
  for (const [key, b] of buckets) {
    const idle = now - (b.recent[b.recent.length - 1] ?? 0) > DAY_MS;
    if (idle && now - b.dayStart > DAY_MS) buckets.delete(key);
  }
}
let lastPrune = Date.now();

export interface RateLimitResult {
  allowed: boolean;
  /** Seconds the client should wait before retrying. */
  retryAfter?: number;
  reason?: string;
  remaining?: number;
}

/**
 * Record a request for `clientId` and decide whether to allow it.
 * `clientId` should be the caller's IP (see clientIdFrom).
 */
export function checkRateLimit(clientId: string, now = Date.now()): RateLimitResult {
  const { burstMax: BURST_MAX, burstWindowMs: BURST_WINDOW_MS, dailyMax: DAILY_MAX } = limits();

  if (now - lastPrune > 60 * 60 * 1000) {
    prune(now);
    lastPrune = now;
  }

  let bucket = buckets.get(clientId);
  if (!bucket) {
    bucket = { recent: [], dayCount: 0, dayStart: now };
    buckets.set(clientId, bucket);
  }

  // Roll the daily window.
  if (now - bucket.dayStart >= DAY_MS) {
    bucket.dayStart = now;
    bucket.dayCount = 0;
  }

  // Daily cap first — it is the real cost guard.
  if (bucket.dayCount >= DAILY_MAX) {
    const retryAfter = Math.ceil((bucket.dayStart + DAY_MS - now) / 1000);
    return {
      allowed: false,
      retryAfter,
      reason: `Daily limit of ${DAILY_MAX} requests reached. Try again later.`,
    };
  }

  // Burst window.
  bucket.recent = bucket.recent.filter((t) => now - t < BURST_WINDOW_MS);
  if (bucket.recent.length >= BURST_MAX) {
    const oldest = bucket.recent[0];
    const retryAfter = Math.max(1, Math.ceil((oldest + BURST_WINDOW_MS - now) / 1000));
    return {
      allowed: false,
      retryAfter,
      reason: `Too many requests. Please wait ${retryAfter}s.`,
    };
  }

  bucket.recent.push(now);
  bucket.dayCount += 1;

  return {
    allowed: true,
    remaining: Math.max(0, BURST_MAX - bucket.recent.length),
  };
}

/**
 * Service-wide ceiling. Keep this independent of the client identifier: a
 * public app bundle can reveal its shared secret and callers can forge ordinary
 * forwarding headers, but neither lets them create more global allowance.
 */
export function checkGlobalRateLimit(now = Date.now()): RateLimitResult {
  const { globalBurstMax: BURST_MAX, burstWindowMs: BURST_WINDOW_MS, globalDailyMax: DAILY_MAX } = limits();

  if (!globalBucket) globalBucket = { recent: [], dayCount: 0, dayStart: now };

  if (now - globalBucket.dayStart >= DAY_MS) {
    globalBucket.dayStart = now;
    globalBucket.dayCount = 0;
  }

  if (globalBucket.dayCount >= DAILY_MAX) {
    const retryAfter = Math.ceil((globalBucket.dayStart + DAY_MS - now) / 1000);
    return {
      allowed: false,
      retryAfter,
      reason: `Service daily limit of ${DAILY_MAX} requests reached. Try again later.`,
    };
  }

  globalBucket.recent = globalBucket.recent.filter((t) => now - t < BURST_WINDOW_MS);
  if (globalBucket.recent.length >= BURST_MAX) {
    const oldest = globalBucket.recent[0];
    const retryAfter = Math.max(1, Math.ceil((oldest + BURST_WINDOW_MS - now) / 1000));
    return {
      allowed: false,
      retryAfter,
      reason: `Service is busy. Please wait ${retryAfter}s.`,
    };
  }

  globalBucket.recent.push(now);
  globalBucket.dayCount += 1;
  return { allowed: true, remaining: Math.max(0, BURST_MAX - globalBucket.recent.length) };
}

/**
 * Derive a client id from the direct socket peer. Do not trust X-Forwarded-For:
 * a public client can supply that ordinary header itself. On Render the peer is
 * commonly the edge proxy, which merely makes the per-client bucket more
 * conservative; the separate global cap remains the actual bill guard.
 */
export function clientIdFrom(
  headers: Record<string, string | string[] | undefined>,
  socketAddress?: string
): string {
  void headers;
  return socketAddress ?? 'unknown';
}

/** Current limits, for /health and tests. */
export function rateLimitConfig() {
  return limits();
}

/** Clear all counters (tests only). */
export function _resetRateLimits(): void {
  buckets.clear();
  globalBucket = undefined;
}

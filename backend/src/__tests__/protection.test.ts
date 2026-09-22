import { AUTH_HEADER, authEnabled, checkAuth } from '../lib/auth';
import { _resetRateLimits, checkRateLimit, clientIdFrom } from '../lib/rateLimit';

const ORIGINAL_ENV = { ...process.env };

// Pin the limits explicitly so these tests never depend on whatever happens to
// be in the developer's / CI's environment.
const BURST_MAX = 15;
const DAILY_MAX = 200;

beforeEach(() => {
  delete process.env.APP_SHARED_SECRET;
  process.env.RATE_LIMIT_BURST_MAX = String(BURST_MAX);
  process.env.RATE_LIMIT_BURST_WINDOW_MS = '60000';
  process.env.RATE_LIMIT_DAILY_MAX = String(DAILY_MAX);
  _resetRateLimits();
});

afterAll(() => {
  process.env = ORIGINAL_ENV;
});

describe('shared-secret auth', () => {
  it('allows everything when no secret is configured (local dev)', () => {
    delete process.env.APP_SHARED_SECRET;
    expect(authEnabled()).toBe(false);
    expect(checkAuth(undefined).allowed).toBe(true);
  });

  it('is reported as enabled once a secret is set', () => {
    process.env.APP_SHARED_SECRET = 'topsecret';
    expect(authEnabled()).toBe(true);
  });

  it('accepts the correct secret', () => {
    process.env.APP_SHARED_SECRET = 'topsecret';
    expect(checkAuth('topsecret').allowed).toBe(true);
  });

  it('rejects a missing header', () => {
    process.env.APP_SHARED_SECRET = 'topsecret';
    const r = checkAuth(undefined);
    expect(r.allowed).toBe(false);
    expect(r.reason).toContain(AUTH_HEADER);
  });

  it('rejects a wrong secret', () => {
    process.env.APP_SHARED_SECRET = 'topsecret';
    expect(checkAuth('guess').allowed).toBe(false);
  });

  it('rejects a secret of different length without throwing', () => {
    // timingSafeEqual requires equal lengths; the wrapper must handle that.
    process.env.APP_SHARED_SECRET = 'topsecret';
    expect(() => checkAuth('short')).not.toThrow();
    expect(checkAuth('short').allowed).toBe(false);
  });

  it('tolerates surrounding whitespace in the header', () => {
    process.env.APP_SHARED_SECRET = 'topsecret';
    expect(checkAuth('  topsecret  ').allowed).toBe(true);
  });
});

describe('rate limiting', () => {
  it('allows requests under the burst limit', () => {
    for (let i = 0; i < 10; i++) {
      expect(checkRateLimit('1.1.1.1').allowed).toBe(true);
    }
  });

  it('blocks once the burst limit is exceeded', () => {
    const max = BURST_MAX;
    for (let i = 0; i < max; i++) checkRateLimit('2.2.2.2');
    const blocked = checkRateLimit('2.2.2.2');
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfter).toBeGreaterThan(0);
    expect(blocked.reason).toMatch(/Too many requests/);
  });

  it('tracks clients independently', () => {
    const max = BURST_MAX;
    for (let i = 0; i < max; i++) checkRateLimit('3.3.3.3');
    expect(checkRateLimit('3.3.3.3').allowed).toBe(false);
    // A different client is unaffected.
    expect(checkRateLimit('4.4.4.4').allowed).toBe(true);
  });

  it('recovers after the burst window slides past', () => {
    const max = BURST_MAX;
    const t0 = 1_000_000;
    for (let i = 0; i < max; i++) checkRateLimit('5.5.5.5', t0);
    expect(checkRateLimit('5.5.5.5', t0).allowed).toBe(false);
    // 61s later the window has rolled over.
    expect(checkRateLimit('5.5.5.5', t0 + 61_000).allowed).toBe(true);
  });

  it('enforces the daily cap even when requests are spread out', () => {
    const dailyMax = DAILY_MAX;
    let t = 2_000_000;
    let allowed = 0;
    // Space requests a minute apart so the burst limit never trips.
    for (let i = 0; i < dailyMax + 5; i++) {
      if (checkRateLimit('6.6.6.6', t).allowed) allowed++;
      t += 61_000;
    }
    expect(allowed).toBe(dailyMax);
    const blocked = checkRateLimit('6.6.6.6', t);
    expect(blocked.allowed).toBe(false);
    expect(blocked.reason).toMatch(/Daily limit/);
  });
});

describe('clientIdFrom', () => {
  it('prefers the first x-forwarded-for entry (the real client behind Render)', () => {
    expect(clientIdFrom({ 'x-forwarded-for': '203.0.113.7, 10.0.0.1' }, '10.0.0.1')).toBe(
      '203.0.113.7'
    );
  });

  it('handles a header array', () => {
    expect(clientIdFrom({ 'x-forwarded-for': ['198.51.100.2'] }, '10.0.0.1')).toBe('198.51.100.2');
  });

  it('falls back to the socket address', () => {
    expect(clientIdFrom({}, '192.168.1.5')).toBe('192.168.1.5');
  });

  it('falls back to "unknown" when nothing is available', () => {
    expect(clientIdFrom({})).toBe('unknown');
  });
});

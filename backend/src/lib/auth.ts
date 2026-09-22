import { timingSafeEqual } from 'crypto';

/**
 * Shared-secret authentication.
 *
 * The app sends `x-app-secret: <secret>` on every request; the server compares it
 * against APP_SHARED_SECRET.
 *
 * HONEST LIMITATION: a secret shipped inside a mobile app is not truly secret —
 * someone who extracts the JS bundle can read it. What this DOES stop is casual
 * abuse: a bot or passer-by who discovers the public URL cannot use your OpenAI
 * quota. Combined with rate limiting that is a reasonable guard for a demo. For
 * anything stronger you need per-user accounts and server-issued tokens.
 */

export const AUTH_HEADER = 'x-app-secret';

/** True when a secret is configured and therefore enforced. */
export function authEnabled(): boolean {
  return Boolean(process.env.APP_SHARED_SECRET?.trim());
}

/** Constant-time compare so the check can't be brute-forced by timing. */
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export interface AuthResult {
  allowed: boolean;
  reason?: string;
}

/**
 * Check a request's secret. When APP_SHARED_SECRET is unset (local development)
 * everything is allowed, and the server prints a prominent startup warning.
 */
export function checkAuth(headerValue: string | undefined): AuthResult {
  const expected = process.env.APP_SHARED_SECRET?.trim();
  if (!expected) return { allowed: true }; // dev mode: no secret configured

  const provided = headerValue?.trim();
  if (!provided) {
    return { allowed: false, reason: `Missing ${AUTH_HEADER} header` };
  }
  if (!safeEqual(provided, expected)) {
    return { allowed: false, reason: 'Invalid app secret' };
  }
  return { allowed: true };
}

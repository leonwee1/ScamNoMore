/**
 * Date helpers.
 *
 * Everything that needs "today" must go through here so the whole app agrees on
 * what day it is, using the DEVICE's clock and timezone as the reference.
 */

/**
 * Today's calendar date on this device, as YYYY-MM-DD.
 *
 * Deliberately built from the LOCAL date parts rather than
 * `new Date().toISOString().slice(0, 10)`. `toISOString()` converts to UTC
 * first, so in Singapore (UTC+8) any moment between 00:00 and 08:00 local time
 * falls on the previous UTC day and would report yesterday's date.
 */
export function deviceToday(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

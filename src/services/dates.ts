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
  return format(now);
}

/** Singapore uses UTC+8 year-round, so the Home greeting stays correct even
 * when the device is configured for another timezone. */
export function singaporeGreetingPeriod(): 'morning' | 'afternoon' | 'evening' {
  const singaporeHour = (new Date().getUTCHours() + 8) % 24;
  if (singaporeHour >= 5 && singaporeHour < 12) return 'morning';
  if (singaporeHour >= 12 && singaporeHour < 18) return 'afternoon';
  return 'evening';
}

/** Format a Date as YYYY-MM-DD using its LOCAL calendar fields. */
function format(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * The date `months` calendar months before today, as YYYY-MM-DD.
 *
 * Used by the Search screen's relative periods ("Past six months"). Built on
 * local date fields for the same reason as deviceToday: a UTC round-trip would
 * shift the boundary by a day for part of every Singapore day.
 *
 * setMonth handles overflow itself, so 31 March minus one month lands on 3 March
 * rather than an invalid 31 February. That is a wider range than a strict
 * calendar month, which is the safe direction for a search filter.
 */
export function monthsAgo(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return format(d);
}

/** A calendar date a number of days before today, using local date fields. */
export function daysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return format(d);
}

/**
 * Every date in MIS is a plain `YYYY-MM-DD` string, never a Date object — that
 * is what goes into the vault, what charts group by, and what the Daily Log keys
 * "today" on. These helpers are the only place that string is produced on the
 * frontend, so the whole UI agrees on what day it is.
 *
 * **They must agree with Rust as well.** `src-tauri/src/dates.rs` builds the
 * same string from the machine's *local* calendar date. The old app built it
 * with `new Date().toISOString().split('T')[0]`, which converts to UTC first —
 * in India (UTC+05:30) that returned yesterday's date every night between
 * midnight and 05:30. The version below reads the local fields directly, so a
 * log written at 1 a.m. lands on the day it was written and matches the day
 * Rust locks.
 */

const pad = (n: number) => String(n).padStart(2, '0');

/** a Date as `YYYY-MM-DD` in the machine's own timezone */
export const isoOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** the ISO date `n` days before today (`isoDaysAgo(0)` is today) */
export const isoDaysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return isoOf(d);
};

/** today as `YYYY-MM-DD` */
export const todayIso = () => isoOf(new Date());

/** `2026-08-05` → `5 Aug`, the form used on chart axes and row labels */
export const shortDate = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
};

/** `2026-08-05` → `Wednesday, 5 August 2026`, for headings and tooltips */
export const longDate = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
};

/** `2026-08-05` → `Wed`, for the streak matrix */
export const weekdayShort = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'short' });
};

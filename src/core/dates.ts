/**
 * Every date in MIS is a plain `YYYY-MM-DD` string, never a Date object — that
 * is what goes into storage, what charts group by, and what the Daily Log keys
 * "today" on. These two helpers are the only place that string is produced, so
 * the whole app agrees on what day it is.
 */

/** the ISO date `n` days before today (`isoDaysAgo(0)` is today) */
export const isoDaysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
};

/** today as `YYYY-MM-DD` */
export const todayIso = () => isoDaysAgo(0);

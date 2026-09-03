//! Every date in MIS is a plain `YYYY-MM-DD` string, never a timestamp — that
//! is what goes into the vault, what charts group by, and what the Daily Log
//! keys "today" on. These helpers are the only place that string is produced,
//! so the whole app agrees on what day it is.
//!
//! **This fixes a real bug carried over from the old app.** `dates.ts` built the
//! string with `new Date().toISOString().split('T')[0]`, which converts local
//! time to UTC first. MIS is used in India (UTC+05:30), so between midnight and
//! 05:30 local, `todayIso()` returned *yesterday* — the Daily Log would open the
//! wrong day, and a submit could lock a day that had already been locked. The
//! codebase already knew about this class of bug (the spreadsheet importer
//! hand-formats dates for exactly this reason) but `dates.ts` itself was never
//! fixed. Here the date comes from the machine's local calendar directly, so
//! there is no timezone conversion to get wrong.

use chrono::{Datelike, Duration, Local, NaiveDate};

/// The ISO date `n` days before today. `iso_days_ago(0)` is today.
pub fn iso_days_ago(n: i64) -> String {
    (Local::now().date_naive() - Duration::days(n))
        .format("%Y-%m-%d")
        .to_string()
}

/// Today as `YYYY-MM-DD`, in the machine's own timezone.
pub fn today_iso() -> String {
    iso_days_ago(0)
}

/// Now as an ISO-8601 timestamp. The only clock time MIS stores is
/// `submitted_at`, which is why this exists at all.
pub fn now_iso() -> String {
    Local::now().to_rfc3339()
}

/// Parse one of our own date strings back into a calendar date. Returns `None`
/// for anything that is not `YYYY-MM-DD`, so a corrupt row is skipped rather
/// than silently treated as the epoch.
pub fn parse_iso(date: &str) -> Option<NaiveDate> {
    NaiveDate::parse_from_str(date, "%Y-%m-%d").ok()
}

/// A date as a day count, so "is this the day after that one?" is a subtraction.
///
/// The epoch it counts from is irrelevant — only differences are ever compared —
/// which is why this returns a bare number rather than anything calendar-shaped.
pub fn day_number(date: &str) -> Option<i64> {
    parse_iso(date).map(|d| d.num_days_from_ce() as i64)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn days_ago_walks_backwards_one_day_at_a_time() {
        let today = parse_iso(&today_iso()).unwrap();
        let week = parse_iso(&iso_days_ago(7)).unwrap();
        assert_eq!((today - week).num_days(), 7);
    }

    #[test]
    fn today_matches_the_local_calendar_not_utc() {
        // The whole point of this module: the date is the machine's local one.
        assert_eq!(today_iso(), Local::now().format("%Y-%m-%d").to_string());
    }
}

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

/// Tomorrow as `YYYY-MM-DD` — the default due date for a next-session task.
pub fn tomorrow_iso() -> String {
    iso_days_ago(-1)
}

/// Whether `date` is strictly after today. Anything that is not a valid
/// `YYYY-MM-DD` is **not** in the future: an empty or corrupt due date is
/// treated as belonging to today, which is the safe side of the day lock.
pub fn is_after_today(date: &str) -> bool {
    match (parse_iso(date), parse_iso(&today_iso())) {
        (Some(d), Some(today)) => d > today,
        _ => false,
    }
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
    fn tomorrow_is_one_day_after_today() {
        let today = parse_iso(&today_iso()).unwrap();
        let tomorrow = parse_iso(&tomorrow_iso()).unwrap();
        assert_eq!((tomorrow - today).num_days(), 1);
    }

    #[test]
    fn only_a_later_valid_date_counts_as_after_today() {
        assert!(is_after_today(&tomorrow_iso()));
        assert!(!is_after_today(&today_iso()));
        assert!(!is_after_today(&iso_days_ago(1)));
        // an empty or corrupt due date is treated as today, not as the future
        assert!(!is_after_today(""));
        assert!(!is_after_today("not a date"));
    }

    #[test]
    fn today_matches_the_local_calendar_not_utc() {
        // The whole point of this module: the date is the machine's local one.
        assert_eq!(today_iso(), Local::now().format("%Y-%m-%d").to_string());
    }
}

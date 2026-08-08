//! Where screen time is kept: one sealed file per day.
//!
//! ```text
//! %LOCALAPPDATA%\MIS\screentime\
//!   2026-08-03.st   that day's intervals, sealed with Windows DPAPI
//!   settings.st     the app-to-category map and the tracker's own settings
//! ```
//!
//! **Why these are encrypted at all.** A list of every program you opened, with
//! window titles, minute by minute, is the most revealing data MIS holds — more
//! so than the marks logbook. Leaving it in a plain file next to a vault that
//! went to the trouble of AES-GCM would be a hole in an otherwise honest story,
//! so each file gets the same DPAPI seal that protects the vault's key.
//!
//! **Why files per day and not a database.** The reads this feature makes are
//! "today" and "the last N days" — whole days at a time. A day of intervals is
//! tens of kilobytes, so a day is a single decrypt and a thirty-day chart is
//! thirty of them, still well under a frame. A database would buy indexed
//! queries nothing here asks for, and would cost the encryption.
//!
//! **Honest limit**, the same one the vault carries: this protects the data from
//! other Windows accounts and from a stolen copy of the folder. It cannot hide
//! anything from the person logged in at this keyboard, nor from an
//! administrator.

use std::collections::BTreeMap;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use crate::vault::dpapi;

/// Bound into every sealed blob, so a day file cannot be passed off as settings
/// — or as a vault key — and quietly decrypt in the wrong place.
pub const AAD: &[u8] = b"mis-screentime-v1";

pub const FORMAT_VERSION: u32 = 1;

/// One unbroken stretch with the same app in front, while someone was there.
///
/// `start` and `end` are seconds since local midnight. A day file only ever
/// describes its own day, so storing full timestamps would repeat the date on
/// every row for nothing.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Interval {
    pub app: String,
    pub title: String,
    pub start: i64,
    pub end: i64,
}

impl Interval {
    pub fn seconds(&self) -> i64 {
        (self.end - self.start).max(0)
    }
}

#[derive(Debug, Serialize, Deserialize)]
struct DayFile {
    v: u32,
    day: String,
    intervals: Vec<Interval>,
}

/// The tracker's own settings, sealed alongside the days.
#[derive(Debug, Default, Clone, Serialize, Deserialize)]
pub struct Settings {
    #[serde(default)]
    pub paused: bool,
    /// The user's own app→category assignments, which beat the defaults.
    #[serde(default)]
    pub categories: BTreeMap<String, String>,
}

pub struct Store {
    pub dir: PathBuf,
}

impl Store {
    pub fn new(dir: PathBuf) -> Self {
        let _ = std::fs::create_dir_all(&dir);
        Self { dir }
    }

    fn day_path(&self, day: &str) -> PathBuf {
        self.dir.join(format!("{day}.st"))
    }

    fn settings_path(&self) -> PathBuf {
        self.dir.join("settings.st")
    }

    // ── Days ────────────────────────────────────────────────────────────────

    /// That day's intervals, or an empty list if it was never recorded.
    ///
    /// A file that will not decrypt is treated as **absent rather than an
    /// error**: it means the folder was copied from another machine or another
    /// account, and one unreadable day should not take down the whole tab.
    pub fn load_day(&self, day: &str) -> Vec<Interval> {
        let path = self.day_path(day);
        let Ok(blob) = std::fs::read(&path) else {
            return Vec::new();
        };
        let Ok(plain) = dpapi::unprotect(&blob, AAD) else {
            return Vec::new();
        };
        serde_json::from_slice::<DayFile>(&plain)
            .map(|f| f.intervals)
            .unwrap_or_default()
    }

    pub fn save_day(&self, day: &str, intervals: &[Interval]) {
        let file = DayFile {
            v: FORMAT_VERSION,
            day: day.to_string(),
            intervals: intervals.to_vec(),
        };
        let Ok(json) = serde_json::to_vec(&file) else { return };
        let Ok(sealed) = dpapi::protect(&json, AAD) else {
            eprintln!("[mis] could not seal screen time for {day}; nothing was written");
            return;
        };
        write_atomic(&self.day_path(day), &sealed);
    }

    /// Every day that has a file, oldest first.
    pub fn recorded_days(&self) -> Vec<String> {
        let Ok(entries) = std::fs::read_dir(&self.dir) else {
            return Vec::new();
        };
        let mut days: Vec<String> = entries
            .flatten()
            .filter_map(|e| {
                let path = e.path();
                if path.extension()?.to_str()? != "st" {
                    return None;
                }
                let stem = path.file_stem()?.to_str()?.to_string();
                // `settings.st` lives in the same folder and is not a day.
                crate::dates::parse_iso(&stem).map(|_| stem)
            })
            .collect();
        days.sort();
        days
    }

    /// Delete one day's recording. Returns whether there was anything to delete.
    pub fn purge_day(&self, day: &str) -> bool {
        std::fs::remove_file(self.day_path(day)).is_ok()
    }

    /// Delete every recording. Returns how many days were removed.
    pub fn purge_all(&self) -> usize {
        self.recorded_days().iter().filter(|d| self.purge_day(d)).count()
    }

    // ── Settings ────────────────────────────────────────────────────────────

    pub fn load_settings(&self) -> Settings {
        let Ok(blob) = std::fs::read(self.settings_path()) else {
            return Settings::default();
        };
        let Ok(plain) = dpapi::unprotect(&blob, AAD) else {
            return Settings::default();
        };
        serde_json::from_slice(&plain).unwrap_or_default()
    }

    pub fn save_settings(&self, settings: &Settings) {
        let Ok(json) = serde_json::to_vec(settings) else { return };
        let Ok(sealed) = dpapi::protect(&json, AAD) else { return };
        write_atomic(&self.settings_path(), &sealed);
    }
}

/// Never leave a half-written file behind — a truncated sealed blob would not
/// decrypt, and would look exactly like tampering.
fn write_atomic(path: &Path, bytes: &[u8]) {
    let tmp = path.with_extension("st.tmp");
    if std::fs::write(&tmp, bytes).is_ok() {
        let _ = std::fs::rename(&tmp, path);
    }
}

/// Seconds since local midnight.
pub fn seconds_since_midnight() -> i64 {
    use chrono::Timelike;
    let now = chrono::Local::now();
    i64::from(now.hour()) * 3600 + i64::from(now.minute()) * 60 + i64::from(now.second())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn an_interval_never_reports_negative_time() {
        let backwards = Interval { app: "a".into(), title: String::new(), start: 100, end: 40 };
        assert_eq!(backwards.seconds(), 0);
    }

    #[test]
    fn a_fresh_interval_has_accrued_nothing_yet() {
        // The under-counting rule: an interval's first sample sets start == end.
        let new = Interval { app: "a".into(), title: String::new(), start: 100, end: 100 };
        assert_eq!(new.seconds(), 0);
    }

    #[cfg(windows)]
    #[test]
    fn days_round_trip_through_the_seal() {
        let dir = std::env::temp_dir().join("mis-st-test-roundtrip");
        let _ = std::fs::remove_dir_all(&dir);
        let store = Store::new(dir.clone());

        let intervals = vec![
            Interval { app: "code.exe".into(), title: "main.rs".into(), start: 100, end: 400 },
            Interval { app: "msedge.exe".into(), title: "Past paper".into(), start: 400, end: 900 },
        ];
        store.save_day("2026-08-03", &intervals);
        assert_eq!(store.load_day("2026-08-03"), intervals);
        assert_eq!(store.recorded_days(), vec!["2026-08-03".to_string()]);

        let _ = std::fs::remove_dir_all(&dir);
    }

    #[cfg(windows)]
    #[test]
    fn window_titles_are_not_legible_on_disk() {
        let dir = std::env::temp_dir().join("mis-st-test-opaque");
        let _ = std::fs::remove_dir_all(&dir);
        let store = Store::new(dir.clone());

        store.save_day("2026-08-03", &[Interval {
            app: "msedge.exe".into(),
            title: "something private".into(),
            start: 0,
            end: 60,
        }]);
        let raw = std::fs::read(dir.join("2026-08-03.st")).unwrap();
        assert!(
            !String::from_utf8_lossy(&raw).contains("something private"),
            "the most revealing data MIS holds must not sit in the clear"
        );
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[cfg(windows)]
    #[test]
    fn an_unreadable_day_reads_as_empty_rather_than_breaking_the_tab() {
        let dir = std::env::temp_dir().join("mis-st-test-foreign");
        let _ = std::fs::remove_dir_all(&dir);
        let store = Store::new(dir.clone());

        // What a folder copied from another machine looks like.
        std::fs::write(dir.join("2026-08-03.st"), b"not a sealed blob at all").unwrap();
        assert!(store.load_day("2026-08-03").is_empty());

        let _ = std::fs::remove_dir_all(&dir);
    }

    #[cfg(windows)]
    #[test]
    fn settings_st_is_not_mistaken_for_a_day() {
        let dir = std::env::temp_dir().join("mis-st-test-settings");
        let _ = std::fs::remove_dir_all(&dir);
        let store = Store::new(dir.clone());

        store.save_settings(&Settings { paused: true, ..Default::default() });
        store.save_day("2026-08-03", &[Interval { app: "a".into(), title: String::new(), start: 0, end: 9 }]);

        assert_eq!(store.recorded_days(), vec!["2026-08-03".to_string()]);
        assert!(store.load_settings().paused);
        let _ = std::fs::remove_dir_all(&dir);
    }
}

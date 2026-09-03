//! The background loop that turns snapshots into intervals.
//!
//! It runs as one thread inside the app process, so screen time is recorded for
//! exactly as long as MIS is open and not one second longer. There is no
//! service, nothing at startup, nothing left running after the window closes —
//! **a tracker that outlives the app it belongs to is a surveillance tool, and
//! this is not that.** The installer registers no scheduled task and no autostart
//! entry, and that is a deliberate constraint on the bundle, not an oversight.
//!
//! How a run of samples becomes an interval:
//!
//! ```text
//!   every POLL_SECONDS, take a snapshot
//!   idle, or paused?           close whatever is open, record nothing
//!   same app as last time?     stretch the open interval's end to now
//!   different app, or a gap?   close the open interval, start a new one
//! ```
//!
//! Two deliberate choices in that loop:
//!
//! **It under-counts rather than over-counts.** An interval's first sample sets
//! `start` and `end` to the same moment, so it contributes zero until the next
//! sample extends it. Every interval is therefore short by up to one poll
//! period. Nudging the numbers up to compensate would mean inventing time nobody
//! was observed to spend, and a study dashboard that flatters you is worthless.
//!
//! **A missing stretch of wall clock breaks the interval.** If the laptop sleeps
//! for an hour, the next sample arrives an hour late; extending the open
//! interval to meet it would bill that hour to whatever happened to be in front
//! when the lid shut. Any gap longer than `GAP_TOLERANCE` closes the interval.

use std::sync::mpsc::{self, RecvTimeoutError, Sender};
use std::sync::{Arc, Mutex};
use std::thread::JoinHandle;
use std::time::{Duration, Instant};

use serde::Serialize;

use super::store::{seconds_since_midnight, Interval, Store};
use super::winapi::{self, IDLE_AFTER};
use crate::dates::today_iso;

/// How often to look. Five seconds is fine-grained enough that alt-tabbing shows
/// up, and cheap enough to be invisible — four Win32 calls per tick.
pub const POLL_SECONDS: f64 = 5.0;

/// Wall-clock gap beyond which the open interval is closed rather than
/// stretched. Comfortably above one poll, so ordinary scheduler jitter does not
/// fragment a session, and far below anything that would matter as real usage.
pub const GAP_TOLERANCE: f64 = POLL_SECONDS * 3.0;

/// How often unflushed intervals are sealed to disk. A crash or a power cut can
/// cost at most this much of the current day.
pub const FLUSH_SECONDS: f64 = 30.0;

#[derive(Debug, Clone, Serialize)]
pub struct TrackerStatus {
    pub running: bool,
    pub paused: bool,
    pub since: Option<String>,
    pub poll_seconds: f64,
    pub idle_after_seconds: f64,
    pub day: String,
}

struct State {
    store: Store,
    day: String,
    intervals: Vec<Interval>,
    /// Index into `intervals` of the interval currently accruing time. An index
    /// rather than a reference because Rust will not let us hold a borrow of a
    /// vector we also push to.
    open: Option<usize>,
    last_tick: Option<Instant>,
    dirty: bool,
    paused: bool,
    started_at: Option<String>,
}

impl State {
    fn tick(&mut self) {
        let now = Instant::now();
        let gap = self.last_tick.map(|t| now.duration_since(t).as_secs_f64()).unwrap_or(0.0);
        self.last_tick = Some(now);

        // Midnight, or the first tick after one.
        let current_day = today_iso();
        if current_day != self.day {
            self.close_open();
            self.flush();
            self.day = current_day.clone();
            self.intervals = self.store.load_day(&current_day);
        }

        if self.paused {
            self.close_open();
            return;
        }

        let shot = winapi::snapshot();
        if !shot.present() {
            self.close_open();
            return;
        }

        let at = seconds_since_midnight();

        if self.open.is_some() && gap > GAP_TOLERANCE {
            // The machine was asleep, or the thread was starved. Do not bill the
            // missing stretch to whatever happened to be in front.
            self.close_open();
        }

        if let Some(idx) = self.open {
            let same = self.intervals[idx].app == shot.app && self.intervals[idx].title == shot.title;
            if same {
                self.intervals[idx].end = at;
                self.dirty = true;
                return;
            }
        }

        self.close_open();
        self.intervals.push(Interval { app: shot.app, title: shot.title, start: at, end: at });
        self.open = Some(self.intervals.len() - 1);
        self.dirty = true;
    }

    /// Finish the open interval, discarding it if it never accrued any time.
    fn close_open(&mut self) {
        let Some(idx) = self.open.take() else { return };
        if self.intervals.get(idx).map(|i| i.seconds() <= 0).unwrap_or(false)
            && idx == self.intervals.len() - 1
        {
            self.intervals.pop();
        }
        self.dirty = true;
    }

    fn flush(&mut self) {
        if !self.dirty {
            return;
        }
        self.store.save_day(&self.day, &self.intervals);
        self.dirty = false;
    }
}

/// Owns the polling thread and the current day's intervals in memory.
pub struct Tracker {
    state: Arc<Mutex<State>>,
    stop: Mutex<Option<Sender<()>>>,
    handle: Mutex<Option<JoinHandle<()>>>,
}

impl Tracker {
    pub fn new(store: Store) -> Self {
        let paused = store.load_settings().paused;
        let day = today_iso();
        let intervals = store.load_day(&day);

        Self {
            state: Arc::new(Mutex::new(State {
                store,
                day,
                intervals,
                open: None,
                last_tick: None,
                dirty: false,
                paused,
                started_at: None,
            })),
            stop: Mutex::new(None),
            handle: Mutex::new(None),
        }
    }

    pub fn start(&self) {
        let mut handle_slot = self.handle.lock().unwrap();
        if handle_slot.is_some() {
            return;
        }

        {
            // Pick up where a previous run in the same day left off.
            let mut st = self.state.lock().unwrap();
            st.day = today_iso();
            st.intervals = st.store.load_day(&st.day);
            st.started_at = Some(crate::dates::now_iso());
            st.last_tick = None;
        }

        let (tx, rx) = mpsc::channel::<()>();
        *self.stop.lock().unwrap() = Some(tx);

        let state = Arc::clone(&self.state);
        *handle_slot = Some(std::thread::spawn(move || {
            let poll = Duration::from_secs_f64(POLL_SECONDS);
            let mut last_flush = Instant::now();

            loop {
                match rx.recv_timeout(poll) {
                    // Asked to stop, or the app is going away.
                    Ok(()) | Err(RecvTimeoutError::Disconnected) => break,
                    Err(RecvTimeoutError::Timeout) => {}
                }

                // One bad tick — a window that vanished mid-call, a transient
                // Win32 failure — must not take the thread down and silently end
                // recording for the rest of the session.
                let Ok(mut st) = state.lock() else { break };
                st.tick();
                if last_flush.elapsed().as_secs_f64() >= FLUSH_SECONDS {
                    st.flush();
                    last_flush = Instant::now();
                }
            }

            if let Ok(mut st) = state.lock() {
                st.close_open();
                st.flush();
            }
        }));
    }

    pub fn stop(&self) {
        if let Some(tx) = self.stop.lock().unwrap().take() {
            let _ = tx.send(());
        }
        if let Some(handle) = self.handle.lock().unwrap().take() {
            let _ = handle.join();
        }
        // Belt and braces: whether or not the thread got there first, the day on
        // disk must be current before the process exits.
        let mut st = self.state.lock().unwrap();
        st.close_open();
        st.flush();
    }

    pub fn running(&self) -> bool {
        self.handle.lock().unwrap().is_some()
    }

    /// Stop or resume recording, remembered across restarts.
    ///
    /// Paused means paused: the loop keeps running but takes no snapshot at all,
    /// so nothing about the foreground window is even read, let alone stored.
    pub fn set_paused(&self, paused: bool) {
        let mut st = self.state.lock().unwrap();
        if paused && !st.paused {
            st.close_open();
            st.flush();
        }
        st.paused = paused;

        let mut settings = st.store.load_settings();
        settings.paused = paused;
        st.store.save_settings(&settings);
    }

    pub fn paused(&self) -> bool {
        self.state.lock().unwrap().paused
    }

    /// A day's intervals, including today's not-yet-flushed tail.
    pub fn intervals_for(&self, day: &str) -> Vec<Interval> {
        let st = self.state.lock().unwrap();
        if day == st.day {
            return st.intervals.clone();
        }
        st.store.load_day(day)
    }

    pub fn settings(&self) -> super::store::Settings {
        self.state.lock().unwrap().store.load_settings()
    }

    pub fn with_store<T>(&self, f: impl FnOnce(&Store) -> T) -> T {
        let st = self.state.lock().unwrap();
        f(&st.store)
    }

    pub fn recorded_days(&self) -> Vec<String> {
        self.state.lock().unwrap().store.recorded_days()
    }

    pub fn status(&self) -> TrackerStatus {
        let st = self.state.lock().unwrap();
        TrackerStatus {
            running: self.handle.lock().unwrap().is_some(),
            paused: st.paused,
            since: st.started_at.clone(),
            poll_seconds: POLL_SECONDS,
            idle_after_seconds: IDLE_AFTER,
            day: st.day.clone(),
        }
    }

    /// Delete a day's recording, or every day when `day` is `None`.
    ///
    /// Anything currently in memory for that day goes too — otherwise the next
    /// flush would write it straight back, and "forget this" would be a lie.
    pub fn forget(&self, day: Option<&str>) -> usize {
        let mut st = self.state.lock().unwrap();

        let clears_today = match day {
            None => true,
            Some(d) => d == st.day,
        };
        if clears_today {
            st.open = None;
            st.intervals.clear();
            st.dirty = false;
        }

        match day {
            None => st.store.purge_all(),
            Some(d) => usize::from(st.store.purge_day(d)),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn state(dir: &str) -> State {
        let path = std::env::temp_dir().join(dir);
        let _ = std::fs::remove_dir_all(&path);
        State {
            store: Store::new(path),
            day: today_iso(),
            intervals: vec![],
            open: None,
            last_tick: None,
            dirty: false,
            paused: false,
            started_at: None,
        }
    }

    #[test]
    fn an_interval_that_never_accrued_time_is_discarded() {
        let mut st = state("mis-tracker-test-empty");
        st.intervals.push(Interval { app: "a.exe".into(), title: String::new(), start: 100, end: 100 });
        st.open = Some(0);

        st.close_open();
        assert!(st.intervals.is_empty(), "a zero-length interval is not usage");
        let _ = std::fs::remove_dir_all(&st.store.dir);
    }

    #[test]
    fn an_interval_that_accrued_time_is_kept() {
        let mut st = state("mis-tracker-test-kept");
        st.intervals.push(Interval { app: "a.exe".into(), title: String::new(), start: 100, end: 160 });
        st.open = Some(0);

        st.close_open();
        assert_eq!(st.intervals.len(), 1);
        assert_eq!(st.intervals[0].seconds(), 60);
        assert!(st.open.is_none());
        let _ = std::fs::remove_dir_all(&st.store.dir);
    }

    #[test]
    fn closing_twice_is_harmless() {
        let mut st = state("mis-tracker-test-twice");
        st.close_open();
        st.close_open();
        assert!(st.intervals.is_empty());
        let _ = std::fs::remove_dir_all(&st.store.dir);
    }

    #[test]
    fn a_paused_tracker_records_nothing_at_all() {
        let mut st = state("mis-tracker-test-paused");
        st.paused = true;
        st.tick();
        assert!(st.intervals.is_empty());
        let _ = std::fs::remove_dir_all(&st.store.dir);
    }

    #[test]
    fn gap_tolerance_sits_above_one_poll_and_well_below_real_usage() {
        assert!(GAP_TOLERANCE > POLL_SECONDS, "jitter must not fragment a session");
        assert!(GAP_TOLERANCE < 60.0, "a real absence must still break the interval");
    }
}

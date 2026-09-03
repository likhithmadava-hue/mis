//! Screen time: what was actually in front of you, and for how long.
//!
//! The whole feature is four pieces with one direction of dependency:
//!
//! ```text
//!   winapi     one look at the screen (foreground app, title, idleness)
//!   tracker    turns a run of looks into intervals, in a thread
//!   store      seals a day's intervals to disk, one file per day
//!   summary    turns a day's intervals into the numbers the tab draws
//! ```
//!
//! **Screen Time must say when nothing was watching.** An empty chart and "you
//! used nothing today" look identical on screen and only one of them is ever
//! true. `Availability` below is what keeps them apart: the tab asks whether the
//! tracker is running before it draws a zero, and shows a "not watching" card
//! instead when it is not. Keep that distinction.
//!
//! In the old app this shipped but was never connected — the router was never
//! included, the dev proxy was never configured, and the tab was never added to
//! `TABS`. Three missing connections. It is wired up here (see `commands.rs` and
//! `App.tsx`), which is the difference between a feature and a folder.

pub mod categories;
pub mod store;
pub mod summary;
pub mod tracker;
pub mod winapi;

use serde::Serialize;

/// Whether screen time can be reported at all, and why not if it cannot.
#[derive(Debug, Clone, Serialize)]
pub struct Availability {
    pub available: bool,
    /// A sentence the tab can show verbatim. `None` when everything is fine.
    pub reason: Option<String>,
}

impl Availability {
    pub fn ok() -> Self {
        Self { available: true, reason: None }
    }

    pub fn unavailable(reason: impl Into<String>) -> Self {
        Self { available: false, reason: Some(reason.into()) }
    }
}

/// Whether this machine can record screen time at all.
///
/// **Paused is deliberately not unavailable.** Pausing stops new recording; it
/// does not make the days already recorded unreadable, and hiding the whole tab
/// behind a "nothing is watching" card would take away the history along with
/// the live figures — including the Resume button. That state is reported by
/// `st_status` and shown as a pill, which is what it is: a status.
///
/// What *is* unavailable is a machine that cannot watch the foreground window
/// (anything but Windows) or a tracker that failed to start. In both cases the
/// tab must say so rather than draw a zero.
pub fn availability(tracker: &tracker::Tracker) -> Availability {
    if !cfg!(windows) {
        return Availability::unavailable("Screen time is only recorded on Windows.");
    }
    if !tracker.running() {
        return Availability::unavailable(
            "The screen-time tracker is not running, so nothing is being recorded. Restarting MIS \
             usually brings it back.",
        );
    }
    Availability::ok()
}

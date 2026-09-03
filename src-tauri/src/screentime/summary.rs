//! Turning a day's intervals into the handful of numbers the tab draws.
//!
//! Kept apart from the command layer so the arithmetic can be reasoned about
//! (and tested) without a window, and apart from the tracker so a change to how
//! a day is *presented* never risks the loop that *records* it.
//!
//! Every figure here is a sum of observed intervals. Nothing is extrapolated,
//! smoothed, or filled in — a gap in the day is a gap in the chart, because the
//! honest answer to "what were you doing at 4pm" is sometimes "MIS was not
//! open".

use std::collections::BTreeMap;

use serde::Serialize;

use super::categories;
use super::store::{Interval, Settings};

/// How many distinct window titles to keep per app. The tab shows these to make
/// a browser's time judgeable by eye; the tail is long, uninformative, and would
/// bloat every response.
pub const TITLES_PER_APP: usize = 8;

#[derive(Debug, Clone, Serialize)]
pub struct TitleTotal {
    pub title: String,
    pub seconds: i64,
}

#[derive(Debug, Clone, Serialize)]
pub struct AppRow {
    pub app: String,
    pub seconds: i64,
    pub category: String,
    pub titles: Vec<TitleTotal>,
}

#[derive(Debug, Clone, Serialize)]
pub struct Stretch {
    pub app: String,
    pub title: String,
    pub seconds: i64,
    pub start: i64,
}

#[derive(Debug, Clone, Serialize)]
pub struct TimelineSpan {
    pub app: String,
    pub title: String,
    pub start: i64,
    pub seconds: i64,
}

#[derive(Debug, Clone, Serialize)]
pub struct DaySummary {
    pub day: String,
    pub total_seconds: i64,
    pub by_app: Vec<AppRow>,
    pub by_category: BTreeMap<String, i64>,
    pub switches: usize,
    pub longest_stretch: Option<Stretch>,
    /// The raw run, for the timeline strip — small enough to send whole.
    pub timeline: Vec<TimelineSpan>,
}

/// A day reduced to what a multi-day chart needs, without the timeline.
#[derive(Debug, Clone, Serialize)]
pub struct CompactDay {
    pub day: String,
    pub total_seconds: i64,
    pub by_category: BTreeMap<String, i64>,
}

fn titles(intervals: &[&Interval]) -> Vec<TitleTotal> {
    let mut totals: BTreeMap<&str, i64> = BTreeMap::new();
    for i in intervals {
        if i.title.is_empty() {
            continue;
        }
        *totals.entry(i.title.as_str()).or_insert(0) += i.seconds();
    }
    let mut ranked: Vec<TitleTotal> = totals
        .into_iter()
        .filter(|(_, s)| *s > 0)
        .map(|(t, seconds)| TitleTotal { title: t.to_string(), seconds })
        .collect();
    // Longest first; ties fall back to the title so the order is stable between
    // renders rather than reshuffling on every poll.
    ranked.sort_by(|a, b| b.seconds.cmp(&a.seconds).then_with(|| a.title.cmp(&b.title)));
    ranked.truncate(TITLES_PER_APP);
    ranked
}

/// Per-app totals, longest first, each with its most-used window titles.
pub fn by_app(intervals: &[Interval], settings: &Settings) -> Vec<AppRow> {
    let resolved = categories::resolved(settings);

    let mut grouped: BTreeMap<&str, Vec<&Interval>> = BTreeMap::new();
    for i in intervals {
        grouped.entry(i.app.as_str()).or_default().push(i);
    }

    let mut rows: Vec<AppRow> = grouped
        .into_iter()
        .map(|(app, group)| AppRow {
            app: app.to_string(),
            seconds: group.iter().map(|i| i.seconds()).sum(),
            category: categories::category_for(app, &resolved),
            titles: titles(&group),
        })
        .filter(|r| r.seconds > 0)
        .collect();

    rows.sort_by(|a, b| b.seconds.cmp(&a.seconds).then_with(|| a.app.cmp(&b.app)));
    rows
}

/// Category totals. Every category is present even at zero, so the legend does
/// not appear and disappear as the day goes on.
pub fn by_category(rows: &[AppRow]) -> BTreeMap<String, i64> {
    let mut totals: BTreeMap<String, i64> =
        categories::CATEGORIES.iter().map(|c| ((*c).to_string(), 0)).collect();
    for r in rows {
        *totals.entry(r.category.clone()).or_insert(0) += r.seconds;
    }
    totals
}

/// The single longest unbroken run on one app — the closest thing here to a
/// measure of focus, and the one number a switching habit shows up in.
pub fn longest_stretch(intervals: &[Interval]) -> Option<Stretch> {
    intervals
        .iter()
        .max_by_key(|i| i.seconds())
        .filter(|i| i.seconds() > 0)
        .map(|i| Stretch {
            app: i.app.clone(),
            title: i.title.clone(),
            seconds: i.seconds(),
            start: i.start,
        })
}

pub fn day(day_key: &str, intervals: &[Interval], settings: &Settings) -> DaySummary {
    let apps = by_app(intervals, settings);
    let counted: Vec<&Interval> = intervals.iter().filter(|i| i.seconds() > 0).collect();

    DaySummary {
        day: day_key.to_string(),
        total_seconds: apps.iter().map(|r| r.seconds).sum(),
        by_category: by_category(&apps),
        by_app: apps,
        switches: counted.len().saturating_sub(1),
        longest_stretch: longest_stretch(intervals),
        timeline: counted
            .iter()
            .map(|i| TimelineSpan {
                app: i.app.clone(),
                title: i.title.clone(),
                start: i.start,
                seconds: i.seconds(),
            })
            .collect(),
    }
}

pub fn compact_day(day_key: &str, intervals: &[Interval], settings: &Settings) -> CompactDay {
    let apps = by_app(intervals, settings);
    CompactDay {
        day: day_key.to_string(),
        total_seconds: apps.iter().map(|r| r.seconds).sum(),
        by_category: by_category(&apps),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn iv(app: &str, title: &str, start: i64, end: i64) -> Interval {
        Interval { app: app.into(), title: title.into(), start, end }
    }

    fn sample() -> Vec<Interval> {
        vec![
            iv("code.exe", "main.rs", 0, 600),      // 10 min study
            iv("msedge.exe", "Past paper", 600, 900), // 5 min neutral
            iv("code.exe", "lib.rs", 900, 1200),    // 5 min study
            iv("discord.exe", "general", 1200, 1320), // 2 min distraction
        ]
    }

    #[test]
    fn per_app_totals_add_up_and_come_back_longest_first() {
        let rows = by_app(&sample(), &Settings::default());
        assert_eq!(rows[0].app, "code.exe");
        assert_eq!(rows[0].seconds, 900);
        assert_eq!(rows[1].app, "msedge.exe");
        assert_eq!(rows.iter().map(|r| r.seconds).sum::<i64>(), 1320);
    }

    #[test]
    fn an_apps_titles_are_kept_and_ranked() {
        let rows = by_app(&sample(), &Settings::default());
        let code = rows.iter().find(|r| r.app == "code.exe").unwrap();
        assert_eq!(code.titles[0].title, "main.rs");
        assert_eq!(code.titles[0].seconds, 600);
    }

    #[test]
    fn every_category_appears_even_at_zero() {
        let rows = by_app(&[iv("code.exe", "", 0, 60)], &Settings::default());
        let totals = by_category(&rows);
        assert_eq!(totals.len(), 3);
        assert_eq!(totals["study"], 60);
        assert_eq!(totals["distraction"], 0);
    }

    #[test]
    fn zero_length_intervals_are_not_counted_as_switches() {
        // A just-opened interval has accrued nothing and is not a real switch.
        let intervals = vec![iv("a.exe", "", 0, 60), iv("b.exe", "", 60, 60)];
        let d = day("2026-08-03", &intervals, &Settings::default());
        assert_eq!(d.switches, 0);
        assert_eq!(d.timeline.len(), 1);
    }

    #[test]
    fn the_longest_stretch_is_the_longest_single_run() {
        let s = longest_stretch(&sample()).unwrap();
        assert_eq!(s.app, "code.exe");
        assert_eq!(s.title, "main.rs");
        assert_eq!(s.seconds, 600);
    }

    #[test]
    fn a_day_with_nothing_in_it_reports_nothing_rather_than_faking_it() {
        let d = day("2026-08-03", &[], &Settings::default());
        assert_eq!(d.total_seconds, 0);
        assert!(d.by_app.is_empty());
        assert!(d.longest_stretch.is_none());
        assert_eq!(d.switches, 0);
    }

    #[test]
    fn recategorising_an_app_moves_its_whole_total() {
        let mut s = Settings::default();
        s.categories.insert("msedge.exe".into(), "study".into());
        let totals = by_category(&by_app(&sample(), &s));
        assert_eq!(totals["study"], 1200);
        assert_eq!(totals["neutral"], 0);
    }
}

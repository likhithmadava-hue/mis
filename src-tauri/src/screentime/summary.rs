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
//!
//! **Two levels, not one.** Every interval belongs to an app *and* to an
//! activity (see `activity.rs`): for a browser that is the site behind the tab,
//! for everything else it is the app itself. The category totals are summed
//! from the **activity** level, which is what lets one browser's hours land in
//! study, neutral and distraction at once instead of in a single grey bar.

use std::collections::BTreeMap;

use serde::Serialize;

use super::activity::{self, Activity};
use super::categories::{self, Filing};
use super::store::{Interval, Settings};

/// How many distinct window titles to keep per activity. The tab shows these so
/// a total can be judged by eye; the tail is long, uninformative, and would
/// bloat every response.
pub const TITLES_PER_APP: usize = 8;

#[derive(Debug, Clone, Serialize)]
pub struct TitleTotal {
    pub title: String,
    pub seconds: i64,
}

/// One thing that was done: a site inside a browser, or an app in its own
/// right. This is the level categories are decided at.
#[derive(Debug, Clone, Serialize)]
pub struct ActivityRow {
    /// What a category assignment is stored against (`web:youtube`, `code.exe`).
    pub key: String,
    pub label: String,
    /// The app it happened in, so the tab can say where a site was opened.
    pub app: String,
    pub seconds: i64,
    pub category: String,
    /// True for a page inside a browser, false for the app itself.
    pub web: bool,
    pub titles: Vec<TitleTotal>,
}

#[derive(Debug, Clone, Serialize)]
pub struct AppRow {
    pub app: String,
    pub seconds: i64,
    /// What the app as a whole is filed as. Still meaningful for a browser: it
    /// is the fallback every site in it that has no assignment of its own uses.
    pub category: String,
    /// Whether this app shows web pages, and so has activities worth opening.
    pub browser: bool,
    /// This app's own seconds split by category — what the bar is stacked from.
    /// A browser is the whole reason this exists; for everything else it is one
    /// entry.
    pub split: BTreeMap<String, i64>,
    /// The sites inside this app, longest first. Empty for anything that is not
    /// a browser, whose one activity is the app itself.
    pub activities: Vec<ActivityRow>,
    pub titles: Vec<TitleTotal>,
}

impl AppRow {
    /// Whether this app's time landed in more than one category — the state a
    /// single-colour bar would misreport.
    pub fn mixed(&self) -> bool {
        self.split.values().filter(|s| **s > 0).count() > 1
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct Stretch {
    pub app: String,
    pub title: String,
    /// What that run actually was — the site, for a browser.
    pub label: String,
    pub category: String,
    pub seconds: i64,
    pub start: i64,
}

#[derive(Debug, Clone, Serialize)]
pub struct TimelineSpan {
    pub app: String,
    pub title: String,
    pub label: String,
    /// Carried here rather than looked up by app on the frontend: one block of
    /// a browser's time can be study and the next distraction, so the strip
    /// cannot colour itself from the app name.
    pub category: String,
    pub start: i64,
    pub seconds: i64,
}

#[derive(Debug, Clone, Serialize)]
pub struct DaySummary {
    pub day: String,
    pub total_seconds: i64,
    pub by_app: Vec<AppRow>,
    /// Everything that was done, flattened to one level and longest first —
    /// sites and apps side by side, with no browser standing in front of them.
    pub by_activity: Vec<ActivityRow>,
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

/// One interval, with the question "what was this" already answered.
struct Resolved<'a> {
    interval: &'a Interval,
    activity: Activity,
    category: String,
    /// The window caption with the browser's own name taken off.
    title: String,
}

fn resolve<'a>(intervals: &'a [Interval], settings: &Settings) -> Vec<Resolved<'a>> {
    let filing = Filing::new(settings);
    intervals
        .iter()
        .map(|interval| {
            let activity = activity::activity_for(&interval.app, &interval.title);
            let category = filing.of(&interval.app, &activity.key);
            let title = activity::clean_title(&interval.app, &interval.title);
            Resolved { interval, activity, category, title }
        })
        .collect()
}

fn titles(rows: &[&Resolved]) -> Vec<TitleTotal> {
    let mut totals: BTreeMap<&str, i64> = BTreeMap::new();
    for r in rows {
        if r.title.is_empty() {
            continue;
        }
        *totals.entry(r.title.as_str()).or_insert(0) += r.interval.seconds();
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

fn activity_rows(rows: &[&Resolved]) -> Vec<ActivityRow> {
    let mut grouped: BTreeMap<&str, Vec<&Resolved>> = BTreeMap::new();
    for r in rows {
        grouped.entry(r.activity.key.as_str()).or_default().push(r);
    }

    let mut out: Vec<ActivityRow> = grouped
        .into_iter()
        .map(|(key, group)| {
            let head = group[0];
            ActivityRow {
                key: key.to_string(),
                label: head.activity.label.clone(),
                app: head.interval.app.clone(),
                seconds: group.iter().map(|r| r.interval.seconds()).sum(),
                category: head.category.clone(),
                web: head.activity.web,
                titles: titles(&group),
            }
        })
        .filter(|a| a.seconds > 0)
        .collect();

    // Longest first. Ties fall back to the label so the order is stable between
    // renders — folded to lowercase, or `YouTube` would outrank `code.exe` for
    // no reason a reader could see.
    out.sort_by(|a, b| {
        b.seconds
            .cmp(&a.seconds)
            .then_with(|| a.label.to_lowercase().cmp(&b.label.to_lowercase()))
    });
    out
}

fn split_of(rows: &[&Resolved]) -> BTreeMap<String, i64> {
    let mut totals: BTreeMap<String, i64> = BTreeMap::new();
    for r in rows {
        let s = r.interval.seconds();
        if s > 0 {
            *totals.entry(r.category.clone()).or_insert(0) += s;
        }
    }
    totals
}

/// Per-app totals, longest first, each carrying the activities inside it.
pub fn by_app(intervals: &[Interval], settings: &Settings) -> Vec<AppRow> {
    rows_from(&resolve(intervals, settings), settings)
}

fn rows_from(resolved: &[Resolved], settings: &Settings) -> Vec<AppRow> {
    let apps = categories::resolved(settings);

    let mut grouped: BTreeMap<&str, Vec<&Resolved>> = BTreeMap::new();
    for r in resolved {
        grouped.entry(r.interval.app.as_str()).or_default().push(r);
    }

    let mut rows: Vec<AppRow> = grouped
        .into_iter()
        .map(|(app, group)| {
            let browser = activity::is_browser(app);
            AppRow {
                app: app.to_string(),
                seconds: group.iter().map(|r| r.interval.seconds()).sum(),
                category: categories::category_for(app, &apps),
                browser,
                split: split_of(&group),
                // Only a browser has a second level. Everything else *is* its
                // own activity, and repeating the app as its only child would
                // be a row that expands to itself.
                activities: if browser { activity_rows(&group) } else { Vec::new() },
                titles: titles(&group),
            }
        })
        .filter(|r| r.seconds > 0)
        .collect();

    rows.sort_by(|a, b| b.seconds.cmp(&a.seconds).then_with(|| a.app.cmp(&b.app)));
    rows
}

/// Category totals, summed at the activity level.
///
/// Every category is present even at zero, so the legend does not appear and
/// disappear as the day goes on.
pub fn by_category(activities: &[ActivityRow]) -> BTreeMap<String, i64> {
    let mut totals: BTreeMap<String, i64> =
        categories::CATEGORIES.iter().map(|c| ((*c).to_string(), 0)).collect();
    for a in activities {
        *totals.entry(a.category.clone()).or_insert(0) += a.seconds;
    }
    totals
}

/// Everything done that day, flattened to one level and longest first.
pub fn by_activity(intervals: &[Interval], settings: &Settings) -> Vec<ActivityRow> {
    let resolved = resolve(intervals, settings);
    activity_rows(&resolved.iter().collect::<Vec<_>>())
}

/// The single longest unbroken run on one thing — the closest measure of focus
/// here, and the one number a switching habit shows up in.
pub fn longest_stretch(intervals: &[Interval], settings: &Settings) -> Option<Stretch> {
    let resolved = resolve(intervals, settings);
    resolved
        .iter()
        .max_by_key(|r| r.interval.seconds())
        .filter(|r| r.interval.seconds() > 0)
        .map(|r| Stretch {
            app: r.interval.app.clone(),
            title: r.title.clone(),
            label: r.activity.label.clone(),
            category: r.category.clone(),
            seconds: r.interval.seconds(),
            start: r.interval.start,
        })
}

pub fn day(day_key: &str, intervals: &[Interval], settings: &Settings) -> DaySummary {
    let resolved = resolve(intervals, settings);
    let counted: Vec<&Resolved> = resolved.iter().filter(|r| r.interval.seconds() > 0).collect();

    let apps = rows_from(&resolved, settings);
    let activities = activity_rows(&counted);

    DaySummary {
        day: day_key.to_string(),
        total_seconds: apps.iter().map(|r| r.seconds).sum(),
        by_category: by_category(&activities),
        by_app: apps,
        by_activity: activities,
        switches: counted.len().saturating_sub(1),
        longest_stretch: counted
            .iter()
            .max_by_key(|r| r.interval.seconds())
            .map(|r| Stretch {
                app: r.interval.app.clone(),
                title: r.title.clone(),
                label: r.activity.label.clone(),
                category: r.category.clone(),
                seconds: r.interval.seconds(),
                start: r.interval.start,
            }),
        timeline: counted
            .iter()
            .map(|r| TimelineSpan {
                app: r.interval.app.clone(),
                title: r.title.clone(),
                label: r.activity.label.clone(),
                category: r.category.clone(),
                start: r.interval.start,
                seconds: r.interval.seconds(),
            })
            .collect(),
    }
}

pub fn compact_day(day_key: &str, intervals: &[Interval], settings: &Settings) -> CompactDay {
    let resolved = resolve(intervals, settings);
    let activities = activity_rows(&resolved.iter().collect::<Vec<_>>());
    CompactDay {
        day: day_key.to_string(),
        total_seconds: activities.iter().map(|a| a.seconds).sum(),
        by_category: by_category(&activities),
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
            iv("code.exe", "main.rs", 0, 600),         // 10 min study
            iv("ulaa.exe", "Past paper - Ulaa", 600, 900), // 5 min unfiled page
            iv("code.exe", "lib.rs", 900, 1200),       // 5 min study
            iv("discord.exe", "general", 1200, 1320),  // 2 min distraction
        ]
    }

    /// A browser hour that was genuinely three different things.
    fn browsing() -> Vec<Interval> {
        vec![
            iv("ulaa.exe", "Limits - Khan Academy - Ulaa", 0, 1800),
            iv("ulaa.exe", "Lecture 4 - YouTube - Ulaa", 1800, 2400),
            iv("ulaa.exe", "reels • Instagram - Ulaa", 2400, 3600),
        ]
    }

    #[test]
    fn per_app_totals_add_up_and_come_back_longest_first() {
        let rows = by_app(&sample(), &Settings::default());
        assert_eq!(rows[0].app, "code.exe");
        assert_eq!(rows[0].seconds, 900);
        assert_eq!(rows[1].app, "ulaa.exe");
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
    fn a_browsers_own_name_is_not_repeated_in_every_title_it_lists() {
        let rows = by_app(&sample(), &Settings::default());
        let browser = rows.iter().find(|r| r.app == "ulaa.exe").unwrap();
        assert_eq!(browser.titles[0].title, "Past paper");
    }

    #[test]
    fn one_browser_breaks_into_what_was_done_in_it() {
        let rows = by_app(&browsing(), &Settings::default());
        assert_eq!(rows.len(), 1, "still one app");

        let browser = &rows[0];
        assert!(browser.browser);
        let labels: Vec<&str> = browser.activities.iter().map(|a| a.label.as_str()).collect();
        assert_eq!(labels, vec!["Khan Academy", "Instagram", "YouTube"], "longest first");
        assert_eq!(browser.activities[0].seconds, 1800);
    }

    #[test]
    fn a_browsers_hour_lands_in_three_categories_rather_than_one_grey_bar() {
        let d = day("2026-08-03", &browsing(), &Settings::default());
        assert_eq!(d.by_category["study"], 1800);
        assert_eq!(d.by_category["neutral"], 600);
        assert_eq!(d.by_category["distraction"], 1200);
        assert_eq!(d.total_seconds, 3600);
    }

    #[test]
    fn an_app_that_split_says_so_and_carries_the_numbers_to_draw_it_with() {
        let rows = by_app(&browsing(), &Settings::default());
        let browser = &rows[0];
        assert!(browser.mixed());
        assert_eq!(browser.split["study"], 1800);
        assert_eq!(browser.split["distraction"], 1200);
        assert_eq!(browser.split.values().sum::<i64>(), browser.seconds);
    }

    #[test]
    fn an_app_that_is_one_thing_is_not_reported_as_mixed_and_has_no_second_level() {
        let rows = by_app(&[iv("code.exe", "main.rs", 0, 600)], &Settings::default());
        assert!(!rows[0].mixed());
        assert!(!rows[0].browser);
        assert!(rows[0].activities.is_empty(), "an app must not expand to itself");
    }

    #[test]
    fn every_category_appears_even_at_zero() {
        let d = day("2026-08-03", &[iv("code.exe", "", 0, 60)], &Settings::default());
        assert_eq!(d.by_category.len(), 3);
        assert_eq!(d.by_category["study"], 60);
        assert_eq!(d.by_category["distraction"], 0);
    }

    #[test]
    fn what_was_done_is_also_offered_flat_with_no_browser_in_front_of_it() {
        let mut intervals = browsing();
        intervals.push(iv("code.exe", "main.rs", 3600, 4200));
        let d = day("2026-08-03", &intervals, &Settings::default());

        let labels: Vec<&str> = d.by_activity.iter().map(|a| a.label.as_str()).collect();
        assert_eq!(labels, vec!["Khan Academy", "Instagram", "code.exe", "YouTube"]);
        assert_eq!(d.by_activity.iter().map(|a| a.seconds).sum::<i64>(), d.total_seconds);
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
    fn the_longest_stretch_is_the_longest_single_run_and_says_what_it_was() {
        let s = longest_stretch(&sample(), &Settings::default()).unwrap();
        assert_eq!(s.app, "code.exe");
        assert_eq!(s.title, "main.rs");
        assert_eq!(s.label, "code.exe");

        let web = longest_stretch(&browsing(), &Settings::default()).unwrap();
        assert_eq!(web.app, "ulaa.exe");
        assert_eq!(web.label, "Khan Academy", "\"ulaa.exe\" is not an answer");
        assert_eq!(web.category, "study");
    }

    #[test]
    fn the_timeline_colours_itself_by_what_each_block_was_not_by_the_app() {
        let d = day("2026-08-03", &browsing(), &Settings::default());
        let cats: Vec<&str> = d.timeline.iter().map(|b| b.category.as_str()).collect();
        assert_eq!(cats, vec!["study", "neutral", "distraction"]);
        assert!(d.timeline.iter().all(|b| b.app == "ulaa.exe"));
    }

    #[test]
    fn a_day_with_nothing_in_it_reports_nothing_rather_than_faking_it() {
        let d = day("2026-08-03", &[], &Settings::default());
        assert_eq!(d.total_seconds, 0);
        assert!(d.by_app.is_empty());
        assert!(d.by_activity.is_empty());
        assert!(d.longest_stretch.is_none());
        assert_eq!(d.switches, 0);
    }

    #[test]
    fn recategorising_a_site_moves_only_that_sites_total() {
        let mut s = Settings::default();
        s.sites.insert("web:youtube".into(), "study".into());
        let d = day("2026-08-03", &browsing(), &s);
        assert_eq!(d.by_category["study"], 2400, "Khan Academy plus YouTube");
        assert_eq!(d.by_category["neutral"], 0);
        assert_eq!(d.by_category["distraction"], 1200, "Instagram is untouched");
    }

    #[test]
    fn recategorising_a_whole_browser_still_works_and_covers_its_unnamed_sites() {
        let mut s = Settings::default();
        s.categories.insert("ulaa.exe".into(), "distraction".into());
        let d = day("2026-08-03", &browsing(), &s);
        assert_eq!(d.by_category["distraction"], 3600);
    }

    #[test]
    fn recategorising_an_app_moves_its_whole_total() {
        let mut s = Settings::default();
        s.categories.insert("ulaa.exe".into(), "study".into());
        let d = day("2026-08-03", &sample(), &s);
        assert_eq!(d.by_category["study"], 1200);
        assert_eq!(d.by_category["neutral"], 0);
    }

    #[test]
    fn the_week_chart_splits_a_browser_the_same_way_the_day_does() {
        let c = compact_day("2026-08-03", &browsing(), &Settings::default());
        assert_eq!(c.total_seconds, 3600);
        assert_eq!(c.by_category["distraction"], 1200);
    }
}

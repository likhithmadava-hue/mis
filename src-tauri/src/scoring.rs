//! What a score means.
//!
//! Day scoring lives here rather than in the Daily Log so the Growth Tracker's
//! charts and the Log itself can never drift apart: the Log writes the numbers,
//! the Tracker draws them, and both must agree on what a "7" is.
//!
//! In the old app this was `core/scoring/score.ts` and ran in the browser. It
//! moved to Rust for the same reason the data layer did — the scores are a
//! property of the data, not of the screen currently showing it, and computing
//! them next to the vault means there is exactly one implementation to be right.
//!
//! What stayed on the frontend is everything presentational: the track labels
//! and icons, the red→green `heat()` class names, the weekday strings. Those are
//! about how a score *looks*, and the browser already knows the user's locale.

use std::collections::HashMap;

use serde::Serialize;

use crate::db::types::*;
use crate::dates::iso_days_ago;

/// The day's score is reported out of this, like the old sheet's target cell.
pub const DAY_TARGET: f64 = 50.0;

/// Minutes of well-spent leisure that count as a full 10.
pub const WELL_SPENT_TARGET: f64 = 60.0;

/// Posture checks that count as a full 10.
pub const POSTURE_TARGET: f64 = 3.0;

pub fn clamp10(n: f64) -> f64 {
    n.clamp(0.0, 10.0)
}

/// One day's score for each of the six tracks, 0–10.
///
/// A struct rather than a map so it serialises to the same JSON object the
/// frontend expects while the compiler still checks every track is filled in.
#[derive(Debug, Clone, Copy, Serialize)]
pub struct TrackScores {
    pub studies: f64,
    pub dpps: f64,
    pub habits: f64,
    pub mood: f64,
    pub well_spent: f64,
    pub wellness: f64,
}

impl TrackScores {
    pub fn get(&self, id: TrackId) -> f64 {
        match id {
            TrackId::Studies => self.studies,
            TrackId::Dpps => self.dpps,
            TrackId::Habits => self.habits,
            TrackId::Mood => self.mood,
            TrackId::WellSpent => self.well_spent,
            TrackId::Wellness => self.wellness,
        }
    }
}

/// Score every track 0–10 for one day.
pub fn score_day(
    m: &DailyMetric,
    habits: &[Habit],
    done_ids: &[String],
    user: &UserConfig,
) -> TrackScores {
    let habit_total: f64 = habits.iter().map(|h| h.priority.weight()).sum();
    let habit_done: f64 = habits
        .iter()
        .filter(|h| done_ids.iter().any(|id| *id == h.id))
        .map(|h| h.priority.weight())
        .sum();

    // Hydration carries most of the wellness score; posture tops it up.
    let water = if user.water_target > 0.0 {
        (m.water_count / user.water_target).min(1.0)
    } else {
        0.0
    };
    let posture = (m.posture_count / POSTURE_TARGET).min(1.0);

    TrackScores {
        studies: if user.target_study_hours > 0.0 {
            clamp10((m.study_hours / user.target_study_hours) * 10.0)
        } else {
            0.0
        },
        dpps: if m.dpps_got > 0.0 {
            clamp10((m.dpps_complete / m.dpps_got) * 10.0)
        } else {
            0.0
        },
        habits: if habit_total > 0.0 {
            clamp10((habit_done / habit_total) * 10.0)
        } else {
            0.0
        },
        mood: clamp10(m.mood_score),
        well_spent: clamp10((m.well_spent_time / WELL_SPENT_TARGET) * 10.0),
        wellness: clamp10((water * 0.6 + posture * 0.4) * 10.0),
    }
}

/// Priority decides both the order of the cards and how much each one counts, so
/// raising a track's priority moves it up the page as well as up the score.
pub fn track_order(priorities: &TrackPriorities) -> Vec<TrackId> {
    let mut ids = TrackId::ALL.to_vec();
    // Stable sort: equal priorities keep TRACK_IDS order, so the layout does not
    // reshuffle itself between renders for no reason.
    ids.sort_by(|a, b| {
        priorities
            .get(*b)
            .weight()
            .partial_cmp(&priorities.get(*a).weight())
            .unwrap_or(std::cmp::Ordering::Equal)
    });
    ids
}

/// The tracks belonging to one mode, still ordered by priority.
pub fn tracks_in(mode: AppMode, priorities: &TrackPriorities) -> Vec<TrackId> {
    track_order(priorities).into_iter().filter(|id| id.mode() == mode).collect()
}

/// One mode's score, 0–10: a weighted average *within* the mode, so Academic and
/// Life stay directly comparable even though they hold a different number of
/// tracks.
pub fn mode_score10(scores: &TrackScores, priorities: &TrackPriorities, mode: AppMode) -> f64 {
    let ids: Vec<TrackId> = TrackId::ALL.into_iter().filter(|id| id.mode() == mode).collect();
    let weight: f64 = ids.iter().map(|id| priorities.get(*id).weight()).sum();
    if weight == 0.0 {
        return 0.0;
    }
    ids.iter()
        .map(|id| scores.get(*id) * priorities.get(*id).weight())
        .sum::<f64>()
        / weight
}

/// One mode's day score out of `DAY_TARGET`.
///
/// There is deliberately **no combined number**. A bad study day must not drag
/// down the Life score, and a good one must not paper over it. If you find
/// yourself adding a single overall total, that is a design regression.
pub fn mode_score(scores: &TrackScores, priorities: &TrackPriorities, mode: AppMode) -> f64 {
    ((mode_score10(scores, priorities, mode) / 10.0) * DAY_TARGET).round()
}

/// Each mode's own score for a day.
#[derive(Debug, Clone, Copy, Serialize)]
pub struct ByMode {
    pub academic: f64,
    pub life: f64,
}

/// One day, scored.
///
/// `scores` and `by_mode` are `None` when there was no log that day — **charts
/// must render a gap, never a zero**. A missing day and a wasted day are not the
/// same thing, and with a fresh vault every day is `None` until something is
/// entered, so every empty state has to survive it.
#[derive(Debug, Clone, Serialize)]
pub struct ScoredDay {
    pub date: String,
    pub metric: Option<DailyMetric>,
    pub scores: Option<TrackScores>,
    pub by_mode: Option<ByMode>,
}

/// Score the last `days` days, oldest first.
pub fn score_range(db: &DbShape, days: i64) -> Vec<ScoredDay> {
    // Bucket the whole habit log once. Filtering it per day inside the loop is
    // what made the old 90-day view crawl.
    let mut done_by_date: HashMap<&str, Vec<String>> = HashMap::new();
    for entry in &db.habit_log {
        done_by_date
            .entry(entry.date.as_str())
            .or_default()
            .push(entry.habit_id.clone());
    }

    (0..days)
        .map(|i| {
            let date = iso_days_ago(days - 1 - i);
            let metric = db.daily_metrics.iter().find(|m| m.date == date).cloned();
            let scores = metric.as_ref().map(|m| {
                score_day(
                    m,
                    &db.habits,
                    done_by_date.get(date.as_str()).map(Vec::as_slice).unwrap_or(&[]),
                    &db.user,
                )
            });
            let by_mode = scores.map(|s| ByMode {
                academic: mode_score(&s, &db.track_priorities, AppMode::Academic),
                life: mode_score(&s, &db.track_priorities, AppMode::Life),
            });
            ScoredDay { date, metric, scores, by_mode }
        })
        .collect()
}

/// One day of the fortnight strip on the home page.
#[derive(Debug, Clone, Serialize)]
pub struct StreakDay {
    pub date: String,
    pub hit: bool,
}

/// The study streak, counted over the **whole history** rather than the visible
/// range — a 40-day streak must not read as 7 just because the 7-day view is
/// selected.
///
/// Today not being logged yet does not break it: the count starts at yesterday,
/// and whether today is done is reported separately so the UI can say "keep it
/// going" rather than "you lost it".
#[derive(Debug, Clone, Serialize)]
pub struct Streak {
    /// days in a row ending today, or yesterday if today is not in yet
    pub days: u32,
    /// the longest run anywhere in the history — something to beat
    pub best: u32,
    pub today_done: bool,
    /// the last fortnight as hit/miss, oldest first
    pub recent: Vec<StreakDay>,
}

/// A day counts toward the streak when it **met the user's own study target**,
/// not merely when something was logged.
///
/// That distinction is the whole point of the number. A target of six hours and
/// a streak that ten minutes keeps alive would be a streak of having opened the
/// app, and it would climb happily through a fortnight of not studying. The
/// target is the user's, so this stays honest as they move it.
///
/// A target of zero means no target is set; nothing can hit it, and the streak
/// reads zero rather than counting every day since the beginning.
pub fn study_streak(db: &DbShape) -> Streak {
    let target = db.user.target_study_hours;

    let hit: std::collections::HashSet<&str> = if target > 0.0 {
        db.daily_metrics
            .iter()
            .filter(|m| m.study_hours >= target)
            .map(|m| m.date.as_str())
            .collect()
    } else {
        Default::default()
    };

    let today_done = hit.contains(iso_days_ago(0).as_str());

    let mut days = 0;
    let mut back = if today_done { 0 } else { 1 };
    while hit.contains(iso_days_ago(back).as_str()) {
        days += 1;
        back += 1;
    }

    // The longest run anywhere in the history. Walking the sorted dates is what
    // makes this whole-history rather than range-limited, and sorting ISO date
    // strings is the same as sorting the dates — one of the reasons every date
    // in MIS is stored as `YYYY-MM-DD`.
    let mut dates: Vec<&str> = hit.iter().copied().collect();
    dates.sort_unstable();

    let mut best = 0;
    let mut run = 0;
    let mut previous: Option<i64> = None;
    for date in dates {
        let Some(day) = crate::dates::day_number(date) else { continue };
        run = if previous == Some(day - 1) { run + 1 } else { 1 };
        previous = Some(day);
        best = best.max(run);
    }

    let recent = (0..14)
        .rev()
        .map(|i| {
            let date = iso_days_ago(i);
            StreakDay { hit: hit.contains(date.as_str()), date }
        })
        .collect();

    Streak { days, best: best.max(days), today_done, recent }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::seed::fresh_db;
    use crate::dates::today_iso;

    fn user() -> UserConfig {
        fresh_db().user // target_study_hours 6, water_target 8
    }

    fn full_day() -> DailyMetric {
        let mut m = DailyMetric::blank("1".into(), today_iso());
        m.study_hours = 6.0;
        m.dpps_got = 4.0;
        m.dpps_complete = 4.0;
        m.mood_score = 10.0;
        m.well_spent_time = 60.0;
        m.posture_count = 3.0;
        m.water_count = 8.0;
        m
    }

    #[test]
    fn a_perfect_day_scores_ten_everywhere() {
        let s = score_day(&full_day(), &[], &[], &user());
        assert_eq!(s.studies, 10.0);
        assert_eq!(s.dpps, 10.0);
        assert_eq!(s.mood, 10.0);
        assert_eq!(s.well_spent, 10.0);
        assert_eq!(s.wellness, 10.0);
    }

    #[test]
    fn overachieving_does_not_score_above_ten() {
        let mut m = full_day();
        m.study_hours = 20.0;
        m.well_spent_time = 600.0;
        let s = score_day(&m, &[], &[], &user());
        assert_eq!(s.studies, 10.0);
        assert_eq!(s.well_spent, 10.0);
    }

    #[test]
    fn no_papers_assigned_scores_zero_rather_than_dividing_by_zero() {
        let mut m = full_day();
        m.dpps_got = 0.0;
        m.dpps_complete = 0.0;
        assert_eq!(score_day(&m, &[], &[], &user()).dpps, 0.0);
    }

    #[test]
    fn habits_are_weighted_by_their_priority() {
        let habits = vec![
            Habit { id: "a".into(), name: "high".into(), priority: Priority::High, legacy_key: None },
            Habit { id: "b".into(), name: "low".into(), priority: Priority::Low, legacy_key: None },
        ];
        // 3 of 4 weight done.
        let s = score_day(&full_day(), &habits, &["a".into()], &user());
        assert_eq!(s.habits, 7.5);
    }

    #[test]
    fn hydration_carries_more_wellness_weight_than_posture() {
        let mut water_only = full_day();
        water_only.posture_count = 0.0;
        let mut posture_only = full_day();
        posture_only.water_count = 0.0;

        let w = score_day(&water_only, &[], &[], &user()).wellness;
        let p = score_day(&posture_only, &[], &[], &user()).wellness;
        assert!((w - 6.0).abs() < 1e-9);
        assert!((p - 4.0).abs() < 1e-9);
    }

    #[test]
    fn each_mode_scores_only_its_own_tracks() {
        // A perfect academic day with a wretched life day, and vice versa: the
        // two numbers must not touch each other.
        let mut m = full_day();
        m.mood_score = 0.0;
        m.well_spent_time = 0.0;
        m.posture_count = 0.0;
        m.water_count = 0.0;

        let p = TrackPriorities::default();
        let s = score_day(&m, &[], &[], &user());
        assert_eq!(mode_score(&s, &p, AppMode::Academic), 50.0);
        assert_eq!(mode_score(&s, &p, AppMode::Life), 0.0);
    }

    #[test]
    fn priority_orders_the_tracks_within_a_mode() {
        let mut p = TrackPriorities::default();
        p.mood = Priority::High;
        p.habits = Priority::Low;
        let life = tracks_in(AppMode::Life, &p);
        let mood_at = life.iter().position(|t| *t == TrackId::Mood).unwrap();
        let habits_at = life.iter().position(|t| *t == TrackId::Habits).unwrap();
        assert!(mood_at < habits_at, "a higher priority must sort earlier");
        assert!(life.iter().all(|t| t.mode() == AppMode::Life));
    }

    #[test]
    fn days_with_no_log_come_back_as_gaps_not_zeros() {
        let db = fresh_db(); // nothing logged at all
        let range = score_range(&db, 7);
        assert_eq!(range.len(), 7);
        assert!(range.iter().all(|d| d.scores.is_none() && d.by_mode.is_none()));
    }

    #[test]
    fn the_range_comes_back_oldest_first_and_ends_today() {
        let range = score_range(&fresh_db(), 7);
        assert_eq!(range[0].date, iso_days_ago(6));
        assert_eq!(range[6].date, today_iso());
    }

    /// Log `hours` on each of the given days-ago. The default target is 6.
    fn studied(days_ago: impl IntoIterator<Item = i64>, hours: f64) -> DbShape {
        let mut db = fresh_db();
        for n in days_ago {
            let mut m = DailyMetric::blank(format!("m{n}"), iso_days_ago(n));
            m.study_hours = hours;
            db.daily_metrics.push(m);
        }
        db
    }

    #[test]
    fn a_streak_survives_today_not_being_logged_yet() {
        let s = study_streak(&studied(1..=5, 6.0));
        assert_eq!(s.days, 5);
        assert!(!s.today_done);
    }

    #[test]
    fn a_streak_is_counted_over_all_history_not_the_visible_window() {
        assert_eq!(study_streak(&studied(0..40, 6.0)).days, 40);
    }

    #[test]
    fn a_missed_day_ends_the_streak() {
        assert_eq!(study_streak(&studied([1, 2, 4, 5], 6.0)).days, 2);
    }

    #[test]
    fn short_of_the_target_does_not_count() {
        // Five days of an hour a day against a six-hour target is not a streak.
        // If it were, the number would measure opening the app.
        let s = study_streak(&studied(1..=5, 1.0));
        assert_eq!(s.days, 0);
        assert_eq!(s.best, 0);
    }

    #[test]
    fn no_target_set_means_no_streak_rather_than_every_day() {
        let mut db = studied(0..10, 8.0);
        db.user.target_study_hours = 0.0;
        assert_eq!(study_streak(&db).days, 0);
    }

    #[test]
    fn best_remembers_a_longer_run_from_earlier() {
        // A run of 5 ending 10 days ago, then a current run of 2.
        let mut db = studied(10..=14, 6.0);
        for n in [1, 2] {
            let mut m = DailyMetric::blank(format!("recent{n}"), iso_days_ago(n));
            m.study_hours = 6.0;
            db.daily_metrics.push(m);
        }
        let s = study_streak(&db);
        assert_eq!(s.days, 2);
        assert_eq!(s.best, 5);
    }

    #[test]
    fn the_fortnight_strip_is_fourteen_days_oldest_first() {
        let s = study_streak(&studied([0], 6.0));
        assert_eq!(s.recent.len(), 14);
        assert_eq!(s.recent[0].date, iso_days_ago(13));
        assert_eq!(s.recent[13].date, today_iso());
        assert!(s.recent[13].hit);
        assert!(!s.recent[12].hit);
    }
}

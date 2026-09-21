//! The data layer.
//!
//! This is the Rust replacement for the old `ArborDatabase` class. Every read
//! and write in MIS goes through here, so no part of the app — and in
//! particular no part of the *frontend* — touches storage directly.
//!
//! The important change from the TypeScript version is where the rules live.
//! `ArborDatabase` was a pile of static methods in the browser, which meant the
//! day-lock guard also lived in the browser, in `useDailyLog`. Anyone with
//! devtools open could step around it. Here the guard is `MisError::DayLocked`
//! returned from these functions: the frontend still greys the surface out, but
//! that styling is now purely an *explanation* of a refusal the backend makes.

pub mod day_hash;
pub mod dev_mirror;
pub mod migrations;
pub mod profile;
pub mod seed;
pub mod types;

use crate::dates::{now_iso, today_iso};
use crate::error::{MisError, Result};
use types::*;

/// A partial update to today's metric — the Rust equivalent of the old
/// `Partial<DailyMetric>`. Only the fields the Daily Log can actually edit are
/// here; `locked`, `submitted_at` and `submit_hash` are set by `lock_today`
/// alone and are deliberately not patchable.
#[derive(Debug, Default, Clone, serde::Deserialize)]
#[serde(default)]
pub struct MetricPatch {
    pub study_hours: Option<f64>,
    pub dpps_got: Option<f64>,
    pub dpps_complete: Option<f64>,
    pub reading_habit: Option<bool>,
    pub revision_habit: Option<bool>,
    pub mood_score: Option<f64>,
    pub well_spent_time: Option<f64>,
    pub posture_count: Option<f64>,
    pub water_count: Option<f64>,
}

/// A partial update to a logbook row.
#[derive(Debug, Default, Clone, serde::Deserialize)]
#[serde(default)]
pub struct EntryPatch {
    pub date: Option<String>,
    pub subject: Option<String>,
    pub chapter: Option<String>,
    pub grade: Option<String>,
    pub score: Option<f64>,
    pub max_score: Option<f64>,
    pub difficulty: Option<Difficulty>,
    pub time_spent: Option<f64>,
    pub mistake_reason: Option<MistakeReason>,
    pub notes: Option<String>,
}

/// A logbook row as it arrives from the frontend, before it is given an id.
#[derive(Debug, Clone, serde::Deserialize)]
pub struct NewEntry {
    pub date: String,
    pub subject: String,
    #[serde(default)]
    pub chapter: String,
    #[serde(default)]
    pub grade: String,
    pub score: f64,
    pub max_score: f64,
    #[serde(default)]
    pub difficulty: Difficulty,
    #[serde(default)]
    pub time_spent: f64,
    pub mistake_reason: MistakeReason,
    #[serde(default)]
    pub notes: String,
}

impl NewEntry {
    fn into_entry(self) -> MarkLogbookEntry {
        MarkLogbookEntry {
            id: uid(),
            date: self.date,
            subject: self.subject,
            chapter: self.chapter,
            grade: self.grade,
            score: self.score,
            max_score: self.max_score,
            difficulty: self.difficulty,
            time_spent: self.time_spent,
            mistake_reason: self.mistake_reason,
            notes: self.notes,
        }
    }
}

// ── Day locking ─────────────────────────────────────────────────────────────

/// True when today's log has been submitted and not reopened.
pub fn today_is_locked(db: &DbShape) -> bool {
    let today = today_iso();
    db.daily_metrics
        .iter()
        .find(|m| m.date == today)
        .map(DailyMetric::is_locked)
        .unwrap_or(false)
}

/// The guard every write against today has to pass. Returning an error rather
/// than silently doing nothing is the point: a refused write must be visible.
fn refuse_if_locked(db: &DbShape) -> Result<()> {
    if today_is_locked(db) {
        return Err(MisError::DayLocked);
    }
    Ok(())
}

// ── User ────────────────────────────────────────────────────────────────────

pub fn save_user_config(db: &mut DbShape, user: UserConfig) {
    db.user = user;
}

// ── Daily metrics ───────────────────────────────────────────────────────────

/// Today's metric — the stored one if the day has been logged, otherwise a blank
/// one that is **not** stored.
///
/// The distinction matters more than it looks. The old app created and saved a
/// blank row the moment the Daily Log was opened, which meant every day MIS was
/// merely *launched* became a logged day scoring zero. The charts then drew a
/// zero where they should have drawn a gap, and the honest statement "you did
/// not record this day" turned into the false one "you did nothing that day" —
/// permanently, in the history.
///
/// So opening the app writes nothing. The row appears on the first real edit,
/// which is the first moment there is anything true to store.
pub fn today_metric(db: &DbShape) -> DailyMetric {
    let today = today_iso();
    db.daily_metrics
        .iter()
        .find(|m| m.date == today)
        .cloned()
        .unwrap_or_else(|| DailyMetric::blank(uid(), today))
}

pub fn update_today_metric(db: &mut DbShape, patch: MetricPatch) -> Result<()> {
    refuse_if_locked(db)?;

    let today = today_iso();
    // First edit of the day: this is where the row is created. See `today_metric`
    // for why it is not created any earlier.
    let idx = match db.daily_metrics.iter().position(|m| m.date == today) {
        Some(i) => i,
        None => {
            db.daily_metrics.push(DailyMetric::blank(uid(), today.clone()));
            db.daily_metrics.len() - 1
        }
    };

    {
        let m = &mut db.daily_metrics[idx];
        if let Some(v) = patch.study_hours { m.study_hours = v }
        if let Some(v) = patch.dpps_got { m.dpps_got = v }
        if let Some(v) = patch.dpps_complete { m.dpps_complete = v }
        if let Some(v) = patch.reading_habit { m.reading_habit = v }
        if let Some(v) = patch.revision_habit { m.revision_habit = v }
        if let Some(v) = patch.mood_score { m.mood_score = v }
        if let Some(v) = patch.well_spent_time { m.well_spent_time = v }
        if let Some(v) = patch.posture_count { m.posture_count = v }
        if let Some(v) = patch.water_count { m.water_count = v }
    }

    // Free time unlocks once the day's study target is met and every assigned
    // paper is done. Recomputed on every write so it can never go stale.
    let t = &db.daily_metrics[idx];
    db.user.free_time_unlocked = t.study_hours >= db.user.target_study_hours
        && t.dpps_got > 0.0
        && t.dpps_complete >= t.dpps_got;

    Ok(())
}

/// Finalise today's log: mark it locked and stamp it with the fingerprint of
/// the data as submitted.
///
/// Unlike the old version, the hash is computed *here* rather than passed in.
/// The TypeScript data layer was synchronous and `crypto.subtle.digest` was
/// not, so the caller had to hash first and hand the result over — a split that
/// let a caller lock a day with a fingerprint of something else. Rust hashing
/// is synchronous, so the stamp is taken from the data being locked, in the
/// same breath.
pub fn lock_today(db: &mut DbShape) -> Result<String> {
    let today = today_iso();
    let done = habits_done_on(db, &today);
    let topics: Vec<TopicItem> = db.topics.iter().filter(|t| t.date == today).cloned().collect();
    let dpps: Vec<DppItem> = db.dpps.iter().filter(|d| d.date == today).cloned().collect();

    let Some(idx) = db.daily_metrics.iter().position(|m| m.date == today) else {
        return Err(MisError::NotFound("there is nothing logged today to submit".into()));
    };

    let hash = day_hash::hash_day(&db.daily_metrics[idx], &done, &topics, &dpps);
    let m = &mut db.daily_metrics[idx];
    m.locked = Some(true);
    m.submitted_at = Some(now_iso());
    m.submit_hash = Some(hash.clone());
    Ok(hash)
}

/// Reopen today's log for editing. The submit stamp is kept as history — the
/// day still remembers when it was last submitted and what it looked like then.
pub fn unlock_today(db: &mut DbShape) -> Result<()> {
    let today = today_iso();
    let Some(m) = db.daily_metrics.iter_mut().find(|m| m.date == today) else {
        return Err(MisError::NotFound("there is no log today to unlock".into()));
    };
    m.locked = Some(false);
    Ok(())
}

/// Re-hash a locked day and report whether it still matches its submit stamp.
/// `false` means the vault was edited outside MIS — which is what the Daily
/// Log's red tamper banner is for.
pub fn day_is_intact(db: &DbShape, date: &str) -> bool {
    let Some(m) = db.daily_metrics.iter().find(|m| m.date == date) else {
        return true;
    };
    let Some(stamped) = &m.submit_hash else {
        return true;
    };
    let done = habits_done_on(db, date);
    let topics: Vec<TopicItem> = db.topics.iter().filter(|t| t.date == date).cloned().collect();
    let dpps: Vec<DppItem> = db.dpps.iter().filter(|d| d.date == date).cloned().collect();
    day_hash::hash_day(m, &done, &topics, &dpps) == *stamped
}

// ── Mark logbook ────────────────────────────────────────────────────────────

pub fn add_mark_entry(db: &mut DbShape, entry: NewEntry) {
    db.mark_logbook.insert(0, entry.into_entry());
}

/// Bulk insert from a spreadsheet import — one write for the whole batch.
/// De-duplication happens before this, in the importer.
pub fn add_mark_entries(db: &mut DbShape, entries: Vec<NewEntry>) -> usize {
    let rows: Vec<MarkLogbookEntry> = entries.into_iter().map(NewEntry::into_entry).collect();
    let n = rows.len();
    db.mark_logbook.splice(0..0, rows);
    n
}

pub fn update_mark_entry(db: &mut DbShape, id: &str, patch: EntryPatch) -> Result<()> {
    let Some(e) = db.mark_logbook.iter_mut().find(|e| e.id == id) else {
        return Err(MisError::NotFound(format!("no logbook entry with id {id}")));
    };
    if let Some(v) = patch.date { e.date = v }
    if let Some(v) = patch.subject { e.subject = v }
    if let Some(v) = patch.chapter { e.chapter = v }
    if let Some(v) = patch.grade { e.grade = v }
    if let Some(v) = patch.score { e.score = v }
    if let Some(v) = patch.max_score { e.max_score = v }
    if let Some(v) = patch.difficulty { e.difficulty = v }
    if let Some(v) = patch.time_spent { e.time_spent = v }
    if let Some(v) = patch.mistake_reason { e.mistake_reason = v }
    if let Some(v) = patch.notes { e.notes = v }
    Ok(())
}

pub fn delete_mark_entry(db: &mut DbShape, id: &str) {
    db.mark_logbook.retain(|e| e.id != id);
}

/// Used by the Database tab's JSON import — replaces the whole logbook, because
/// that format is our own backup rather than an arbitrary sheet to append.
pub fn replace_mark_logbook(db: &mut DbShape, entries: Vec<MarkLogbookEntry>) {
    db.mark_logbook = entries;
}

/// The fingerprints already in the logbook, so an importer can tell which of
/// its rows are new without shipping the whole logbook to the frontend.
pub fn logbook_fingerprints(db: &DbShape) -> Vec<String> {
    db.mark_logbook.iter().map(MarkLogbookEntry::fingerprint).collect()
}

// ── Focus ───────────────────────────────────────────────────────────────────

pub fn add_focus_session(db: &mut DbShape, duration_minutes: f64, tag: String, completed: bool) {
    db.focus_sessions.insert(
        0,
        FocusSession { id: uid(), date: today_iso(), duration_minutes, tag, completed },
    );
}

/// Credits finished focus minutes toward today's study hours.
pub fn add_study_minutes(db: &mut DbShape, minutes: f64) -> Result<()> {
    let current = today_metric(db).study_hours;
    let hours = ((current + minutes / 60.0) * 10.0).round() / 10.0;
    update_today_metric(db, MetricPatch { study_hours: Some(hours), ..Default::default() })
}

pub fn save_focus_settings(db: &mut DbShape, settings: FocusSettings) {
    db.focus_settings = settings;
}

// ── Tasks ───────────────────────────────────────────────────────────────────

pub fn add_task(
    db: &mut DbShape,
    title: String,
    subject: String,
    due_date: String,
    mode: AppMode,
) -> Result<()> {
    refuse_if_locked(db)?;
    db.tasks.insert(
        0,
        Task { id: uid(), title, subject, due_date, completed: false, completed_on: None, mode },
    );
    Ok(())
}

pub fn toggle_task_done(db: &mut DbShape, id: &str) -> Result<()> {
    refuse_if_locked(db)?;
    if let Some(t) = db.tasks.iter_mut().find(|t| t.id == id) {
        t.completed = !t.completed;
        // ticking stamps today; unticking takes the stamp back, so the record
        // never claims a day for something that is not done
        t.completed_on = t.completed.then(today_iso);
    }
    Ok(())
}

pub fn delete_task(db: &mut DbShape, id: &str) -> Result<()> {
    refuse_if_locked(db)?;
    db.tasks.retain(|t| t.id != id);
    Ok(())
}

// ── DPPs ────────────────────────────────────────────────────────────────────

/// Bring today's `dpps_got` / `dpps_complete` in line with today's DPP list.
///
/// The score, the charts and Home read those two counters, so they stay the
/// numbers everything divides — the list is where they come from now. It runs
/// inside the same mutation as the change that needs it, so the counters can
/// never disagree with the list a moment later. Only *today* is synced: a past
/// day's counters are history, and a DPP list only ever changes for today.
fn sync_dpp_counters(db: &mut DbShape) -> Result<()> {
    let today = today_iso();
    let got = db.dpps.iter().filter(|d| d.date == today).count() as f64;
    let done = db.dpps.iter().filter(|d| d.date == today && d.done).count() as f64;
    update_today_metric(
        db,
        MetricPatch { dpps_got: Some(got), dpps_complete: Some(done), ..Default::default() },
    )
}

pub fn add_dpp(db: &mut DbShape, subject: String, topic: String, teacher: String) -> Result<()> {
    refuse_if_locked(db)?;
    db.dpps.insert(
        0,
        DppItem {
            id: uid(),
            date: today_iso(),
            subject,
            topic,
            teacher,
            done: false,
            done_on: None,
        },
    );
    sync_dpp_counters(db)
}

pub fn toggle_dpp_done(db: &mut DbShape, id: &str) -> Result<()> {
    refuse_if_locked(db)?;
    if let Some(d) = db.dpps.iter_mut().find(|d| d.id == id) {
        d.done = !d.done;
        d.done_on = d.done.then(today_iso);
    }
    sync_dpp_counters(db)
}

pub fn delete_dpp(db: &mut DbShape, id: &str) -> Result<()> {
    refuse_if_locked(db)?;
    db.dpps.retain(|d| d.id != id);
    sync_dpp_counters(db)
}

// ── Topics ──────────────────────────────────────────────────────────────────

pub fn add_topic(db: &mut DbShape, name: String, kind: TopicType) -> Result<()> {
    refuse_if_locked(db)?;
    db.topics.insert(
        0,
        TopicItem { id: uid(), date: today_iso(), name, kind, done: false, done_on: None },
    );
    Ok(())
}

pub fn toggle_topic_done(db: &mut DbShape, id: &str) -> Result<()> {
    refuse_if_locked(db)?;
    if let Some(t) = db.topics.iter_mut().find(|t| t.id == id) {
        t.done = !t.done;
        t.done_on = t.done.then(today_iso);
    }
    Ok(())
}

pub fn delete_topic(db: &mut DbShape, id: &str) -> Result<()> {
    refuse_if_locked(db)?;
    db.topics.retain(|t| t.id != id);
    Ok(())
}

// ── Habits ──────────────────────────────────────────────────────────────────

pub fn add_habit(db: &mut DbShape, name: String, priority: Priority) {
    db.habits.push(Habit { id: uid(), name, priority, legacy_key: None });
}

pub fn set_habit_priority(db: &mut DbShape, id: &str, priority: Priority) {
    if let Some(h) = db.habits.iter_mut().find(|h| h.id == id) {
        h.priority = priority;
    }
}

/// Deleting a habit takes its log rows with it — an orphaned row would score a
/// habit that no longer exists.
pub fn delete_habit(db: &mut DbShape, id: &str) {
    db.habits.retain(|h| h.id != id);
    db.habit_log.retain(|l| l.habit_id != id);
}

/// Habit ids ticked on the given date.
pub fn habits_done_on(db: &DbShape, date: &str) -> Vec<String> {
    db.habit_log
        .iter()
        .filter(|l| l.date == date)
        .map(|l| l.habit_id.clone())
        .collect()
}

pub fn toggle_habit_today(db: &mut DbShape, id: &str) -> Result<()> {
    refuse_if_locked(db)?;
    let today = today_iso();

    let existed = db.habit_log.iter().any(|l| l.date == today && l.habit_id == id);
    if existed {
        db.habit_log.retain(|l| !(l.date == today && l.habit_id == id));
    } else {
        db.habit_log.push(HabitLogEntry { id: uid(), date: today.clone(), habit_id: id.to_string() });
    }

    // Keep the Growth Tracker's streak matrix (reading_habit / revision_habit)
    // in step. Habits have two representations and this is the bridge between
    // them; if you touch habit storage, keep it working.
    let legacy = db.habits.iter().find(|h| h.id == id).and_then(|h| h.legacy_key);
    if let Some(key) = legacy {
        if let Some(m) = db.daily_metrics.iter_mut().find(|m| m.date == today) {
            let now_done = !existed;
            match key {
                LegacyHabitKey::ReadingHabit => m.reading_habit = now_done,
                LegacyHabitKey::RevisionHabit => m.revision_habit = now_done,
            }
        }
    }
    Ok(())
}

// ── Tracks and mode ─────────────────────────────────────────────────────────

pub fn set_track_priority(db: &mut DbShape, id: TrackId, priority: Priority) {
    db.track_priorities.set(id, priority);
}

pub fn set_app_mode(db: &mut DbShape, mode: AppMode) {
    db.app_mode = mode;
}

pub fn set_daily_log_layout(db: &mut DbShape, mode: AppMode, layout: Vec<WidgetPlacement>) {
    db.daily_log_layout.set(mode, layout);
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A database where today has actually been logged. It goes through
    /// `update_today_metric` rather than pushing a row directly, because that
    /// is now the only thing that creates one — reading no longer does.
    fn db_with_today() -> DbShape {
        let mut db = seed::fresh_db();
        update_today_metric(&mut db, MetricPatch { study_hours: Some(1.0), ..Default::default() })
            .unwrap();
        db
    }

    #[test]
    fn reading_today_does_not_create_a_day() {
        let db = seed::fresh_db();
        let m = today_metric(&db);
        assert_eq!(m.date, today_iso());
        assert!(
            db.daily_metrics.is_empty(),
            "opening the app must leave no logged day behind — otherwise every \
             day MIS was merely launched scores zero in the charts forever"
        );
    }

    #[test]
    fn the_first_edit_is_what_creates_the_day() {
        let mut db = seed::fresh_db();
        update_today_metric(&mut db, MetricPatch { water_count: Some(1.0), ..Default::default() })
            .unwrap();
        assert_eq!(db.daily_metrics.len(), 1);
        assert_eq!(db.daily_metrics[0].date, today_iso());
    }

    #[test]
    fn a_day_that_was_never_logged_cannot_be_submitted() {
        let mut db = seed::fresh_db();
        assert!(matches!(lock_today(&mut db), Err(MisError::NotFound(_))));
    }

    #[test]
    fn a_locked_day_refuses_every_write_against_it() {
        let mut db = db_with_today();
        lock_today(&mut db).unwrap();

        let habit = db.habits[0].id.clone();
        assert!(matches!(
            update_today_metric(&mut db, MetricPatch { water_count: Some(5.0), ..Default::default() }),
            Err(MisError::DayLocked)
        ));
        assert!(matches!(toggle_habit_today(&mut db, &habit), Err(MisError::DayLocked)));
        assert!(matches!(add_topic(&mut db, "x".into(), TopicType::Taught), Err(MisError::DayLocked)));
    }

    #[test]
    fn unlocking_restores_writes_and_keeps_the_submit_stamp() {
        let mut db = db_with_today();
        let hash = lock_today(&mut db).unwrap();
        unlock_today(&mut db).unwrap();

        assert!(update_today_metric(&mut db, MetricPatch { water_count: Some(5.0), ..Default::default() }).is_ok());
        let m = db.daily_metrics.iter().find(|m| m.date == today_iso()).unwrap();
        assert_eq!(m.submit_hash.as_deref(), Some(hash.as_str()));
        assert!(m.submitted_at.is_some());
    }

    #[test]
    fn editing_a_locked_day_behind_the_apps_back_is_detected() {
        let mut db = db_with_today();
        lock_today(&mut db).unwrap();
        assert!(day_is_intact(&db, &today_iso()));

        // Exactly what tampering with the vault file would look like.
        db.daily_metrics.iter_mut().find(|m| m.date == today_iso()).unwrap().water_count = 99.0;
        assert!(!day_is_intact(&db, &today_iso()));
    }

    #[test]
    fn dpp_list_drives_the_days_counters() {
        let mut db = db_with_today();
        let counters = |db: &DbShape| {
            let m = db.daily_metrics.iter().find(|m| m.date == today_iso()).unwrap();
            (m.dpps_got, m.dpps_complete)
        };

        add_dpp(&mut db, "Physics".into(), "Kinematics".into(), "Rao".into()).unwrap();
        add_dpp(&mut db, "Maths".into(), "Integration".into(), "Iyer".into()).unwrap();
        assert_eq!(counters(&db), (2.0, 0.0));

        let id = db.dpps[0].id.clone();
        toggle_dpp_done(&mut db, &id).unwrap();
        assert_eq!(counters(&db), (2.0, 1.0));
        assert_eq!(db.dpps[0].done_on.as_deref(), Some(today_iso().as_str()));

        toggle_dpp_done(&mut db, &id).unwrap();
        assert_eq!(counters(&db), (2.0, 0.0));
        assert_eq!(db.dpps[0].done_on, None);

        delete_dpp(&mut db, &id).unwrap();
        assert_eq!(counters(&db), (1.0, 0.0));
    }

    #[test]
    fn dpp_details_are_kept() {
        let mut db = db_with_today();
        add_dpp(&mut db, "Chemistry".into(), "Mole concept".into(), "Sharma".into()).unwrap();
        let d = &db.dpps[0];
        assert_eq!((d.subject.as_str(), d.topic.as_str(), d.teacher.as_str()),
                   ("Chemistry", "Mole concept", "Sharma"));
    }

    #[test]
    fn a_locked_day_refuses_dpp_changes() {
        let mut db = db_with_today();
        add_dpp(&mut db, "Physics".into(), "Optics".into(), "Rao".into()).unwrap();
        lock_today(&mut db).unwrap();
        assert!(add_dpp(&mut db, "x".into(), "y".into(), "z".into()).is_err());
        let id = db.dpps[0].id.clone();
        assert!(toggle_dpp_done(&mut db, &id).is_err());
        assert!(delete_dpp(&mut db, &id).is_err());
    }

    #[test]
    fn a_day_locked_with_dpps_notices_a_changed_teacher() {
        let mut db = db_with_today();
        add_dpp(&mut db, "Physics".into(), "Optics".into(), "Rao".into()).unwrap();
        lock_today(&mut db).unwrap();
        assert!(day_is_intact(&db, &today_iso()));
        db.dpps[0].teacher = "Someone else".into();
        assert!(!day_is_intact(&db, &today_iso()));
    }

    #[test]
    fn a_vault_from_before_dpp_lists_still_loads() {
        let dpp: DppItem = serde_json::from_str(r#"{"id":"d","date":"2026-01-01","done":false}"#).unwrap();
        assert_eq!((dpp.subject.as_str(), dpp.topic.as_str(), dpp.teacher.as_str()), ("", "", ""));
    }

    #[test]
    fn ticking_a_task_stamps_today_and_unticking_takes_it_back() {
        let mut db = db_with_today();
        add_task(&mut db, "Finish DPP".into(), String::new(), String::new(), AppMode::Academic)
            .unwrap();
        let id = db.tasks[0].id.clone();

        toggle_task_done(&mut db, &id).unwrap();
        assert!(db.tasks[0].completed);
        assert_eq!(db.tasks[0].completed_on.as_deref(), Some(today_iso().as_str()));

        toggle_task_done(&mut db, &id).unwrap();
        assert!(!db.tasks[0].completed);
        assert_eq!(db.tasks[0].completed_on, None, "an undone task must not claim a day");
    }

    #[test]
    fn ticking_a_topic_stamps_today_and_unticking_takes_it_back() {
        let mut db = db_with_today();
        add_topic(&mut db, "Work & Energy".into(), TopicType::Revise).unwrap();
        let id = db.topics[0].id.clone();

        toggle_topic_done(&mut db, &id).unwrap();
        assert_eq!(db.topics[0].done_on.as_deref(), Some(today_iso().as_str()));

        toggle_topic_done(&mut db, &id).unwrap();
        assert_eq!(db.topics[0].done_on, None);
    }

    #[test]
    fn a_vault_from_before_completion_dates_still_loads() {
        // saved with neither field — both must default rather than fail the load
        let task: Task = serde_json::from_str(
            r#"{"id":"t","title":"x","completed":true}"#,
        )
        .unwrap();
        assert_eq!(task.completed_on, None);
        let topic: TopicItem = serde_json::from_str(
            r#"{"id":"p","date":"2026-01-01","name":"x","type":"revise","done":true}"#,
        )
        .unwrap();
        assert_eq!(topic.done_on, None);
    }

    #[test]
    fn ticking_a_legacy_habit_mirrors_into_the_streak_matrix() {
        let mut db = db_with_today();
        let reading = db
            .habits
            .iter()
            .find(|h| h.legacy_key == Some(LegacyHabitKey::ReadingHabit))
            .unwrap()
            .id
            .clone();

        toggle_habit_today(&mut db, &reading).unwrap();
        assert!(db.daily_metrics.iter().find(|m| m.date == today_iso()).unwrap().reading_habit);

        toggle_habit_today(&mut db, &reading).unwrap();
        assert!(!db.daily_metrics.iter().find(|m| m.date == today_iso()).unwrap().reading_habit);
    }

    #[test]
    fn deleting_a_habit_removes_its_log_rows_too() {
        let mut db = db_with_today();
        let id = db.habits[0].id.clone();
        toggle_habit_today(&mut db, &id).unwrap();
        assert_eq!(db.habit_log.len(), 1);

        delete_habit(&mut db, &id);
        assert!(db.habit_log.is_empty());
    }

    #[test]
    fn free_time_unlocks_only_when_hours_and_papers_are_both_done() {
        let mut db = db_with_today();
        update_today_metric(&mut db, MetricPatch {
            study_hours: Some(6.0), dpps_got: Some(4.0), dpps_complete: Some(2.0), ..Default::default()
        }).unwrap();
        assert!(!db.user.free_time_unlocked, "papers unfinished");

        update_today_metric(&mut db, MetricPatch { dpps_complete: Some(4.0), ..Default::default() }).unwrap();
        assert!(db.user.free_time_unlocked);
    }
}

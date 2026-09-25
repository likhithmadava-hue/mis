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

use crate::dates::{is_after_today, now_iso, parse_iso, today_iso, tomorrow_iso};
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

/// Room for a subject, a topic and a note. Generous — these are sentences a
/// person types — but bounded, so nothing can write a page of text into every
/// row of a list that shows one line.
const SESSION_SUBJECT_MAX: usize = 60;
const SESSION_CHAPTER_MAX: usize = 120;
const SESSION_NOTE_MAX: usize = 300;

/// Record a focus round together with what it was for.
///
/// **A session without a subject, a topic and a reason is refused.** Asking
/// before the round starts is the whole feature: a tag typed as an afterthought
/// is exactly what made the old log unable to say where the hours went. That
/// makes this the guard, not the form — the dialog that asks is only the
/// explanation, so a bug there can show the wrong thing but cannot write a
/// nameless session.
///
/// `reason == Other` additionally needs the note, because "other" on its own
/// tells the reader nothing.
pub fn add_focus_session(
    db: &mut DbShape,
    duration_minutes: f64,
    completed: bool,
    details: SessionDetails,
) -> Result<()> {
    // Runs of whitespace collapse so "Laws  of motion" and "Laws of motion" are
    // one topic in the suggestion list and any later grouping.
    let tidy = |s: &str| s.split_whitespace().collect::<Vec<_>>().join(" ");
    let subject = tidy(&details.subject);
    let chapter = tidy(&details.chapter);
    let note = details.reason_note.trim().to_string();

    if subject.is_empty() {
        return Err(MisError::Invalid("Pick a subject for this session".into()));
    }
    if chapter.is_empty() {
        return Err(MisError::Invalid("Pick or type the topic you are working on".into()));
    }
    let Some(reason) = details.reason else {
        return Err(MisError::Invalid("Say why you are studying this".into()));
    };
    if reason == SessionReason::Other && note.is_empty() {
        return Err(MisError::Invalid(
            "\"Something else\" needs a few words on what the reason is".into(),
        ));
    }
    for (what, text, max) in [
        ("subject", &subject, SESSION_SUBJECT_MAX),
        ("topic", &chapter, SESSION_CHAPTER_MAX),
        ("note", &note, SESSION_NOTE_MAX),
    ] {
        if text.chars().count() > max {
            return Err(MisError::Invalid(format!("The {what} is too long — {max} characters at most")));
        }
    }

    db.focus_sessions.insert(
        0,
        FocusSession {
            id: uid(),
            date: today_iso(),
            duration_minutes,
            tag: chapter.clone(),
            completed,
            subject,
            chapter,
            reason: Some(reason),
            reason_note: note,
        },
    );
    Ok(())
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

/// The guard for adding a task. **A task due after today may be added even when
/// today is locked**: the lock protects today's record, and tomorrow's work is
/// not part of it. That is what lets a student plan the next session after
/// submitting the day. A task due today, or with no valid due date, is still
/// refused — an undated task is treated as today's, the safe side of the lock.
fn refuse_task_if_locked(db: &DbShape, due_date: &str) -> Result<()> {
    if is_after_today(due_date) {
        return Ok(());
    }
    refuse_if_locked(db)
}

fn new_task(
    title: String,
    subject: String,
    due_date: String,
    mode: AppMode,
    details: TaskDetails,
) -> Task {
    Task {
        id: uid(),
        title,
        subject,
        due_date,
        completed: false,
        completed_on: None,
        mode,
        // trimmed here so "Practice PYQ " and "Practice PYQ" are one kind when
        // the frontend counts how often each has been used
        kind: details.kind.trim().to_string(),
        chapter: details.chapter.trim().to_string(),
        reference: details.reference.trim().to_string(),
        problems: details.problems,
    }
}

pub fn add_task(
    db: &mut DbShape,
    title: String,
    subject: String,
    due_date: String,
    mode: AppMode,
    details: TaskDetails,
) -> Result<()> {
    refuse_task_if_locked(db, &due_date)?;
    db.tasks.insert(0, new_task(title, subject, due_date, mode, details));
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

fn new_topic(name: String, kind: TopicType, details: TopicDetails) -> TopicItem {
    TopicItem {
        id: uid(),
        date: today_iso(),
        name,
        kind,
        done: false,
        done_on: None,
        subject: details.subject.trim().to_string(),
        chapter: details.chapter.trim().to_string(),
        note: details.note.trim().to_string(),
    }
}

pub fn add_topic(
    db: &mut DbShape,
    name: String,
    kind: TopicType,
    details: TopicDetails,
) -> Result<()> {
    refuse_if_locked(db)?;
    db.topics.insert(0, new_topic(name, kind, details));
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

// ── Session wrap-up and the journal ─────────────────────────────────────────

/// A doubt the student is leaving behind, as it arrives from the wrap-up.
#[derive(Debug, Clone, serde::Deserialize)]
pub struct WrapDoubt {
    pub title: String,
    #[serde(default)]
    pub subject: String,
    #[serde(default)]
    pub chapter: String,
    #[serde(default)]
    pub note: String,
    /// which "left to" list it lands in
    pub list: DoubtList,
}

/// A task planned for the next session. `due_date` is optional and defaults to
/// tomorrow.
#[derive(Debug, Clone, Default, serde::Deserialize)]
#[serde(default)]
pub struct WrapPlanned {
    pub title: String,
    pub subject: String,
    pub kind: String,
    pub chapter: String,
    pub reference: String,
    pub problems: u32,
    pub due_date: Option<String>,
}

/// Everything the wrap-up panel sends: the three levels, the misses a practice
/// session produced, and the note.
#[derive(Debug, Clone, Default, serde::Deserialize)]
#[serde(default)]
pub struct WrapInput {
    pub subject: String,
    pub chapter: String,
    pub kind: String,
    pub minutes: f64,
    pub pyq: Option<PyqResult>,
    /// level 1 — tasks to mark done
    pub done_task_ids: Vec<String>,
    /// level 1 — today's DPPs finished in this session
    pub done_dpp_ids: Vec<String>,
    /// level 1 — Left to revise / Left to solve topics finished in this session
    pub done_topic_ids: Vec<String>,
    /// level 2 — doubts left, each landing in Left to revise or Left to solve
    pub doubts: Vec<WrapDoubt>,
    /// level 3 — tasks for the next session
    pub next_plan: Vec<WrapPlanned>,
    /// one logbook row per wrong PYQ
    pub mistakes: Vec<NewEntry>,
    pub note: String,
}

/// What a wrap-up wrote, for the confirmation the panel shows.
#[derive(Debug, Clone, serde::Serialize)]
pub struct WrapOutcome {
    pub journal_id: String,
    pub ticked: usize,
    pub doubts_added: usize,
    pub planned: usize,
    pub mistakes_added: usize,
}

fn invalid(msg: &str) -> MisError {
    MisError::Invalid(msg.into())
}

/// The ids in order, each once — so a double-sent tick counts once.
fn unique(ids: &[String]) -> Vec<&str> {
    let mut out: Vec<&str> = Vec::new();
    for id in ids {
        if !out.contains(&id.as_str()) {
            out.push(id);
        }
    }
    out
}

/// Wrap up a study session: tick what got done, record the doubts left, plan the
/// next session, log the misses, and write the journal entry.
///
/// **Everything is validated before anything is written**, so a refusal part of
/// the way through leaves the database exactly as it was. (`AppState::mutate`
/// also works on a copy, but this function must not rely on that — it is called
/// directly by the tests, and it should be atomic on its own terms.)
///
/// Ticking tasks and adding doubts touch *today's* record, so they are refused
/// on a locked day like every other write to it. A next-session task is refused
/// only if it is due today or earlier — see [`refuse_task_if_locked`]. The
/// journal and the logbook are not day-locked, the same as the logbook has
/// always been.
pub fn session_wrap(db: &mut DbShape, input: WrapInput) -> Result<WrapOutcome> {
    // ── validate ────────────────────────────────────────────────────────────
    if !input.minutes.is_finite() || input.minutes < 0.0 {
        return Err(invalid("minutes must be zero or more"));
    }
    if let Some(p) = &input.pyq {
        if !p.marks.is_finite() || !p.max_marks.is_finite() || p.max_marks < 0.0 {
            return Err(invalid("the PYQ marks are not valid numbers"));
        }
    }
    if input.doubts.iter().any(|d| d.title.trim().is_empty()) {
        return Err(invalid("a doubt needs a title"));
    }
    if input.next_plan.iter().any(|p| p.title.trim().is_empty()) {
        return Err(invalid("a planned task needs a title"));
    }

    let done_ids = unique(&input.done_task_ids);
    for id in &done_ids {
        if !db.tasks.iter().any(|t| t.id == *id) {
            return Err(MisError::NotFound(format!("no task with id {id}")));
        }
    }
    let done_dpp_ids = unique(&input.done_dpp_ids);
    for id in &done_dpp_ids {
        if !db.dpps.iter().any(|d| d.id == *id) {
            return Err(MisError::NotFound(format!("no DPP with id {id}")));
        }
    }
    let done_topic_ids = unique(&input.done_topic_ids);
    for id in &done_topic_ids {
        match db.topics.iter().find(|t| t.id == *id) {
            None => return Err(MisError::NotFound(format!("no topic with id {id}"))),
            // "Taught in school" is a record of lessons that happened, so there
            // is nothing in it to finish — the checklist never offers a tick
            Some(t) if t.kind == TopicType::Taught => {
                return Err(invalid("a taught topic cannot be ticked off"));
            }
            Some(_) => {}
        }
    }
    let ticks_today =
        !done_ids.is_empty() || !done_dpp_ids.is_empty() || !done_topic_ids.is_empty();

    let mut planned_due = Vec::with_capacity(input.next_plan.len());
    for p in &input.next_plan {
        let due = match p.due_date.as_deref().map(str::trim).filter(|d| !d.is_empty()) {
            Some(d) if parse_iso(d).is_some() => d.to_string(),
            Some(_) => return Err(invalid("a due date must look like 2026-09-21")),
            None => tomorrow_iso(),
        };
        refuse_task_if_locked(db, &due)?;
        planned_due.push(due);
    }

    if ticks_today || !input.doubts.is_empty() {
        refuse_if_locked(db)?;
    }

    let has_content = input.minutes > 0.0
        || input.pyq.is_some()
        || ticks_today
        || !input.doubts.is_empty()
        || !input.next_plan.is_empty()
        || !input.mistakes.is_empty()
        || !input.note.trim().is_empty();
    if !has_content {
        return Err(invalid("there is nothing to log for this session"));
    }

    // ── write ───────────────────────────────────────────────────────────────
    // Nothing below can be refused: every check above has passed, and the one
    // fallible call (`sync_dpp_counters`) can only fail on a locked day, which
    // was ruled out above whenever a DPP is ticked.
    let today = today_iso();

    let mut tasks_done =
        Vec::with_capacity(done_ids.len() + done_dpp_ids.len() + done_topic_ids.len());
    let mut ticked = 0;
    for id in &done_ids {
        if let Some(t) = db.tasks.iter_mut().find(|t| t.id == *id) {
            tasks_done.push(JournalTask { title: t.title.clone(), kind: t.kind.clone() });
            // idempotent, not a toggle: a task already done stays done, on the
            // day it was really finished
            if !t.completed {
                t.completed = true;
                t.completed_on = Some(today.clone());
                ticked += 1;
            }
        }
    }
    for id in &done_dpp_ids {
        if let Some(d) = db.dpps.iter_mut().find(|d| d.id == *id) {
            tasks_done.push(JournalTask {
                title: if d.topic.is_empty() { "DPP".into() } else { d.topic.clone() },
                kind: "DPP".into(),
            });
            if !d.done {
                d.done = true;
                d.done_on = Some(today.clone());
                ticked += 1;
            }
        }
    }
    for id in &done_topic_ids {
        if let Some(t) = db.topics.iter_mut().find(|t| t.id == *id) {
            tasks_done.push(JournalTask {
                title: t.name.clone(),
                kind: match t.kind {
                    TopicType::Solve => "Solve",
                    _ => "Revise",
                }
                .into(),
            });
            if !t.done {
                t.done = true;
                t.done_on = Some(today.clone());
                ticked += 1;
            }
        }
    }
    if !done_dpp_ids.is_empty() {
        // the DPP score reads the day's two counters, so they move in this write
        sync_dpp_counters(db)?;
    }

    let mut doubts = Vec::with_capacity(input.doubts.len());
    for d in &input.doubts {
        doubts.push(JournalDoubt {
            title: d.title.trim().to_string(),
            subject: d.subject.trim().to_string(),
            chapter: d.chapter.trim().to_string(),
            note: d.note.trim().to_string(),
            list: d.list,
        });
        db.topics.insert(
            0,
            new_topic(
                d.title.trim().to_string(),
                d.list.topic_type(),
                TopicDetails {
                    subject: d.subject.clone(),
                    chapter: d.chapter.clone(),
                    note: d.note.clone(),
                },
            ),
        );
    }

    let mut next_plan = Vec::with_capacity(input.next_plan.len());
    for (p, due) in input.next_plan.iter().zip(planned_due) {
        next_plan.push(JournalPlanned {
            title: p.title.trim().to_string(),
            kind: p.kind.trim().to_string(),
            due_date: due.clone(),
        });
        db.tasks.insert(
            0,
            new_task(
                p.title.trim().to_string(),
                p.subject.trim().to_string(),
                due,
                AppMode::Academic,
                TaskDetails {
                    kind: p.kind.clone(),
                    chapter: p.chapter.clone(),
                    reference: p.reference.clone(),
                    problems: p.problems,
                },
            ),
        );
    }

    let mistakes_added = add_mark_entries(db, input.mistakes);

    let journal_id = uid();
    db.journal.insert(
        0,
        JournalEntry {
            id: journal_id.clone(),
            date: today,
            created_at: now_iso(),
            // a wrapped-up study session belongs to the Academic logbook
            mode: AppMode::Academic,
            title: String::new(),
            subject: input.subject.trim().to_string(),
            chapter: input.chapter.trim().to_string(),
            kind: input.kind.trim().to_string(),
            minutes: input.minutes,
            pyq: input.pyq,
            tasks_done,
            doubts: doubts.clone(),
            next_plan: next_plan.clone(),
            note: input.note.trim().to_string(),
        },
    );

    Ok(WrapOutcome {
        journal_id,
        ticked,
        doubts_added: doubts.len(),
        planned: next_plan.len(),
        mistakes_added,
    })
}

/// A journal entry written by hand rather than produced by a wrap-up: a page
/// of the Academic logbook, or a day of the Life diary.
#[derive(Debug, Clone, Default, serde::Deserialize)]
#[serde(default)]
pub struct NewJournalEntry {
    /// which journal it belongs to
    pub mode: AppMode,
    /// `YYYY-MM-DD`; empty means today. **Backdating is allowed** — catching up
    /// on yesterday is the normal way a diary gets written, and the journal is
    /// not part of the scored, lockable day record.
    pub date: String,
    pub title: String,
    pub subject: String,
    pub chapter: String,
    pub kind: String,
    pub minutes: f64,
    pub note: String,
}

/// The fields of an entry that can be rewritten afterwards.
///
/// The three structured levels of a session are deliberately absent: they are a
/// record of what happened and stay as written. Everything a person *wrote* —
/// the title, the body, what it was about — can be edited, because a diary you
/// cannot correct is one people stop writing in.
#[derive(Debug, Clone, Default, serde::Deserialize)]
#[serde(default)]
pub struct JournalPatch {
    pub date: Option<String>,
    pub title: Option<String>,
    pub subject: Option<String>,
    pub chapter: Option<String>,
    pub kind: Option<String>,
    pub minutes: Option<f64>,
    pub note: Option<String>,
}

fn check_minutes(minutes: f64) -> Result<()> {
    if !minutes.is_finite() || minutes < 0.0 {
        return Err(invalid("minutes must be zero or more"));
    }
    Ok(())
}

fn check_date(date: &str) -> Result<String> {
    let trimmed = date.trim();
    if trimmed.is_empty() {
        return Ok(today_iso());
    }
    if parse_iso(trimmed).is_none() {
        return Err(invalid("a date must look like 2026-09-23"));
    }
    Ok(trimmed.to_string())
}

/// Write a journal entry by hand. Returns its id.
///
/// Not day-locked: the journal records what a day *was*, and locking the log
/// is about freezing the day's scored numbers, not about forbidding you from
/// writing down what happened.
pub fn add_journal_entry(db: &mut DbShape, input: NewJournalEntry) -> Result<String> {
    check_minutes(input.minutes)?;
    let date = check_date(&input.date)?;
    if input.title.trim().is_empty() && input.note.trim().is_empty() {
        return Err(invalid("an entry needs a title or something written in it"));
    }

    let id = uid();
    db.journal.insert(
        0,
        JournalEntry {
            id: id.clone(),
            date,
            created_at: now_iso(),
            mode: input.mode,
            title: input.title.trim().to_string(),
            subject: input.subject.trim().to_string(),
            chapter: input.chapter.trim().to_string(),
            kind: input.kind.trim().to_string(),
            minutes: input.minutes,
            pyq: None,
            tasks_done: Vec::new(),
            doubts: Vec::new(),
            next_plan: Vec::new(),
            note: input.note.trim().to_string(),
        },
    );
    Ok(id)
}

/// Rewrite the written parts of an entry. See [`JournalPatch`] for what is
/// deliberately not editable.
pub fn update_journal_entry(db: &mut DbShape, id: &str, patch: JournalPatch) -> Result<()> {
    if let Some(m) = patch.minutes {
        check_minutes(m)?;
    }
    let date = patch.date.as_deref().map(check_date).transpose()?;

    let Some(e) = db.journal.iter_mut().find(|e| e.id == id) else {
        return Err(MisError::NotFound(format!("no journal entry with id {id}")));
    };
    if let Some(v) = date { e.date = v }
    if let Some(v) = patch.title { e.title = v.trim().to_string() }
    if let Some(v) = patch.subject { e.subject = v.trim().to_string() }
    if let Some(v) = patch.chapter { e.chapter = v.trim().to_string() }
    if let Some(v) = patch.kind { e.kind = v.trim().to_string() }
    if let Some(v) = patch.minutes { e.minutes = v }
    if let Some(v) = patch.note { e.note = v.trim().to_string() }
    Ok(())
}

pub fn delete_journal_entry(db: &mut DbShape, id: &str) {
    db.journal.retain(|e| e.id != id);
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
    use crate::dates::iso_days_ago;

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
        assert!(matches!(add_topic(&mut db, "x".into(), TopicType::Taught, TopicDetails::default()), Err(MisError::DayLocked)));
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
        add_task(&mut db, "Finish DPP".into(), String::new(), String::new(), AppMode::Academic, TaskDetails::default())
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
        add_topic(&mut db, "Work & Energy".into(), TopicType::Revise, TopicDetails::default()).unwrap();
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

    // ── session wrap-up and the journal ─────────────────────────────────────

    fn task_with_kind(db: &mut DbShape, title: &str, kind: &str, due: &str) -> String {
        add_task(
            db,
            title.into(),
            "Physics".into(),
            due.into(),
            AppMode::Academic,
            TaskDetails { kind: kind.into(), ..Default::default() },
        )
        .unwrap();
        db.tasks[0].id.clone()
    }

    fn miss(chapter: &str) -> NewEntry {
        NewEntry {
            date: today_iso(),
            subject: "Physics".into(),
            chapter: chapter.into(),
            grade: String::new(),
            score: 0.0,
            max_score: 4.0,
            difficulty: Difficulty::Hard,
            time_spent: 3.0,
            mistake_reason: MistakeReason::Conceptual,
            notes: "PYQ phy4-q7".into(),
        }
    }

    fn doubt(title: &str, list: DoubtList) -> WrapDoubt {
        WrapDoubt {
            title: title.into(),
            subject: "Physics".into(),
            chapter: "Rotational Motion".into(),
            note: "why does torque flip".into(),
            list,
        }
    }

    fn snapshot(db: &DbShape) -> String {
        serde_json::to_string(db).unwrap()
    }

    #[test]
    fn a_task_keeps_its_kind_and_the_kind_is_trimmed() {
        let mut db = seed::fresh_db();
        add_task(
            &mut db,
            "Ch 5".into(),
            "Physics".into(),
            String::new(),
            AppMode::Academic,
            TaskDetails {
                kind: "  Reference problems ".into(),
                reference: " HC Verma ".into(),
                problems: 20,
                ..Default::default()
            },
        )
        .unwrap();
        let t = &db.tasks[0];
        assert_eq!(t.kind, "Reference problems");
        assert_eq!(t.reference, "HC Verma");
        assert_eq!(t.problems, 20);
    }

    #[test]
    fn a_locked_day_still_accepts_a_task_due_after_today() {
        let mut db = db_with_today();
        lock_today(&mut db).unwrap();

        assert!(add_task(
            &mut db, "Tomorrow".into(), String::new(), tomorrow_iso(), AppMode::Academic,
            TaskDetails::default(),
        )
        .is_ok());
    }

    #[test]
    fn a_locked_day_still_refuses_a_task_due_today_or_undated() {
        let mut db = db_with_today();
        lock_today(&mut db).unwrap();

        for due in [today_iso(), String::new(), "garbage".into()] {
            assert!(
                matches!(
                    add_task(&mut db, "x".into(), String::new(), due, AppMode::Academic, TaskDetails::default()),
                    Err(MisError::DayLocked)
                ),
                "a task that is not clearly in the future belongs to today's record"
            );
        }
        // and everything else about today stays refused
        let id = task_with_kind_unlocked(&mut db);
        assert!(matches!(toggle_task_done(&mut db, &id), Err(MisError::DayLocked)));
    }

    /// Adds a task straight into the list, bypassing the lock, so a locked-day
    /// test has something to try to tick.
    fn task_with_kind_unlocked(db: &mut DbShape) -> String {
        db.tasks.insert(0, Task { id: "t-locked".into(), title: "x".into(), ..Default::default() });
        "t-locked".into()
    }

    #[test]
    fn a_wrap_up_writes_all_three_levels_the_misses_and_the_journal() {
        let mut db = seed::fresh_db();
        let a = task_with_kind(&mut db, "Practice rotation PYQs", "Practice PYQ", &today_iso());
        let b = task_with_kind(&mut db, "HC Verma ch 5", "Reference problems", &today_iso());

        let out = session_wrap(
            &mut db,
            WrapInput {
                subject: "Physics".into(),
                chapter: "Rotational Motion".into(),
                kind: "Practice PYQ".into(),
                minutes: 45.0,
                pyq: Some(PyqResult { correct: 7, wrong: 2, skipped: 1, marks: 26.0, max_marks: 40.0 }),
                done_task_ids: vec![a.clone(), a.clone()],
                doubts: vec![doubt("Torque direction", DoubtList::Solve), doubt("Moment of inertia", DoubtList::Revise)],
                next_plan: vec![WrapPlanned { title: "Redo rotation misses".into(), kind: "Practice PYQ".into(), ..Default::default() }],
                mistakes: vec![miss("Rotational Motion"), miss("Rotational Motion")],
                note: "  felt slow on the last five  ".into(),
                ..Default::default()
            },
        )
        .unwrap();

        // level 1: the task is done, once, stamped today; the other is untouched
        assert_eq!(out.ticked, 1);
        assert!(db.tasks.iter().find(|t| t.id == a).unwrap().completed);
        assert_eq!(db.tasks.iter().find(|t| t.id == a).unwrap().completed_on.as_deref(), Some(today_iso().as_str()));
        assert!(!db.tasks.iter().find(|t| t.id == b).unwrap().completed);

        // level 2: each doubt is a topic in the right list, with its detail
        assert_eq!(out.doubts_added, 2);
        let solve = db.topics.iter().find(|t| t.name == "Torque direction").unwrap();
        assert_eq!(solve.kind, TopicType::Solve);
        assert_eq!(solve.chapter, "Rotational Motion");
        assert_eq!(solve.note, "why does torque flip");
        assert_eq!(db.topics.iter().find(|t| t.name == "Moment of inertia").unwrap().kind, TopicType::Revise);

        // level 3: the next-session task is due tomorrow by default
        assert_eq!(out.planned, 1);
        let next = db.tasks.iter().find(|t| t.title == "Redo rotation misses").unwrap();
        assert_eq!(next.due_date, tomorrow_iso());
        assert_eq!(next.kind, "Practice PYQ");
        assert!(!next.completed);

        // the misses went to the mistake log, one row each
        assert_eq!(out.mistakes_added, 2);
        assert_eq!(db.mark_logbook.len(), 2);

        // and the journal has one entry holding the session
        assert_eq!(db.journal.len(), 1);
        let j = &db.journal[0];
        assert_eq!(j.id, out.journal_id);
        assert_eq!(j.date, today_iso());
        assert_eq!(j.minutes, 45.0);
        assert_eq!(j.pyq.as_ref().unwrap().correct, 7);
        assert_eq!(j.tasks_done.len(), 1);
        assert_eq!(j.doubts.len(), 2);
        assert_eq!(j.next_plan[0].due_date, tomorrow_iso());
        assert_eq!(j.note, "felt slow on the last five");
    }

    #[test]
    fn a_wrap_up_that_fails_validation_writes_nothing() {
        let mut db = seed::fresh_db();
        let a = task_with_kind(&mut db, "A", "Practice PYQ", &today_iso());
        let before = snapshot(&db);

        // a good tick and a good doubt, then one task id that does not exist
        let err = session_wrap(
            &mut db,
            WrapInput {
                done_task_ids: vec![a, "no-such-task".into()],
                doubts: vec![doubt("D", DoubtList::Solve)],
                mistakes: vec![miss("X")],
                ..Default::default()
            },
        );
        assert!(matches!(err, Err(MisError::NotFound(_))));
        assert_eq!(snapshot(&db), before, "a refused wrap-up must leave nothing behind");

        // the same for a blank doubt title and a malformed due date
        for input in [
            WrapInput { minutes: 10.0, doubts: vec![doubt("  ", DoubtList::Revise)], ..Default::default() },
            WrapInput {
                minutes: 10.0,
                next_plan: vec![WrapPlanned { title: "x".into(), due_date: Some("tomorrow".into()), ..Default::default() }],
                ..Default::default()
            },
        ] {
            assert!(matches!(session_wrap(&mut db, input), Err(MisError::Invalid(_))));
            assert_eq!(snapshot(&db), before);
        }
    }

    #[test]
    fn an_empty_wrap_up_is_refused() {
        let mut db = seed::fresh_db();
        assert!(matches!(session_wrap(&mut db, WrapInput::default()), Err(MisError::Invalid(_))));
        assert!(db.journal.is_empty());
    }

    #[test]
    fn a_task_finished_earlier_keeps_its_original_day() {
        let mut db = seed::fresh_db();
        let id = task_with_kind(&mut db, "Old", "Practice PYQ", &today_iso());
        db.tasks[0].completed = true;
        db.tasks[0].completed_on = Some("2026-01-05".into());

        let out = session_wrap(&mut db, WrapInput { done_task_ids: vec![id], ..Default::default() }).unwrap();
        assert_eq!(out.ticked, 0, "it was already done, so nothing changed");
        assert_eq!(db.tasks[0].completed_on.as_deref(), Some("2026-01-05"));
        // it is still part of the story of this session
        assert_eq!(db.journal[0].tasks_done.len(), 1);
    }

    #[test]
    fn on_a_locked_day_the_wrap_up_refuses_ticks_and_doubts_but_can_still_plan() {
        let mut db = db_with_today();
        let id = task_with_kind(&mut db, "Today's", "Practice PYQ", &today_iso());
        lock_today(&mut db).unwrap();
        let before = snapshot(&db);

        assert!(matches!(
            session_wrap(&mut db, WrapInput { done_task_ids: vec![id], ..Default::default() }),
            Err(MisError::DayLocked)
        ));
        assert!(matches!(
            session_wrap(&mut db, WrapInput { doubts: vec![doubt("D", DoubtList::Solve)], ..Default::default() }),
            Err(MisError::DayLocked)
        ));
        // a next-session task due today is still today's record
        assert!(matches!(
            session_wrap(&mut db, WrapInput {
                next_plan: vec![WrapPlanned { title: "x".into(), due_date: Some(today_iso()), ..Default::default() }],
                ..Default::default()
            }),
            Err(MisError::DayLocked)
        ));
        assert_eq!(snapshot(&db), before, "every refusal above must have written nothing");

        // but planning tomorrow, logging the misses and writing the journal all work
        let out = session_wrap(
            &mut db,
            WrapInput {
                minutes: 30.0,
                next_plan: vec![WrapPlanned { title: "Tomorrow's set".into(), ..Default::default() }],
                mistakes: vec![miss("Optics")],
                ..Default::default()
            },
        )
        .unwrap();
        assert_eq!((out.planned, out.mistakes_added, out.ticked, out.doubts_added), (1, 1, 0, 0));
        assert_eq!(db.journal.len(), 1);
    }

    #[test]
    fn the_journal_still_reads_after_the_task_it_came_from_is_deleted() {
        let mut db = seed::fresh_db();
        let id = task_with_kind(&mut db, "Rotation PYQs", "Practice PYQ", &today_iso());
        session_wrap(&mut db, WrapInput { done_task_ids: vec![id.clone()], ..Default::default() }).unwrap();

        delete_task(&mut db, &id).unwrap();
        assert!(db.tasks.is_empty());
        assert_eq!(db.journal[0].tasks_done[0].title, "Rotation PYQs");
        assert_eq!(db.journal[0].tasks_done[0].kind, "Practice PYQ");
    }

    #[test]
    fn a_journal_note_can_be_edited_and_an_entry_deleted() {
        let mut db = seed::fresh_db();
        let out = session_wrap(&mut db, WrapInput { minutes: 20.0, ..Default::default() }).unwrap();

        update_journal_entry(
            &mut db,
            &out.journal_id,
            JournalPatch { note: Some("  better than yesterday ".into()), ..Default::default() },
        )
        .unwrap();
        assert_eq!(db.journal[0].note, "better than yesterday");
        assert!(matches!(
            update_journal_entry(&mut db, "nope", JournalPatch::default()),
            Err(MisError::NotFound(_))
        ));

        delete_journal_entry(&mut db, &out.journal_id);
        assert!(db.journal.is_empty());
    }

    #[test]
    fn a_vault_from_before_the_journal_still_loads() {
        // Exactly what an old vault looks like: no `journal`, and tasks and
        // topics without any of the new fields.
        let mut v = serde_json::to_value(seed::fresh_db()).unwrap();
        v.as_object_mut().unwrap().remove("journal");
        v["tasks"] = serde_json::json!([
            { "id": "t", "title": "Old task", "completed": false }
        ]);
        v["topics"] = serde_json::json!([
            { "id": "p", "date": "2026-08-01", "name": "Old topic", "type": "revise", "done": false }
        ]);

        let db: DbShape = serde_json::from_value(v).unwrap();
        assert!(db.journal.is_empty());
        assert_eq!(db.tasks[0].kind, "");
        assert_eq!(db.tasks[0].problems, 0);
        assert_eq!(db.topics[0].chapter, "");
        assert_eq!(db.topics[0].kind, TopicType::Revise);
    }

    fn topic(db: &mut DbShape, name: &str, kind: TopicType) -> String {
        add_topic(db, name.into(), kind, TopicDetails::default()).unwrap();
        db.topics[0].id.clone()
    }

    fn dpp(db: &mut DbShape, name: &str) -> String {
        add_dpp(db, "Physics".into(), name.into(), "Sir".into()).unwrap();
        db.dpps[0].id.clone()
    }

    #[test]
    fn a_wrapped_up_session_belongs_to_the_academic_logbook() {
        let mut db = seed::fresh_db();
        session_wrap(&mut db, WrapInput { minutes: 30.0, ..Default::default() }).unwrap();
        assert_eq!(db.journal[0].mode, AppMode::Academic);
        assert_eq!(db.journal[0].title, "");
    }

    #[test]
    fn an_entry_can_be_written_by_hand_in_either_journal() {
        let mut db = seed::fresh_db();

        let diary = add_journal_entry(
            &mut db,
            NewJournalEntry {
                mode: AppMode::Life,
                title: "  Long day  ".into(),
                note: "  Tired but finished the set.  ".into(),
                ..Default::default()
            },
        )
        .unwrap();
        let log = add_journal_entry(
            &mut db,
            NewJournalEntry {
                mode: AppMode::Academic,
                title: "Rotation recap".into(),
                subject: "Physics".into(),
                minutes: 40.0,
                note: "Worked through torque problems.".into(),
                ..Default::default()
            },
        )
        .unwrap();

        let d = db.journal.iter().find(|e| e.id == diary).unwrap();
        assert_eq!((d.mode, d.title.as_str()), (AppMode::Life, "Long day"));
        assert_eq!(d.note, "Tired but finished the set.");
        assert_eq!(d.date, today_iso(), "an entry with no date is written for today");
        // a hand-written entry has none of a session's structure
        assert!(d.pyq.is_none() && d.tasks_done.is_empty() && d.doubts.is_empty());

        assert_eq!(db.journal.iter().find(|e| e.id == log).unwrap().mode, AppMode::Academic);
    }

    #[test]
    fn an_entry_needs_something_written_in_it_and_a_real_date() {
        let mut db = seed::fresh_db();

        assert!(matches!(
            add_journal_entry(&mut db, NewJournalEntry { subject: "Physics".into(), ..Default::default() }),
            Err(MisError::Invalid(_))
        ));
        assert!(matches!(
            add_journal_entry(
                &mut db,
                NewJournalEntry { title: "x".into(), date: "yesterday".into(), ..Default::default() }
            ),
            Err(MisError::Invalid(_))
        ));
        assert!(db.journal.is_empty(), "a refused entry leaves nothing behind");
    }

    #[test]
    fn a_diary_entry_can_be_backdated_and_rewritten() {
        let mut db = seed::fresh_db();
        let id = add_journal_entry(
            &mut db,
            NewJournalEntry {
                mode: AppMode::Life,
                date: iso_days_ago(2),
                title: "Sunday".into(),
                note: "first draft".into(),
                ..Default::default()
            },
        )
        .unwrap();
        assert_eq!(db.journal[0].date, iso_days_ago(2));

        update_journal_entry(
            &mut db,
            &id,
            JournalPatch {
                title: Some("Sunday, properly".into()),
                note: Some("second draft".into()),
                date: Some(iso_days_ago(1)),
                ..Default::default()
            },
        )
        .unwrap();
        let e = &db.journal[0];
        assert_eq!((e.title.as_str(), e.note.as_str(), e.date.as_str()), (
            "Sunday, properly",
            "second draft",
            iso_days_ago(1).as_str()
        ));

        // and a nonsense edit is refused without touching what is stored
        assert!(matches!(
            update_journal_entry(&mut db, &id, JournalPatch { minutes: Some(-5.0), ..Default::default() }),
            Err(MisError::Invalid(_))
        ));
        assert_eq!(db.journal[0].note, "second draft");
    }

    #[test]
    fn a_locked_day_does_not_stop_the_journal() {
        // Locking freezes the day's scored numbers; writing down what happened
        // is not one of them.
        let mut db = db_with_today();
        lock_today(&mut db).unwrap();
        assert!(add_journal_entry(
            &mut db,
            NewJournalEntry { mode: AppMode::Life, note: "wrote this after locking".into(), ..Default::default() }
        )
        .is_ok());
    }

    #[test]
    fn a_wrap_up_ticks_dpps_and_topics_and_moves_the_dpp_counters() {
        let mut db = seed::fresh_db();
        let d1 = dpp(&mut db, "Kinematics DPP 3");
        dpp(&mut db, "Kinematics DPP 4");
        let revise = topic(&mut db, "Relative velocity", TopicType::Revise);
        let solve = topic(&mut db, "Projectile Q12", TopicType::Solve);

        let out = session_wrap(
            &mut db,
            WrapInput {
                done_dpp_ids: vec![d1.clone(), d1.clone()],
                done_topic_ids: vec![revise.clone(), solve.clone()],
                ..Default::default()
            },
        )
        .unwrap();

        assert_eq!(out.ticked, 3, "the repeated DPP id counts once");
        let d = db.dpps.iter().find(|d| d.id == d1).unwrap();
        assert!(d.done);
        assert_eq!(d.done_on.as_deref(), Some(today_iso().as_str()));
        assert!(db.topics.iter().find(|t| t.id == revise).unwrap().done);
        assert!(db.topics.iter().find(|t| t.id == solve).unwrap().done);

        // the score reads these, so they must move in the same write
        let m = today_metric(&db);
        assert_eq!((m.dpps_got, m.dpps_complete), (2.0, 1.0));

        let kinds: Vec<&str> = db.journal[0].tasks_done.iter().map(|t| t.kind.as_str()).collect();
        assert_eq!(kinds, ["DPP", "Revise", "Solve"]);
        assert_eq!(db.journal[0].tasks_done[0].title, "Kinematics DPP 3");
    }

    #[test]
    fn a_taught_topic_or_an_unknown_dpp_cannot_be_ticked_and_nothing_is_written() {
        let mut db = seed::fresh_db();
        let taught = topic(&mut db, "Newton's laws", TopicType::Taught);
        let task = task_with_kind(&mut db, "A", "Practice PYQ", &today_iso());
        let before = snapshot(&db);

        assert!(matches!(
            session_wrap(&mut db, WrapInput {
                done_task_ids: vec![task.clone()],
                done_topic_ids: vec![taught],
                ..Default::default()
            }),
            Err(MisError::Invalid(_))
        ));
        assert!(matches!(
            session_wrap(&mut db, WrapInput {
                done_task_ids: vec![task],
                done_dpp_ids: vec!["no-such-dpp".into()],
                ..Default::default()
            }),
            Err(MisError::NotFound(_))
        ));
        assert_eq!(snapshot(&db), before);
    }

    #[test]
    fn on_a_locked_day_the_wrap_up_refuses_dpp_and_topic_ticks() {
        let mut db = db_with_today();
        let d = dpp(&mut db, "DPP");
        let t = topic(&mut db, "T", TopicType::Solve);
        lock_today(&mut db).unwrap();
        let before = snapshot(&db);

        for input in [
            WrapInput { done_dpp_ids: vec![d.clone()], ..Default::default() },
            WrapInput { done_topic_ids: vec![t.clone()], ..Default::default() },
        ] {
            assert!(matches!(session_wrap(&mut db, input), Err(MisError::DayLocked)));
        }
        assert_eq!(snapshot(&db), before);
    }

    // ── Focus sessions: what a round was for ─────────────────────────────────

    fn details(subject: &str, chapter: &str, reason: Option<SessionReason>, note: &str) -> SessionDetails {
        SessionDetails {
            subject: subject.into(),
            chapter: chapter.into(),
            reason,
            reason_note: note.into(),
        }
    }

    #[test]
    fn a_focus_session_is_refused_without_a_subject_a_topic_or_a_reason() {
        let mut db = seed::fresh_db();
        let before = db.focus_sessions.len();

        for bad in [
            details("", "Optics", Some(SessionReason::Homework), ""),
            details("Physics", "", Some(SessionReason::Homework), ""),
            details("Physics", "   ", Some(SessionReason::Homework), ""),
            details("Physics", "Optics", None, ""),
            SessionDetails::default(),
        ] {
            assert!(
                matches!(add_focus_session(&mut db, 25.0, true, bad), Err(MisError::Invalid(_))),
                "a nameless session must never reach the vault"
            );
        }
        assert_eq!(db.focus_sessions.len(), before, "a refusal must write nothing");
    }

    #[test]
    fn something_else_needs_words_but_the_other_reasons_do_not() {
        let mut db = seed::fresh_db();
        let none = db.focus_sessions.len();

        assert!(matches!(
            add_focus_session(&mut db, 25.0, true, details("Physics", "Optics", Some(SessionReason::Other), "  ")),
            Err(MisError::Invalid(_))
        ));
        assert_eq!(db.focus_sessions.len(), none);

        add_focus_session(&mut db, 25.0, true, details("Physics", "Optics", Some(SessionReason::Homework), "")).unwrap();
        add_focus_session(&mut db, 25.0, true, details("Physics", "Optics", Some(SessionReason::Other), "coach asked me to")).unwrap();
        assert_eq!(db.focus_sessions.len(), none + 2);
    }

    #[test]
    fn a_focus_session_is_stored_tidied_newest_first_with_the_chapter_as_its_tag() {
        let mut db = seed::fresh_db();
        add_focus_session(
            &mut db,
            50.0,
            true,
            details("  Physics ", "Laws   of  motion", Some(SessionReason::UpcomingTest), " revise friction "),
        )
        .unwrap();

        let s = &db.focus_sessions[0];
        assert_eq!(s.subject, "Physics");
        assert_eq!(s.chapter, "Laws of motion");
        assert_eq!(s.tag, "Laws of motion", "list views that only know `tag` must still read well");
        assert_eq!(s.reason, Some(SessionReason::UpcomingTest));
        assert_eq!(s.reason_note, "revise friction");
        assert_eq!(s.date, today_iso());
        assert!(s.completed);
        assert_eq!(s.duration_minutes, 50.0);
    }

    #[test]
    fn an_overlong_subject_topic_or_note_is_refused() {
        let mut db = seed::fresh_db();
        let long = |n: usize| "x".repeat(n);
        for bad in [
            details(&long(SESSION_SUBJECT_MAX + 1), "Optics", Some(SessionReason::SelfStudy), ""),
            details("Physics", &long(SESSION_CHAPTER_MAX + 1), Some(SessionReason::SelfStudy), ""),
            details("Physics", "Optics", Some(SessionReason::SelfStudy), &long(SESSION_NOTE_MAX + 1)),
        ] {
            assert!(matches!(add_focus_session(&mut db, 25.0, true, bad), Err(MisError::Invalid(_))));
        }
        // the limits themselves are allowed
        add_focus_session(
            &mut db,
            25.0,
            true,
            details(&long(SESSION_SUBJECT_MAX), &long(SESSION_CHAPTER_MAX), Some(SessionReason::SelfStudy), &long(SESSION_NOTE_MAX)),
        )
        .unwrap();
    }

    #[test]
    fn a_session_from_before_topics_loads_and_writes_back_unchanged() {
        // What an old vault holds: no subject, chapter or reason at all.
        let old = serde_json::json!({
            "id": "abc", "date": "2026-03-01", "duration_minutes": 25.0,
            "tag": "Physics DPP", "completed": true
        });
        let s: FocusSession = serde_json::from_value(old.clone()).unwrap();
        assert!(s.subject.is_empty() && s.chapter.is_empty() && s.reason.is_none());
        assert_eq!(
            serde_json::to_value(&s).unwrap(),
            old,
            "history must not grow empty fields it never had, or the vault rewrites itself for nothing"
        );
    }

    #[test]
    fn the_reason_names_are_the_contract_with_the_frontend() {
        // src/core/db/types.ts spells these out; changing one here without
        // changing it there would make every session fail to load.
        for (reason, name) in [
            (SessionReason::TaughtInClass, "taught_in_class"),
            (SessionReason::Homework, "homework"),
            (SessionReason::UpcomingTest, "upcoming_test"),
            (SessionReason::SelfStudy, "self_study"),
            (SessionReason::Other, "other"),
        ] {
            assert_eq!(serde_json::to_value(reason).unwrap(), serde_json::json!(name));
            assert_eq!(serde_json::from_value::<SessionReason>(serde_json::json!(name)).unwrap(), reason);
        }
    }
}

//! The Tauri command surface — everything the Solid frontend can ask Rust to do.
//!
//! This replaces the old FastAPI host wholesale. Where the browser used to make
//! an authenticated HTTP call to `127.0.0.1:<random port>/api/db` carrying an
//! `X-MIS-Token`, it now calls `invoke("db_load")` over Tauri's IPC bridge.
//! There is no socket, no port, no token, and no window of opportunity for
//! another local program to talk to the vault — the frontend and the vault are
//! the same process.
//!
//! ## The one rule in this file
//!
//! Every mutating command goes through [`mutate`], which locks the state,
//! applies the change, and **persists to the encrypted vault before returning**.
//! The old app debounced saves by 600 ms from the browser, which meant a crash
//! could lose the last write and a component that mutated without calling
//! `save()` lost it silently. Here a command that returns `Ok` has already been
//! sealed to disk. Vault writes are a few hundred microseconds; there is nothing
//! to gain by being clever about it and a day's log to lose.

use serde::Serialize;
use tauri::State;

use crate::db::{self, types::*, MetricPatch, EntryPatch, NewEntry};
use crate::error::{MisError, Result};
use crate::scoring::{self, ScoredDay, Streak};
use crate::screentime::{self, store::Settings as StSettings, summary, tracker::TrackerStatus};
use crate::state::AppState;

// ── Database ────────────────────────────────────────────────────────────────

#[tauri::command]
pub fn db_load(state: State<AppState>) -> Result<DbShape> {
    state.read(|db| db.clone())
}

/// Today's metric, blank if nothing has been logged today.
///
/// A plain read: opening the app must not create a day. See `db::today_metric`.
#[tauri::command]
pub fn db_today_metric(state: State<AppState>) -> Result<DailyMetric> {
    state.read(db::today_metric)
}

#[tauri::command]
pub fn db_today_is_locked(state: State<AppState>) -> Result<bool> {
    state.read(db::today_is_locked)
}

#[tauri::command]
pub fn db_update_today(state: State<AppState>, patch: MetricPatch) -> Result<DailyMetric> {
    state.mutate(|db| {
        db::update_today_metric(db, patch)?;
        Ok(db::today_metric(db))
    })
}

#[tauri::command]
pub fn db_save_user(state: State<AppState>, user: UserConfig) -> Result<()> {
    state.mutate(|db| {
        db::save_user_config(db, user);
        Ok(())
    })
}

/// Submit today's log. Returns the fingerprint that was stamped on it.
#[tauri::command]
pub fn db_lock_today(state: State<AppState>) -> Result<String> {
    let hash = state.mutate(db::lock_today)?;
    state.log_event("log-submit", [("hash", hash.as_str())]);
    Ok(hash)
}

#[tauri::command]
pub fn db_unlock_today(state: State<AppState>) -> Result<()> {
    state.mutate(db::unlock_today)?;
    state.log_event("log-unlock", []);
    Ok(())
}

/// Whether a submitted day still matches the fingerprint taken at submit time.
/// `false` means the vault was edited outside MIS — the Daily Log's red banner.
#[tauri::command]
pub fn db_day_is_intact(state: State<AppState>, date: String) -> Result<bool> {
    state.read(|db| db::day_is_intact(db, &date))
}

// ── Mark logbook ────────────────────────────────────────────────────────────

#[tauri::command]
pub fn db_add_mark_entry(state: State<AppState>, entry: NewEntry) -> Result<()> {
    state.mutate(|db| {
        db::add_mark_entry(db, entry);
        Ok(())
    })
}

/// Bulk insert from a spreadsheet import — one vault write for the whole batch.
#[tauri::command]
pub fn db_add_mark_entries(state: State<AppState>, entries: Vec<NewEntry>) -> Result<usize> {
    state.mutate(|db| Ok(db::add_mark_entries(db, entries)))
}

#[tauri::command]
pub fn db_update_mark_entry(state: State<AppState>, id: String, patch: EntryPatch) -> Result<()> {
    state.mutate(|db| db::update_mark_entry(db, &id, patch))
}

#[tauri::command]
pub fn db_delete_mark_entry(state: State<AppState>, id: String) -> Result<()> {
    state.mutate(|db| {
        db::delete_mark_entry(db, &id);
        Ok(())
    })
}

#[tauri::command]
pub fn db_replace_mark_logbook(
    state: State<AppState>,
    entries: Vec<MarkLogbookEntry>,
) -> Result<()> {
    state.mutate(|db| {
        db::replace_mark_logbook(db, entries);
        Ok(())
    })
}

/// The fingerprints already stored, so the importer can spot duplicates without
/// pulling the whole logbook across the bridge.
#[tauri::command]
pub fn db_logbook_fingerprints(state: State<AppState>) -> Result<Vec<String>> {
    state.read(db::logbook_fingerprints)
}

// ── Focus ───────────────────────────────────────────────────────────────────

#[tauri::command]
pub fn db_add_focus_session(
    state: State<AppState>,
    duration_minutes: f64,
    tag: String,
    completed: bool,
) -> Result<()> {
    state.mutate(|db| {
        db::add_focus_session(db, duration_minutes, tag, completed);
        Ok(())
    })
}

#[tauri::command]
pub fn db_add_study_minutes(state: State<AppState>, minutes: f64) -> Result<()> {
    state.mutate(|db| db::add_study_minutes(db, minutes))
}

#[tauri::command]
pub fn db_save_focus_settings(state: State<AppState>, settings: FocusSettings) -> Result<()> {
    state.mutate(|db| {
        db::save_focus_settings(db, settings);
        Ok(())
    })
}

// ── Tasks ───────────────────────────────────────────────────────────────────

#[tauri::command]
pub fn db_add_task(
    state: State<AppState>,
    title: String,
    subject: String,
    due_date: String,
    mode: AppMode,
) -> Result<()> {
    state.mutate(|db| db::add_task(db, title, subject, due_date, mode))
}

#[tauri::command]
pub fn db_toggle_task(state: State<AppState>, id: String) -> Result<()> {
    state.mutate(|db| db::toggle_task_done(db, &id))
}

#[tauri::command]
pub fn db_delete_task(state: State<AppState>, id: String) -> Result<()> {
    state.mutate(|db| db::delete_task(db, &id))
}

// ── Topics ──────────────────────────────────────────────────────────────────

#[tauri::command]
pub fn db_add_topic(state: State<AppState>, name: String, kind: TopicType) -> Result<()> {
    state.mutate(|db| db::add_topic(db, name, kind))
}

#[tauri::command]
pub fn db_toggle_topic(state: State<AppState>, id: String) -> Result<()> {
    state.mutate(|db| db::toggle_topic_done(db, &id))
}

#[tauri::command]
pub fn db_delete_topic(state: State<AppState>, id: String) -> Result<()> {
    state.mutate(|db| db::delete_topic(db, &id))
}

// ── Habits ──────────────────────────────────────────────────────────────────

#[tauri::command]
pub fn db_add_habit(state: State<AppState>, name: String, priority: Priority) -> Result<()> {
    state.mutate(|db| {
        db::add_habit(db, name, priority);
        Ok(())
    })
}

#[tauri::command]
pub fn db_set_habit_priority(
    state: State<AppState>,
    id: String,
    priority: Priority,
) -> Result<()> {
    state.mutate(|db| {
        db::set_habit_priority(db, &id, priority);
        Ok(())
    })
}

#[tauri::command]
pub fn db_delete_habit(state: State<AppState>, id: String) -> Result<()> {
    state.mutate(|db| {
        db::delete_habit(db, &id);
        Ok(())
    })
}

#[tauri::command]
pub fn db_habits_done_on(state: State<AppState>, date: String) -> Result<Vec<String>> {
    state.read(|db| db::habits_done_on(db, &date))
}

#[tauri::command]
pub fn db_toggle_habit_today(state: State<AppState>, id: String) -> Result<()> {
    state.mutate(|db| db::toggle_habit_today(db, &id))
}

// ── Tracks and mode ─────────────────────────────────────────────────────────

#[tauri::command]
pub fn db_set_track_priority(
    state: State<AppState>,
    id: TrackId,
    priority: Priority,
) -> Result<()> {
    state.mutate(|db| {
        db::set_track_priority(db, id, priority);
        Ok(())
    })
}

#[tauri::command]
pub fn db_set_app_mode(state: State<AppState>, mode: AppMode) -> Result<()> {
    state.mutate(|db| {
        db::set_app_mode(db, mode);
        Ok(())
    })
}

/// Wipe the database back to a starting state.
///
/// `demo` fills it with two weeks of sample data instead of leaving it empty.
/// That is the *only* way demo rows can ever appear: the old app baked them into
/// the desktop build, so a first launch showed marks nobody had entered. Now you
/// have to ask.
#[tauri::command]
pub fn db_reset(state: State<AppState>, demo: bool) -> Result<DbShape> {
    let fresh = if demo { crate::db::seed::demo_db() } else { crate::db::seed::fresh_db() };
    state.mutate(|db| {
        *db = fresh;
        Ok(db.clone())
    })
}

// ── Scoring ─────────────────────────────────────────────────────────────────

#[tauri::command]
pub fn score_range(state: State<AppState>, days: i64) -> Result<Vec<ScoredDay>> {
    let days = days.clamp(1, 400);
    state.read(|db| scoring::score_range(db, days))
}

#[tauri::command]
pub fn study_streak(state: State<AppState>) -> Result<Streak> {
    state.read(scoring::study_streak)
}

// ── Vault and audit ─────────────────────────────────────────────────────────

#[derive(Serialize)]
pub struct VaultInfo {
    /// Shown in the app so the honest limits are checkable, not just claimed.
    pub folder: String,
    pub audit_intact: bool,
    /// The sequence number where the chain first breaks, if it does.
    pub audit_broken_at: Option<u64>,
    pub recovery_key_id: String,
}

#[tauri::command]
pub fn vault_info(state: State<AppState>) -> Result<VaultInfo> {
    state.with_vault(|v| {
        let (intact, broken_at) = v.audit_status();
        VaultInfo {
            folder: v.dir.display().to_string(),
            audit_intact: intact,
            audit_broken_at: broken_at,
            recovery_key_id: crate::vault::crypto::recovery_key_id(),
        }
    })
}

#[tauri::command]
pub fn audit_recent(
    state: State<AppState>,
    limit: usize,
) -> Result<Vec<crate::vault::audit::AuditRecord>> {
    state.with_vault(|v| crate::vault::audit::recent(&v.audit_path, limit.min(500)))
}

// ── Screen time ─────────────────────────────────────────────────────────────

#[tauri::command]
pub fn st_status(state: State<AppState>) -> TrackerStatus {
    state.tracker.status()
}

/// Whether there is anything to show, and a sentence explaining why not.
/// The tab must call this before drawing a zero — see `screentime/mod.rs`.
#[tauri::command]
pub fn st_availability(state: State<AppState>) -> screentime::Availability {
    screentime::availability(&state.tracker)
}

#[tauri::command]
pub fn st_day(state: State<AppState>, day: Option<String>) -> summary::DaySummary {
    let day = day.unwrap_or_else(crate::dates::today_iso);
    let intervals = state.tracker.intervals_for(&day);
    summary::day(&day, &intervals, &state.tracker.settings())
}

/// The last `days` days, oldest first, without the per-day timelines.
#[tauri::command]
pub fn st_range(state: State<AppState>, days: i64) -> Vec<summary::CompactDay> {
    let days = days.clamp(1, 400);
    let settings = state.tracker.settings();
    (0..days)
        .map(|i| {
            let day = crate::dates::iso_days_ago(days - 1 - i);
            let intervals = state.tracker.intervals_for(&day);
            summary::compact_day(&day, &intervals, &settings)
        })
        .collect()
}

#[tauri::command]
pub fn st_set_paused(state: State<AppState>, paused: bool) -> TrackerStatus {
    state.tracker.set_paused(paused);
    state.tracker.status()
}

#[tauri::command]
pub fn st_categories(state: State<AppState>) -> std::collections::BTreeMap<String, String> {
    screentime::categories::resolved(&state.tracker.settings())
}

#[tauri::command]
pub fn st_set_category(state: State<AppState>, app: String, category: String) -> Result<()> {
    state
        .tracker
        .with_store(|store| screentime::categories::set_category(store, &app, &category))
}

#[tauri::command]
pub fn st_clear_category(state: State<AppState>, app: String) {
    state
        .tracker
        .with_store(|store| screentime::categories::clear_category(store, &app));
}

#[tauri::command]
pub fn st_recorded_days(state: State<AppState>) -> Vec<String> {
    state.tracker.recorded_days()
}

/// Delete a day's recording, or every day when `day` is omitted.
#[tauri::command]
pub fn st_forget(state: State<AppState>, day: Option<String>) -> usize {
    let removed = state.tracker.forget(day.as_deref());
    state.log_event(
        "screentime-forget",
        [("day", day.as_deref().unwrap_or("all"))],
    );
    removed
}

#[tauri::command]
pub fn st_settings(state: State<AppState>) -> StSettings {
    state.tracker.settings()
}

// ── Misc ────────────────────────────────────────────────────────────────────

/// Surfaced so the About panel can state the version rather than hardcode it.
#[tauri::command]
pub fn app_version() -> &'static str {
    env!("CARGO_PKG_VERSION")
}

/// A last-resort escape hatch: hand the whole database back as pretty JSON for
/// the user to save wherever they like. The vault is theirs; there must always
/// be a way to get the data out of it that does not require this app.
#[tauri::command]
pub fn db_export_json(state: State<AppState>) -> Result<String> {
    state.read(|db| serde_json::to_string_pretty(db))?
        .map_err(MisError::from)
}

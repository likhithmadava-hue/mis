//! A plain, unencrypted SQLite mirror of the vault — for development only.
//!
//! `vault.mis` stays the one real, encrypted, tamper-evident store; nothing
//! here changes how it is read or written, and nothing here is ever read
//! back into the app. This file exists purely so a developer can open
//! `mis-dev.db` in an ordinary SQLite viewer (DB Browser for SQLite,
//! TablePlus, `sqlite3` on the command line, …) and see the same data as
//! plain tables — one per collection in [`DbShape`] — instead of one opaque
//! encrypted blob.
//!
//! It is rebuilt from scratch on every save (`DELETE` then re-`INSERT`, one
//! transaction) rather than diffed, because the dataset is small — a
//! personal study log, not a multi-user app — and "always exactly matches
//! `DbShape`" is worth more here than incremental writes would save.
//!
//! **Debug builds only.** [`refresh`] is a no-op in a release build, so
//! nobody who installs MIS from the NSIS/MSI installer ever gets a second,
//! plaintext copy of their scores sitting next to the encrypted vault — the
//! "encrypted vault on this device" promise in the installer's description
//! (`tauri.conf.json`'s `longDescription`) stays true for everyone except the
//! person actually building the app.

use std::path::Path;

use crate::db::types::DbShape;

pub const MIRROR_FILE_NAME: &str = "mis-dev.db";

/// Refresh the dev mirror. Never fails the caller — a mirror write going
/// wrong must not cost the real, encrypted save that already succeeded. See
/// `state.rs::mutate` and `state.rs::boot` for where this is called.
#[cfg(debug_assertions)]
pub fn refresh(dir: &Path, db: &DbShape) {
    if let Err(e) = imp::write(dir, db) {
        eprintln!(
            "[mis] dev mirror refresh failed (harmless — the real save already succeeded): {e}"
        );
    }
}

#[cfg(not(debug_assertions))]
pub fn refresh(_dir: &Path, _db: &DbShape) {}

#[cfg(debug_assertions)]
mod imp {
    use std::path::Path;

    use rusqlite::{params, Connection, Result};
    use serde::Serialize;

    use crate::db::types::DbShape;

    use super::MIRROR_FILE_NAME;

    pub fn write(dir: &Path, db: &DbShape) -> Result<()> {
        // The schema is only ever created, never migrated — `CREATE TABLE IF
        // NOT EXISTS` against a file left over from an older debug build
        // keeps its old columns forever, and a save after a schema change
        // (like this one adding `focus_music`/`music_volume`) fails outright
        // instead of staying the harmless no-op the doc comment above
        // promises. Deleting the file first keeps "rebuilt from scratch" true
        // of the schema, not just the rows.
        let path = dir.join(MIRROR_FILE_NAME);
        let _ = std::fs::remove_file(&path);

        let mut conn = Connection::open(&path)?;
        conn.execute_batch(SCHEMA)?;

        let tx = conn.transaction()?;

        tx.execute_batch(
            "DELETE FROM user_config;
             DELETE FROM daily_metrics;
             DELETE FROM mark_logbook;
             DELETE FROM focus_sessions;
             DELETE FROM tasks;
             DELETE FROM topics;
             DELETE FROM focus_settings;
             DELETE FROM habits;
             DELETE FROM habit_log;
             DELETE FROM track_priorities;
             DELETE FROM app_mode;",
        )?;

        let u = &db.user;
        tx.execute(
            "INSERT INTO user_config
                (id, name, target_study_hours, water_target, blocked_apps,
                 is_focus_active, free_time_unlocked, sleep_bedtime, sleep_wake)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![
                u.id,
                u.name,
                u.target_study_hours,
                u.water_target,
                u.blocked_apps.join(", "),
                u.is_focus_active,
                u.free_time_unlocked,
                u.sleep_bedtime,
                u.sleep_wake,
            ],
        )?;

        {
            let mut stmt = tx.prepare(
                "INSERT INTO daily_metrics
                    (id, date, study_hours, dpps_got, dpps_complete, reading_habit,
                     revision_habit, mood_score, well_spent_time, posture_count,
                     water_count, locked, submitted_at, submit_hash)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)",
            )?;
            for m in &db.daily_metrics {
                stmt.execute(params![
                    m.id,
                    m.date,
                    m.study_hours,
                    m.dpps_got,
                    m.dpps_complete,
                    m.reading_habit,
                    m.revision_habit,
                    m.mood_score,
                    m.well_spent_time,
                    m.posture_count,
                    m.water_count,
                    m.locked,
                    m.submitted_at,
                    m.submit_hash,
                ])?;
            }
        }

        {
            let mut stmt = tx.prepare(
                "INSERT INTO mark_logbook
                    (id, date, subject, chapter, grade, score, max_score,
                     difficulty, time_spent, mistake_reason, notes)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
            )?;
            for e in &db.mark_logbook {
                stmt.execute(params![
                    e.id,
                    e.date,
                    e.subject,
                    e.chapter,
                    e.grade,
                    e.score,
                    e.max_score,
                    ser_str(&e.difficulty),
                    e.time_spent,
                    ser_str(&e.mistake_reason),
                    e.notes,
                ])?;
            }
        }

        {
            let mut stmt = tx.prepare(
                "INSERT INTO focus_sessions (id, date, duration_minutes, tag, completed)
                 VALUES (?1, ?2, ?3, ?4, ?5)",
            )?;
            for s in &db.focus_sessions {
                stmt.execute(params![s.id, s.date, s.duration_minutes, s.tag, s.completed])?;
            }
        }

        {
            let mut stmt = tx.prepare(
                "INSERT INTO tasks (id, title, subject, due_date, completed)
                 VALUES (?1, ?2, ?3, ?4, ?5)",
            )?;
            for t in &db.tasks {
                stmt.execute(params![t.id, t.title, t.subject, t.due_date, t.completed])?;
            }
        }

        {
            let mut stmt = tx.prepare(
                "INSERT INTO topics (id, date, name, kind, done) VALUES (?1, ?2, ?3, ?4, ?5)",
            )?;
            for t in &db.topics {
                stmt.execute(params![t.id, t.date, t.name, ser_str(&t.kind), t.done])?;
            }
        }

        let fs = &db.focus_settings;
        tx.execute(
            "INSERT INTO focus_settings
                (focus_minutes, short_break, long_break, rounds_before_long, timer_design, focus_music, music_volume,
                 ambient_sound, ambient_volume, brainwave, brainwave_volume)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
            params![
                fs.focus_minutes,
                fs.short_break,
                fs.long_break,
                fs.rounds_before_long,
                ser_str(&fs.timer_design),
                ser_str(&fs.focus_music),
                fs.music_volume,
                ser_str(&fs.ambient_sound),
                fs.ambient_volume,
                ser_str(&fs.brainwave),
                fs.brainwave_volume,
            ],
        )?;

        {
            let mut stmt = tx.prepare(
                "INSERT INTO habits (id, name, priority, legacy_key) VALUES (?1, ?2, ?3, ?4)",
            )?;
            for h in &db.habits {
                stmt.execute(params![
                    h.id,
                    h.name,
                    ser_str(&h.priority),
                    h.legacy_key.as_ref().map(ser_str),
                ])?;
            }
        }

        {
            let mut stmt =
                tx.prepare("INSERT INTO habit_log (id, date, habit_id) VALUES (?1, ?2, ?3)")?;
            for l in &db.habit_log {
                stmt.execute(params![l.id, l.date, l.habit_id])?;
            }
        }

        {
            let tp = &db.track_priorities;
            let mut stmt = tx
                .prepare("INSERT INTO track_priorities (track, priority) VALUES (?1, ?2)")?;
            for (track, priority) in [
                ("studies", tp.studies),
                ("dpps", tp.dpps),
                ("habits", tp.habits),
                ("mood", tp.mood),
                ("well_spent", tp.well_spent),
                ("wellness", tp.wellness),
            ] {
                stmt.execute(params![track, ser_str(&priority)])?;
            }
        }

        tx.execute(
            "INSERT INTO app_mode (mode) VALUES (?1)",
            params![ser_str(&db.app_mode)],
        )?;

        tx.commit()
    }

    /// A simple enum's serde JSON representation, unwrapped from its quotes.
    /// Used instead of hand-written `match` arms for every enum so the
    /// mirror can never drift from the strings the encrypted vault actually
    /// stores — one serialisation rule, read twice.
    fn ser_str<T: Serialize>(v: &T) -> String {
        match serde_json::to_value(v) {
            Ok(serde_json::Value::String(s)) => s,
            _ => String::new(),
        }
    }

    const SCHEMA: &str = "
CREATE TABLE IF NOT EXISTS user_config (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    target_study_hours REAL NOT NULL,
    water_target REAL NOT NULL,
    blocked_apps TEXT NOT NULL,
    is_focus_active INTEGER NOT NULL,
    free_time_unlocked INTEGER NOT NULL,
    sleep_bedtime TEXT NOT NULL,
    sleep_wake TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS daily_metrics (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    study_hours REAL NOT NULL,
    dpps_got REAL NOT NULL,
    dpps_complete REAL NOT NULL,
    reading_habit INTEGER NOT NULL,
    revision_habit INTEGER NOT NULL,
    mood_score REAL NOT NULL,
    well_spent_time REAL NOT NULL,
    posture_count REAL NOT NULL,
    water_count REAL NOT NULL,
    locked INTEGER,
    submitted_at TEXT,
    submit_hash TEXT
);

CREATE TABLE IF NOT EXISTS mark_logbook (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    subject TEXT NOT NULL,
    chapter TEXT NOT NULL,
    grade TEXT NOT NULL,
    score REAL NOT NULL,
    max_score REAL NOT NULL,
    difficulty TEXT NOT NULL,
    time_spent REAL NOT NULL,
    mistake_reason TEXT NOT NULL,
    notes TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS focus_sessions (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    duration_minutes REAL NOT NULL,
    tag TEXT NOT NULL,
    completed INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    subject TEXT NOT NULL,
    due_date TEXT NOT NULL,
    completed INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS topics (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    name TEXT NOT NULL,
    kind TEXT NOT NULL,
    done INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS focus_settings (
    focus_minutes REAL NOT NULL,
    short_break REAL NOT NULL,
    long_break REAL NOT NULL,
    rounds_before_long REAL NOT NULL,
    timer_design TEXT NOT NULL,
    focus_music TEXT NOT NULL,
    music_volume REAL NOT NULL,
    ambient_sound TEXT NOT NULL,
    ambient_volume REAL NOT NULL,
    brainwave TEXT NOT NULL,
    brainwave_volume REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS habits (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    priority TEXT NOT NULL,
    legacy_key TEXT
);

CREATE TABLE IF NOT EXISTS habit_log (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    habit_id TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS track_priorities (
    track TEXT PRIMARY KEY,
    priority TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS app_mode (
    mode TEXT NOT NULL
);
";
}

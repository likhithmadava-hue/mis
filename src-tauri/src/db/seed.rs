//! What a brand-new MIS contains.
//!
//! The old app decided this at *build* time: `npm run build:netlify` inlined
//! `VITE_FRESH_START=true` and got an empty database, every other build got two
//! weeks of demo rows. There is only one build now, and it is an installer a
//! stranger can download — so **first launch is always empty**. Rows you did not
//! enter are confusing, not helpful, and a study app that opens showing someone
//! else's Physics marks has already lied to you once.
//!
//! `demo_db()` is kept and reachable on purpose: the Database tab can load it
//! deliberately ("show me what a filled-in MIS looks like"), which is the only
//! honest way to have sample data — you asked for it.

use super::types::*;
use crate::dates::iso_days_ago;

pub fn default_focus_settings() -> FocusSettings {
    FocusSettings {
        focus_minutes: 25.0,
        short_break: 5.0,
        long_break: 15.0,
        rounds_before_long: 4.0,
        timer_design: TimerDesign::Ring,
        focus_music: FocusMusic::Off,
        music_volume: 0.5,
        ambient_sound: AmbientSound::Off,
        ambient_volume: 0.5,
        brainwave: Brainwave::Off,
        brainwave_volume: 0.5,
    }
}

/// Starter habits stay in a fresh database — they are defaults you can rename
/// or delete, not history, and the Habits track has nothing to score without
/// them.
pub fn seed_habits() -> Vec<Habit> {
    vec![
        Habit {
            id: uid(),
            name: "Read 20 pages".into(),
            priority: Priority::Medium,
            legacy_key: Some(LegacyHabitKey::ReadingHabit),
        },
        Habit {
            id: uid(),
            name: "Revise yesterday".into(),
            priority: Priority::High,
            legacy_key: Some(LegacyHabitKey::RevisionHabit),
        },
        Habit {
            id: uid(),
            name: "Morning workout".into(),
            priority: Priority::Medium,
            legacy_key: None,
        },
        Habit {
            id: uid(),
            name: "No phone in bed".into(),
            priority: Priority::Low,
            legacy_key: None,
        },
    ]
}

/// A brand-new database with nothing logged in it.
pub fn fresh_db() -> DbShape {
    DbShape {
        user: UserConfig {
            id: "user-1".into(),
            name: "Student".into(),
            target_study_hours: 6.0,
            water_target: 8.0,
            blocked_apps: vec![
                "Instagram".into(),
                "YouTube Shorts".into(),
                "TikTok".into(),
                "Netflix".into(),
            ],
            is_focus_active: true,
            free_time_unlocked: false,
            sleep_bedtime: "22:30".into(),
            sleep_wake: "06:30".into(),
        },
        daily_metrics: vec![],
        mark_logbook: vec![],
        focus_sessions: vec![],
        tasks: vec![],
        topics: vec![],
        focus_settings: default_focus_settings(),
        habits: seed_habits(),
        habit_log: vec![],
        track_priorities: TrackPriorities::default(),
        app_mode: AppMode::Academic,
    }
}

/// Helper so the demo rows below read like the table they represent.
#[allow(clippy::too_many_arguments)]
fn metric(
    days_ago: i64,
    study_hours: f64,
    dpps_got: f64,
    dpps_complete: f64,
    reading: bool,
    revision: bool,
    mood: f64,
    well_spent: f64,
    posture: f64,
    water: f64,
) -> DailyMetric {
    DailyMetric {
        id: uid(),
        date: iso_days_ago(days_ago),
        study_hours,
        dpps_got,
        dpps_complete,
        reading_habit: reading,
        revision_habit: revision,
        mood_score: mood,
        well_spent_time: well_spent,
        posture_count: posture,
        water_count: water,
        locked: None,
        submitted_at: None,
        submit_hash: None,
    }
}

#[allow(clippy::too_many_arguments)]
fn paper(
    days_ago: i64,
    subject: &str,
    chapter: &str,
    grade: &str,
    score: f64,
    difficulty: Difficulty,
    time_spent: f64,
    reason: MistakeReason,
    notes: &str,
) -> MarkLogbookEntry {
    MarkLogbookEntry {
        id: uid(),
        date: iso_days_ago(days_ago),
        subject: subject.into(),
        chapter: chapter.into(),
        grade: grade.into(),
        score,
        max_score: 100.0,
        difficulty,
        time_spent,
        mistake_reason: reason,
        notes: notes.into(),
    }
}

/// A fresh database plus two weeks of plausible sample data, so every chart has
/// something to draw. Only ever loaded on explicit request.
pub fn demo_db() -> DbShape {
    use Difficulty::*;
    use MistakeReason::*;

    let mut db = fresh_db();

    db.daily_metrics = vec![
        metric(6, 5.0, 4.0, 4.0, true, true, 8.0, 45.0, 3.0, 7.0),
        metric(5, 3.0, 4.0, 2.0, true, false, 6.0, 60.0, 2.0, 5.0),
        metric(4, 6.0, 5.0, 5.0, true, true, 9.0, 30.0, 4.0, 8.0),
        metric(3, 0.0, 3.0, 0.0, false, false, 4.0, 120.0, 0.0, 3.0),
        metric(2, 4.0, 4.0, 3.0, true, true, 7.0, 50.0, 2.0, 6.0),
        metric(1, 7.0, 5.0, 5.0, true, true, 9.0, 40.0, 5.0, 8.0),
        metric(0, 2.0, 4.0, 1.0, true, false, 7.0, 20.0, 1.0, 3.0),
    ];

    db.mark_logbook = vec![
        paper(1, "Physics", "Rotational Motion", "B", 68.0, Hard, 75.0, Conceptual,
              "Revisit torque direction conventions."),
        paper(3, "Maths", "Integration", "A", 88.0, Medium, 60.0, Sign,
              "Dropped a minus sign in substitution."),
        paper(5, "Chemistry", "Thermodynamics", "A+", 95.0, Medium, 55.0, TimePressure,
              "Left last question — practice pacing."),
        paper(6, "Physics", "Kinematics", "C", 55.0, Hard, 80.0, Conceptual,
              "Confused relative velocity frames."),
        paper(8, "Maths", "Probability", "B", 72.0, Medium, 50.0, Reading,
              "Misread \"at least one\" as \"exactly one\"."),
        paper(9, "Chemistry", "Mole Concept", "B", 70.0, Easy, 40.0, Unit,
              "Mixed g and mg partway through."),
        paper(11, "Physics", "Electrostatics", "A", 85.0, Hard, 70.0, FormulaRecall,
              "Wrote the field formula instead of the potential one."),
        paper(13, "Maths", "Matrices", "C", 58.0, Medium, 65.0, Calculation,
              "Arithmetic slip in the determinant expansion."),
    ];

    db.focus_sessions = vec![
        FocusSession { id: uid(), date: iso_days_ago(1), duration_minutes: 90.0, tag: "Physics DPP".into(), completed: true },
        FocusSession { id: uid(), date: iso_days_ago(1), duration_minutes: 60.0, tag: "Maths Revision".into(), completed: true },
        FocusSession { id: uid(), date: iso_days_ago(0), duration_minutes: 45.0, tag: "Chemistry Notes".into(), completed: false },
    ];

    db.tasks = vec![
        Task { id: uid(), title: "Finish Kinematics DPP sheet".into(), subject: "Physics".into(), due_date: iso_days_ago(0), completed: false, mode: AppMode::Academic },
        Task { id: uid(), title: "Revise periodic table trends".into(), subject: "Chemistry".into(), due_date: iso_days_ago(0), completed: true, mode: AppMode::Academic },
        Task { id: uid(), title: "Solve 10 integration problems".into(), subject: "Maths".into(), due_date: iso_days_ago(-1), completed: false, mode: AppMode::Academic },
        Task { id: uid(), title: "Book a dentist appointment".into(), subject: "Health".into(), due_date: iso_days_ago(-2), completed: false, mode: AppMode::Life },
        Task { id: uid(), title: "Call mom".into(), subject: "".into(), due_date: iso_days_ago(0), completed: true, mode: AppMode::Life },
        Task { id: uid(), title: "Laundry".into(), subject: "Chores".into(), due_date: iso_days_ago(1), completed: false, mode: AppMode::Life },
    ];

    db.topics = vec![
        TopicItem { id: uid(), date: iso_days_ago(0), name: "Rotational Motion — Torque".into(), kind: TopicType::Taught, done: false },
        TopicItem { id: uid(), date: iso_days_ago(0), name: "Kinematics — Relative Velocity".into(), kind: TopicType::Revise, done: false },
        TopicItem { id: uid(), date: iso_days_ago(1), name: "Integration by Parts".into(), kind: TopicType::Revise, done: true },
        TopicItem { id: uid(), date: iso_days_ago(0), name: "Thermodynamics DPP Q11–Q20".into(), kind: TopicType::Solve, done: false },
    ];

    db
}

//! Every shape MIS stores.
//!
//! This is the Rust twin of the old `src/core/db/types.ts`. It is the
//! vocabulary the rest of the backend is written in, and — because these types
//! derive `Serialize`/`Deserialize` — it is also the wire format the Solid
//! frontend receives. `src/core/db/types.ts` on the frontend is now a *mirror*
//! of this file rather than the source of truth: if a field changes here it
//! must change there, and `migrations.rs` must carry old vaults forward.
//!
//! Field names are serialised exactly as the old localStorage blob wrote them,
//! so a vault written by the Python host still loads.

use serde::{Deserialize, Serialize};

// ── Enumerations ────────────────────────────────────────────────────────────

/// The app runs in one of two modes. The mode decides which tabs exist, which
/// tracks the Daily Log accepts, which charts the Growth Tracker draws, and the
/// accent colour of the whole UI. Each mode scores its own day independently.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AppMode {
    Academic,
    Life,
}

impl AppMode {
    pub const ALL: [AppMode; 2] = [AppMode::Academic, AppMode::Life];
}

impl Default for AppMode {
    fn default() -> Self {
        AppMode::Academic
    }
}

/// How much a track or habit counts toward the day's score.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Priority {
    High,
    Medium,
    Low,
}

impl Priority {
    /// Priority does double duty: it sets the scoring weight *and* sorts the
    /// cards, so raising a track moves it up the page.
    pub fn weight(self) -> f64 {
        match self {
            Priority::High => 3.0,
            Priority::Medium => 2.0,
            Priority::Low => 1.0,
        }
    }
}

/// The things the Daily Log scores — one column-group each in the old sheet.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TrackId {
    Studies,
    Dpps,
    WellSpent,
    Mood,
    Habits,
    Wellness,
}

impl TrackId {
    pub const ALL: [TrackId; 6] = [
        TrackId::Studies,
        TrackId::Dpps,
        TrackId::WellSpent,
        TrackId::Mood,
        TrackId::Habits,
        TrackId::Wellness,
    ];

    /// Every track belongs to exactly one mode — never both. Academic is the
    /// work that moves marks; Life is what keeps that work sustainable.
    pub fn mode(self) -> AppMode {
        match self {
            TrackId::Studies | TrackId::Dpps => AppMode::Academic,
            TrackId::WellSpent | TrackId::Mood | TrackId::Habits | TrackId::Wellness => AppMode::Life,
        }
    }
}

/// The nine kinds of mistake a paper can be tagged with.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum MistakeReason {
    Conceptual,
    Calculation,
    Careless,
    Reading,
    Unit,
    Sign,
    #[serde(rename = "Formula Recall")]
    FormulaRecall,
    #[serde(rename = "Time Pressure")]
    TimePressure,
    Other,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum Difficulty {
    Easy,
    Medium,
    Hard,
}

impl Default for Difficulty {
    fn default() -> Self {
        Difficulty::Medium
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum TopicType {
    Taught,
    Revise,
    Solve,
}

/// Which clock face the Focus Timer draws.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum TimerDesign {
    Ring,
    Flip,
}

impl Default for TimerDesign {
    fn default() -> Self {
        TimerDesign::Ring
    }
}

/// Which background music loop plays behind the Focus Timer, if any.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum FocusMusic {
    Off,
    Jazz,
    Lofi,
}

impl Default for FocusMusic {
    fn default() -> Self {
        FocusMusic::Off
    }
}

fn default_music_volume() -> f64 {
    0.5
}

/// Ambient noise layer behind the Focus Timer — synthesised in the frontend
/// with Web Audio, not shipped as files. Independent of `FocusMusic`: the two
/// can run at once.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AmbientSound {
    Off,
    White,
    Pink,
    Brown,
    Rain,
    Ocean,
}

impl Default for AmbientSound {
    fn default() -> Self {
        AmbientSound::Off
    }
}

fn default_ambient_volume() -> f64 {
    0.5
}

/// Binaural-beat brainwave entrainment tone — also synthesised, not a file.
/// Only audible as intended over headphones (one carrier per ear).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Brainwave {
    Off,
    Delta,
    Theta,
    Alpha,
    Beta,
    Gamma,
}

impl Default for Brainwave {
    fn default() -> Self {
        Brainwave::Off
    }
}

fn default_brainwave_volume() -> f64 {
    0.5
}

/// The two habits whose state is mirrored into `DailyMetric` for the Growth
/// Tracker's streak matrix. New habits do not get one.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum LegacyHabitKey {
    ReadingHabit,
    RevisionHabit,
}

// ── Records ─────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserConfig {
    pub id: String,
    pub name: String,
    pub target_study_hours: f64,
    pub water_target: f64,
    #[serde(default)]
    pub blocked_apps: Vec<String>,
    #[serde(default)]
    pub is_focus_active: bool,
    #[serde(default)]
    pub free_time_unlocked: bool,
    /// Sleep window, merged in from the old Wellness tab.
    #[serde(default = "default_bedtime")]
    pub sleep_bedtime: String,
    #[serde(default = "default_wake")]
    pub sleep_wake: String,
}

fn default_bedtime() -> String {
    "22:30".into()
}
fn default_wake() -> String {
    "06:30".into()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DailyMetric {
    pub id: String,
    pub date: String,
    pub study_hours: f64,
    pub dpps_got: f64,
    pub dpps_complete: f64,
    pub reading_habit: bool,
    pub revision_habit: bool,
    pub mood_score: f64,
    pub well_spent_time: f64,
    pub posture_count: f64,
    pub water_count: f64,

    /// Set when the day's log is submitted. A locked day is read-only in the
    /// Daily Log; it can be reopened with an explicit, audit-logged unlock.
    /// Absent on older data, which reads as unlocked.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub locked: Option<bool>,
    /// ISO timestamp of the most recent submit.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub submitted_at: Option<String>,
    /// SHA-256 of the day's data at submit time. If the stored data later stops
    /// matching this, the day was changed outside the app — the app flags it,
    /// and the hash-chained audit log proves it.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub submit_hash: Option<String>,
}

impl DailyMetric {
    /// A day that exists but has nothing entered in it yet.
    pub fn blank(id: String, date: String) -> Self {
        Self {
            id,
            date,
            study_hours: 0.0,
            dpps_got: 4.0,
            dpps_complete: 0.0,
            reading_habit: false,
            revision_habit: false,
            mood_score: 5.0,
            well_spent_time: 0.0,
            posture_count: 0.0,
            water_count: 0.0,
            locked: None,
            submitted_at: None,
            submit_hash: None,
        }
    }

    pub fn is_locked(&self) -> bool {
        self.locked.unwrap_or(false)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MarkLogbookEntry {
    pub id: String,
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
    /// Minutes spent on the paper.
    #[serde(default)]
    pub time_spent: f64,
    pub mistake_reason: MistakeReason,
    #[serde(default)]
    pub notes: String,
}

impl MarkLogbookEntry {
    /// Marks dropped on a paper — derived, never stored.
    pub fn marks_lost(&self) -> f64 {
        (self.max_score - self.score).max(0.0)
    }

    /// Identity for de-duplicating a spreadsheet import. Two rows describing the
    /// same paper on the same day are the same paper, however they were typed.
    ///
    /// **This must produce byte-identical output to `fingerprint` in
    /// `src/modules/database/sheetImport.ts`.** The importer asks Rust for the
    /// fingerprints already stored and compares them against ones it builds
    /// itself, so a difference in how either side normalises text does not
    /// produce an error — it produces silently duplicated rows. `normalise`
    /// below is the shared rule; the TypeScript `norm()` is the same three
    /// steps in the same order.
    pub fn fingerprint(&self) -> String {
        format!(
            "{}|{}|{}|{}|{}",
            self.date,
            normalise(&self.subject),
            normalise(&self.chapter),
            self.score,
            self.max_score
        )
    }
}

/// Trim, lower-case, turn `_`, `-` and `.` into spaces, and collapse runs of
/// whitespace to one. Mirrors `norm()` in `sheetImport.ts` exactly — see
/// [`MarkLogbookEntry::fingerprint`] for why that matters.
fn normalise(s: &str) -> String {
    let spaced: String = s
        .trim()
        .to_lowercase()
        .chars()
        .map(|c| if c == '_' || c == '-' || c == '.' { ' ' } else { c })
        .collect();
    spaced.split_whitespace().collect::<Vec<_>>().join(" ")
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FocusSession {
    pub id: String,
    pub date: String,
    pub duration_minutes: f64,
    #[serde(default)]
    pub tag: String,
    pub completed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Task {
    pub id: String,
    pub title: String,
    #[serde(default)]
    pub subject: String,
    #[serde(default)]
    pub due_date: String,
    pub completed: bool,
    /// which mode's to-do list this belongs to — a vault from before this field
    /// existed defaults every task to Academic, where the feature started
    #[serde(default)]
    pub mode: AppMode,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TopicItem {
    pub id: String,
    pub date: String,
    pub name: String,
    #[serde(rename = "type")]
    pub kind: TopicType,
    pub done: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FocusSettings {
    pub focus_minutes: f64,
    pub short_break: f64,
    pub long_break: f64,
    pub rounds_before_long: f64,
    #[serde(default)]
    pub timer_design: TimerDesign,
    #[serde(default)]
    pub focus_music: FocusMusic,
    #[serde(default = "default_music_volume")]
    pub music_volume: f64,
    #[serde(default)]
    pub ambient_sound: AmbientSound,
    #[serde(default = "default_ambient_volume")]
    pub ambient_volume: f64,
    #[serde(default)]
    pub brainwave: Brainwave,
    #[serde(default = "default_brainwave_volume")]
    pub brainwave_volume: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Habit {
    pub id: String,
    pub name: String,
    pub priority: Priority,
    /// Set only on the two habits the Growth Tracker's streak matrix reads.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub legacy_key: Option<LegacyHabitKey>,
}

/// One row per habit actually ticked — absence means "not done", so do not
/// expect a `false` row.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HabitLogEntry {
    pub id: String,
    pub date: String,
    pub habit_id: String,
}

/// `Record<TrackId, Priority>` as a struct rather than a map: it serialises to
/// exactly the same JSON object, but the compiler now refuses to let a new
/// track be added without deciding its default here.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrackPriorities {
    #[serde(default = "high")]
    pub studies: Priority,
    #[serde(default = "high")]
    pub dpps: Priority,
    #[serde(default = "medium")]
    pub habits: Priority,
    #[serde(default = "medium")]
    pub mood: Priority,
    #[serde(default = "low")]
    pub well_spent: Priority,
    #[serde(default = "low")]
    pub wellness: Priority,
}

fn high() -> Priority {
    Priority::High
}
fn medium() -> Priority {
    Priority::Medium
}
fn low() -> Priority {
    Priority::Low
}

impl TrackPriorities {
    pub fn get(&self, id: TrackId) -> Priority {
        match id {
            TrackId::Studies => self.studies,
            TrackId::Dpps => self.dpps,
            TrackId::Habits => self.habits,
            TrackId::Mood => self.mood,
            TrackId::WellSpent => self.well_spent,
            TrackId::Wellness => self.wellness,
        }
    }

    pub fn set(&mut self, id: TrackId, p: Priority) {
        match id {
            TrackId::Studies => self.studies = p,
            TrackId::Dpps => self.dpps = p,
            TrackId::Habits => self.habits = p,
            TrackId::Mood => self.mood = p,
            TrackId::WellSpent => self.well_spent = p,
            TrackId::Wellness => self.wellness = p,
        }
    }
}

impl Default for TrackPriorities {
    fn default() -> Self {
        Self {
            studies: Priority::High,
            dpps: Priority::High,
            habits: Priority::Medium,
            mood: Priority::Medium,
            well_spent: Priority::Low,
            wellness: Priority::Low,
        }
    }
}

/// The whole saved database — what the vault holds, encrypted.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DbShape {
    pub user: UserConfig,
    #[serde(default)]
    pub daily_metrics: Vec<DailyMetric>,
    #[serde(default)]
    pub mark_logbook: Vec<MarkLogbookEntry>,
    #[serde(default)]
    pub focus_sessions: Vec<FocusSession>,
    #[serde(default)]
    pub tasks: Vec<Task>,
    #[serde(default)]
    pub topics: Vec<TopicItem>,
    pub focus_settings: FocusSettings,
    #[serde(default)]
    pub habits: Vec<Habit>,
    #[serde(default)]
    pub habit_log: Vec<HabitLogEntry>,
    #[serde(default)]
    pub track_priorities: TrackPriorities,
    #[serde(default)]
    pub app_mode: AppMode,
}

/// A fresh id. The old TS `uid()` produced a random string; anything unique
/// works, and a v4 UUID cannot collide across a merge or an import.
pub fn uid() -> String {
    uuid::Uuid::new_v4().to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn entry(subject: &str, chapter: &str, score: f64, max: f64) -> MarkLogbookEntry {
        MarkLogbookEntry {
            id: uid(),
            date: "2026-08-05".into(),
            subject: subject.into(),
            chapter: chapter.into(),
            grade: "B".into(),
            score,
            max_score: max,
            difficulty: Difficulty::Medium,
            time_spent: 60.0,
            mistake_reason: MistakeReason::Careless,
            notes: String::new(),
        }
    }

    #[test]
    fn normalise_matches_the_typescript_rule() {
        assert_eq!(normalise("  Work_Energy  "), "work energy");
        assert_eq!(normalise("Work - Energy"), "work energy");
        assert_eq!(normalise("Sub.\tUnit"), "sub unit");
        assert_eq!(normalise(""), "");
    }

    #[test]
    fn the_same_paper_typed_differently_fingerprints_the_same() {
        // The importer's whole duplicate check rests on this. If the two sides
        // ever disagree, nothing errors — rows just quietly double up.
        assert_eq!(
            entry("Physics", "Work_Energy", 38.0, 50.0).fingerprint(),
            entry("  physics ", "work - energy", 38.0, 50.0).fingerprint()
        );
    }

    #[test]
    fn whole_numbers_print_without_a_decimal_point() {
        // JavaScript renders 38 as "38"; a Rust f64 that printed "38.0" here
        // would make every imported row look new.
        assert!(entry("Physics", "", 38.0, 50.0).fingerprint().ends_with("|38|50"));
    }

    #[test]
    fn a_different_paper_fingerprints_differently() {
        let a = entry("Physics", "Kinematics", 38.0, 50.0).fingerprint();
        assert_ne!(a, entry("Physics", "Kinematics", 39.0, 50.0).fingerprint());
        assert_ne!(a, entry("Physics", "Optics", 38.0, 50.0).fingerprint());
        assert_ne!(a, entry("Chemistry", "Kinematics", 38.0, 50.0).fingerprint());
    }
}

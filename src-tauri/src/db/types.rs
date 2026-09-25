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
    AcademicTasks,
    LifeTasks,
}

impl TrackId {
    pub const ALL: [TrackId; 8] = [
        TrackId::Studies,
        TrackId::Dpps,
        TrackId::WellSpent,
        TrackId::Mood,
        TrackId::Habits,
        TrackId::Wellness,
        TrackId::AcademicTasks,
        TrackId::LifeTasks,
    ];

    /// Every track belongs to exactly one mode — never both. Academic is the
    /// work that moves marks; Life is what keeps that work sustainable.
    ///
    /// The to-do list itself is one shared list split by a task's own `mode`
    /// field (see `Task`), not two separate lists — but its *score* still has
    /// to obey this same one-track-one-mode rule, so it is split into
    /// `AcademicTasks` and `LifeTasks` here, each counting only its own half.
    pub fn mode(self) -> AppMode {
        match self {
            TrackId::Studies | TrackId::Dpps | TrackId::AcademicTasks => AppMode::Academic,
            TrackId::WellSpent | TrackId::Mood | TrackId::Habits | TrackId::Wellness | TrackId::LifeTasks => {
                AppMode::Life
            }
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

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum TopicType {
    #[default]
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

/// One subject the person is studying, as they described it at onboarding.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(default)]
pub struct ProfileSubject {
    pub name: String,
    /// 1 (shaky) to 5 (confident) — how they rate themselves *before* MIS has
    /// any data. It is a starting guess, and the mistake analytics will
    /// eventually contradict it, which is the point of keeping it.
    pub confidence: u8,
    /// Free text — "B+", "72%", "Grade 7". Not parsed.
    pub last_result: String,
}

/// Who the person is and what they are working towards: the answers from the
/// onboarding questionnaire, plus the account identifiers shown back to them.
///
/// **No secret lives here.** The password and the recovery code are turned into
/// keys in `vault.key` (`vault/passkey.rs`), which has to be readable *before*
/// the vault can be — so the credential material cannot sit in the vault it
/// unlocks. This record is what the vault holds *about* the account, not the
/// means of opening it.
///
/// Every field defaults, so a profile written by an older build still loads
/// after a field is added.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(default)]
pub struct Profile {
    // account
    pub username: String,
    pub email: String,

    // about you
    pub full_name: String,
    pub age: u32,
    /// "Class 11", "Year 12", "Undergraduate"…
    pub grade: String,

    // what you are working towards
    /// "CBSE / ICSE", "IGCSE (Cambridge)", "JEE", "NEET"…
    pub program: String,
    pub goals: Vec<String>,
    pub target_exam: String,
    /// `YYYY-MM-DD`, or empty when there is no fixed date.
    pub exam_date: String,
    /// "90%", "A*", "AIR under 1000" — free text.
    pub target_score: String,
    pub subjects: Vec<ProfileSubject>,

    // how you work
    pub daily_study_hours: f64,
    /// How long you can hold focus before drifting, in minutes.
    pub focus_span_minutes: f64,
    /// `morning` | `afternoon` | `evening` | `night`
    pub productive_time: String,
    /// School or college hours, `HH:MM`; both empty when not applicable.
    pub school_start: String,
    pub school_end: String,
    pub sleep_bedtime: String,
    pub sleep_wake: String,
    pub preferences: Vec<String>,

    pub created_at: String,
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

/// Why a focus session was started. A fixed set, unlike the free-text topic:
/// the point of asking is to be able to add the answers up later — how much of
/// the month went on homework, how much on things nobody set.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SessionReason {
    /// the class covered it today
    TaughtInClass,
    /// it was set as homework
    Homework,
    /// a test or exam is coming
    UpcomingTest,
    /// the student's own choice, no outside deadline
    SelfStudy,
    /// none of the above — [`SessionDetails::reason_note`] says what
    Other,
}

/// One finished (or abandoned) focus round.
///
/// `subject`, `chapter` and `reason` describe what the round was *for*. They are
/// empty on a session recorded before MIS asked, and stay empty — nothing here
/// guesses a topic for old history. They are also skipped when empty, so an old
/// session written back out is byte-for-byte what it was.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct FocusSession {
    pub id: String,
    pub date: String,
    pub duration_minutes: f64,
    /// A short label for lists that only have room for one line. New sessions
    /// set it to the chapter; it is kept because older readers key on it.
    #[serde(default)]
    pub tag: String,
    pub completed: bool,
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub subject: String,
    /// The topic worked on — free text, whatever the student typed or picked.
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub chapter: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub reason: Option<SessionReason>,
    /// In the student's own words. Required when `reason` is `Other`, optional
    /// otherwise.
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub reason_note: String,
}

/// What a focus session was for, as the frontend sends it. [`add_focus_session`]
/// (in `db/mod.rs`) refuses the session unless subject, chapter and reason are
/// all there — this struct is only the carrier.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(default)]
pub struct SessionDetails {
    pub subject: String,
    pub chapter: String,
    pub reason: Option<SessionReason>,
    pub reason_note: String,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct Task {
    pub id: String,
    pub title: String,
    #[serde(default)]
    pub subject: String,
    #[serde(default)]
    pub due_date: String,
    pub completed: bool,
    /// The day it was ticked off, so the Daily Log can say what was finished on
    /// which day. Absent on anything completed before this field existed — that
    /// history is unknown, and inventing a date for it would be worse than none.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub completed_on: Option<String>,
    /// which mode's to-do list this belongs to — a vault from before this field
    /// existed defaults every task to Academic, where the feature started
    #[serde(default)]
    pub mode: AppMode,
    /// What sort of session this is — "Practice PYQ", "Reference problems", or
    /// anything the student typed. **Free text on purpose**: the app offers
    /// presets and the kinds the student keeps reusing, but never restricts them
    /// to a list. Empty on a plain to-do.
    #[serde(default)]
    pub kind: String,
    /// The syllabus chapter the task is about, free text.
    #[serde(default)]
    pub chapter: String,
    /// The book or sheet a reference task draws from ("HC Verma").
    #[serde(default)]
    pub reference: String,
    /// How many problems the task sets, `0` when it does not count them.
    #[serde(default)]
    pub problems: u32,
}

/// The optional session fields of a task, as the frontend sends them. Every one
/// defaults, so a plain to-do is still `add_task` with nothing extra.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(default)]
pub struct TaskDetails {
    pub kind: String,
    pub chapter: String,
    pub reference: String,
    pub problems: u32,
}

/// One DPP (daily practice problem sheet) set for a day: what it covers, who
/// set it, and whether it is finished.
///
/// The day's `DailyMetric.dpps_got` / `dpps_complete` are *derived* from these
/// whenever any exist for the day (see `db::sync_dpp_counters`), so the score,
/// the charts and Home keep reading the two counters they always have.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DppItem {
    pub id: String,
    pub date: String,
    #[serde(default)]
    pub subject: String,
    #[serde(default)]
    pub topic: String,
    /// the teacher who gave it
    #[serde(default)]
    pub teacher: String,
    pub done: bool,
    /// the day it was ticked off — see `Task::completed_on`
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub done_on: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct TopicItem {
    pub id: String,
    pub date: String,
    pub name: String,
    #[serde(rename = "type")]
    pub kind: TopicType,
    pub done: bool,
    /// The day it was ticked off — see `Task::completed_on`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub done_on: Option<String>,
    /// Which subject and chapter a doubt belongs to, and a short note on what
    /// is unclear. All free text, all empty on a topic added the old way.
    #[serde(default)]
    pub subject: String,
    #[serde(default)]
    pub chapter: String,
    #[serde(default)]
    pub note: String,
}

/// The optional detail of a topic, as the frontend sends it.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(default)]
pub struct TopicDetails {
    pub subject: String,
    pub chapter: String,
    pub note: String,
}

/// Which "left to" list a doubt lands in.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum DoubtList {
    Revise,
    Solve,
}

impl DoubtList {
    pub fn topic_type(self) -> TopicType {
        match self {
            DoubtList::Revise => TopicType::Revise,
            DoubtList::Solve => TopicType::Solve,
        }
    }
}

/// How a Practice PYQ session went. Kept on the journal entry rather than in the
/// mistake log: the log holds the *misses*, this holds the session.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(default)]
pub struct PyqResult {
    pub correct: u32,
    pub wrong: u32,
    pub skipped: u32,
    /// marks earned, after negative marking
    pub marks: f64,
    pub max_marks: f64,
}

/// A task as the journal remembers it. A snapshot, not a link: the journal must
/// still read correctly after the task is deleted.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(default)]
pub struct JournalTask {
    pub title: String,
    pub kind: String,
}

/// A doubt as the journal remembers it (see [`JournalTask`]).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JournalDoubt {
    pub title: String,
    #[serde(default)]
    pub subject: String,
    #[serde(default)]
    pub chapter: String,
    #[serde(default)]
    pub note: String,
    pub list: DoubtList,
}

/// A planned next-session task as the journal remembers it.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(default)]
pub struct JournalPlanned {
    pub title: String,
    pub kind: String,
    pub due_date: String,
}

/// One study session, written when the student wraps it up. It records the
/// session on three levels — what got done, what is still a doubt, and what
/// comes next — plus a free-text note.
///
/// Every list is a snapshot, so deleting the task or doubt it came from later
/// does not rewrite the history.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(default)]
pub struct JournalEntry {
    pub id: String,
    /// the day the session happened, `YYYY-MM-DD`
    pub date: String,
    /// when the wrap-up was confirmed, ISO-8601
    pub created_at: String,
    pub subject: String,
    pub chapter: String,
    /// the kind of session, free text like `Task::kind`
    pub kind: String,
    pub minutes: f64,
    pub pyq: Option<PyqResult>,
    pub tasks_done: Vec<JournalTask>,
    pub doubts: Vec<JournalDoubt>,
    pub next_plan: Vec<JournalPlanned>,
    pub note: String,
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
    #[serde(default = "medium")]
    pub academic_tasks: Priority,
    #[serde(default = "medium")]
    pub life_tasks: Priority,
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
            TrackId::AcademicTasks => self.academic_tasks,
            TrackId::LifeTasks => self.life_tasks,
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
            TrackId::AcademicTasks => self.academic_tasks = p,
            TrackId::LifeTasks => self.life_tasks = p,
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
            academic_tasks: Priority::Medium,
            life_tasks: Priority::Medium,
        }
    }
}

/// A Daily Log card's snapped width in the two-column grid.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum WidgetSize {
    Sm,
    Lg,
}

impl Default for WidgetSize {
    fn default() -> Self {
        WidgetSize::Sm
    }
}

/// One track card's place in a hand-arranged Daily Log layout.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct WidgetPlacement {
    pub id: TrackId,
    #[serde(default)]
    pub size: WidgetSize,
}

/// A user's hand-arranged Daily Log card order, kept per mode since each mode
/// shows a different set of cards. Empty until the user actually drags
/// something — until then the Daily Log falls back to priority order, exactly
/// as it always has.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(default)]
pub struct DailyLogLayout {
    pub academic: Vec<WidgetPlacement>,
    pub life: Vec<WidgetPlacement>,
}

impl DailyLogLayout {
    pub fn get(&self, mode: AppMode) -> &Vec<WidgetPlacement> {
        match mode {
            AppMode::Academic => &self.academic,
            AppMode::Life => &self.life,
        }
    }

    pub fn set(&mut self, mode: AppMode, layout: Vec<WidgetPlacement>) {
        match mode {
            AppMode::Academic => self.academic = layout,
            AppMode::Life => self.life = layout,
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
    #[serde(default)]
    pub dpps: Vec<DppItem>,
    pub focus_settings: FocusSettings,
    #[serde(default)]
    pub habits: Vec<Habit>,
    #[serde(default)]
    pub habit_log: Vec<HabitLogEntry>,
    #[serde(default)]
    pub track_priorities: TrackPriorities,
    #[serde(default)]
    pub app_mode: AppMode,
    #[serde(default)]
    pub daily_log_layout: DailyLogLayout,
    /// `None` until onboarding has been completed. That absence is what routes a
    /// launch to the setup wizard — including for a vault that predates it.
    #[serde(default)]
    pub profile: Option<Profile>,
    /// One entry per wrapped-up study session, newest first.
    #[serde(default)]
    pub journal: Vec<JournalEntry>,
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

/**
 * Every shape MIS stores — as the frontend sees it.
 *
 * **This file is a mirror, not the source of truth.** The authoritative
 * definitions now live in `src-tauri/src/db/types.rs`; these are the TypeScript
 * views of what Rust serialises across the IPC bridge. If a field changes there
 * it must change here, and `migrations.rs` must carry old vaults forward. The
 * arrow only ever points one way: Rust decides the shape, TypeScript describes
 * it.
 *
 * Nothing in here runs. It is the vocabulary the rest of the frontend is written
 * in, which is why it has no imports and can be pulled into any module without
 * dragging the IPC layer along.
 */

// ── Enumerations ────────────────────────────────────────────────────────────

/**
 * The app runs in one of two modes. The mode decides which tabs exist, which
 * tracks the Daily Log accepts, which charts the Growth Tracker draws, and the
 * accent colour of the whole UI. Each mode scores its own day independently.
 */
export const MODES = ['academic', 'life'] as const;
export type AppMode = (typeof MODES)[number];

/** how much a track or habit counts toward the day's score */
export const PRIORITIES = ['high', 'medium', 'low'] as const;
export type Priority = (typeof PRIORITIES)[number];

export const PRIORITY_WEIGHT: Record<Priority, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

/** the things the Daily Log scores, one column-group each in the old sheet */
export const TRACK_IDS = [
  'studies',
  'dpps',
  'well_spent',
  'mood',
  'habits',
  'wellness',
  'academic_tasks',
  'life_tasks',
] as const;
export type TrackId = (typeof TRACK_IDS)[number];

/** the nine kinds of mistake a paper can be tagged with */
export const MISTAKE_REASONS = [
  'Conceptual',
  'Calculation',
  'Careless',
  'Reading',
  'Unit',
  'Sign',
  'Formula Recall',
  'Time Pressure',
  'Other',
] as const;
export type MistakeReason = (typeof MISTAKE_REASONS)[number];

export const DIFFICULTIES = ['Easy', 'Medium', 'Hard'] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export const TOPIC_TYPES = ['taught', 'revise', 'solve'] as const;
export type TopicType = (typeof TOPIC_TYPES)[number];

/** which clock face the Focus Timer draws */
export type TimerDesign = 'ring' | 'flip';

/** which background music loop plays behind the Focus Timer, if any */
export type FocusMusic = 'off' | 'jazz' | 'lofi';

/** ambient noise layer behind the Focus Timer, if any — independent of `FocusMusic` */
export type AmbientSound = 'off' | 'white' | 'pink' | 'brown' | 'rain' | 'ocean';

/** binaural-beat brainwave tone behind the Focus Timer, if any */
export type Brainwave = 'off' | 'delta' | 'theta' | 'alpha' | 'beta' | 'gamma';

// ── Records ─────────────────────────────────────────────────────────────────

export interface UserConfig {
  id: string;
  name: string;
  target_study_hours: number;
  water_target: number;
  blocked_apps: string[];
  is_focus_active: boolean;
  free_time_unlocked: boolean;
  /** sleep window, merged in from the old Wellness tab */
  sleep_bedtime: string;
  sleep_wake: string;
}

/** One subject as described at onboarding. Mirrors `ProfileSubject` in `types.rs`. */
export interface ProfileSubject {
  name: string;
  /** 1 (shaky) to 5 (confident). A starting guess, before MIS has any data. */
  confidence: number;
  /** Free text — "B+", "72%". */
  last_result: string;
}

export const PRODUCTIVE_TIMES = ['morning', 'afternoon', 'evening', 'night'] as const;
export type ProductiveTime = (typeof PRODUCTIVE_TIMES)[number];

/**
 * The onboarding answers plus the account identifiers. Mirrors `Profile` in
 * `types.rs`; Rust validates it (`db/profile.rs`), so the wizard's checks are a
 * courtesy and not the guard. **No secret is in here** — see the Rust docs.
 */
export interface Profile {
  username: string;
  email: string;
  full_name: string;
  age: number;
  grade: string;
  program: string;
  goals: string[];
  target_exam: string;
  /** `YYYY-MM-DD`, or empty when there is no fixed date. */
  exam_date: string;
  target_score: string;
  subjects: ProfileSubject[];
  daily_study_hours: number;
  focus_span_minutes: number;
  productive_time: ProductiveTime;
  /** `HH:MM`; both empty when school hours don't apply. */
  school_start: string;
  school_end: string;
  sleep_bedtime: string;
  sleep_wake: string;
  preferences: string[];
  created_at: string;
}

/** Which screen the app should show. Mirrors `Stage` in `state.rs`. */
export type AuthStage = 'setup' | 'locked' | 'unlocked';

export interface AuthStatus {
  stage: AuthStage;
}

export interface DailyMetric {
  id: string;
  date: string;
  study_hours: number;
  dpps_got: number;
  dpps_complete: number;
  reading_habit: boolean;
  revision_habit: boolean;
  mood_score: number;
  well_spent_time: number;
  posture_count: number;
  water_count: number;
  /**
   * Set when the day's log is submitted. A locked day is read-only; it can be
   * reopened with an explicit, audit-logged unlock. Absent on older data, which
   * reads as unlocked.
   *
   * The lock is enforced in Rust, not here — a write against a locked day comes
   * back as an error. The greyed-out styling in the Daily Log is the
   * *explanation* of that refusal, never the mechanism.
   */
  locked?: boolean;
  /** ISO timestamp of the most recent submit */
  submitted_at?: string;
  /** SHA-256 of the day's data at submit time */
  submit_hash?: string;
}

export interface MarkLogbookEntry {
  id: string;
  date: string;
  subject: string;
  chapter: string;
  grade: string;
  score: number;
  max_score: number;
  difficulty: Difficulty;
  /** minutes spent on the paper */
  time_spent: number;
  mistake_reason: MistakeReason;
  notes: string;
}

/** a logbook row on its way in, before Rust gives it an id */
export type NewEntry = Omit<MarkLogbookEntry, 'id'>;

/** marks dropped on a paper — derived, never stored */
export const marksLost = (e: MarkLogbookEntry) => Math.max(0, e.max_score - e.score);

/**
 * Why a focus session was started. Spelled exactly as Rust's `SessionReason`
 * serialises (`snake_case`), and pinned by a test there — change one side and
 * every stored session stops loading.
 */
export type SessionReason =
  | 'taught_in_class'
  | 'homework'
  | 'upcoming_test'
  | 'self_study'
  | 'other';

export interface FocusSession {
  id: string;
  date: string;
  duration_minutes: number;
  /** one-line label; for a session made now it is the chapter */
  tag: string;
  completed: boolean;
  /**
   * What the round was for. Absent on a session recorded before MIS asked —
   * those are shown by their `tag` and never guessed at.
   */
  subject?: string;
  chapter?: string;
  reason?: SessionReason;
  /** in the student's own words; required by Rust when `reason` is `other` */
  reason_note?: string;
}

/**
 * What a focus session is for, as it goes to Rust. All three of subject,
 * chapter and reason are required there — a session without them is refused.
 */
export interface SessionDetails {
  subject: string;
  chapter: string;
  reason: SessionReason | null;
  reason_note: string;
}

export interface Task {
  id: string;
  title: string;
  subject: string;
  due_date: string;
  completed: boolean;
  /** the day it was ticked off; absent on anything finished before this was recorded */
  completed_on?: string;
  /** which mode's to-do list this belongs to */
  mode: AppMode;
  /**
   * What sort of session this is — "Practice PYQ", "Reference problems", or anything
   * the student typed. Free text on purpose: presets and reused kinds are suggested,
   * never enforced. Empty on a plain to-do, and absent on a vault older than this.
   */
  kind?: string;
  /** the syllabus chapter the task is about, free text */
  chapter?: string;
  /** the book or sheet a reference task draws from */
  reference?: string;
  /** how many problems it sets; `0`/absent when it does not count them */
  problems?: number;
}

/** The optional session fields of a new task. Every one may be left out. */
export interface TaskDetails {
  kind?: string;
  chapter?: string;
  reference?: string;
  problems?: number;
}

/**
 * One DPP set for a day. The day's `dpps_got` / `dpps_complete` are derived from
 * these in Rust whenever any exist, so scoring and the charts are unchanged.
 */
export interface DppItem {
  id: string;
  date: string;
  subject: string;
  topic: string;
  /** the teacher who gave it */
  teacher: string;
  done: boolean;
  /** the day it was ticked off — see `Task.completed_on` */
  done_on?: string;
}

export interface TopicItem {
  id: string;
  date: string;
  name: string;
  type: TopicType;
  done: boolean;
  /** the day it was ticked off — see `Task.completed_on` */
  done_on?: string;
  /** which subject and chapter a doubt belongs to, and what is unclear — all free text */
  subject?: string;
  chapter?: string;
  note?: string;
}

/** The optional detail of a new topic. Every field may be left out. */
export interface TopicDetails {
  subject?: string;
  chapter?: string;
  note?: string;
}

/** Which "left to" list a doubt lands in. */
export type DoubtList = 'revise' | 'solve';

/** How a Practice PYQ session went. The misses are in the mistake log; this is the session. */
export interface PyqResult {
  correct: number;
  wrong: number;
  skipped: number;
  /** marks earned, after negative marking */
  marks: number;
  max_marks: number;
}

/** A task, doubt or planned task as the journal remembers it — a snapshot, not a link. */
export interface JournalTask {
  title: string;
  kind: string;
}

export interface JournalDoubt {
  title: string;
  subject: string;
  chapter: string;
  note: string;
  list: DoubtList;
}

export interface JournalPlanned {
  title: string;
  kind: string;
  due_date: string;
}

/**
 * One wrapped-up study session: what got done, what is still a doubt, what comes
 * next, and a free-text note. Newest first in `DbShape.journal`.
 */
export interface JournalEntry {
  id: string;
  /** the day the session happened, `YYYY-MM-DD` */
  date: string;
  /** when the wrap-up was confirmed, ISO-8601 */
  created_at: string;
  /**
   * Which journal it belongs to: Academic is the study logbook (every session
   * wrap-up lands there), Life is the personal diary. The two are never mixed
   * on screen. Absent on a vault written before the diary existed.
   */
  mode?: AppMode;
  /** the entry's own heading; empty on a session wrap-up */
  title?: string;
  subject: string;
  chapter: string;
  kind: string;
  minutes: number;
  pyq: PyqResult | null;
  tasks_done: JournalTask[];
  doubts: JournalDoubt[];
  next_plan: JournalPlanned[];
  note: string;
}

/** A journal entry written by hand — a logbook page or a diary day. */
export interface NewJournalEntry {
  mode: AppMode;
  /** `YYYY-MM-DD`; omitted or empty means today. Backdating is allowed. */
  date?: string;
  title?: string;
  subject?: string;
  chapter?: string;
  kind?: string;
  minutes?: number;
  note?: string;
}

/**
 * The parts of an entry that can be rewritten. A session's three structured
 * levels are deliberately absent — they record what happened.
 */
export interface JournalPatch {
  date?: string;
  title?: string;
  subject?: string;
  chapter?: string;
  kind?: string;
  minutes?: number;
  note?: string;
}

/** A doubt as the wrap-up panel sends it. */
export interface WrapDoubt {
  title: string;
  subject?: string;
  chapter?: string;
  note?: string;
  list: DoubtList;
}

/** A next-session task as the wrap-up panel sends it. `due_date` defaults to tomorrow. */
export interface WrapPlanned {
  title: string;
  subject?: string;
  kind?: string;
  chapter?: string;
  reference?: string;
  problems?: number;
  due_date?: string;
}

/** Everything the wrap-up panel sends. Mirrors `db::WrapInput`. */
export interface WrapInput {
  subject?: string;
  chapter?: string;
  kind?: string;
  minutes?: number;
  pyq?: PyqResult | null;
  /** level 1 — tasks to mark done */
  done_task_ids?: string[];
  /** level 1 — today's DPPs finished in this session */
  done_dpp_ids?: string[];
  /** level 1 — Left to revise / Left to solve topics finished in this session */
  done_topic_ids?: string[];
  /** level 2 — doubts left */
  doubts?: WrapDoubt[];
  /** level 3 — tasks for the next session */
  next_plan?: WrapPlanned[];
  /** one logbook row per wrong PYQ */
  mistakes?: NewEntry[];
  note?: string;
}

/** What a wrap-up wrote. */
export interface WrapOutcome {
  journal_id: string;
  ticked: number;
  doubts_added: number;
  planned: number;
  mistakes_added: number;
}

export interface FocusSettings {
  focus_minutes: number;
  short_break: number;
  long_break: number;
  rounds_before_long: number;
  timer_design: TimerDesign;
  focus_music: FocusMusic;
  music_volume: number;
  ambient_sound: AmbientSound;
  ambient_volume: number;
  brainwave: Brainwave;
  brainwave_volume: number;
}

export interface Habit {
  id: string;
  name: string;
  priority: Priority;
  /** set only on the two habits the Growth Tracker's streak matrix reads */
  legacy_key?: 'reading_habit' | 'revision_habit';
}

/** one row per habit actually ticked — absence means "not done" */
export interface HabitLogEntry {
  id: string;
  date: string;
  habit_id: string;
}

/** a Daily Log card's snapped width in the two-column grid */
export const WIDGET_SIZES = ['sm', 'lg'] as const;
export type WidgetSize = (typeof WIDGET_SIZES)[number];

/** one track card's place in a hand-arranged Daily Log layout */
export interface WidgetPlacement {
  id: TrackId;
  size: WidgetSize;
}

/**
 * A user's hand-arranged Daily Log card order, kept per mode since each mode
 * shows a different set of cards. Empty until the user actually drags
 * something — see `reconcileLayout` in `modules/log/layout.ts`.
 */
export interface DailyLogLayout {
  academic: WidgetPlacement[];
  life: WidgetPlacement[];
}

/** the whole database, as Rust hands it over */
export interface DbShape {
  user: UserConfig;
  daily_metrics: DailyMetric[];
  mark_logbook: MarkLogbookEntry[];
  focus_sessions: FocusSession[];
  tasks: Task[];
  topics: TopicItem[];
  dpps: DppItem[];
  focus_settings: FocusSettings;
  habits: Habit[];
  habit_log: HabitLogEntry[];
  track_priorities: Record<TrackId, Priority>;
  app_mode: AppMode;
  daily_log_layout: DailyLogLayout;
  /** `null` until onboarding has been completed. */
  profile: Profile | null;
  /** one entry per wrapped-up study session, newest first */
  journal: JournalEntry[];
}

// ── Patches ─────────────────────────────────────────────────────────────────

/**
 * The fields the Daily Log can edit. `locked` / `submitted_at` / `submit_hash`
 * are deliberately absent: they are set by submitting, and by nothing else.
 */
export type MetricPatch = Partial<
  Pick<
    DailyMetric,
    | 'study_hours'
    | 'dpps_got'
    | 'dpps_complete'
    | 'reading_habit'
    | 'revision_habit'
    | 'mood_score'
    | 'well_spent_time'
    | 'posture_count'
    | 'water_count'
  >
>;

export type EntryPatch = Partial<Omit<MarkLogbookEntry, 'id'>>;

// ── Scoring, computed in Rust ───────────────────────────────────────────────

export type TrackScores = Record<TrackId, number>;

/** each mode's own score out of DAY_TARGET */
export type ByMode = Record<AppMode, number>;

/**
 * One day, scored.
 *
 * `scores` and `by_mode` are null when there was no log that day — **charts
 * render a gap, never a zero.** A missing day and a wasted day are not the same
 * thing, and with a fresh vault every day is null until something is entered, so
 * every empty state has to survive it.
 */
export interface ScoredDay {
  date: string;
  metric: DailyMetric | null;
  scores: TrackScores | null;
  by_mode: ByMode | null;
}

/** one day of the fortnight strip on the home page */
export interface StreakDay {
  date: string;
  hit: boolean;
}

/**
 * The study streak, counted over the **whole history** rather than the visible
 * range — a 40-day streak must not read as 7 because the 7-day view is on.
 *
 * A day counts when it met the user's own study target, not merely when
 * something was logged. `today_done` is separate so the home page can say "keep
 * it going" rather than "you lost it" before the day is in.
 */
export interface Streak {
  days: number;
  /** the longest run anywhere in the history — something to beat */
  best: number;
  today_done: boolean;
  /** the last fortnight, oldest first */
  recent: StreakDay[];
}

// ── Built-in study content (read-only, from Rust `content/`) ────────────────

/** One NCERT chapter. Mirrors `content::SyllabusChapter`. */
export interface SyllabusChapter {
  /** `phy-1-04` — what MIS stores when it means this chapter */
  id: string;
  subject: string;
  /** 1 = first PUC (class 11), 2 = second PUC (class 12) */
  puc: 1 | 2;
  num: number;
  /** what is shown, and written into free-text chapter fields */
  title: string;
  /** exam weight, 1 (low) to 5 (high) */
  priority: number;
  exams: ('jee' | 'neet')[];
  /** the question-bank chapter covering it; several NCERT chapters can share one */
  bank_id: string | null;
}

export interface BankTopic {
  name: string;
  teaser: string;
}

/** A question-bank chapter without its questions. Mirrors `content::BankChapterSummary`. */
export interface BankChapter {
  id: string;
  subject: string;
  num: number;
  title: string;
  teaser: string;
  topics: BankTopic[];
  questions: number;
  by_difficulty: Partial<Record<Difficulty, number>>;
  /** the NCERT chapters it covers; empty for a few JEE-only chapters */
  syllabus_ids: string[];
}

/** One practice question. Mirrors `content::Question`. */
export interface Question {
  /** `<bank chapter>-<nnn>` */
  id: string;
  topic: string;
  difficulty: Difficulty;
  /** math is KaTeX between `\( \)` and `\[ \]` */
  text: string;
  options: string[];
  /** index into `options` as stored — shuffle for display, the stored order is skewed */
  correct: number;
  /** the worked solution, `**bold**` step headings */
  answer: string;
  tip: string;
  points: number;
  negative: number;
  /** `original` (exam-style) or `pyq` (a real past question) — only call the latter PYQs */
  source: 'original' | 'pyq';
}

// ── Vault ───────────────────────────────────────────────────────────────────

export interface VaultInfo {
  /** shown in the app so the honest limits are checkable, not just claimed */
  folder: string;
  audit_intact: boolean;
  audit_broken_at: number | null;
  recovery_key_id: string;
}

export interface AuditRecord {
  seq: number;
  ts: string;
  event: string;
  bytes: number;
  prev: string;
  hash: string;
  detail?: Record<string, unknown>;
}

// ── Screen time ─────────────────────────────────────────────────────────────

export const ST_CATEGORIES = ['study', 'neutral', 'distraction'] as const;
export type StCategory = (typeof ST_CATEGORIES)[number];

export interface TitleTotal {
  title: string;
  seconds: number;
}

/**
 * One thing that was done: a site inside a browser, or an app in its own right.
 *
 * This is the level categories are decided at. Windows only ever reports a
 * process, so `ulaa.exe` covers a past paper and a reel alike; the site is read
 * from the page title in `screentime/activity.rs`, which is how one browser's
 * hours end up in three different categories instead of one grey bar.
 */
export interface ActivityRow {
  /** what an assignment is stored against: `web:youtube`, or `code.exe` */
  key: string;
  label: string;
  /** the app it happened in */
  app: string;
  seconds: number;
  category: string;
  /** true for a page inside a browser, false for the app itself */
  web: boolean;
  titles: TitleTotal[];
}

export interface AppRow {
  app: string;
  seconds: number;
  /** what the app as a whole is filed as — the fallback for sites inside it */
  category: string;
  /** whether this app shows web pages, and so has activities worth opening */
  browser: boolean;
  /** this app's seconds by category: what its bar is stacked from */
  split: Record<string, number>;
  /** the sites inside it, longest first. Empty for anything but a browser. */
  activities: ActivityRow[];
  titles: TitleTotal[];
}

export interface Stretch {
  app: string;
  title: string;
  /** what that run actually was — the site, for a browser */
  label: string;
  category: string;
  seconds: number;
  start: number;
}

export interface TimelineSpan {
  app: string;
  title: string;
  label: string;
  /**
   * Carried per block rather than looked up by app: one block of a browser's
   * time can be study and the next distraction, so the strip cannot colour
   * itself from the app name.
   */
  category: string;
  start: number;
  seconds: number;
}

export interface DaySummary {
  day: string;
  total_seconds: number;
  by_app: AppRow[];
  /** everything done that day, flattened to one level and longest first */
  by_activity: ActivityRow[];
  by_category: Record<string, number>;
  switches: number;
  longest_stretch: Stretch | null;
  timeline: TimelineSpan[];
}

export interface CompactDay {
  day: string;
  total_seconds: number;
  by_category: Record<string, number>;
}

/** the tracker's own settings file, kept beside its recordings */
export interface StSettings {
  paused: boolean;
  /** opt-in: keep recording with no window open, and start with Windows */
  background: boolean;
  /** the user's app→category overrides, which beat the built-in defaults */
  categories: Record<string, string>;
  /** the user's site→category overrides, keyed by activity key, which beat those */
  sites: Record<string, string>;
}

export interface TrackerStatus {
  running: boolean;
  paused: boolean;
  /** background tracking is switched on */
  background: boolean;
  since: string | null;
  poll_seconds: number;
  idle_after_seconds: number;
  day: string;
}

/**
 * Whether screen time can be reported at all.
 *
 * **Screen Time must say when nothing was watching.** An empty chart and "you
 * used nothing today" look identical and only one is ever true, so the tab asks
 * this before drawing a zero.
 */
export interface Availability {
  available: boolean;
  reason: string | null;
}

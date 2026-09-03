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
export const TRACK_IDS = ['studies', 'dpps', 'well_spent', 'mood', 'habits', 'wellness'] as const;
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

export interface FocusSession {
  id: string;
  date: string;
  duration_minutes: number;
  tag: string;
  completed: boolean;
}

export interface Task {
  id: string;
  title: string;
  subject: string;
  due_date: string;
  completed: boolean;
  /** which mode's to-do list this belongs to */
  mode: AppMode;
}

export interface TopicItem {
  id: string;
  date: string;
  name: string;
  type: TopicType;
  done: boolean;
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

/** the whole database, as Rust hands it over */
export interface DbShape {
  user: UserConfig;
  daily_metrics: DailyMetric[];
  mark_logbook: MarkLogbookEntry[];
  focus_sessions: FocusSession[];
  tasks: Task[];
  topics: TopicItem[];
  focus_settings: FocusSettings;
  habits: Habit[];
  habit_log: HabitLogEntry[];
  track_priorities: Record<TrackId, Priority>;
  app_mode: AppMode;
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

export interface AppRow {
  app: string;
  seconds: number;
  category: string;
  titles: TitleTotal[];
}

export interface Stretch {
  app: string;
  title: string;
  seconds: number;
  start: number;
}

export interface TimelineSpan {
  app: string;
  title: string;
  start: number;
  seconds: number;
}

export interface DaySummary {
  day: string;
  total_seconds: number;
  by_app: AppRow[];
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
  /** the user's app→category overrides, which beat the built-in defaults */
  categories: Record<string, string>;
}

export interface TrackerStatus {
  running: boolean;
  paused: boolean;
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

/**
 * Every shape MIS stores. Nothing in here runs — it is the vocabulary the rest
 * of the app is written in, which is why it has no imports and can be pulled
 * into any module without dragging storage along.
 */

export interface UserConfig {
  id: string;
  name: string;
  target_study_hours: number;
  water_target: number;
  blocked_apps: string[];
  is_focus_active: boolean;
  free_time_unlocked: boolean;
  /** sleep window, merged in from the old Wellness tab (was unsaved local state) */
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
}

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
}

export interface TopicItem {
  id: string;
  date: string;
  name: string;
  type: 'taught' | 'revise' | 'solve';
  done: boolean;
}

/** which clock face the Focus Timer draws */
export type TimerDesign = 'ring' | 'flip';

export interface FocusSettings {
  focus_minutes: number;
  short_break: number;
  long_break: number;
  rounds_before_long: number;
  timer_design: TimerDesign;
}

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

export interface Habit {
  id: string;
  name: string;
  priority: Priority;
  /** set only on the two habits GrowTrack's streak matrix still reads */
  legacy_key?: 'reading_habit' | 'revision_habit';
}

/** one row per habit actually ticked — absence means "not done" */
export interface HabitLogEntry {
  id: string;
  date: string;
  habit_id: string;
}

/** the whole saved database, as it sits in localStorage */
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

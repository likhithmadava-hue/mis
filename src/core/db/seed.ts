import { isoDaysAgo } from '../dates';
import { uid } from './uid';
import type { DbShape, FocusSettings, Habit, Priority, TrackId } from './types';

/**
 * What a brand-new MIS looks like.
 *
 * There are two answers, and which one you get is decided at build time:
 *
 *   freshDb()  settings and starter habits, and nothing else. What a person
 *              opening the hosted copy for the first time should see — rows
 *              they did not enter are confusing, not helpful.
 *   demoDb()   the same, plus two weeks of plausible sample data so every
 *              chart has something to draw on the desktop build's first run.
 *
 * `npm run build:netlify` builds with VITE_FRESH_START=true (see .env.fresh)
 * and gets the empty one; every other build gets the demo data.
 *
 * The defaults are exported separately because migrations.ts backfills saved
 * databases with them — a field added here must be added there too.
 */

export const DEFAULT_TRACK_PRIORITIES: Record<TrackId, Priority> = {
  studies: 'high',
  dpps: 'high',
  habits: 'medium',
  mood: 'medium',
  well_spent: 'low',
  wellness: 'low',
};

export const DEFAULT_FOCUS_SETTINGS: FocusSettings = {
  focus_minutes: 25,
  short_break: 5,
  long_break: 15,
  rounds_before_long: 4,
  timer_design: 'ring',
};

export const seedHabits = (): Habit[] => [
  { id: uid(), name: 'Read 20 pages',   priority: 'medium', legacy_key: 'reading_habit' },
  { id: uid(), name: 'Revise yesterday', priority: 'high',  legacy_key: 'revision_habit' },
  { id: uid(), name: 'Morning workout',  priority: 'medium' },
  { id: uid(), name: 'No phone in bed',  priority: 'low' },
];

/**
 * A brand-new database with nothing logged in it. Starter habits stay — they
 * are defaults you can rename or delete, not history, and the Habits track has
 * nothing to score without them.
 */
export const freshDb = (): DbShape => ({
  user: {
    id: 'user-1',
    name: 'Student',
    target_study_hours: 6,
    water_target: 8,
    blocked_apps: ['Instagram', 'YouTube Shorts', 'TikTok', 'Netflix'],
    is_focus_active: true,
    free_time_unlocked: false,
    sleep_bedtime: '22:30',
    sleep_wake: '06:30',
  },
  daily_metrics: [],
  mark_logbook: [],
  focus_sessions: [],
  tasks: [],
  topics: [],
  focus_settings: { ...DEFAULT_FOCUS_SETTINGS },
  habits: seedHabits(),
  habit_log: [],
  track_priorities: { ...DEFAULT_TRACK_PRIORITIES },
  app_mode: 'academic',
});

/** the same, with two weeks of sample data on top */
export const demoDb = (): DbShape => ({
  ...freshDb(),
  daily_metrics: [
    { id: uid(), date: isoDaysAgo(6), study_hours: 5, dpps_got: 4, dpps_complete: 4, reading_habit: true,  revision_habit: true,  mood_score: 8, well_spent_time: 45, posture_count: 3, water_count: 7 },
    { id: uid(), date: isoDaysAgo(5), study_hours: 3, dpps_got: 4, dpps_complete: 2, reading_habit: true,  revision_habit: false, mood_score: 6, well_spent_time: 60, posture_count: 2, water_count: 5 },
    { id: uid(), date: isoDaysAgo(4), study_hours: 6, dpps_got: 5, dpps_complete: 5, reading_habit: true,  revision_habit: true,  mood_score: 9, well_spent_time: 30, posture_count: 4, water_count: 8 },
    { id: uid(), date: isoDaysAgo(3), study_hours: 0, dpps_got: 3, dpps_complete: 0, reading_habit: false, revision_habit: false, mood_score: 4, well_spent_time: 120, posture_count: 0, water_count: 3 },
    { id: uid(), date: isoDaysAgo(2), study_hours: 4, dpps_got: 4, dpps_complete: 3, reading_habit: true,  revision_habit: true,  mood_score: 7, well_spent_time: 50, posture_count: 2, water_count: 6 },
    { id: uid(), date: isoDaysAgo(1), study_hours: 7, dpps_got: 5, dpps_complete: 5, reading_habit: true,  revision_habit: true,  mood_score: 9, well_spent_time: 40, posture_count: 5, water_count: 8 },
    { id: uid(), date: isoDaysAgo(0), study_hours: 2, dpps_got: 4, dpps_complete: 1, reading_habit: true,  revision_habit: false, mood_score: 7, well_spent_time: 20, posture_count: 1, water_count: 3 },
  ],
  mark_logbook: [
    { id: uid(), date: isoDaysAgo(1), subject: 'Physics',   chapter: 'Rotational Motion', grade: 'B',  score: 68, max_score: 100, difficulty: 'Hard',   time_spent: 75, mistake_reason: 'Conceptual',     notes: 'Revisit torque direction conventions.' },
    { id: uid(), date: isoDaysAgo(3), subject: 'Maths',     chapter: 'Integration',       grade: 'A',  score: 88, max_score: 100, difficulty: 'Medium', time_spent: 60, mistake_reason: 'Sign',           notes: 'Dropped a minus sign in substitution.' },
    { id: uid(), date: isoDaysAgo(5), subject: 'Chemistry', chapter: 'Thermodynamics',    grade: 'A+', score: 95, max_score: 100, difficulty: 'Medium', time_spent: 55, mistake_reason: 'Time Pressure',  notes: 'Left last question — practice pacing.' },
    { id: uid(), date: isoDaysAgo(6), subject: 'Physics',   chapter: 'Kinematics',        grade: 'C',  score: 55, max_score: 100, difficulty: 'Hard',   time_spent: 80, mistake_reason: 'Conceptual',     notes: 'Confused relative velocity frames.' },
    { id: uid(), date: isoDaysAgo(8), subject: 'Maths',     chapter: 'Probability',       grade: 'B',  score: 72, max_score: 100, difficulty: 'Medium', time_spent: 50, mistake_reason: 'Reading',        notes: 'Misread "at least one" as "exactly one".' },
    { id: uid(), date: isoDaysAgo(9), subject: 'Chemistry', chapter: 'Mole Concept',      grade: 'B',  score: 70, max_score: 100, difficulty: 'Easy',   time_spent: 40, mistake_reason: 'Unit',           notes: 'Mixed g and mg partway through.' },
    { id: uid(), date: isoDaysAgo(11), subject: 'Physics',  chapter: 'Electrostatics',    grade: 'A',  score: 85, max_score: 100, difficulty: 'Hard',   time_spent: 70, mistake_reason: 'Formula Recall', notes: 'Wrote the field formula instead of the potential one.' },
    { id: uid(), date: isoDaysAgo(13), subject: 'Maths',    chapter: 'Matrices',          grade: 'C',  score: 58, max_score: 100, difficulty: 'Medium', time_spent: 65, mistake_reason: 'Calculation',    notes: 'Arithmetic slip in the determinant expansion.' },
  ],
  focus_sessions: [
    { id: uid(), date: isoDaysAgo(1), duration_minutes: 90, tag: 'Physics DPP',   completed: true },
    { id: uid(), date: isoDaysAgo(1), duration_minutes: 60, tag: 'Maths Revision', completed: true },
    { id: uid(), date: isoDaysAgo(0), duration_minutes: 45, tag: 'Chemistry Notes', completed: false },
  ],
  tasks: [
    { id: uid(), title: 'Finish Kinematics DPP sheet', subject: 'Physics',   due_date: isoDaysAgo(0), completed: false },
    { id: uid(), title: 'Revise periodic table trends', subject: 'Chemistry', due_date: isoDaysAgo(0), completed: true },
    { id: uid(), title: 'Solve 10 integration problems', subject: 'Maths',   due_date: isoDaysAgo(-1), completed: false },
  ],
  topics: [
    { id: uid(), date: isoDaysAgo(0), name: 'Rotational Motion — Torque', type: 'taught', done: false },
    { id: uid(), date: isoDaysAgo(0), name: 'Kinematics — Relative Velocity', type: 'revise', done: false },
    { id: uid(), date: isoDaysAgo(1), name: 'Integration by Parts', type: 'revise', done: true },
    { id: uid(), date: isoDaysAgo(0), name: 'Thermodynamics DPP Q11–Q20', type: 'solve', done: false },
  ],
});

/**
 * What storage.ts writes when there is nothing saved yet. The flag is inlined
 * by Vite at build time, so the demo rows are not even in the hosted bundle.
 */
export const seedDb = (): DbShape =>
  import.meta.env.VITE_FRESH_START === 'true' ? freshDb() : demoDb();

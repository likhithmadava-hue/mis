import { isoDaysAgo } from '../dates';
import {
  ArborDatabase,
  PRIORITY_WEIGHT,
  TRACK_IDS,
  type AppMode,
  type DailyMetric,
  type Habit,
  type HabitLogEntry,
  type Priority,
  type TrackId,
  type UserConfig,
} from '../db';
import { DAY_TARGET, POSTURE_TARGET, TRACK_META, WELL_SPENT_TARGET } from './meta';

/**
 * Day scoring lives here rather than in the Daily Log so the Growth Tracker
 * charts and the Log itself can never drift apart. The Log writes the numbers,
 * the Tracker draws them — both must agree on what a "7" means.
 */

export const clamp10 = (n: number) => Math.max(0, Math.min(10, n));

/** score every track 0–10 for one day */
export const scoreDay = (
  m: DailyMetric,
  habits: Habit[],
  doneIds: string[],
  user: UserConfig
): Record<TrackId, number> => {
  const habitTotal = habits.reduce((sum, h) => sum + PRIORITY_WEIGHT[h.priority], 0);
  const habitDone = habits
    .filter((h) => doneIds.includes(h.id))
    .reduce((sum, h) => sum + PRIORITY_WEIGHT[h.priority], 0);

  // hydration carries most of the wellness score; posture tops it up
  const water = user.water_target > 0 ? Math.min(1, m.water_count / user.water_target) : 0;
  const posture = Math.min(1, m.posture_count / POSTURE_TARGET);

  return {
    studies: user.target_study_hours > 0 ? clamp10((m.study_hours / user.target_study_hours) * 10) : 0,
    dpps: m.dpps_got > 0 ? clamp10((m.dpps_complete / m.dpps_got) * 10) : 0,
    habits: habitTotal > 0 ? clamp10((habitDone / habitTotal) * 10) : 0,
    mood: clamp10(m.mood_score),
    well_spent: clamp10((m.well_spent_time / WELL_SPENT_TARGET) * 10),
    wellness: clamp10((water * 0.6 + posture * 0.4) * 10),
  };
};

/** priority decides both the order of the cards and how much each one counts */
export const trackOrder = (priorities: Record<TrackId, Priority>): TrackId[] =>
  [...TRACK_IDS].sort((a, b) => PRIORITY_WEIGHT[priorities[b]] - PRIORITY_WEIGHT[priorities[a]]);

/** the tracks belonging to one mode, still ordered by priority */
export const tracksIn = (mode: AppMode, priorities: Record<TrackId, Priority>): TrackId[] =>
  trackOrder(priorities).filter((id) => TRACK_META[id].mode === mode);

/**
 * One mode's score, 0–10. A weighted average *within* the mode, so Academic
 * and Life stay directly comparable even though they hold a different number
 * of tracks.
 */
export const modeScore10 = (
  scores: Record<TrackId, number>,
  priorities: Record<TrackId, Priority>,
  mode: AppMode
): number => {
  const ids = TRACK_IDS.filter((id) => TRACK_META[id].mode === mode);
  const weight = ids.reduce((sum, id) => sum + PRIORITY_WEIGHT[priorities[id]], 0);
  if (weight === 0) return 0;
  return ids.reduce((sum, id) => sum + scores[id] * PRIORITY_WEIGHT[priorities[id]], 0) / weight;
};

/**
 * One mode's day score out of DAY_TARGET. There is deliberately no combined
 * number — a bad study day must not drag down the Life score, and vice versa.
 */
export const modeScore = (
  scores: Record<TrackId, number>,
  priorities: Record<TrackId, Priority>,
  mode: AppMode
): number => Math.round((modeScore10(scores, priorities, mode) / 10) * DAY_TARGET);

export interface ScoredDay {
  date: string;
  /** short weekday, e.g. "Mo" */
  label: string;
  /** short calendar date, e.g. "12 Jul" */
  dateLabel: string;
  metric: DailyMetric | null;
  scores: Record<TrackId, number> | null;
  /** each mode's own score out of DAY_TARGET; null on days with no log */
  byMode: Record<AppMode, number> | null;
}

/**
 * Score the last `days` days, oldest first. Missing days come back with null
 * scores so charts can render a gap rather than a fake zero.
 */
export const scoreRange = (days: number): ScoredDay[] => {
  const user = ArborDatabase.getUserConfig();
  const habits = ArborDatabase.getHabits();
  const priorities = ArborDatabase.getTrackPriorities();
  const metrics = ArborDatabase.getDailyMetrics();

  // bucket the habit log once instead of re-reading storage per day
  const doneByDate = new Map<string, string[]>();
  for (const entry of ArborDatabase.getHabitLog() as HabitLogEntry[]) {
    const list = doneByDate.get(entry.date);
    if (list) list.push(entry.habit_id);
    else doneByDate.set(entry.date, [entry.habit_id]);
  }

  return Array.from({ length: days }, (_, i) => {
    const date = isoDaysAgo(days - 1 - i);
    const metric = metrics.find((m) => m.date === date) ?? null;
    const scores = metric ? scoreDay(metric, habits, doneByDate.get(date) ?? [], user) : null;
    return {
      date,
      label: new Date(date).toLocaleDateString([], { weekday: 'short' }).slice(0, 2),
      dateLabel: new Date(date).toLocaleDateString([], { day: 'numeric', month: 'short' }),
      metric,
      scores,
      byMode: scores
        ? {
            academic: modeScore(scores, priorities, 'academic'),
            life: modeScore(scores, priorities, 'life'),
          }
        : null,
    };
  });
};

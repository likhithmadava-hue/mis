import { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import {
  ArborDatabase,
  type AppMode,
  type DailyMetric,
  type Habit,
  type MarkLogbookEntry,
  type Priority,
  type TopicItem,
  type TrackId,
  type UserConfig,
} from '../../core/db';
import { todayIso } from '../../core/dates';
import { modeScore, scoreDay, tracksIn } from '../../core/scoring';

/**
 * The Daily Log's state and every write it makes.
 *
 * The Log is the only place anything is entered, so this is where the app's
 * writes live. The pattern each action follows is deliberate: write to the
 * database, `reload()` so this tab is instantly correct, then `onLogChange()`
 * so the sibling tabs re-read too.
 */
export function useDailyLog(mode: AppMode, triggerUpdate: number, onLogChange: () => void) {
  const [user, setUser] = useState<UserConfig>(ArborDatabase.getUserConfig());
  const [today, setToday] = useState<DailyMetric>(ArborDatabase.getTodayMetric());
  const [habits, setHabits] = useState<Habit[]>(ArborDatabase.getHabits());
  const [doneIds, setDoneIds] = useState<string[]>(ArborDatabase.getHabitsDoneOn());
  const [priorities, setPriorities] = useState(ArborDatabase.getTrackPriorities());
  const [topics, setTopics] = useState<TopicItem[]>(ArborDatabase.getTopics());
  const [nudge, setNudge] = useState<string | null>(null);

  const reload = () => {
    setUser(ArborDatabase.getUserConfig());
    setToday(ArborDatabase.getTodayMetric());
    setHabits(ArborDatabase.getHabits());
    setDoneIds(ArborDatabase.getHabitsDoneOn());
    setPriorities(ArborDatabase.getTrackPriorities());
    setTopics(ArborDatabase.getTopics());
  };

  useEffect(reload, [triggerUpdate]);

  const flash = (msg: string) => {
    setNudge(msg);
    setTimeout(() => setNudge(null), 4000);
  };

  /** write to the DB, refresh locally, then let sibling tabs know */
  const patchToday = (patch: Partial<DailyMetric>) => {
    ArborDatabase.updateTodayMetric(patch);
    reload();
    onLogChange();
  };

  const addWater = () => {
    const next = today.water_count + 1;
    patchToday({ water_count: next });
    if (next === user.water_target) {
      confetti({ particleCount: 80, spread: 50, colors: ['#00ccf9', '#ffffff'] });
      flash('💧 Hydration target hit for the day.');
    } else {
      flash(`💧 ${next} / ${user.water_target} glasses logged.`);
    }
  };

  const addPosture = () => {
    patchToday({ posture_count: today.posture_count + 1 });
    flash('🧘 Posture check logged.');
  };

  const saveSleep = (patch: Partial<UserConfig>) => {
    ArborDatabase.saveUserConfig({ ...user, ...patch });
    reload();
  };

  const addHabit = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    ArborDatabase.addHabit(trimmed, 'medium');
    reload();
    onLogChange();
  };

  const toggleHabit = (id: string) => {
    ArborDatabase.toggleHabitToday(id);
    reload();
    onLogChange();
  };

  const setHabitPriority = (id: string, p: Priority) => {
    ArborDatabase.setHabitPriority(id, p);
    reload();
  };

  const deleteHabit = (id: string) => {
    ArborDatabase.deleteHabit(id);
    reload();
    onLogChange();
  };

  const setTrackPriority = (id: TrackId, p: Priority) => {
    ArborDatabase.setTrackPriority(id, p);
    reload();
  };

  const addTopic = (name: string, type: TopicItem['type']) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    ArborDatabase.addTopic(trimmed, type);
    reload();
    onLogChange();
  };

  const toggleTopic = (id: string) => {
    ArborDatabase.toggleTopicDone(id);
    reload();
    onLogChange();
  };

  const deleteTopic = (id: string) => {
    ArborDatabase.deleteTopic(id);
    reload();
    onLogChange();
  };

  /** a logged paper only feeds the charts, so this tab doesn't need to reload */
  const addPaper = (entry: Omit<MarkLogbookEntry, 'id' | 'date'>) => {
    ArborDatabase.addMarkLogbookEntry({ ...entry, date: todayIso() });
    flash('📌 Paper logged — see the Growth Tracker for the updated charts.');
    onLogChange();
  };

  const scores = scoreDay(today, habits, doneIds, user);

  return {
    user,
    today,
    habits,
    doneIds,
    priorities,
    topics,
    nudge,
    scores,
    /** only this mode's tracks are editable here; the other mode owns the rest */
    ordered: tracksIn(mode, priorities),
    dayScore: modeScore(scores, priorities, mode),
    patchToday,
    addWater,
    addPosture,
    saveSleep,
    addHabit,
    toggleHabit,
    setHabitPriority,
    deleteHabit,
    setTrackPriority,
    addTopic,
    toggleTopic,
    deleteTopic,
    addPaper,
  };
}

export type DailyLogState = ReturnType<typeof useDailyLog>;

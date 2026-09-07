import { isoDaysAgo, todayIso } from '../dates';
import { load, save } from './storage';
import { seedDb } from './seed';
import { uid } from './uid';
import type {
  DailyMetric,
  FocusSession,
  FocusSettings,
  Habit,
  HabitLogEntry,
  MarkLogbookEntry,
  Priority,
  Task,
  TopicItem,
  TrackId,
  UserConfig,
  AppMode,
} from './types';

/**
 * The data layer. Every read and write in MIS goes through these static
 * methods — no component talks to localStorage directly, so swapping this
 * implementation for the Python backend later means rewriting this one file.
 *
 * The pieces underneath it:
 *   types.ts       every stored shape
 *   seed.ts        what a fresh install contains
 *   migrations.ts  patching old saved data forward
 *   storage.ts     the localStorage read/write itself
 */

// re-exported so the rest of the app imports shapes and the database together,
// from `core/db`, without needing to know which file each one lives in
export * from './types';

// the Supabase side of the same data layer — attaching an account, the sync
// status the sidebar shows, and bringing offline data into an account
export {
  attachUser,
  countImportableGuestRows,
  detachUser,
  dismissGuestImport,
  flushSync,
  getSyncState,
  importGuestData,
  retrySync,
  subscribeSync,
  type SyncState,
  type SyncStatus,
} from './sync';

/**
 * bootStorage hydrates cached data or vault storage before mounting components.
 * Included for desktop shortcut / host environment compatibility.
 */
export async function bootStorage(): Promise<void> {
  return Promise.resolve();
}

export class ArborDatabase {
  static getUserConfig(): UserConfig {
    return load().user;
  }

  static saveUserConfig(user: UserConfig) {
    const db = load();
    db.user = user;
    save(db);
  }

  static getDailyMetrics(): DailyMetric[] {
    return load().daily_metrics;
  }

  static getTodayMetric(): DailyMetric {
    const db = load();
    const today = todayIso();
    let metric = db.daily_metrics.find((m) => m.date === today);
    if (!metric) {
      metric = {
        id: uid(), date: today, study_hours: 0, dpps_got: 4, dpps_complete: 0,
        reading_habit: false, revision_habit: false, mood_score: 5,
        well_spent_time: 0, posture_count: 0, water_count: 0,
      };
      db.daily_metrics.push(metric);
      save(db);
    }
    return metric;
  }

  static updateTodayMetric(patch: Partial<DailyMetric>) {
    const db = load();
    const today = todayIso();
    const idx = db.daily_metrics.findIndex((m) => m.date === today);
    if (idx === -1) return;
    db.daily_metrics[idx] = { ...db.daily_metrics[idx], ...patch };

    const { user } = db;
    const t = db.daily_metrics[idx];
    user.free_time_unlocked =
      t.study_hours >= user.target_study_hours &&
      t.dpps_got > 0 &&
      t.dpps_complete >= t.dpps_got;
    save(db);
  }

  static getMarkLogbook(): MarkLogbookEntry[] {
    return load().mark_logbook;
  }

  static addMarkLogbookEntry(entry: Omit<MarkLogbookEntry, 'id'>) {
    const db = load();
    db.mark_logbook.unshift({ ...entry, id: uid() });
    save(db);
  }

  static updateMarkLogbookEntry(id: string, patch: Partial<Omit<MarkLogbookEntry, 'id'>>) {
    const db = load();
    const idx = db.mark_logbook.findIndex((e) => e.id === id);
    if (idx === -1) return;
    db.mark_logbook[idx] = { ...db.mark_logbook[idx], ...patch };
    save(db);
  }

  static deleteMarkLogbookEntry(id: string) {
    const db = load();
    db.mark_logbook = db.mark_logbook.filter((e) => e.id !== id);
    save(db);
  }

  /**
   * Bulk insert from a spreadsheet import. One save() for the whole batch —
   * calling addMarkLogbookEntry in a loop would re-serialise the entire
   * database per row, which a 500-row sheet makes painfully obvious.
   * De-duplication happens before this, in the database module's sheetImport.
   */
  static addMarkLogbookEntries(entries: Omit<MarkLogbookEntry, 'id'>[]) {
    if (entries.length === 0) return;
    const db = load();
    db.mark_logbook.unshift(...entries.map((e) => ({ ...e, id: uid() })));
    save(db);
  }

  /** used by the Database tab's JSON import — replaces the whole logbook */
  static replaceMarkLogbook(entries: MarkLogbookEntry[]) {
    const db = load();
    db.mark_logbook = entries;
    save(db);
  }

  static getFocusSessions(): FocusSession[] {
    return load().focus_sessions;
  }

  static addFocusSession(session: Omit<FocusSession, 'id'>) {
    const db = load();
    db.focus_sessions.unshift({ ...session, id: uid() });
    save(db);
  }

  /** credits finished focus minutes toward today's study hours */
  static addStudyMinutes(minutes: number) {
    const today = this.getTodayMetric();
    const hours = Math.round((today.study_hours + minutes / 60) * 10) / 10;
    this.updateTodayMetric({ study_hours: hours });
  }

  static getFocusSettings(): FocusSettings {
    return load().focus_settings;
  }

  static saveFocusSettings(settings: FocusSettings) {
    const db = load();
    db.focus_settings = settings;
    save(db);
  }

  static getTasks(): Task[] {
    return load().tasks;
  }

  static getTopics(): TopicItem[] {
    return load().topics;
  }

  static addTopic(name: string, type: TopicItem['type']) {
    const db = load();
    db.topics.unshift({ id: uid(), date: todayIso(), name, type, done: false });
    save(db);
  }

  static toggleTopicDone(id: string) {
    const db = load();
    const topic = db.topics.find((t) => t.id === id);
    if (topic) {
      topic.done = !topic.done;
      save(db);
    }
  }

  static deleteTopic(id: string) {
    const db = load();
    db.topics = db.topics.filter((t) => t.id !== id);
    save(db);
  }

  static getHabits(): Habit[] {
    return load().habits;
  }

  static addHabit(name: string, priority: Priority) {
    const db = load();
    db.habits.push({ id: uid(), name, priority });
    save(db);
  }

  static setHabitPriority(id: string, priority: Priority) {
    const db = load();
    const habit = db.habits.find((h) => h.id === id);
    if (habit) {
      habit.priority = priority;
      save(db);
    }
  }

  static deleteHabit(id: string) {
    const db = load();
    db.habits = db.habits.filter((h) => h.id !== id);
    db.habit_log = db.habit_log.filter((l) => l.habit_id !== id);
    save(db);
  }

  /**
   * The whole habit log. Charts that score many days at once should use this
   * and bucket by date in memory — calling getHabitsDoneOn() per day reparses
   * all of localStorage on every iteration.
   */
  static getHabitLog(): HabitLogEntry[] {
    return load().habit_log;
  }

  /** habit ids ticked on the given date (defaults to today) */
  static getHabitsDoneOn(date = isoDaysAgo(0)): string[] {
    return load()
      .habit_log.filter((l) => l.date === date)
      .map((l) => l.habit_id);
  }

  static toggleHabitToday(id: string) {
    const db = load();
    const today = todayIso();
    const existing = db.habit_log.find((l) => l.date === today && l.habit_id === id);
    if (existing) {
      db.habit_log = db.habit_log.filter((l) => l !== existing);
    } else {
      db.habit_log.push({ id: uid(), date: today, habit_id: id });
    }

    // keep GrowTrack's streak matrix (reading_habit / revision_habit) in step
    const habit = db.habits.find((h) => h.id === id);
    if (habit?.legacy_key) {
      const metric = db.daily_metrics.find((m) => m.date === today);
      if (metric) metric[habit.legacy_key] = !existing;
    }
    save(db);
  }

  static getTrackPriorities(): Record<TrackId, Priority> {
    return load().track_priorities;
  }

  static setTrackPriority(id: TrackId, priority: Priority) {
    const db = load();
    db.track_priorities[id] = priority;
    save(db);
  }

  static getAppMode(): AppMode {
    return load().app_mode;
  }

  static setAppMode(mode: AppMode) {
    const db = load();
    db.app_mode = mode;
    save(db);
  }

  static resetToDefault() {
    save(seedDb());
  }
}

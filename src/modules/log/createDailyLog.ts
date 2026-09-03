import confetti from 'canvas-confetti';
import { createMemo, createResource, createSignal, onCleanup } from 'solid-js';

import { todayIso } from '../../core/dates';
import {
  act,
  api,
  db,
  errorMessage,
  isDayLocked,
  revision,
  type AppMode,
  type DailyMetric,
  type MetricPatch,
  type Priority,
  type TopicType,
  type TrackId,
  type TrackScores,
  type UserConfig,
} from '../../core/db';
import { tracksIn } from '../../core/scoring';

/**
 * The Daily Log's state and every write it makes.
 *
 * The Log is the only place anything is entered, so this is where the app's
 * writes live — and the shape of them changed completely in the port.
 *
 * The old version guarded every action with `blockedByLock()`, a copy of the
 * lock rule living in the browser. It was a *second* implementation of the rule,
 * and the one that could be stepped around with devtools open. The rule now
 * lives in Rust, so what is left here is the explanation: every action goes
 * through [`run`], which reports the refusal it gets back. The UI no longer
 * decides whether a write is allowed; it says what happened when it wasn't.
 *
 * There is also no `reload()` and no `onLogChange()`. `act` refreshes the store
 * from the vault, and every tab reads the same store, so a habit ticked here is
 * already in the Growth Tracker's numbers before the click finishes.
 */
export function createDailyLog(mode: () => AppMode) {
  const [nudge, setNudge] = createSignal<string | null>(null);

  let nudgeTimer: number | undefined;
  const flash = (msg: string) => {
    setNudge(msg);
    clearTimeout(nudgeTimer);
    nudgeTimer = setTimeout(() => setNudge(null), 4000);
  };
  onCleanup(() => clearTimeout(nudgeTimer));

  /**
   * Today's row, or a blank one if nothing has been logged yet.
   *
   * The blank is not stored anywhere — reading the Log does not create a day.
   * See `today_metric` in `db/mod.rs` for why that matters to the charts.
   */
  const today = createMemo<DailyMetric>(() => {
    const date = todayIso();
    return (
      db.daily_metrics.find((m) => m.date === date) ?? {
        id: 'unsaved',
        date,
        study_hours: 0,
        dpps_got: 4,
        dpps_complete: 0,
        reading_habit: false,
        revision_habit: false,
        mood_score: 5,
        well_spent_time: 0,
        posture_count: 0,
        water_count: 0,
      }
    );
  });

  const locked = () => today().locked === true;
  const doneIds = createMemo(() =>
    db.habit_log.filter((h) => h.date === todayIso()).map((h) => h.habit_id),
  );
  const todayTopics = createMemo(() => db.topics.filter((t) => t.date === todayIso()));
  const tasks = createMemo(() => db.tasks.filter((t) => t.mode === mode()));

  // Today's scores, computed in Rust from the same data the day is fingerprinted
  // with. Asking for a one-day range is how the Log gets exactly the numbers the
  // Growth Tracker would show for today — there is no second scoring engine here
  // to disagree with it.
  const [scored] = createResource(
    () => ({ rev: revision() }),
    async () => (await api.scoreRange(1))[0],
  );

  const ZERO: TrackScores = {
    studies: 0,
    dpps: 0,
    well_spent: 0,
    mood: 0,
    habits: 0,
    wellness: 0,
  };
  const scores = () => scored()?.scores ?? ZERO;
  const dayScore = () => scored()?.by_mode?.[mode()] ?? 0;

  /**
   * Whether a locked day still matches the fingerprint taken when it was
   * submitted. Only ever false if the vault was edited outside MIS — the app
   * itself cannot write to a locked day.
   */
  const [intact] = createResource(
    () => (locked() ? { date: today().date, rev: revision() } : null),
    ({ date }) => api.dayIsIntact(date),
    { initialValue: true },
  );
  const edited = () => locked() && intact() === false;

  /**
   * Run a command, refresh, and say what happened.
   *
   * A locked-day refusal is an expected answer, not a fault, so it gets the
   * explanation rather than an error. Anything else really did go wrong and is
   * reported as itself — silently swallowing a failed write would leave the
   * screen showing a change the vault never took.
   */
  const run = async (command: Promise<unknown>, ok?: string) => {
    try {
      await act(command);
      if (ok) flash(ok);
    } catch (e) {
      flash(
        isDayLocked(e)
          ? '🔒 Today’s log is submitted and locked. Unlock it to make changes.'
          : `⚠ ${errorMessage(e)}`,
      );
    }
  };

  const patchToday = (patch: MetricPatch) => run(api.updateToday(patch));

  const addWater = async () => {
    const next = today().water_count + 1;
    await run(api.updateToday({ water_count: next }));
    if (locked()) return;
    if (next === db.user.water_target) {
      confetti({ particleCount: 80, spread: 50, colors: ['#00ccf9', '#ffffff'] });
      flash('💧 Hydration target hit for the day.');
    } else {
      flash(`💧 ${next} / ${db.user.water_target} glasses logged.`);
    }
  };

  const addPosture = () =>
    run(api.updateToday({ posture_count: today().posture_count + 1 }), '🧘 Posture check logged.');

  const saveSleep = (patch: Partial<UserConfig>) => run(api.saveUser({ ...db.user, ...patch }));

  const addHabit = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    return run(api.addHabit(trimmed, 'medium'));
  };

  const toggleHabit = (id: string) => run(api.toggleHabitToday(id));
  const setHabitPriority = (id: string, p: Priority) => run(api.setHabitPriority(id, p));
  const deleteHabit = (id: string) => run(api.deleteHabit(id));
  const setTrackPriority = (id: TrackId, p: Priority) => run(api.setTrackPriority(id, p));

  const addTopic = (name: string, kind: TopicType) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    return run(api.addTopic(trimmed, kind));
  };

  const toggleTopic = (id: string) => run(api.toggleTopic(id));
  const deleteTopic = (id: string) => run(api.deleteTopic(id));

  const addTask = (title: string, subject: string, dueDate: string) => {
    const trimmed = title.trim();
    if (!trimmed) return;
    return run(api.addTask(trimmed, subject.trim(), dueDate, mode()));
  };

  const toggleTask = (id: string) => run(api.toggleTask(id));
  const deleteTask = (id: string) => run(api.deleteTask(id));

  /**
   * Finalise today: lock it and stamp the submitted data's fingerprint.
   *
   * The hash is taken in Rust, from the rows being locked, in the same call —
   * the old split (hash in the browser, then pass it to `lockToday`) allowed a
   * day to be locked with the fingerprint of something else entirely.
   */
  const submitLog = async () => {
    if (locked()) return;
    try {
      await act(api.lockToday());
      confetti({ particleCount: 90, spread: 60, colors: ['#00ccf9', '#ffffff'] });
      flash('🔒 Day submitted and locked.');
    } catch (e) {
      flash(`⚠ ${errorMessage(e)}`);
    }
  };

  /** Reopen today for editing — recorded in the audit log by Rust. */
  const unlockLog = async () => {
    if (!locked()) return;
    await run(api.unlockToday(), '🔓 Log reopened. This unlock was recorded in the audit log.');
  };

  /** A logged paper feeds the charts, not this tab — hence no nudge about today. */
  const addPaper = (entry: Omit<Parameters<typeof api.addMarkEntry>[0], 'date'>) =>
    run(
      api.addMarkEntry({ ...entry, date: todayIso() }),
      '📌 Paper logged — see the Growth Tracker for the updated charts.',
    );

  return {
    user: () => db.user,
    today,
    habits: () => db.habits,
    doneIds,
    priorities: () => db.track_priorities,
    topics: () => db.topics,
    todayTopics,
    nudge,
    scores,
    locked,
    edited,
    submittedAt: () => today().submitted_at,
    /** only this mode's tracks are editable here; the other mode owns the rest */
    ordered: createMemo(() => tracksIn(mode(), db.track_priorities)),
    dayScore,
    submitLog,
    unlockLog,
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
    tasks,
    addTask,
    toggleTask,
    deleteTask,
    addPaper,
  };
}

export type DailyLogState = ReturnType<typeof createDailyLog>;

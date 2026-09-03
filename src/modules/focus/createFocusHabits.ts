import { createMemo, createSignal, onCleanup } from 'solid-js';

import { todayIso } from '../../core/dates';
import { act, api, db, errorMessage, isDayLocked } from '../../core/db';

/**
 * The habit list, editable from the Focus tab.
 *
 * The Daily Log still owns the *day* — hours, DPPs, submitting — but a habit is
 * the one thing you tend to remember mid-session, with the clock running, and
 * leaving the timer to tick it is how it gets forgotten. So the habits row in
 * "Left Today" is live rather than a read-only tally: it follows whatever the
 * list actually is, and can be ticked, added to and pruned without leaving the
 * timer.
 *
 * There is no local copy of the list here. `db.habits` and `db.habit_log` *are*
 * the state; every write goes through `act`, which refreshes the store, so a
 * habit added in the Daily Log shows up here — and one ticked here shows up
 * there — with no wiring between the two tabs.
 */
export function createFocusHabits() {
  const [nudge, setNudge] = createSignal<string | null>(null);

  let nudgeTimer: number | undefined;
  const flash = (msg: string) => {
    setNudge(msg);
    clearTimeout(nudgeTimer);
    nudgeTimer = setTimeout(() => setNudge(null), 4000);
  };
  onCleanup(() => clearTimeout(nudgeTimer));

  /**
   * Run a write, refresh, and say what happened.
   *
   * Mirrors the Daily Log's `run` for the same reason: a locked day refusing a
   * tick is an expected answer that has to reach the screen, or the checkbox
   * looks broken. Ticking is refused on a locked day; adding and removing
   * habits are not — the list is the standing set of habits, not part of the
   * day that was submitted.
   */
  const run = async (command: Promise<unknown>) => {
    try {
      await act(command);
    } catch (e) {
      flash(
        isDayLocked(e)
          ? '🔒 Today’s log is submitted and locked. Unlock it in the Daily Log.'
          : `⚠ ${errorMessage(e)}`,
      );
    }
  };

  const habits = () => db.habits;
  const doneIds = createMemo(
    () => new Set(db.habit_log.filter((h) => h.date === todayIso()).map((h) => h.habit_id)),
  );

  const addHabit = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    // Same default priority the Daily Log adds with; re-weight it there.
    return run(api.addHabit(trimmed, 'medium'));
  };

  return {
    habits,
    isDone: (id: string) => doneIds().has(id),
    doneCount: () => doneIds().size,
    addHabit,
    toggleHabit: (id: string) => run(api.toggleHabitToday(id)),
    deleteHabit: (id: string) => run(api.deleteHabit(id)),
    /** the last refusal or error, shown under the list for a few seconds */
    nudge,
  };
}

export type FocusHabitsState = ReturnType<typeof createFocusHabits>;

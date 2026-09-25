import { createMemo } from 'solid-js';

import { todayIso } from '../../core/dates';
import { act, api, db, errorMessage, isDayLocked } from '../../core/db';
import { messageDialog } from '../../core/ui';

/**
 * What is still open, for the timer's Tasks & Topics view.
 *
 * Like the Daily Log's checklist this is a view, not a list of everything you
 * own: an item shows while it is open and stays, struck through, for the rest of
 * the day it was finished on — so ticking one does not make it vanish from
 * under the cursor. Tomorrow it is gone from here and still in the database.
 *
 * The three lists read the same rows the Daily Log ticks, and the toggles are
 * the same commands, so a task ticked here is ticked there with no wiring
 * between the two tabs.
 */
export function createTasksTopics() {
  /** open work first — overdue, then soonest due, undated last — then what is done */
  const byUrgency = (a: { completed: boolean; due_date: string }, b: typeof a) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    return (a.due_date || '9999-99-99').localeCompare(b.due_date || '9999-99-99');
  };

  // The Focus tab only exists in Academic mode, so it is the academic to-do list.
  const tasks = createMemo(() => {
    const day = todayIso();
    return db.tasks
      .filter((t) => t.mode === 'academic' && (!t.completed || t.completed_on === day))
      .sort(byUrgency);
  });

  const dpps = createMemo(() => {
    const day = todayIso();
    return db.dpps.filter((d) => d.date === day && (!d.done || d.done_on === day));
  });

  /**
   * A day from before DPPs carried details has only a count. That is still real
   * work left, so it is reported — as a number, since there is nothing to tick.
   */
  const dppCount = createMemo(() => {
    if (dpps().length > 0) return null;
    const m = db.daily_metrics.find((x) => x.date === todayIso());
    const total = Math.max(0, Math.round(m?.dpps_got ?? 0));
    if (total === 0) return null;
    return { done: Math.min(total, Math.max(0, Math.round(m?.dpps_complete ?? 0))), total };
  });

  const revise = createMemo(() => {
    const day = todayIso();
    return db.topics.filter((t) => t.type === 'revise' && (!t.done || t.done_on === day));
  });

  /** items still open across the three lists — the badge on the sidebar tab */
  const pending = createMemo(
    () =>
      tasks().filter((t) => !t.completed).length +
      dpps().filter((d) => !d.done).length +
      (dppCount() ? dppCount()!.total - dppCount()!.done : 0) +
      revise().filter((t) => !t.done).length,
  );

  /**
   * A locked-day refusal is an expected answer and gets the explanation; anything
   * else really did fail and is reported as itself. Either way the box is left
   * unticked, because `act` only reloads after a write that succeeded.
   */
  const run = async (command: Promise<unknown>) => {
    try {
      await act(command);
    } catch (e) {
      await messageDialog({
        title: isDayLocked(e) ? 'Today is locked' : 'That did not save',
        body: isDayLocked(e)
          ? 'Today’s log is submitted and locked. Unlock it in the Daily Log to make changes.'
          : errorMessage(e),
        tone: 'warning',
      });
    }
  };

  return {
    tasks,
    dpps,
    dppCount,
    revise,
    pending,
    toggleTask: (id: string) => run(api.toggleTask(id)),
    toggleDpp: (id: string) => run(api.toggleDpp(id)),
    toggleTopic: (id: string) => run(api.toggleTopic(id)),
  };
}

export type TasksTopicsState = ReturnType<typeof createTasksTopics>;

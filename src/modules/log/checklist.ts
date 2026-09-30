import { createMemo } from 'solid-js';

import { todayIso } from '../../core/dates';
import type { AppMode, Task, TopicItem, TopicType } from '../../core/db';
import type { DailyLogState } from './createDailyLog';

export interface Tally {
  done: number;
  total: number;
}

/** open work first — overdue, then soonest due, undated last — then what is done */
const byUrgency = (a: Task, b: Task) => {
  if (a.completed !== b.completed) return a.completed ? 1 : -1;
  return (a.due_date || '9999-99-99').localeCompare(b.due_date || '9999-99-99');
};

/**
 * What the master checklist shows, and how far through it the day is.
 *
 * "Today's checklist" is a *view*, not a list of everything you own. A task or
 * topic appears while it is still open, and stays for the rest of the day it
 * was finished on — which is what `completed_on` / `done_on` are for. Tomorrow
 * it is gone from here (it is still in the Topics card and the database), so
 * the list reads as "what is left and what I did today" instead of growing into
 * a pile of everything ever ticked.
 *
 * Nothing here is scored. Scores come from Rust off the same stored data; these
 * are counts for the eye. The one place they touch scoring is by agreeing with
 * it: DPPs and habits count exactly the numbers the score divides.
 */
export function createChecklist(log: DailyLogState, mode: () => AppMode) {
  const studies = createMemo<Tally>(() => {
    const target = log.user().target_study_hours;
    return { done: target > 0 && log.today().study_hours >= target ? 1 : 0, total: 1 };
  });

  const dpps = createMemo<Tally>(() => {
    const total = Math.max(0, Math.round(log.today().dpps_got));
    return { done: Math.min(Math.max(0, Math.round(log.today().dpps_complete)), total), total };
  });

  const habits = createMemo<Tally>(() => ({
    done: log.doneIds().length,
    total: log.habits().length,
  }));

  const topicsOf = (kind: TopicType) =>
    createMemo<TopicItem[]>(() =>
      log.topics().filter((t) => t.type === kind && (!t.done || t.done_on === todayIso())),
    );
  const revise = topicsOf('revise');
  const solve = topicsOf('solve');

  const tasks = createMemo<Task[]>(() => {
    const day = todayIso();
    return log
      .tasks()
      .filter((t) => !t.completed || t.completed_on === day || t.due_date === day)
      .sort(byUrgency);
  });

  const count = (items: { done?: boolean; completed?: boolean }[]): Tally => ({
    done: items.filter((i) => i.done ?? i.completed).length,
    total: items.length,
  });
  const reviseTally = createMemo(() => count(revise()));
  const solveTally = createMemo(() => count(solve()));
  const tasksTally = createMemo(() => count(tasks()));

  /** every section this mode shows, added up — the number in the header */
  const progress = createMemo<Tally>(() => {
    const parts =
      mode() === 'academic'
        ? [studies(), dpps(), reviseTally(), solveTally(), tasksTally()]
        : [habits(), tasksTally()];
    return parts.reduce((sum, p) => ({ done: sum.done + p.done, total: sum.total + p.total }), {
      done: 0,
      total: 0,
    });
  });

  return {
    studies,
    dpps,
    habits,
    revise,
    solve,
    tasks,
    reviseTally,
    solveTally,
    tasksTally,
    progress,
  };
}

export type Checklist = ReturnType<typeof createChecklist>;

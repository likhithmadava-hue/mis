import { BookOpen, ListChecks, ListTodo, Repeat, Timer } from 'lucide-solid';
import { createMemo } from 'solid-js';

import { todayIso } from '../../core/dates';
import { db } from '../../core/db';
import type { Icon } from '../../core/ui';
import type { TimerMode } from './constants';

export interface RemainingItem {
  key: string;
  label: string;
  icon: Icon;
  /** counts down to 0 */
  left: number;
  /** what `left` started from — together they give the bar */
  total: number;
  unit: string;
  /** the progress line under the bar */
  done: string;
  /**
   * How much of `total` the round currently on the clock will add once it is
   * banked, in the same unit as `left`. Drawn as a ghost ahead of the solid bar
   * so a round in progress is visible without being counted as finished.
   *
   * A function, not a number, on purpose: it changes four times a second while
   * the clock runs, and the panel reads it inside the row's JSX so only that one
   * bar updates. If it were a plain field, `remaining` would have to recompute —
   * and every row would be rebuilt — on every tick.
   */
  live?: () => number;
  /** one line of timer state, on the rows the timer actually drives */
  note?: () => string;
}

/**
 * The slice of the running timer the panel reacts to.
 *
 * Deliberately narrow: the panel needs to know what phase the clock is in and
 * how far through it is, and nothing else. Taking accessors rather than a
 * `FocusTimerState` keeps this module independent of the timer engine.
 */
export interface FocusContext {
  mode: () => TimerMode;
  isRunning: () => boolean;
  /** 0 → 1 through the current phase */
  phaseProgress: () => number;
  /** the round number on the clock — during a break, the one coming next */
  round: () => number;
  /** the "are you done?" dialog is open: the round is over but not yet banked */
  awaitingConfirm: () => boolean;
}

/**
 * What's still outstanding today, for the timer's "Left Today" panel.
 *
 * Numbers only — this module never writes. The Daily Log owns entering all of
 * it, with one exception: the habits row opens into a live list you can tick
 * and edit here (see `createFocusHabits`), because a habit is what you remember
 * mid-session and leaving the clock to record it is how it gets forgotten.
 * Either way both tabs read the same store, so a change on one side is already
 * in the other's numbers with no wiring between them at all.
 *
 * The focus rounds row is the one place the timer and this panel meet. Its goal
 * is *derived* from the study-hours target rather than configured separately —
 * a round is worth `focus_minutes`, so the day's target is worth that many
 * rounds — because a confirmed session credits those minutes to study hours.
 * Two independently-set goals over one pot of minutes could disagree; a derived
 * one cannot. It also means an hour studied away from the timer and logged in
 * the Daily Log reduces the rounds you still owe, which is the honest answer:
 * the work is what's owed, not the ceremony of timing it.
 */
export function createTodayProgress(focus: FocusContext) {
  /**
   * The fraction of one round sitting on the clock unbanked.
   *
   * Only ever counts a *focus* phase — a break earns nothing, so it moves no
   * bar. A finished round awaiting confirmation counts as a whole one, since
   * confirming is all that stands between it and the vault.
   */
  const inFlight = () => {
    if (focus.mode() !== 'focus') return 0;
    if (focus.awaitingConfirm()) return 1;
    return focus.isRunning() ? focus.phaseProgress() : 0;
  };

  const noteText = () => {
    const r = focus.round();
    switch (focus.mode()) {
      case 'short':
        return `Short break — round ${r} is next`;
      case 'long':
        return `Long break — round ${r} is next`;
      default:
        if (focus.awaitingConfirm()) return `Round ${r} finished — confirm it to bank it`;
        return focus.isRunning() ? `Round ${r} on the clock` : `Round ${r} ready to start`;
    }
  };

  const remaining = createMemo<RemainingItem[]>(() => {
    const date = todayIso();
    const today = db.daily_metrics.find((m) => m.date === date);
    const user = db.user;

    const studyHours = today?.study_hours ?? 0;
    const dppsGot = today?.dpps_got ?? 0;
    const dppsDone = today?.dpps_complete ?? 0;

    const toRevise = db.topics.filter((t) => t.type === 'revise');
    const habitsDone = db.habit_log.filter((h) => h.date === date).map((h) => h.habit_id);

    // A round is never zero minutes long, however mangled the settings are —
    // dividing the day's target by it has to be safe.
    const roundMinutes = Math.max(1, db.focus_settings.focus_minutes);
    const targetMinutes = Math.max(0, user.target_study_hours * 60);
    const minutesOutstanding = Math.max(0, targetMinutes - studyHours * 60);

    const sessions = db.focus_sessions.filter((s) => s.date === date && s.completed);
    const bankedMinutes = sessions.reduce((sum, s) => sum + s.duration_minutes, 0);

    return [
      {
        key: 'study',
        label: 'Hours of study',
        icon: BookOpen,
        // one decimal, because a focus round adds a fraction of an hour
        left: Math.max(0, Math.round((user.target_study_hours - studyHours) * 10) / 10),
        total: user.target_study_hours,
        unit: 'h',
        done: `${studyHours}h of ${user.target_study_hours}h done`,
        live: () => Math.round(((inFlight() * roundMinutes) / 60) * 100) / 100,
        note: noteText,
      },
      {
        key: 'rounds',
        label: 'Focus rounds',
        icon: Timer,
        // Ceiling both ways: a target the round length does not divide evenly
        // still needs the round that covers the remainder.
        left: Math.ceil(minutesOutstanding / roundMinutes),
        total: Math.ceil(targetMinutes / roundMinutes),
        unit: '',
        done: sessions.length
          ? `${sessions.length} banked today · ${Math.round(bankedMinutes)} min`
          : 'nothing banked yet today',
        live: inFlight,
        note: noteText,
      },
      {
        key: 'dpps',
        label: 'DPPs',
        icon: ListChecks,
        left: Math.max(0, dppsGot - dppsDone),
        total: dppsGot,
        unit: '',
        done: `${dppsDone} of ${dppsGot} finished`,
      },
      {
        key: 'revise',
        label: 'Topics to revise',
        icon: ListTodo,
        left: toRevise.filter((t) => !t.done).length,
        total: toRevise.length,
        unit: '',
        done: `${toRevise.filter((t) => t.done).length} revised`,
      },
      {
        key: 'habits',
        label: 'Habits',
        icon: Repeat,
        left: db.habits.filter((h) => !habitsDone.includes(h.id)).length,
        total: db.habits.length,
        unit: '',
        done: `${habitsDone.length} of ${db.habits.length} ticked`,
      },
    ];
  });

  return {
    remaining,
    /**
     * Every line cleared. Note that a row with nothing assigned counts as
     * cleared — you cannot owe zero DPPs — but the panel still draws it as a
     * dash rather than a tick, because nothing set and nothing left are
     * different things to be told.
     *
     * Reads `left` only, never `live`: a round half-run is not a round done,
     * and the day is not clear until it has been confirmed and written.
     */
    allClear: () => remaining().every((r) => r.left === 0),
  };
}

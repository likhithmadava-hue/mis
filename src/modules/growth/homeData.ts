import { createMemo, createResource, createSignal, onCleanup } from 'solid-js';

import { todayIso } from '../../core/dates';
import {
  api,
  db,
  errorMessage,
  marksLost,
  revision,
  type AppMode,
  type TrackId,
} from '../../core/db';
import { POSTURE_TARGET, TRACK_META, WELL_SPENT_TARGET } from '../../core/scoring';
import type { Icon } from '../../core/ui';
import { createGrowthData } from './growthData';

/**
 * Everything the home board draws, worked out in one place.
 *
 * The home page is a deck of small widgets, each answering one question, and
 * every one of them is a *different* question — today's score, the streak, what
 * the papers say, where the screen time went. This file is where each of those
 * answers is computed; the component is layout and nothing else.
 *
 * It sits on top of [`createGrowthData`] rather than beside it. That file already
 * shapes the scored range, the streak and the paper analytics for the Report
 * tab, and the board needs the same numbers — recomputing them here would give
 * the two tabs two chances to disagree about what today was worth. What is added
 * below is only what the Report has no use for: the raw fact behind each track's
 * score, the counts the widgets read, and today's screen time.
 *
 * Everything is a memo or a resource, so a widget only recomputes when the thing
 * it shows actually moved.
 */

/** how often today's screen time is re-read while the board is open */
const SCREEN_REFRESH_MS = 60_000;

/** `3h 42m`, `42m`, `18s` — the same shape the Screen Time tab prints */
export const humanDuration = (seconds: number): string => {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
};

/** `23:00` → minutes past midnight; a malformed time reads as midnight */
const minutesOf = (time: string) => {
  const [h, m] = (time ?? '').split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

/**
 * One of the mode's tracks, as a widget.
 *
 * `score` is what Rust scored the track out of ten and `detail` is what it was
 * scored *from*, in the day's own units — "3.5h of 5h", "2 of 5 finished". The
 * pair is the point: a number out of ten is only meaningful next to the thing it
 * measured, and the old home page showed the score alone.
 */
export interface TrackTile {
  id: TrackId;
  label: string;
  hint: string;
  icon: Icon;
  /** 0–10, or **null on a day with no log at all** — never a zero */
  score: number | null;
  /** the raw fact behind the score */
  detail: string;
  /** 0–100, for the meter under the number */
  pct: number;
}

/**
 * Today's screen time, or the reason there isn't any.
 *
 * **An empty chart and "you used nothing today" look identical and only one is
 * ever true**, so the widget is never handed a bare zero — it is handed a state
 * that says which of the four situations it is in.
 */
export type ScreenState =
  | { state: 'loading' }
  | { state: 'off'; reason: string }
  | { state: 'error'; message: string }
  | {
      state: 'ok';
      total: number;
      distraction: number;
      study: number;
      /** distraction as a percentage of the day, 0–100 */
      sharePct: number;
      topApp: string | null;
    };

export function createHomeData(mode: () => AppMode) {
  const growth = createGrowthData(mode, () => 7);

  const metric = () => growth.today()?.metric ?? null;
  const scores = () => growth.today()?.scores ?? null;

  /** how many habits are ticked today, straight off the store the Log writes to */
  const habitsDone = createMemo(() => {
    const date = todayIso();
    return db.habit_log.filter((h) => h.date === date).length;
  });

  // ── the mode's tracks, each with the fact behind its score ─────────────────

  const trackDetail = (id: TrackId): { detail: string; pct: number } => {
    const m = metric();
    const user = db.user;

    switch (id) {
      case 'studies': {
        const hours = m?.study_hours ?? 0;
        const target = user.target_study_hours;
        return {
          detail: `${hours}h of ${target}h`,
          pct: target > 0 ? (hours / target) * 100 : 0,
        };
      }
      case 'dpps': {
        const assigned = m?.dpps_got ?? 0;
        const finished = m?.dpps_complete ?? 0;
        // Nothing assigned is not the same as nothing done, and a full bar for
        // an empty day would say the opposite of what happened.
        return {
          detail: assigned > 0 ? `${finished} of ${assigned} finished` : 'none assigned yet',
          pct: assigned > 0 ? (finished / assigned) * 100 : 0,
        };
      }
      case 'habits': {
        const total = db.habits.length;
        return {
          detail: total > 0 ? `${habitsDone()} of ${total} ticked` : 'no habits set up yet',
          pct: total > 0 ? (habitsDone() / total) * 100 : 0,
        };
      }
      case 'mood': {
        const v = m?.mood_score ?? 0;
        return { detail: m ? `${v} out of 10` : 'not rated yet', pct: v * 10 };
      }
      case 'well_spent': {
        const mins = m?.well_spent_time ?? 0;
        return {
          detail: `${mins} min of ${WELL_SPENT_TARGET}`,
          pct: (mins / WELL_SPENT_TARGET) * 100,
        };
      }
      case 'wellness': {
        const water = m?.water_count ?? 0;
        const posture = m?.posture_count ?? 0;
        const waterPct = user.water_target > 0 ? Math.min(1, water / user.water_target) : 0;
        const posturePct = Math.min(1, posture / POSTURE_TARGET);
        return {
          detail: `${water}/${user.water_target} cups · ${posture}/${POSTURE_TARGET} checks`,
          pct: ((waterPct + posturePct) / 2) * 100,
        };
      }
    }
  };

  const tracks = createMemo<TrackTile[]>(() =>
    growth.modeTracks().map((id) => ({
      id,
      label: TRACK_META[id].label,
      hint: TRACK_META[id].hint,
      icon: TRACK_META[id].icon,
      score: scores()?.[id] ?? null,
      ...trackDetail(id),
    })),
  );

  // ── Academic extras ───────────────────────────────────────────────────────

  /** focus rounds banked today — an unconfirmed round is not one */
  const focusToday = createMemo(() => {
    const date = todayIso();
    const done = db.focus_sessions.filter((s) => s.date === date && s.completed);
    return {
      rounds: done.length,
      minutes: Math.round(done.reduce((sum, s) => sum + s.duration_minutes, 0)),
    };
  });

  const topics = createMemo(() => ({
    left: db.topics.filter((t) => !t.done).length,
    total: db.topics.length,
  }));

  /**
   * How much of the damage is avoidable.
   *
   * Marks dropped on papers tagged `Careless`, as a share of every mark dropped.
   * It is a share of *marks* rather than of papers on purpose: one careless slip
   * on a 5-mark question and one on a 40-mark question are not the same mistake,
   * and counting papers would call them equal.
   */
  const careless = createMemo(() => {
    const log = db.mark_logbook;
    const lost = log.reduce((sum, e) => sum + marksLost(e), 0);
    const slips = log
      .filter((e) => e.mistake_reason === 'Careless')
      .reduce((sum, e) => sum + marksLost(e), 0);
    return { marks: slips, pct: lost > 0 ? Math.round((slips / lost) * 100) : 0, anyLoss: lost > 0 };
  });

  // ── Life extras ───────────────────────────────────────────────────────────

  /** leisure across the days that were actually logged, not across seven */
  const leisureWeek = createMemo(() => {
    const logged = growth.days().filter((d) => d.metric);
    const total = logged.reduce((sum, d) => sum + (d.metric?.well_spent_time ?? 0), 0);
    return {
      total,
      days: logged.length,
      avg: logged.length ? Math.round(total / logged.length) : 0,
    };
  });

  const sleep = createMemo(() => {
    const bedtime = db.user.sleep_bedtime;
    const wake = db.user.sleep_wake;
    let span = minutesOf(wake) - minutesOf(bedtime);
    if (span <= 0) span += 24 * 60; // the window crosses midnight, which is the normal case
    return { bedtime, wake, hours: Math.round(span / 6) / 10 };
  });

  /**
   * The three week-long series the tiles draw as sparklines.
   *
   * **A day with no log is `null`, not `0`.** The sparkline breaks at a null, so
   * a week you skipped reads as a gap rather than as a week of zeroes — the same
   * rule the full charts on the Report follow, for the same reason.
   */
  const sparks = createMemo(() => {
    const rows = growth.days();
    return {
      score: rows.map((d) => d.by_mode?.[mode()] ?? null),
      study: rows.map((d) => (d.metric ? d.metric.study_hours : null)),
      leisure: rows.map((d) => (d.metric ? d.metric.well_spent_time : null)),
    };
  });

  // ── Today's screen time ───────────────────────────────────────────────────

  const [tick, setTick] = createSignal(0);
  const poller = setInterval(() => setTick((n) => n + 1), SCREEN_REFRESH_MS);
  onCleanup(() => clearInterval(poller));

  /**
   * Null in Academic mode, which stops the resource fetching at all — the
   * Screen Time widget only exists in Life, and asking Rust for a day of
   * recordings to throw it away is work nobody asked for.
   */
  const screenSource = () => (mode() === 'life' ? { tick: tick(), rev: revision() } : null);

  const [availability] = createResource(screenSource, () => api.stAvailability());
  const [today] = createResource(screenSource, () => api.stDay());

  const screen = createMemo<ScreenState>(() => {
    // Read `.error` before the accessor: a resource in an error state re-throws
    // at the read site, and this memo is not inside an error boundary.
    if (availability.error) return { state: 'error', message: errorMessage(availability.error) };
    if (today.error) return { state: 'error', message: errorMessage(today.error) };

    const avail = availability();
    if (avail && !avail.available) {
      return { state: 'off', reason: avail.reason ?? 'nothing was recording' };
    }

    const day = today();
    if (!day) return { state: 'loading' };

    const total = day.total_seconds;
    const distraction = day.by_category['distraction'] ?? 0;
    const top = day.by_app.reduce<{ app: string; seconds: number } | null>(
      (best, row) => (!best || row.seconds > best.seconds ? row : best),
      null,
    );
    return {
      state: 'ok',
      total,
      distraction,
      study: day.by_category['study'] ?? 0,
      sharePct: total > 0 ? (distraction / total) * 100 : 0,
      topApp: top?.app ?? null,
    };
  });

  return {
    ...growth,
    /** whether today has a log at all — every "—" on the board comes back to this */
    logged: () => metric() !== null,
    submitted: () => metric()?.locked === true,
    tracks,
    sparks,
    focusToday,
    topics,
    careless,
    leisureWeek,
    sleep,
    screen,
  };
}

export type HomeData = ReturnType<typeof createHomeData>;

import { createMemo, createResource } from 'solid-js';

import { longDate, shortDate, weekdayShort } from '../../core/dates';
import {
  api,
  db,
  DIFFICULTIES,
  MISTAKE_REASONS,
  marksLost,
  revision,
  type AppMode,
  type MarkLogbookEntry,
  type ScoredDay,
  type Streak,
} from '../../core/db';
import { POSTURE_TARGET, tracksIn, WELL_SPENT_TARGET } from '../../core/scoring';
import type { BarPoint, TrendPoint } from '../../core/ui';
import { DIFFICULTY_COLOR, REASON_BAR } from '../../core/ui';

/**
 * Everything the Growth Tracker draws, worked out in one place.
 *
 * The tab is strictly read-only. What changed in the port is where the numbers
 * come from: the day scores and the streak are now computed in Rust and
 * fetched, and only the *shaping* happens here — turning a `ScoredDay[]` into
 * the exact series each chart wants, with the labels and tooltip lines written
 * for a person. Keeping that out of the components means they are pure layout,
 * and the arithmetic can be read on its own.
 *
 * Everything below is a memo or a resource, so nothing recomputes because an
 * unrelated part of the page moved. The two resources refetch when
 * `revision()` changes — that is, when any command has written the vault.
 */

/** how many days of history the tracker is showing */
export const RANGES = [7, 14, 30] as const;
export type Range = (typeof RANGES)[number];

const clockTime = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

/**
 * The third line of a chart tooltip: what else the day held, and when it was
 * written down.
 *
 * `submitted_at` is the only clock time MIS stores, which makes it the honest
 * answer to "when was this?" — a day with a log but no submit says so rather
 * than inventing a time.
 */
const dayDetail = (d: ScoredDay, lead?: string) => {
  if (!d.metric) return 'No log for this day';
  const when = d.metric.submitted_at
    ? `submitted ${clockTime(d.metric.submitted_at)}`
    : 'not submitted yet';
  return lead ? `${lead} · ${when}` : when;
};

/** the two labels every chart point carries: `5 Aug` and `Wednesday, 5 August 2026` */
const labels = (d: ScoredDay) => ({ label: shortDate(d.date), sub: longDate(d.date) });

const EMPTY_STREAK: Streak = { days: 0, best: 0, today_done: false, recent: [] };

/**
 * Paper analytics run over the **whole logbook** rather than the selected
 * range — papers are far too sparse for a 7-day window to say anything useful.
 * A fortnight with two papers in it would report a 50% weakness in whichever
 * subject happened to go badly.
 */
function paperAnalytics(logbook: MarkLogbookEntry[]) {
  const totalEntries = logbook.length;

  const reasonCounts = logbook.reduce<Record<string, number>>((acc, e) => {
    acc[e.mistake_reason] = (acc[e.mistake_reason] || 0) + 1;
    return acc;
  }, {});

  const reasonBars = MISTAKE_REASONS.map((r) => {
    const count = reasonCounts[r] || 0;
    const pct = totalEntries > 0 ? (count / totalEntries) * 100 : 0;
    return {
      label: r,
      value: count,
      pct,
      class: REASON_BAR[r],
      right: `${count} · ${Math.round(pct)}%`,
    };
  })
    .filter((r) => r.value > 0)
    .sort((a, b) => b.value - a.value);

  const difficultySegments = DIFFICULTIES.map((d) => ({
    label: d,
    value: logbook.filter((e) => e.difficulty === d).length,
    color: DIFFICULTY_COLOR[d],
  })).filter((s) => s.value > 0);

  // average % per subject, weakest first — where to actually spend revision time
  const bySubject = new Map<string, { got: number; max: number; n: number }>();
  for (const e of logbook) {
    const key = e.subject || 'Unlabelled';
    const cur = bySubject.get(key) ?? { got: 0, max: 0, n: 0 };
    cur.got += e.score;
    cur.max += e.max_score;
    cur.n += 1;
    bySubject.set(key, cur);
  }
  const subjectBars = [...bySubject.entries()]
    .map(([label, v]) => {
      const pct = v.max > 0 ? (v.got / v.max) * 100 : 0;
      return {
        label,
        value: Math.round(pct),
        pct,
        right: `${Math.round(pct)}% · ${v.n} paper${v.n === 1 ? '' : 's'}`,
        class: pct >= 80 ? 'bg-success' : pct >= 60 ? 'bg-yellow-500' : 'bg-red-500',
      };
    })
    .sort((a, b) => a.pct - b.pct);

  // marks lost per chapter — the single most actionable chart in the app
  const byChapter = new Map<string, number>();
  for (const e of logbook) {
    const key = `${e.subject}${e.chapter ? ` — ${e.chapter}` : ''}`;
    byChapter.set(key, (byChapter.get(key) ?? 0) + marksLost(e));
  }
  const chapterRows = [...byChapter.entries()]
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1]);
  const worst = chapterRows[0]?.[1] ?? 1;
  const chapterBars = chapterRows.slice(0, 6).map(([label, value]) => ({
    label,
    value,
    pct: (value / worst) * 100,
    right: `${value} lost`,
    class: 'bg-destructive',
  }));

  const markTrend: TrendPoint[] = [...logbook]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((e) => ({
      label: shortDate(e.date),
      sub: `${longDate(e.date)} · ${e.subject}${e.chapter ? ` — ${e.chapter}` : ''}`,
      detail: `${e.score}/${e.max_score} · ${e.difficulty} · ${e.time_spent} min · ${e.mistake_reason}`,
      // A paper with a max of zero is a bad row, not a zero percent — it is
      // dropped rather than plotted as a catastrophic result.
      value: e.max_score > 0 ? Math.round((e.score / e.max_score) * 100) : null,
    }));

  return {
    totalEntries,
    totalMarksLost: logbook.reduce((sum, e) => sum + marksLost(e), 0),
    avgPaper: totalEntries
      ? Math.round(
          logbook.reduce((sum, e) => sum + (e.max_score > 0 ? (e.score / e.max_score) * 100 : 0), 0) /
            totalEntries,
        )
      : 0,
    reasonBars,
    difficultySegments,
    subjectBars,
    chapterBars,
    markTrend,
  };
}

export function createGrowthData(mode: () => AppMode, range: () => Range) {
  // The source is an object rather than the number itself so that a range of 0
  // or a revision of 0 could never read as "don't fetch".
  const [scored] = createResource(
    () => ({ days: range(), rev: revision() }),
    ({ days }) => api.scoreRange(days),
    { initialValue: [] },
  );

  const [streak] = createResource(() => ({ rev: revision() }), () => api.studyStreak(), {
    initialValue: EMPTY_STREAK,
  });

  const days = () => scored();
  const today = () => days()[days().length - 1] as ScoredDay | undefined;
  const logged = createMemo(() => days().filter((d) => d.metric));

  const user = () => db.user;
  const papers = createMemo(() => paperAnalytics(db.mark_logbook));

  /** the fortnight strip, with the labels the card hovers */
  const recentDays = createMemo(() =>
    streak().recent.map((d) => ({
      ...d,
      label: weekdayShort(d.date).slice(0, 2),
      fullLabel: longDate(d.date),
    })),
  );

  const bestDay = createMemo(() =>
    logged().reduce<ScoredDay | null>(
      (best, d) =>
        !best || (d.by_mode?.[mode()] ?? 0) > (best.by_mode?.[mode()] ?? 0) ? d : best,
      null,
    ),
  );

  // ── the free-time gate (merged in from the old Wellness tab) ───────────────
  const gate = createMemo(() => {
    const t = today()?.metric;
    const target = user().target_study_hours;
    const studyProgress = target > 0 ? Math.min(((t?.study_hours ?? 0) / target) * 100, 100) : 0;
    const dppTarget = t?.dpps_got ?? 0;
    const dppProgress =
      dppTarget > 0 ? Math.min(((t?.dpps_complete ?? 0) / dppTarget) * 100, 100) : 0;
    return {
      studyHours: t?.study_hours ?? 0,
      studyProgress,
      dppsComplete: t?.dpps_complete ?? 0,
      dppTarget,
      dppProgress,
      unlocked: studyProgress >= 100 && dppProgress >= 100 && dppTarget > 0,
    };
  });

  /** this mode's day score, one point per day — null on days with no log */
  const scoreTrend = createMemo<TrendPoint[]>(() =>
    days().map((d) => ({
      ...labels(d),
      detail: dayDetail(d, d.metric ? `${d.metric.study_hours}h studied` : undefined),
      value: d.by_mode?.[mode()] ?? null,
    })),
  );

  const academic = createMemo(() => ({
    studyBars: days().map<BarPoint>((d) => ({
      ...labels(d),
      detail: dayDetail(
        d,
        d.metric ? `${d.metric.dpps_complete}/${d.metric.dpps_got} DPPs` : undefined,
      ),
      value: d.metric?.study_hours ?? 0,
      class:
        (d.metric?.study_hours ?? 0) >= user().target_study_hours ? 'bg-success' : 'bg-primary',
    })),
    dppBars: days().map<BarPoint>((d) => ({
      ...labels(d),
      detail: dayDetail(
        d,
        d.metric ? `${d.metric.dpps_complete} of ${d.metric.dpps_got} assigned` : undefined,
      ),
      value: d.metric?.dpps_complete ?? 0,
      class: 'bg-yellow-500',
    })),
    gate: gate(),
  }));

  const life = createMemo(() => ({
    moodTrend: days().map<TrendPoint>((d) => ({
      ...labels(d),
      detail: dayDetail(d, d.metric ? `${d.metric.well_spent_time} min leisure` : undefined),
      value: d.metric ? d.metric.mood_score : null,
    })),
    habitTrend: days().map<TrendPoint>((d) => ({
      ...labels(d),
      detail: dayDetail(d),
      value: d.scores?.habits ?? null,
    })),
    leisureBars: days().map<BarPoint>((d) => ({
      ...labels(d),
      detail: dayDetail(d, d.metric ? `mood ${d.metric.mood_score}/10` : undefined),
      value: d.metric?.well_spent_time ?? 0,
      // Past twice the target, leisure stops being the thing that sustains the
      // studying. The bar says so before the score does.
      class:
        (d.metric?.well_spent_time ?? 0) > WELL_SPENT_TARGET * 2 ? 'bg-red-500' : 'bg-yellow-500',
    })),
    waterBars: days().map<BarPoint>((d) => ({
      ...labels(d),
      detail: dayDetail(d, `target ${user().water_target} cups`),
      value: d.metric?.water_count ?? 0,
      class: (d.metric?.water_count ?? 0) >= user().water_target ? 'bg-success' : 'bg-primary',
    })),
    postureBars: days().map<BarPoint>((d) => ({
      ...labels(d),
      detail: dayDetail(d, `target ${POSTURE_TARGET} checks`),
      value: d.metric?.posture_count ?? 0,
      class: (d.metric?.posture_count ?? 0) >= POSTURE_TARGET ? 'bg-success' : 'bg-emerald-600',
    })),
  }));

  return {
    days,
    user,
    topics: () => db.topics,
    today,
    bestDay,
    streak,
    recentDays,
    todayScore: () => today()?.by_mode?.[mode()] ?? 0,
    modeTracks: createMemo(() => tracksIn(mode(), db.track_priorities)),
    avgScore: createMemo(() =>
      logged().length
        ? Math.round(
            logged().reduce((s, d) => s + (d.by_mode?.[mode()] ?? 0), 0) / logged().length,
          )
        : 0,
    ),
    totalStudy: createMemo(
      () => Math.round(days().reduce((s, d) => s + (d.metric?.study_hours ?? 0), 0) * 10) / 10,
    ),
    scoreTrend,
    academic,
    life,
    papers,
  };
}

export type GrowthData = ReturnType<typeof createGrowthData>;

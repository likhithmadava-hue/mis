import { useState, useEffect, useMemo } from 'react';
import {
  ArborDatabase,
  DIFFICULTIES,
  MISTAKE_REASONS,
  marksLost,
  type AppMode,
  type MarkLogbookEntry,
  type TopicItem,
  type UserConfig,
} from '../../core/db';
import {
  POSTURE_TARGET,
  WELL_SPENT_TARGET,
  scoreRange,
  tracksIn,
  type ScoredDay,
} from '../../core/scoring';
import { DIFFICULTY_COLOR, REASON_BAR } from '../../core/ui/mistakes';
import type { TrendPoint } from '../../core/ui/charts';

/**
 * Everything the Growth Tracker draws, worked out in one place.
 *
 * The tab is read-only, so this hook only ever reads: it reloads from the
 * database whenever `triggerUpdate` changes and turns the raw rows into the
 * exact series each chart wants. Keeping it out of the component means the
 * component is just layout, and the arithmetic can be read on its own.
 */

/** how many days of history the tracker is showing */
export const RANGES = [7, 14, 30] as const;
export type Range = (typeof RANGES)[number];

/**
 * Paper analytics run over the whole logbook rather than the selected range —
 * papers are far too sparse for a 7-day window to say anything useful.
 */
function usePaperAnalytics(logbook: MarkLogbookEntry[]) {
  return useMemo(() => {
    const totalEntries = logbook.length;

    const reasonCounts = logbook.reduce((acc, e) => {
      acc[e.mistake_reason] = (acc[e.mistake_reason] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const reasonBars = MISTAKE_REASONS.map((r) => {
      const count = reasonCounts[r] || 0;
      const pct = totalEntries > 0 ? (count / totalEntries) * 100 : 0;
      return { label: r, value: count, pct, className: REASON_BAR[r], right: `${count} · ${Math.round(pct)}%` };
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
          className: pct >= 80 ? 'bg-success' : pct >= 60 ? 'bg-yellow-500' : 'bg-red-500',
        };
      })
      .sort((a, b) => a.pct - b.pct);

    // marks lost per chapter — the single most actionable chart in the app
    const byChapter = new Map<string, number>();
    for (const e of logbook) {
      const key = `${e.subject}${e.chapter ? ` — ${e.chapter}` : ''}`;
      byChapter.set(key, (byChapter.get(key) ?? 0) + marksLost(e));
    }
    const chapterRows = [...byChapter.entries()].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
    const worst = chapterRows[0]?.[1] ?? 1;
    const chapterBars = chapterRows.slice(0, 6).map(([label, value]) => ({
      label, value, pct: (value / worst) * 100, right: `${value} lost`, className: 'bg-destructive',
    }));

    // Optimization (⚡ Bolt): ISO `YYYY-MM-DD` strings compare lexicographically identical
    // to chronological ordering, avoiding 2 Date object allocations per comparison in O(N log N) sort
    const markTrend: TrendPoint[] = [...logbook]
      .sort((a, b) => (a.date > b.date ? 1 : a.date < b.date ? -1 : 0))
      .map((e) => ({
        label: new Date(e.date).toLocaleDateString([], { day: 'numeric', month: 'short' }),
        sub: `${e.subject}${e.chapter ? ` — ${e.chapter}` : ''}`,
        value: Math.round((e.score / e.max_score) * 100),
      }));

    return {
      totalEntries,
      totalMarksLost: logbook.reduce((sum, e) => sum + marksLost(e), 0),
      avgPaper: totalEntries
        ? Math.round(logbook.reduce((sum, e) => sum + (e.score / e.max_score) * 100, 0) / totalEntries)
        : 0,
      reasonBars,
      difficultySegments,
      subjectBars,
      chapterBars,
      markTrend,
    };
  }, [logbook]);
}

export function useGrowthData(mode: AppMode, range: Range, triggerUpdate: number) {
  const [logbook, setLogbook] = useState<MarkLogbookEntry[]>(ArborDatabase.getMarkLogbook());
  const [user, setUser] = useState<UserConfig>(ArborDatabase.getUserConfig());
  const [topics, setTopics] = useState<TopicItem[]>(ArborDatabase.getTopics());
  const [days, setDays] = useState<ScoredDay[]>(() => scoreRange(7));
  const [priorities, setPriorities] = useState(ArborDatabase.getTrackPriorities());

  useEffect(() => {
    setLogbook(ArborDatabase.getMarkLogbook());
    setUser(ArborDatabase.getUserConfig());
    setTopics(ArborDatabase.getTopics());
    setPriorities(ArborDatabase.getTrackPriorities());
    setDays(scoreRange(range));
  }, [triggerUpdate, range]);

  const today = days[days.length - 1];
  const logged = days.filter((d) => d.metric);

  // consecutive days ending today that hit the study target
  const streak = useMemo(() => {
    let n = 0;
    for (let i = days.length - 1; i >= 0; i--) {
      if ((days[i].metric?.study_hours ?? 0) >= user.target_study_hours) n++;
      else break;
    }
    return n;
  }, [days, user.target_study_hours]);

  const papers = usePaperAnalytics(logbook);

  const bestDay = logged.reduce<ScoredDay | null>(
    (best, d) => (!best || (d.byMode?.[mode] ?? 0) > (best.byMode?.[mode] ?? 0) ? d : best),
    null
  );

  // ── free time gate (merged in from the old Wellness tab) ──────────────────
  const t = today?.metric;
  const studyProgress = Math.min(((t?.study_hours ?? 0) / user.target_study_hours) * 100, 100);
  const dppTarget = t?.dpps_got ?? 0;
  const dppProgress = dppTarget > 0 ? Math.min(((t?.dpps_complete ?? 0) / dppTarget) * 100, 100) : 0;

  return {
    days,
    user,
    topics,
    today,
    bestDay,
    streak,
    todayScore: today?.byMode?.[mode] ?? 0,
    modeTracks: tracksIn(mode, priorities),
    avgScore: logged.length
      ? Math.round(logged.reduce((s, d) => s + (d.byMode?.[mode] ?? 0), 0) / logged.length)
      : 0,
    totalStudy: Math.round(days.reduce((s, d) => s + (d.metric?.study_hours ?? 0), 0) * 10) / 10,

    /** this mode's day score, one point per day */
    scoreTrend: days.map((d) => ({
      label: d.label,
      sub: d.dateLabel,
      value: d.byMode?.[mode] ?? null,
    })) as TrendPoint[],

    academic: {
      studyBars: days.map((d) => ({
        label: d.label, sub: d.dateLabel,
        value: d.metric?.study_hours ?? 0,
        className: (d.metric?.study_hours ?? 0) >= user.target_study_hours ? 'bg-success' : 'bg-primary',
      })),
      dppBars: days.map((d) => ({
        label: d.label, sub: d.dateLabel,
        value: d.metric?.dpps_complete ?? 0,
        className: 'bg-yellow-500',
      })),
      gate: {
        studyHours: t?.study_hours ?? 0,
        studyProgress,
        dppsComplete: t?.dpps_complete ?? 0,
        dppTarget,
        dppProgress,
        unlocked: studyProgress >= 100 && dppProgress >= 100 && dppTarget > 0,
      },
    },

    life: {
      moodTrend: days.map((d) => ({
        label: d.label, sub: d.dateLabel, value: d.metric ? d.metric.mood_score : null,
      })) as TrendPoint[],
      habitTrend: days.map((d) => ({
        label: d.label, sub: d.dateLabel, value: d.scores?.habits ?? null,
      })) as TrendPoint[],
      leisureBars: days.map((d) => ({
        label: d.label, sub: d.dateLabel,
        value: d.metric?.well_spent_time ?? 0,
        className: (d.metric?.well_spent_time ?? 0) > WELL_SPENT_TARGET * 2 ? 'bg-red-500' : 'bg-yellow-500',
      })),
      waterBars: days.map((d) => ({
        label: d.label, sub: d.dateLabel,
        value: d.metric?.water_count ?? 0,
        className: (d.metric?.water_count ?? 0) >= user.water_target ? 'bg-success' : 'bg-primary',
      })),
      postureBars: days.map((d) => ({
        label: d.label, sub: d.dateLabel,
        value: d.metric?.posture_count ?? 0,
        className: (d.metric?.posture_count ?? 0) >= POSTURE_TARGET ? 'bg-success' : 'bg-emerald-600',
      })),
    },

    papers,
  };
}

import {
  BarChart3,
  BookOpen,
  Database,
  Flame,
  FlaskConical,
  PlusCircle,
  Sparkles,
  Target,
} from 'lucide-solid';
import { createMemo, For, Show } from 'solid-js';

import {
  db,
  marksLost,
  MISTAKE_REASONS,
  type Difficulty,
  type MistakeReason,
} from '../../core/db';
import { REASON_BAR } from '../../core/ui';

interface MistakeAnalyticsProps {
  onOpenLog?: () => void;
  onOpenDb?: () => void;
}

const AVOIDABLE_REASONS = new Set<MistakeReason>([
  'Careless',
  'Reading',
  'Unit',
  'Sign',
]);

const DIFF_WEIGHTS: Record<Difficulty, number> = {
  Easy: 1,
  Medium: 2,
  Hard: 3,
};

/**
 * Mistake Analytics — directly replicating the analytics dashboard from
 * mistakeintelligencesystem.lovable.app/analytics.
 *
 * Provides:
 * 1. Carelessness index (Avoidable mistakes ÷ total mistakes)
 * 2. Error frequency (Where you bleed marks the most)
 * 3. Marks lost by subject (Where the damage concentrates)
 * 4. Chapter damage heatmap (Total marks lost per chapter, ranked)
 * 5. Revision priority engine (Score = marks lost + frequency bonus + difficulty weight)
 * 6. AI Insights (Coming Soon)
 */
export default function MistakeAnalytics(props: MistakeAnalyticsProps) {
  const entries = () => db.mark_logbook;
  const totalEntries = () => entries().length;

  // Total marks lost
  const totalMarks = createMemo(() =>
    entries().reduce((sum, e) => sum + marksLost(e), 0),
  );

  // ── Carelessness Index ───────────────────────────────────────────────────
  const carelessnessData = createMemo(() => {
    const list = entries();
    const total = list.length;
    if (total === 0) {
      return {
        score: 0,
        label: 'No data yet',
        tone: 'good' as const,
        note: 'Log mistakes to measure control.',
      };
    }

    const avoidableCount = list.filter((e) =>
      AVOIDABLE_REASONS.has(e.mistake_reason),
    ).length;
    const score = avoidableCount / total;

    if (score >= 0.6) {
      return {
        score,
        label: 'High carelessness',
        tone: 'bad' as const,
        note: 'Focus on slowing down and re-reading.',
      };
    }
    if (score >= 0.3) {
      return {
        score,
        label: 'Moderate avoidable loss',
        tone: 'warn' as const,
        note: 'Trim small avoidable mistakes.',
      };
    }
    return {
      score,
      label: 'Excellent control',
      tone: 'good' as const,
      note: 'Keep the discipline.',
    };
  });

  // ── Error Frequency ───────────────────────────────────────────────────────
  const errorFrequency = createMemo(() => {
    const list = entries();
    const counts: Partial<Record<MistakeReason, number>> = {};
    for (const e of list) {
      counts[e.mistake_reason] = (counts[e.mistake_reason] || 0) + 1;
    }
    return MISTAKE_REASONS.map((r) => {
      const count = counts[r] || 0;
      return {
        reason: r,
        count,
        pct: list.length > 0 ? (count / list.length) * 100 : 0,
      };
    })
      .filter((item) => item.count > 0)
      .sort((a, b) => b.count - a.count);
  });

  // ── Marks Lost by Subject ─────────────────────────────────────────────────
  const subjectDamage = createMemo(() => {
    const list = entries();
    const map = new Map<string, number>();
    for (const e of list) {
      const sub = e.subject || 'Unlabelled';
      map.set(sub, (map.get(sub) || 0) + marksLost(e));
    }
    const tot = totalMarks();
    return [...map.entries()]
      .map(([subject, marks]) => ({
        subject,
        marks,
        pct: tot > 0 ? (marks / tot) * 100 : 0,
      }))
      .sort((a, b) => b.marks - a.marks);
  });

  // ── Chapter Damage Heatmap ────────────────────────────────────────────────
  const chapterHeatmap = createMemo(() => {
    const list = entries();
    const map = new Map<string, { subject: string; chapter: string; marks: number }>();
    for (const e of list) {
      const key = `${e.subject} — ${e.chapter || 'General'}`;
      const cur = map.get(key) || {
        subject: e.subject,
        chapter: e.chapter || 'General',
        marks: 0,
      };
      cur.marks += marksLost(e);
      map.set(key, cur);
    }
    const items = [...map.values()].filter((item) => item.marks > 0);
    items.sort((a, b) => b.marks - a.marks);
    const worst = items[0]?.marks || 1;
    return items.map((item) => ({
      ...item,
      pct: (item.marks / worst) * 100,
    }));
  });

  // ── Revision Priority Engine ──────────────────────────────────────────────
  // Score = marks lost + frequency bonus (freq * 2) + difficulty weight
  const revisionPriorities = createMemo(() => {
    const list = entries();
    const map = new Map<
      string,
      {
        subject: string;
        chapter: string;
        marks: number;
        freq: number;
        diffScore: number;
      }
    >();

    for (const e of list) {
      const key = `${e.subject} › ${e.chapter || 'General'}`;
      const cur = map.get(key) || {
        subject: e.subject,
        chapter: e.chapter || 'General',
        marks: 0,
        freq: 0,
        diffScore: 0,
      };
      cur.marks += marksLost(e);
      cur.freq += 1;
      cur.diffScore += DIFF_WEIGHTS[e.difficulty] ?? 1;
      map.set(key, cur);
    }

    const items = [...map.entries()].map(([key, item]) => ({
      key,
      ...item,
      score: item.marks + item.freq * 2 + item.diffScore,
    }));

    items.sort((a, b) => b.score - a.score);
    const topScore = items[0]?.score || 1;

    return items.map((item) => ({
      ...item,
      relativePct: Math.min(100, (item.score / topScore) * 100),
    }));
  });

  return (
    <div class="space-y-6">
      {/* ── Page Header ─────────────────────────────────────────────────── */}
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 class="font-display text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Analytics
          </h2>
          <p class="text-xs sm:text-sm text-muted-foreground mt-1">
            Where you bleed marks, what to fix first, and how careful you really are.
          </p>
        </div>

        <div class="flex items-center gap-2">
          <Show when={props.onOpenLog}>
            <button
              onClick={() => props.onOpenLog?.()}
              class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold font-space shadow-md hover:opacity-90 transition-opacity"
            >
              <PlusCircle size={14} /> Log mistake
            </button>
          </Show>
          <Show when={props.onOpenDb}>
            <button
              onClick={() => props.onOpenDb?.()}
              class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
            >
              <Database size={14} /> Database
            </button>
          </Show>
        </div>
      </div>

      {/* ── Empty state fallback ─────────────────────────────────────────── */}
      <Show
        when={totalEntries() > 0}
        fallback={
          <div class="rounded-2xl border border-border bg-card p-10 sm:p-14 text-center shadow-[var(--shadow-card)] space-y-4">
            <div class="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto text-primary">
              <FlaskConical size={24} />
            </div>
            <div class="max-w-md mx-auto">
              <h3 class="font-display text-lg font-semibold">No mistakes logged yet</h3>
              <p class="text-xs text-muted-foreground mt-1 leading-relaxed">
                Log a few mistakes in the Daily Log to unlock the Carelessness index, Chapter damage heatmap, and Revision priority engine.
              </p>
            </div>
            <Show when={props.onOpenLog}>
              <div class="pt-2">
                <button
                  onClick={() => props.onOpenLog?.()}
                  class="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold font-space shadow-md hover:opacity-90 transition-opacity"
                >
                  <PlusCircle size={15} /> Add first mistake
                </button>
              </div>
            </Show>
          </div>
        }
      >
        {/* ── 1. Carelessness Index ───────────────────────────────────────── */}
        <section class="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)] space-y-5">
          <div class="flex items-start justify-between">
            <div>
              <h3 class="font-display text-base font-semibold">Carelessness index</h3>
              <p class="text-xs text-muted-foreground mt-0.5">
                Avoidable mistakes ÷ total mistakes
              </p>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
            {/* Big Score Readout */}
            <div>
              <div
                class={`font-display text-5xl sm:text-6xl font-semibold tracking-tight leading-none ${
                  carelessnessData().tone === 'bad'
                    ? 'text-destructive'
                    : carelessnessData().tone === 'warn'
                      ? 'text-warning'
                      : 'text-success'
                }`}
              >
                {carelessnessData().score.toFixed(2)}
              </div>
              <div class="mt-2.5 text-sm font-medium text-foreground">
                {carelessnessData().label}
              </div>
              <div class="text-xs text-muted-foreground mt-0.5">
                {carelessnessData().note}
              </div>
            </div>

            {/* Gauge Bar & Scale */}
            <div class="md:col-span-2 space-y-2">
              <div class="h-3 rounded-full bg-secondary overflow-hidden">
                <div
                  class={`h-full transition-all duration-500 rounded-full ${
                    carelessnessData().tone === 'bad'
                      ? 'bg-destructive'
                      : carelessnessData().tone === 'warn'
                        ? 'bg-warning'
                        : 'bg-success'
                  }`}
                  style={{ width: `${Math.min(100, carelessnessData().score * 100)}%` }}
                />
              </div>

              <div class="grid grid-cols-3 text-[11px] text-muted-foreground font-mono">
                <span>0.0 · Excellent</span>
                <span class="text-center">0.3 · Moderate</span>
                <span class="text-right">0.6+ · High</span>
              </div>

              <div class="pt-2 text-xs text-muted-foreground">
                Avoidable categories:{' '}
                <span class="text-foreground/80 font-medium">
                  {[...AVOIDABLE_REASONS].join(' · ')}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* ── 2. Two-Column Analytics: Error Frequency & Marks Lost by Subject ─ */}
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Error Frequency */}
          <section class="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)] space-y-4">
            <div>
              <h3 class="font-display text-base font-semibold flex items-center gap-2">
                <Flame size={16} class="text-primary" /> Error frequency
              </h3>
              <p class="text-xs text-muted-foreground mt-0.5">
                Where you bleed marks the most
              </p>
            </div>

            <div class="space-y-2.5 pt-1">
              <For each={errorFrequency()}>
                {(item) => (
                  <div class="space-y-1">
                    <div class="flex items-center justify-between text-xs">
                      <span class="font-medium text-foreground">{item.reason}</span>
                      <span class="font-mono text-muted-foreground">
                        {item.count} · {Math.round(item.pct)}%
                      </span>
                    </div>
                    <div class="h-2 rounded-full bg-secondary overflow-hidden">
                      <div
                        class={`h-full rounded-full transition-all duration-300 ${
                          REASON_BAR[item.reason] || 'bg-primary'
                        }`}
                        style={{ width: `${Math.min(100, item.pct)}%` }}
                      />
                    </div>
                  </div>
                )}
              </For>
            </div>
          </section>

          {/* Marks Lost by Subject */}
          <section class="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)] space-y-4">
            <div>
              <h3 class="font-display text-base font-semibold flex items-center gap-2">
                <BookOpen size={16} class="text-primary" /> Marks lost by subject
              </h3>
              <p class="text-xs text-muted-foreground mt-0.5">
                Where the damage concentrates
              </p>
            </div>

            <div class="space-y-2.5 pt-1">
              <For each={subjectDamage()}>
                {(item) => (
                  <div class="space-y-1">
                    <div class="flex items-center justify-between text-xs">
                      <span class="font-medium text-foreground">{item.subject}</span>
                      <span class="font-mono text-muted-foreground">
                        {item.marks} marks ({Math.round(item.pct)}%)
                      </span>
                    </div>
                    <div class="h-2 rounded-full bg-secondary overflow-hidden">
                      <div
                        class="h-full rounded-full bg-primary transition-all duration-300"
                        style={{ width: `${Math.min(100, item.pct)}%` }}
                      />
                    </div>
                  </div>
                )}
              </For>
            </div>
          </section>
        </div>

        {/* ── 3. Chapter Damage Heatmap ───────────────────────────────────── */}
        <section class="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)] space-y-4">
          <div>
            <h3 class="font-display text-base font-semibold flex items-center gap-2">
              <BarChart3 size={16} class="text-primary" /> Chapter damage heatmap
            </h3>
            <p class="text-xs text-muted-foreground mt-0.5">
              Total marks lost per chapter, ranked
            </p>
          </div>

          <div class="space-y-2.5 pt-1">
            <For each={chapterHeatmap().slice(0, 10)}>
              {(item) => (
                <div class="space-y-1">
                  <div class="flex items-center justify-between text-xs">
                    <span class="font-medium text-foreground">
                      {item.chapter}{' '}
                      <span class="text-muted-foreground font-normal">
                        · {item.subject}
                      </span>
                    </span>
                    <span class="font-mono text-destructive font-semibold">
                      {item.marks} lost
                    </span>
                  </div>
                  <div class="h-2 rounded-full bg-secondary overflow-hidden">
                    <div
                      class="h-full rounded-full bg-destructive transition-all duration-300"
                      style={{ width: `${Math.min(100, item.pct)}%` }}
                    />
                  </div>
                </div>
              )}
            </For>
          </div>
        </section>

        {/* ── 4. Revision Priority Engine ─────────────────────────────────── */}
        <section class="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)] space-y-4">
          <div>
            <h3 class="font-display text-base font-semibold flex items-center gap-2">
              <Target size={16} class="text-primary" /> Revision priority engine
            </h3>
            <p class="text-xs text-muted-foreground mt-0.5">
              Score = marks lost + frequency bonus + difficulty weight
            </p>
          </div>

          <ol class="space-y-2.5 pt-1">
            <For each={revisionPriorities().slice(0, 8)}>
              {(item, index) => (
                <li class="rounded-xl bg-secondary/40 border border-border/40 p-3.5 space-y-2">
                  <div class="flex items-center gap-3">
                    <span class="font-mono text-xs font-bold text-primary w-6">
                      #{index() + 1}
                    </span>
                    <div class="flex-1 min-w-0">
                      <div class="font-medium text-xs sm:text-sm truncate text-foreground">
                        {item.chapter}{' '}
                        <span class="text-muted-foreground text-xs font-normal">
                          · {item.subject}
                        </span>
                      </div>
                      <div class="text-[11px] text-muted-foreground mt-0.5">
                        {item.marks} marks lost · {item.freq} mistake
                        {item.freq === 1 ? '' : 's'} · diff weight {item.diffScore}
                      </div>
                    </div>
                    <span class="font-mono text-sm font-bold text-primary flex-shrink-0">
                      {item.score.toFixed(0)}
                    </span>
                  </div>

                  <div class="h-1.5 rounded-full bg-background overflow-hidden">
                    <div
                      class="h-full bg-primary/70 rounded-full transition-all duration-300"
                      style={{ width: `${item.relativePct}%` }}
                    />
                  </div>
                </li>
              )}
            </For>
          </ol>
        </section>

        {/* ── 5. AI Insights ──────────────────────────────────────────────── */}
        <div class="rounded-2xl border border-dashed border-border bg-card/40 p-5 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
          <Sparkles size={14} class="text-primary/70" />
          <span>AI Insights — Coming Soon</span>
        </div>
      </Show>
    </div>
  );
}

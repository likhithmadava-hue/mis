import type { JSX } from 'solid-js';
import { createMemo, createSignal, For, onMount, Show } from 'solid-js';
import { Dynamic } from 'solid-js/web';

import type { Icon } from '../../core/ui';

/**
 * The home board's vocabulary: one tile, and the three things a tile can draw
 * underneath its number.
 *
 * Every widget on the home page is the same shell — a captioned icon, one large
 * value, one line of context, and optionally a meter, a sparkline or a strip
 * below it. That uniformity is the whole idea. Eleven differently-shaped cards
 * would each have to be read before it could be understood; eleven identical
 * ones are read once and then only scanned, which is what a board you open
 * every morning has to support.
 *
 * These live here rather than in `core/ui` because none of them is general —
 * they are the home page's own idea of "a small fact with a picture under it",
 * and no other tab draws one.
 */

interface WidgetProps {
  icon: Icon;
  /** the caption above the number — short, it is uppercased and tracked out */
  label: string;
  /** the number itself. `—` when there is nothing to say, never a stand-in zero */
  value: string;
  /** the line under it: what the number is out of, or where it came from */
  sub?: string;
  /** a colour class for the value — muted it when the value is a dash */
  tone?: string;
  /** a small visual to the right of the number: a ring, a flame */
  aside?: JSX.Element;
  /** the full sentence, for a value the tile had to truncate */
  hint?: string;
  /** ms of stagger on the entrance animation, so the board deals itself out */
  delay?: number;
  /** makes the whole tile a shortcut to the tab that owns this number */
  onClick?: () => void;
  /** where that shortcut goes, for the overlay button's accessible name */
  goes?: string;
  /** the meter, sparkline or strip that fills the foot of the tile */
  children?: JSX.Element;
  class?: string;
}

export function Widget(props: WidgetProps) {
  return (
    <section
      title={props.hint}
      style={{ 'animation-delay': `${props.delay ?? 0}ms` }}
      class={`animate-rise-in relative bg-card rounded-2xl border border-border card-shadow p-3.5 flex flex-col gap-2.5 min-w-0 transition-colors ${
        props.onClick ? 'hover:border-primary/40' : 'hover:border-primary/20'
      } ${props.class ?? ''}`}
    >
      <div class="flex items-center gap-2 min-w-0 text-muted-foreground">
        <Dynamic component={props.icon} size={14} class="text-primary flex-shrink-0" />
        <span class="text-[0.625rem] font-bold uppercase tracking-wider font-space truncate">
          {props.label}
        </span>
      </div>

      <div class="flex items-center justify-between gap-2.5 min-w-0">
        <div class="min-w-0">
          <p
            class={`text-2xl font-bold font-space leading-none truncate ${
              props.tone ?? 'text-foreground'
            }`}
          >
            {props.value}
          </p>
          <Show when={props.sub}>
            <p class="text-[0.6875rem] text-muted-foreground leading-snug mt-1 truncate">
              {props.sub}
            </p>
          </Show>
        </div>
        <Show when={props.aside}>
          <div class="flex-shrink-0">{props.aside}</div>
        </Show>
      </div>

      {/* pinned to the foot, so a row of tiles lines its meters up even when one
          of them has a two-line caption */}
      <div class="mt-auto min-w-0">{props.children}</div>

      {/* The shortcut is an overlay rather than a wrapper: it keeps the tile's
          markup one tree, and it means the focus ring outlines the whole card
          instead of the caption. */}
      <Show when={props.onClick}>
        <button
          type="button"
          onClick={() => props.onClick?.()}
          aria-label={props.goes ?? `Open ${props.label}`}
          class="absolute inset-0 rounded-2xl cursor-pointer"
        />
      </Show>
    </section>
  );
}

/** the thin progress bar under a widget's number */
export function WidgetBar(props: { pct: number; class?: string }) {
  return (
    <div class="w-full bg-background h-1.5 rounded-full overflow-hidden">
      <div
        class={`h-full rounded-full transition-all duration-500 ${props.class ?? 'bg-primary'}`}
        style={{ width: `${Math.max(0, Math.min(100, props.pct))}%` }}
      />
    </div>
  );
}

/**
 * A week of numbers, small enough to sit inside a tile.
 *
 * Like the full `TrendChart` it splits the series into runs of consecutive
 * non-null points, so **a day with no log is a gap and not a dip** — joining
 * across it would draw days that never happened. A run of one point has no line
 * to draw, so it is drawn as a dot instead; otherwise a single logged day would
 * render an empty box.
 */
export function Spark(props: { data: (number | null)[]; max: number }) {
  const n = () => props.data.length;
  const safeMax = () => (props.max > 0 ? props.max : 1);
  const x = (i: number) => (n() <= 1 ? 50 : (i / (n() - 1)) * 100);
  const y = (v: number) => 100 - (Math.max(0, Math.min(safeMax(), v)) / safeMax()) * 100;

  const runs = createMemo(() => {
    const out: { i: number; v: number }[][] = [];
    let run: { i: number; v: number }[] = [];
    props.data.forEach((v, i) => {
      if (v === null) {
        if (run.length) out.push(run);
        run = [];
      } else {
        run.push({ i, v });
      }
    });
    if (run.length) out.push(run);
    return out;
  });

  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" class="w-full h-7 overflow-visible">
      <For each={runs()}>
        {(r) => (
          <path
            d={
              r.length === 1
                ? `M ${x(r[0].i)},${y(r[0].v)} L ${x(r[0].i)},${y(r[0].v)}`
                : `M ${r.map((p) => `${x(p.i)},${y(p.v)}`).join(' L ')}`
            }
            fill="none"
            stroke="hsl(var(--primary))"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            vector-effect="non-scaling-stroke"
          />
        )}
      </For>
    </svg>
  );
}

/**
 * The fortnight of study days, as blocks.
 *
 * No per-day letters: fourteen labels are illegible at this width and were never
 * the point. The ends are captioned by the caller and hovering a block names its
 * date in full.
 */
export function DayStrip(props: {
  days: { date: string; hit: boolean; fullLabel: string }[];
  targetHours: number;
}) {
  return (
    <div class="flex items-stretch gap-[3px] h-6">
      <For each={props.days}>
        {(d, i) => (
          <div
            title={`${d.fullLabel} — ${
              d.hit ? `${props.targetHours}h target cleared` : 'target missed'
            }`}
            style={{ 'animation-delay': `${140 + i() * 20}ms` }}
            class={`animate-rise-in flex-1 min-w-0 rounded-[3px] border transition-colors ${
              d.hit
                ? 'bg-orange-500/25 border-orange-500/40 hover:bg-orange-500/40'
                : 'bg-muted/40 border-border hover:bg-muted'
            }`}
          />
        )}
      </For>
    </div>
  );
}

/**
 * The day's score as a ring rather than a filled box.
 *
 * A box coloured by `heat` told you the score twice — once as a number and once
 * as a colour — but never showed how far through the day's target you were. The
 * ring does, and it keeps the mode accent instead of turning the brightest
 * element on the board red on a slow morning.
 */
export function ScoreRing(props: { value: number; max: number; size?: number }) {
  const R = 42;
  const CIRCUMFERENCE = 2 * Math.PI * R;
  const target = () => (props.max > 0 ? Math.max(0, Math.min(1, props.value / props.max)) : 0);

  // The arc already animates whenever the score changes, but on the first paint
  // it was simply *there*. Holding it at zero for a frame lets the same
  // transition draw it in when the tab opens.
  const [drawn, setDrawn] = createSignal(false);
  onMount(() => requestAnimationFrame(() => setDrawn(true)));
  const fraction = () => (drawn() ? target() : 0);

  return (
    <svg
      viewBox="0 0 100 100"
      class="-rotate-90 flex-shrink-0"
      style={{ width: `${props.size ?? 52}px`, height: `${props.size ?? 52}px` }}
    >
      <circle cx="50" cy="50" r={R} fill="none" stroke="hsl(var(--muted))" stroke-width="11" />
      {/* A round cap on a zero-length arc still paints a dot, which read as
          "something is logged" on a blank day — so at zero, draw nothing. */}
      <Show when={fraction() > 0}>
        <circle
          cx="50"
          cy="50"
          r={R}
          fill="none"
          stroke="hsl(var(--primary))"
          stroke-width="11"
          stroke-linecap="round"
          stroke-dasharray={`${fraction() * CIRCUMFERENCE} ${CIRCUMFERENCE}`}
          class="transition-all duration-700 ease-out"
        />
      </Show>
    </svg>
  );
}

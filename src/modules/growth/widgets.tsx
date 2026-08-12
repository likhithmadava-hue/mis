import { ArrowRight } from 'lucide-solid';
import type { JSX } from 'solid-js';
import { createMemo, createSignal, For, onMount, Show } from 'solid-js';
import { Dynamic } from 'solid-js/web';

import type { Icon } from '../../core/ui';

/**
 * The home board's vocabulary: the cards, and the things a card can draw
 * underneath its number.
 *
 * The board used to be eleven identical tiles. That uniformity was deliberate —
 * eleven identical things are read once and then only scanned — but it flattened
 * the page: the day score, the one number you open MIS to see, was drawn exactly
 * like "Sleep window". So the shell now comes in **two weights**. A `primary`
 * card sits on the elevated surface with more padding and bigger type; a
 * `secondary` card sits on the ordinary card surface and recedes. The tiles
 * themselves did not change — only which weight each one is asked for.
 *
 * These live here rather than in `core/ui` because none of them is general —
 * they are the home page's own idea of "a fact with a picture under it", and no
 * other tab draws one.
 */

export type CardVariant = 'primary' | 'secondary';

/**
 * The surface rules, in one place.
 *
 * Depth on this board comes from the surfaces themselves — four blues at rising
 * lightness, a hairline border at ~7% white, and a wide faint shadow. Not from
 * heavy outlines, and not from a glow on every element.
 */
const shell = (variant: CardVariant | undefined, interactive: boolean) =>
  [
    'animate-rise-in relative rounded-2xl border border-border min-w-0 flex flex-col transition-colors',
    variant === 'primary'
      ? 'bg-elevated raised-shadow p-5 gap-4'
      : 'bg-card card-shadow p-4 gap-3',
    interactive ? 'hover:border-primary/30' : 'hover:border-primary/15',
  ].join(' ');

/** the caption every card wears: a small accent icon and a tracked-out label */
function CardLabel(props: { icon: Icon; label: string; variant?: CardVariant }) {
  return (
    <div class="flex items-center gap-2 min-w-0 text-muted-foreground">
      <Dynamic
        component={props.icon}
        size={props.variant === 'primary' ? 15 : 14}
        // Important cards get the accent; the quieter ones get blue-grey, so a
        // row of secondary tiles does not compete with the number above it.
        class={`flex-shrink-0 ${props.variant === 'primary' ? 'text-primary' : 'text-subtle-foreground'}`}
      />
      <span
        class={`font-bold uppercase font-space truncate ${
          props.variant === 'primary'
            ? 'text-[0.75rem] tracking-[0.12em] text-muted-foreground'
            : 'text-[0.6875rem] tracking-[0.1em]'
        }`}
      >
        {props.label}
      </span>
    </div>
  );
}

/**
 * The whole-card shortcut.
 *
 * An overlay rather than a wrapper: it keeps the card's markup one tree, and it
 * means the focus ring outlines the whole card instead of the caption.
 */
function GoOverlay(props: { onClick?: () => void; goes?: string; label: string }) {
  return (
    <Show when={props.onClick}>
      <button
        type="button"
        onClick={() => props.onClick?.()}
        aria-label={props.goes ?? `Open ${props.label}`}
        class="absolute inset-0 rounded-2xl cursor-pointer"
      />
    </Show>
  );
}

/**
 * False for one frame after mount, so anything driven by it has a value to
 * animate *from*. Without it a meter is simply already full on first paint.
 */
function useDrawn() {
  const [drawn, setDrawn] = createSignal(false);
  onMount(() => requestAnimationFrame(() => setDrawn(true)));
  return drawn;
}

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
  /** primary cards lead a band; secondary ones fill it. Defaults to secondary. */
  variant?: CardVariant;
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
      class={`${shell(props.variant, !!props.onClick)} ${props.class ?? ''}`}
    >
      <CardLabel icon={props.icon} label={props.label} variant={props.variant} />

      <div class="flex items-center justify-between gap-2.5 min-w-0">
        <div class="min-w-0">
          <p
            class={`font-bold font-space leading-none truncate ${
              props.variant === 'primary' ? 'text-[2rem]' : 'text-2xl'
            } ${props.tone ?? 'text-foreground'}`}
          >
            {props.value}
          </p>
          <Show when={props.sub}>
            <p class="text-[0.75rem] text-muted-foreground leading-snug mt-1.5 truncate">
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

      <GoOverlay onClick={props.onClick} goes={props.goes} label={props.label} />
    </section>
  );
}

/**
 * A card that is a picture rather than a number — the week chart, the continue
 * panel. Same shell and the same caption as `Widget`, without the big value.
 */
export function BoardCard(props: {
  icon: Icon;
  label: string;
  variant?: CardVariant;
  /** a control belonging to this card, sat opposite the caption */
  right?: JSX.Element;
  hint?: string;
  delay?: number;
  children: JSX.Element;
  class?: string;
}) {
  return (
    <section
      title={props.hint}
      style={{ 'animation-delay': `${props.delay ?? 0}ms` }}
      class={`${shell(props.variant, false)} ${props.class ?? ''}`}
    >
      <div class="flex items-center justify-between gap-3 min-w-0">
        <CardLabel icon={props.icon} label={props.label} variant={props.variant} />
        <Show when={props.right}>
          <div class="flex-shrink-0">{props.right}</div>
        </Show>
      </div>
      <div class="flex-1 min-h-0 min-w-0 flex flex-col">{props.children}</div>
    </section>
  );
}

/**
 * The day's score, as the anchor of the board.
 *
 * Everything here exists to make one relationship readable in about a second:
 * **this many, out of that many.** The score is set at more than twice the size
 * of any other number on the page, the denominator sits beside it in the quiet
 * text step rather than hiding in the caption below, and the ring and the meter
 * say the same fraction twice — one as an arc you can read at a glance from
 * across the desk, one as a line you can compare against yesterday's.
 *
 * A day with no log shows `—` and draws no arc. It is not a zero.
 */
export function ScoreHero(props: {
  icon: Icon;
  label: string;
  value: number;
  max: number;
  /** false when there is no log today at all — the whole card goes quiet */
  logged: boolean;
  /** `open`, `submitted`, `nothing logged yet` */
  status: string;
  hint?: string;
  onOpen: () => void;
  goes: string;
  class?: string;
}) {
  const pct = () => (props.max > 0 ? (props.value / props.max) * 100 : 0);

  return (
    <section
      title={props.hint}
      class={`${shell('primary', true)} ${props.class ?? ''}`}
    >
      <CardLabel icon={props.icon} label={props.label} variant="primary" />

      <div class="flex items-center justify-between gap-4 min-w-0">
        <div class="min-w-0">
          <p class="font-space font-bold leading-none flex items-baseline gap-2 min-w-0">
            <span
              class={`text-[2.625rem] ${props.logged ? 'text-foreground' : 'text-subtle-foreground'}`}
            >
              {props.logged ? props.value : '—'}
            </span>
            <span class="text-xl text-subtle-foreground">/ {props.max}</span>
          </p>
          <p class="text-[0.8125rem] text-muted-foreground mt-2.5 truncate">{props.status}</p>
        </div>

        <ScoreRing value={props.logged ? props.value : 0} max={props.max} size={92} />
      </div>

      <div class="mt-auto">
        <WidgetBar pct={props.logged ? pct() : 0} tall />
      </div>

      <GoOverlay onClick={props.onOpen} goes={props.goes} label={props.label} />
    </section>
  );
}

/** the progress bar under a card's number */
export function WidgetBar(props: { pct: number; class?: string; tall?: boolean }) {
  const drawn = useDrawn();
  const width = () => (drawn() ? Math.max(0, Math.min(100, props.pct)) : 0);

  return (
    <div
      class={`w-full bg-muted rounded-full overflow-hidden ${props.tall ? 'h-2' : 'h-1.5'}`}
    >
      <div
        class={`h-full rounded-full transition-[width] duration-700 ease-out ${
          props.class ?? 'bar-primary'
        }`}
        style={{ width: `${width()}%` }}
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

/** one column of [`WeekChart`] */
export interface WeekDay {
  /** the weekday initial under the bar */
  label: string;
  /** the whole date, for the hover */
  full: string;
  /** **null on a day with no log** — drawn as an empty slot, never a zero bar */
  value: number | null;
  isToday: boolean;
}

/**
 * The last seven days as labelled bars.
 *
 * This is the week you can actually read: the fortnight strip in the streak card
 * says *whether* each day cleared the target, and this says *by how much*, with
 * the weekday under each column so a dip has a name.
 *
 * **A day with no log is an empty dashed slot.** A zero-height bar and a day you
 * never opened MIS look identical, and only one of them is ever true — the same
 * rule the full charts on the Report follow.
 */
export function WeekChart(props: { days: WeekDay[]; max: number; unit?: string }) {
  const drawn = useDrawn();
  const safeMax = () => (props.max > 0 ? props.max : 1);
  const height = (v: number) =>
    drawn() ? Math.max(4, Math.min(100, (v / safeMax()) * 100)) : 0;

  return (
    <div class="flex-1 flex items-stretch gap-1.5 sm:gap-2 min-h-[5rem]">
      <For each={props.days}>
        {(d) => (
          <div class="flex-1 min-w-0 flex flex-col items-center gap-2">
            <div
              title={`${d.full} — ${
                d.value === null ? 'no log' : `${d.value}${props.unit ?? ''}`
              }`}
              class="relative w-full flex-1 rounded-md bg-muted overflow-hidden"
            >
              <Show
                when={d.value !== null}
                fallback={
                  <div class="absolute inset-0 rounded-md border border-dashed border-border" />
                }
              >
                <div
                  class="absolute inset-x-0 bottom-0 rounded-md bar-primary transition-[height] duration-700 ease-out"
                  style={{ height: `${height(d.value ?? 0)}%` }}
                />
              </Show>
            </div>
            <span
              class={`text-[0.625rem] font-bold uppercase tracking-wider font-space ${
                d.isToday ? 'text-primary' : 'text-subtle-foreground'
              }`}
            >
              {d.label}
            </span>
          </div>
        )}
      </For>
    </div>
  );
}

/**
 * The fortnight of study days, as blocks.
 *
 * No per-day letters: fourteen labels are illegible at this width and were never
 * the point — [`WeekChart`] is where the week gets named axes. The ends are
 * captioned by the caller and hovering a block names its date in full.
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
                ? 'bg-primary/25 border-primary/40 hover:bg-primary/40'
                : 'bg-muted/60 border-border hover:bg-muted'
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
  const drawn = useDrawn();
  const fraction = () => (drawn() ? target() : 0);

  return (
    <svg
      viewBox="0 0 100 100"
      class="-rotate-90 flex-shrink-0"
      style={{ width: `${props.size ?? 52}px`, height: `${props.size ?? 52}px` }}
    >
      {/* the track is the darkest surface, not the card's own — a ring needs
          something to be read against */}
      <circle cx="50" cy="50" r={R} fill="none" stroke="hsl(var(--background))" stroke-width="10" />
      {/* A round cap on a zero-length arc still paints a dot, which read as
          "something is logged" on a blank day — so at zero, draw nothing. */}
      <Show when={fraction() > 0}>
        <circle
          cx="50"
          cy="50"
          r={R}
          fill="none"
          stroke="hsl(var(--primary))"
          stroke-width="10"
          stroke-linecap="round"
          stroke-dasharray={`${fraction() * CIRCUMFERENCE} ${CIRCUMFERENCE}`}
          class="transition-all duration-700 ease-out"
        />
      </Show>
    </svg>
  );
}

/** what [`ContinueCard`] draws when there is something to pick up */
export interface ContinueTarget {
  /** what kind of thing this is — "Left to Revise", "Costliest chapter" */
  kicker: string;
  /** the thing itself */
  title: string;
  /** 0–100 */
  pct: number;
  /** what the meter is measuring, in its own units */
  meterLabel: string;
  /** where it came from — a date, a paper count */
  footnote: string;
  /** the button's words: "Continue", "Revise" */
  cta: string;
  onGo: () => void;
}

/**
 * The one card on the board that asks you to *do* something.
 *
 * Everything else here reports; this proposes. It is built strictly from what
 * the vault already holds — the next unfinished topic, or the chapter bleeding
 * the most marks — because a "resume where you left off" card that invents its
 * own progress state would be the only thing on this page you could not check.
 *
 * When there is genuinely nothing queued it says so and points at the tab that
 * fixes that, rather than drawing an empty meter at 0%.
 */
export function ContinueCard(props: {
  icon: Icon;
  label: string;
  target: ContinueTarget | null;
  empty: { line: string; cta: string; onGo: () => void };
  delay?: number;
  class?: string;
}) {
  return (
    <BoardCard
      icon={props.icon}
      label={props.label}
      variant="primary"
      delay={props.delay}
      class={props.class}
    >
      <Show
        when={props.target}
        fallback={
          <div class="flex-1 flex flex-col lg:flex-row lg:items-center justify-center gap-4 lg:gap-8 py-1">
            <p class="text-[0.9375rem] text-subtle-foreground leading-relaxed lg:flex-1 text-pretty">
              {props.empty.line}
            </p>
            <div class="flex lg:flex-shrink-0">
              <GoButton label={props.empty.cta} onGo={props.empty.onGo} />
            </div>
          </div>
        }
      >
        {(t) => (
          /* Three parts stacked in a narrow window and laid across the card in a
             wide one — full width, a single left-aligned column would leave the
             right two thirds of the card empty. */
          <div class="flex-1 flex flex-col lg:flex-row lg:items-center gap-4 lg:gap-8">
            <div class="min-w-0 lg:flex-1">
              <p class="text-[0.6875rem] font-bold uppercase tracking-[0.1em] font-space text-primary truncate">
                {t().kicker}
              </p>
              <p class="text-xl font-bold font-space leading-tight mt-1 truncate">{t().title}</p>
            </div>

            <div class="space-y-1.5 lg:w-[34%] lg:flex-shrink-0">
              <WidgetBar pct={t().pct} tall />
              <div class="flex items-baseline justify-between gap-2 text-[0.75rem]">
                <span class="text-muted-foreground truncate">{t().meterLabel}</span>
                <span class="font-mono font-bold text-primary flex-shrink-0">
                  {Math.round(t().pct)}%
                </span>
              </div>
            </div>

            <div class="flex items-center justify-between lg:justify-end gap-4 lg:flex-shrink-0">
              <span class="text-[0.75rem] text-subtle-foreground truncate">{t().footnote}</span>
              <GoButton label={t().cta} onGo={t().onGo} />
            </div>
          </div>
        )}
      </Show>
    </BoardCard>
  );
}

/** the accented call to action — the only filled primary button on the board */
function GoButton(props: { label: string; onGo: () => void }) {
  return (
    <button
      type="button"
      onClick={() => props.onGo()}
      class="flex-shrink-0 h-9 px-4 rounded-xl bg-primary text-primary-foreground text-[0.8125rem] font-bold font-space flex items-center gap-2 transition-[filter,transform] hover:brightness-110 active:scale-[0.98]"
    >
      {props.label}
      <ArrowRight size={15} />
    </button>
  );
}

/**
 * A quiet statistic inside a section, with no border of its own.
 *
 * The analytics band used to be six cards identical to the ones above it, which
 * made a standing pattern from the whole logbook compete with today's score.
 * These sit *inside* one bordered section instead: same information, one box
 * instead of seven, and the hierarchy says which is which.
 */
export function StatBlock(props: {
  icon: Icon;
  label: string;
  value: string;
  sub?: string;
  tone?: string;
  hint?: string;
  onClick?: () => void;
  goes?: string;
  children?: JSX.Element;
}) {
  return (
    <div
      title={props.hint}
      class={`relative rounded-xl bg-muted/50 p-4 flex flex-col gap-2 min-w-0 border border-transparent transition-colors ${
        props.onClick ? 'hover:border-border' : ''
      }`}
    >
      <div class="flex items-center gap-2 min-w-0 text-subtle-foreground">
        <Dynamic component={props.icon} size={13} class="flex-shrink-0" />
        <span class="text-[0.625rem] font-bold uppercase tracking-[0.1em] font-space truncate">
          {props.label}
        </span>
      </div>

      <div class="min-w-0">
        <p class={`text-xl font-bold font-space leading-none truncate ${props.tone ?? 'text-foreground'}`}>
          {props.value}
        </p>
        <Show when={props.sub}>
          <p class="text-[0.6875rem] text-muted-foreground mt-1.5 truncate">{props.sub}</p>
        </Show>
      </div>

      <Show when={props.children}>
        <div class="mt-auto min-w-0">{props.children}</div>
      </Show>

      <Show when={props.onClick}>
        <button
          type="button"
          onClick={() => props.onClick?.()}
          aria-label={props.goes ?? `Open ${props.label}`}
          class="absolute inset-0 rounded-xl cursor-pointer"
        />
      </Show>
    </div>
  );
}

/**
 * A finding rather than a figure — "your most common mistake is Careless".
 *
 * Laid out as a row because the value is a *name*, not a number: a chapter title
 * in a 20px bold slot would truncate on every card, and the thing worth reading
 * is the sentence, not the digit.
 */
export function InsightRow(props: {
  icon: Icon;
  label: string;
  value: string;
  detail: string;
  tone?: string;
  hint?: string;
  onClick?: () => void;
  goes?: string;
}) {
  return (
    <div
      title={props.hint}
      class={`relative rounded-xl bg-muted/50 px-4 py-3 flex items-center gap-3.5 min-w-0 border border-transparent transition-colors ${
        props.onClick ? 'hover:border-border' : ''
      }`}
    >
      <div class="w-9 h-9 flex-shrink-0 rounded-lg bg-background grid place-items-center">
        <Dynamic component={props.icon} size={16} class="text-subtle-foreground" />
      </div>

      <div class="min-w-0 flex-1">
        <p class="text-[0.625rem] font-bold uppercase tracking-[0.1em] font-space text-subtle-foreground truncate">
          {props.label}
        </p>
        <p class={`text-[0.9375rem] font-semibold leading-tight mt-0.5 truncate ${props.tone ?? 'text-foreground'}`}>
          {props.value}
        </p>
      </div>

      <span class="flex-shrink-0 text-[0.75rem] font-mono text-muted-foreground">
        {props.detail}
      </span>

      <Show when={props.onClick}>
        <button
          type="button"
          onClick={() => props.onClick?.()}
          aria-label={props.goes ?? `Open ${props.label}`}
          class="absolute inset-0 rounded-xl cursor-pointer"
        />
      </Show>
    </div>
  );
}

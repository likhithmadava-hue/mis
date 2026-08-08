import { createMemo, createSignal, For, Show } from 'solid-js';

/**
 * Hand-rolled chart primitives.
 *
 * There is no chart library in this project and adding one would pull a large
 * dependency into the bundle for six chart types. These cover what the Growth
 * Tracker needs and are styled with the same CSS-variable tokens as everything
 * else, which is why they retint with the mode for free — a library's canvas
 * would have to be told the colour changed.
 *
 * Line charts stretch with `preserveAspectRatio="none"`, which would also
 * stretch the stroke — `vector-effect="non-scaling-stroke"` keeps it even, and
 * the dots are HTML positioned over the SVG so they stay circular.
 *
 * Every chart carries its own tooltip rather than a `title` attribute. The
 * charts are small now that the Report page fits them all on one screen, so
 * "which day was that, and when did I write it down" has to be answerable by
 * hovering — a native tooltip takes a second to appear, shows one grey line of
 * text and cannot say it in the app's own typography.
 */

export interface TrendPoint {
  label: string;
  /** secondary label — the tooltip's heading, e.g. "Monday, 3 August" */
  sub?: string;
  /** the tooltip's third line: what else that day held, and when it was logged */
  detail?: string;
  /** null renders a gap — **a day with no data is not a zero** */
  value: number | null;
}

/**
 * The hovered point's own label, floated over the plot.
 *
 * `x`/`y` are percentages of the plot box — the same coordinate space the
 * charts already work in. The box flips below the point when the point sits too
 * high to fit above it, and stops shifting sideways at either edge, so it never
 * hangs off the chart no matter which point you land on.
 */
function ChartTooltip(props: {
  title: string;
  value: string;
  detail?: string;
  x: number;
  y: number;
}) {
  const shift = () =>
    props.x < 25 ? 'translate-x-0' : props.x > 75 ? '-translate-x-full' : '-translate-x-1/2';
  // the underscores are Tailwind's spaces — calc() is invalid CSS without them
  const lift = () => (props.y < 42 ? 'translate-y-2' : '-translate-y-[calc(100%_+_0.5rem)]');

  return (
    <div
      role="tooltip"
      class={`pointer-events-none absolute z-30 w-max max-w-[12rem] rounded-lg border border-primary/30 bg-card px-2.5 py-1.5 card-shadow animate-fade-in ${shift()} ${lift()}`}
      style={{ left: `${props.x}%`, top: `${props.y}%` }}
    >
      <p class="text-[0.625rem] font-bold font-space leading-tight">{props.title}</p>
      <p class="text-xs font-mono text-primary leading-tight mt-0.5">{props.value}</p>
      <Show when={props.detail}>
        <p class="text-[0.625rem] text-muted-foreground leading-snug mt-0.5">{props.detail}</p>
      </Show>
    </div>
  );
}

/** one hover strip per data point, laid over the plot so the whole column reacts */
function HoverColumns(props: { count: number; onHover: (index: number | null) => void }) {
  return (
    <div class="absolute inset-0 flex" onMouseLeave={() => props.onHover(null)}>
      <For each={Array.from({ length: props.count }, (_, i) => i)}>
        {(i) => <div class="flex-1 h-full" onMouseEnter={() => props.onHover(i)} />}
      </For>
    </div>
  );
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export function TrendChart(props: {
  data: TrendPoint[];
  max: number;
  color?: string;
  height?: number;
  unit?: string;
  /** the date strip under the plot — off when two charts share one small tile */
  showLabels?: boolean;
}) {
  const [hover, setHover] = createSignal<number | null>(null);

  const color = () => props.color ?? 'hsl(var(--primary))';
  const unit = () => props.unit ?? '';
  const safeMax = () => (props.max > 0 ? props.max : 1);
  const n = () => props.data.length;

  const x = (i: number) => (n() <= 1 ? 50 : (i / (n() - 1)) * 100);
  const y = (v: number) => 100 - (Math.max(0, Math.min(safeMax(), v)) / safeMax()) * 100;

  /**
   * Split into runs of consecutive non-null points, so a missing day breaks the
   * line instead of being interpolated across. The gap *is* the information:
   * joining 3 August to 6 August with a straight segment would draw two days
   * that never happened.
   */
  const runs = createMemo(() => {
    const out: { i: number; v: number }[][] = [];
    let run: { i: number; v: number }[] = [];
    props.data.forEach((p, i) => {
      if (p.value === null) {
        if (run.length) out.push(run);
        run = [];
      } else {
        run.push({ i, v: p.value });
      }
    });
    if (run.length) out.push(run);
    return out;
  });

  // Two TrendCharts on one page would otherwise share a gradient id and the
  // second would paint with the first's colour.
  const gradientId = createMemo(
    () =>
      `trend-${Math.abs(
        props.data.reduce((h, p) => (h * 31 + (p.label.charCodeAt(0) || 0)) | 0, 7),
      )}`,
  );

  const hovered = () => {
    const i = hover();
    if (i === null) return null;
    const p = props.data[i];
    return p && p.value !== null ? { i, p, v: p.value } : null;
  };

  return (
    <div class="w-full">
      <div class="relative w-full" style={{ height: `${props.height ?? 150}px` }}>
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          class="absolute inset-0 w-full h-full overflow-visible"
        >
          <defs>
            <linearGradient id={gradientId()} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color={color()} stop-opacity="0.28" />
              <stop offset="100%" stop-color={color()} stop-opacity="0" />
            </linearGradient>
          </defs>

          <For each={[0, 25, 50, 75, 100]}>
            {(g) => (
              <line
                x1="0"
                x2="100"
                y1={g}
                y2={g}
                stroke="hsl(var(--border))"
                stroke-width="1"
                vector-effect="non-scaling-stroke"
              />
            )}
          </For>

          <For each={runs()}>
            {(r) => {
              const line = r.map((p) => `${x(p.i)},${y(p.v)}`).join(' L ');
              return (
                <g>
                  <Show when={r.length > 1}>
                    <path
                      d={`M ${x(r[0].i)},100 L ${line} L ${x(r[r.length - 1].i)},100 Z`}
                      fill={`url(#${gradientId()})`}
                    />
                  </Show>
                  <path
                    d={`M ${line}`}
                    fill="none"
                    stroke={color()}
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    vector-effect="non-scaling-stroke"
                  />
                </g>
              );
            }}
          </For>
        </svg>

        <For each={props.data}>
          {(p, i) => (
            <Show when={p.value !== null}>
              <div
                class={`absolute w-2 h-2 -ml-1 -mt-1 rounded-full border-2 border-card transition-transform ${
                  hover() === i() ? 'scale-150' : ''
                }`}
                style={{
                  left: `${x(i())}%`,
                  top: `${y(p.value as number)}%`,
                  background: color(),
                }}
              />
            </Show>
          )}
        </For>

        {/* The strips sit above the dots, so a dot's hover state is driven by
            the signal instead — otherwise landing on an 8px dot would be the
            only way to read a point. */}
        <HoverColumns count={n()} onHover={setHover} />

        <Show when={hovered()}>
          {(h) => (
            <ChartTooltip
              title={h().p.sub ?? h().p.label}
              value={`${round1(h().v)}${unit()}`}
              detail={h().p.detail}
              x={x(h().i)}
              y={y(h().v)}
            />
          )}
        </Show>
      </div>

      <Show when={props.showLabels ?? true}>
        <div class="flex justify-between mt-2">
          <For each={props.data}>
            {(p, i) => (
              <span class="text-[0.5625rem] text-muted-foreground font-mono flex-1 text-center truncate">
                {n() > 14 && i() % 3 !== 0 ? '' : p.label}
              </span>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}

export interface BarPoint {
  label: string;
  /** the tooltip's heading, e.g. "Monday, 3 August" */
  sub?: string;
  /** the tooltip's third line: what else that day held, and when it was logged */
  detail?: string;
  value: number;
  /** tailwind bg class; falls back to primary */
  class?: string;
}

export function BarChart(props: {
  data: BarPoint[];
  max: number;
  height?: number;
  unit?: string;
  /** the date strip under the bars — off when two charts share one small tile */
  showLabels?: boolean;
}) {
  const [hover, setHover] = createSignal<number | null>(null);

  const unit = () => props.unit ?? '';
  const safeMax = () => (props.max > 0 ? props.max : 1);
  const n = () => props.data.length;

  /** the middle of a bar's column, as a percentage of the plot */
  const centre = (i: number) => ((i + 0.5) / Math.max(1, n())) * 100;
  const topOf = (v: number) => 100 - Math.min(100, (Math.max(0, v) / safeMax()) * 100);

  const hovered = () => {
    const i = hover();
    return i === null ? null : props.data[i] ? { i, p: props.data[i] } : null;
  };

  return (
    <div class="w-full">
      <div
        class="relative flex items-end gap-1 w-full"
        onMouseLeave={() => setHover(null)}
        style={{ height: `${props.height ?? 150}px` }}
      >
        <For each={props.data}>
          {(p, i) => {
            const pct = () => (Math.max(0, p.value) / safeMax()) * 100;
            return (
              <div
                onMouseEnter={() => setHover(i())}
                class="flex-1 h-full flex items-end min-w-0"
              >
                {/* A bar for a real value is never allowed to vanish: 3% is the
                    floor, so "a little" reads differently from "none". */}
                <div
                  class={`w-full rounded-t-md transition-all ${
                    hover() === i() ? 'opacity-80' : ''
                  } ${p.class ?? 'bg-primary'}`}
                  style={{ height: `${Math.max(pct(), p.value > 0 ? 3 : 1)}%` }}
                />
              </div>
            );
          }}
        </For>

        <Show when={hovered()}>
          {(h) => (
            <ChartTooltip
              title={h().p.sub ?? h().p.label}
              value={`${round1(h().p.value)}${unit()}`}
              detail={h().p.detail}
              x={centre(h().i)}
              y={topOf(h().p.value)}
            />
          )}
        </Show>
      </div>

      <Show when={props.showLabels ?? true}>
        <div class="flex gap-1 mt-2">
          <For each={props.data}>
            {(p, i) => (
              <span class="text-[0.5625rem] text-muted-foreground font-mono flex-1 text-center truncate">
                {n() > 14 && i() % 3 !== 0 ? '' : p.label}
              </span>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}

export interface HBar {
  label: string;
  value: number;
  /** 0–100 */
  pct: number;
  class?: string;
  right?: string;
}

export function HBarList(props: { data: HBar[]; empty: string }) {
  return (
    <Show when={props.data.length > 0} fallback={<EmptyChart message={props.empty} />}>
      <div class="space-y-3">
        <For each={props.data}>
          {(d) => (
            <div class="space-y-1.5">
              <div class="flex justify-between text-xs font-medium gap-2">
                <span class="truncate">{d.label}</span>
                <span class="font-mono text-muted-foreground flex-shrink-0">
                  {d.right ?? d.value}
                </span>
              </div>
              <div class="w-full bg-background h-2.5 rounded-lg overflow-hidden">
                <div
                  class={`h-full rounded-lg transition-all ${d.class ?? 'bg-primary'}`}
                  style={{ width: `${Math.max(0, Math.min(100, d.pct))}%` }}
                />
              </div>
            </div>
          )}
        </For>
      </div>
    </Show>
  );
}

export interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

export function Donut(props: {
  segments: DonutSegment[];
  centerValue: string;
  centerLabel: string;
  size?: number;
}) {
  const R = 42;
  const CIRCUMFERENCE = 2 * Math.PI * R;

  /**
   * Each segment's arc length and where it starts.
   *
   * The React version accumulated `offset` inside the map callback, which
   * worked because the whole function re-ran on every render. Solid's `For`
   * body runs once per row, so the running total is computed here instead —
   * the arithmetic that depends on the rows before it cannot live inside a
   * per-row callback.
   */
  const arcs = createMemo(() => {
    const total = props.segments.reduce((s, x) => s + x.value, 0);
    if (total <= 0) return [];
    let offset = 0;
    return props.segments.map((s) => {
      const len = (s.value / total) * CIRCUMFERENCE;
      const arc = { ...s, dash: `${len} ${CIRCUMFERENCE - len}`, offset: -offset };
      offset += len;
      return arc;
    });
  });

  return (
    <div class="flex items-center gap-5 flex-wrap">
      <svg
        width={props.size ?? 132}
        height={props.size ?? 132}
        viewBox="0 0 100 100"
        class="flex-shrink-0 -rotate-90"
      >
        <circle cx="50" cy="50" r={R} fill="none" stroke="hsl(var(--muted))" stroke-width="13" />
        <For each={arcs()}>
          {(a) => (
            <circle
              cx="50"
              cy="50"
              r={R}
              fill="none"
              stroke={a.color}
              stroke-width="13"
              stroke-dasharray={a.dash}
              stroke-dashoffset={a.offset}
            />
          )}
        </For>
        {/* the svg is rotated a quarter turn so the arcs start at 12 o'clock;
            these two rotate back so the text reads horizontally */}
        <text
          x="50"
          y="47"
          text-anchor="middle"
          class="rotate-90"
          style={{ 'transform-origin': '50px 50px', fill: 'hsl(var(--foreground))' }}
          font-size="19"
          font-weight="700"
        >
          {props.centerValue}
        </text>
        <text
          x="50"
          y="61"
          text-anchor="middle"
          class="rotate-90"
          style={{ 'transform-origin': '50px 50px', fill: 'hsl(var(--muted-foreground))' }}
          font-size="8"
        >
          {props.centerLabel}
        </text>
      </svg>

      <div class="space-y-1.5 flex-1 min-w-0">
        <For each={props.segments}>
          {(s) => (
            <div class="flex items-center gap-2 text-xs">
              <span class="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: s.color }} />
              <span class="truncate flex-1">{s.label}</span>
              <span class="font-mono text-muted-foreground">{s.value}</span>
            </div>
          )}
        </For>
      </div>
    </div>
  );
}

/**
 * What a chart shows when it has nothing to show.
 *
 * It takes a written message rather than drawing an empty axis, because "no
 * papers logged yet" and "no mistakes in this range" are different facts and a
 * blank plot states neither. Every caller passes a sentence that says which one
 * it is — a fresh install is nothing but these, and they are the first thing
 * anyone reads.
 */
export function EmptyChart(props: { message: string; compact?: boolean }) {
  return (
    <div class={`text-center text-xs text-muted-foreground ${props.compact ? 'py-5' : 'py-12'}`}>
      {props.message}
    </div>
  );
}

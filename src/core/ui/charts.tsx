/**
 * Hand-rolled chart primitives.
 *
 * There is no chart library in this project and adding one would pull a large
 * dependency into a single-file build. These cover what the Growth Tracker
 * needs and are styled with the same CSS-variable tokens as everything else.
 *
 * Line charts stretch with `preserveAspectRatio="none"`, which would also
 * stretch the stroke — `vector-effect="non-scaling-stroke"` keeps it even, and
 * the dots are HTML positioned over the SVG so they stay circular.
 */

export interface TrendPoint {
  label: string;
  /** secondary label, shown in the dot tooltip */
  sub?: string;
  /** null renders a gap — a day with no data is not a zero */
  value: number | null;
}

export function TrendChart({
  data,
  max,
  color = 'hsl(var(--primary))',
  height = 150,
  unit = '',
}: {
  data: TrendPoint[];
  max: number;
  color?: string;
  height?: number;
  unit?: string;
}) {
  const safeMax = max > 0 ? max : 1;
  const n = data.length;
  const x = (i: number) => (n <= 1 ? 50 : (i / (n - 1)) * 100);
  const y = (v: number) => 100 - (Math.max(0, Math.min(safeMax, v)) / safeMax) * 100;

  // split into runs of consecutive non-null points so gaps stay gaps
  const runs: { i: number; v: number }[][] = [];
  let run: { i: number; v: number }[] = [];
  data.forEach((p, i) => {
    if (p.value === null) {
      if (run.length) runs.push(run);
      run = [];
    } else {
      run.push({ i, v: p.value });
    }
  });
  if (run.length) runs.push(run);

  const gradientId = `trend-${Math.abs(
    data.reduce((h, p) => (h * 31 + p.label.charCodeAt(0)) | 0, 7)
  )}`;

  return (
    <div className="w-full">
      <div className="relative w-full" style={{ height }}>
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="absolute inset-0 w-full h-full overflow-visible"
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.28" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>

          {[0, 25, 50, 75, 100].map((g) => (
            <line
              key={g}
              x1="0"
              x2="100"
              y1={g}
              y2={g}
              stroke="hsl(var(--border))"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
          ))}

          {runs.map((r, ri) => {
            const line = r.map((p) => `${x(p.i)},${y(p.v)}`).join(' L ');
            return (
              <g key={ri}>
                {r.length > 1 && (
                  <path
                    d={`M ${r[0] ? `${x(r[0].i)},100 L ` : ''}${line} L ${x(
                      r[r.length - 1].i
                    )},100 Z`}
                    fill={`url(#${gradientId})`}
                  />
                )}
                <path
                  d={`M ${line}`}
                  fill="none"
                  stroke={color}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
              </g>
            );
          })}
        </svg>

        {data.map((p, i) =>
          p.value === null ? null : (
            <div
              key={p.label + i}
              title={`${p.sub ?? p.label}: ${Math.round(p.value * 10) / 10}${unit}`}
              className="absolute w-2 h-2 -ml-1 -mt-1 rounded-full border-2 border-card hover:scale-150 transition-transform"
              style={{ left: `${x(i)}%`, top: `${y(p.value)}%`, background: color }}
            />
          )
        )}
      </div>

      <div className="flex justify-between mt-2">
        {data.map((p, i) => (
          <span
            key={p.label + i}
            className="text-[9px] text-muted-foreground font-mono flex-1 text-center truncate"
          >
            {n > 14 && i % 3 !== 0 ? '' : p.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export interface BarPoint {
  label: string;
  sub?: string;
  value: number;
  /** tailwind bg class; falls back to primary */
  className?: string;
}

export function BarChart({
  data,
  max,
  height = 150,
  unit = '',
}: {
  data: BarPoint[];
  max: number;
  height?: number;
  unit?: string;
}) {
  const safeMax = max > 0 ? max : 1;
  return (
    <div className="w-full">
      <div className="flex items-end gap-1 w-full" style={{ height }}>
        {data.map((p, i) => {
          const pct = (Math.max(0, p.value) / safeMax) * 100;
          return (
            <div
              key={p.label + i}
              title={`${p.sub ?? p.label}: ${Math.round(p.value * 10) / 10}${unit}`}
              className="flex-1 h-full flex items-end min-w-0 group"
            >
              <div
                className={`w-full rounded-t-md transition-all group-hover:opacity-80 ${
                  p.className ?? 'bg-primary'
                }`}
                style={{ height: `${Math.max(pct, p.value > 0 ? 3 : 1)}%` }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex gap-1 mt-2">
        {data.map((p, i) => (
          <span
            key={p.label + i}
            className="text-[9px] text-muted-foreground font-mono flex-1 text-center truncate"
          >
            {data.length > 14 && i % 3 !== 0 ? '' : p.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export interface HBar {
  label: string;
  value: number;
  /** 0–100 */
  pct: number;
  className?: string;
  right?: string;
}

export function HBarList({ data, empty }: { data: HBar[]; empty: string }) {
  if (data.length === 0) return <EmptyChart message={empty} />;
  return (
    <div className="space-y-3">
      {data.map((d) => (
        <div key={d.label} className="space-y-1.5">
          <div className="flex justify-between text-xs font-medium gap-2">
            <span className="truncate">{d.label}</span>
            <span className="font-mono text-muted-foreground flex-shrink-0">
              {d.right ?? d.value}
            </span>
          </div>
          <div className="w-full bg-background h-2.5 rounded-lg overflow-hidden">
            <div
              className={`h-full rounded-lg transition-all ${d.className ?? 'bg-primary'}`}
              style={{ width: `${Math.max(0, Math.min(100, d.pct))}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

export function Donut({
  segments,
  centerValue,
  centerLabel,
  size = 132,
}: {
  segments: DonutSegment[];
  centerValue: string;
  centerLabel: string;
  size?: number;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  const r = 42;
  const circumference = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div className="flex items-center gap-5 flex-wrap">
      <svg width={size} height={size} viewBox="0 0 100 100" className="flex-shrink-0 -rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth="13" />
        {total > 0 &&
          segments.map((s) => {
            const len = (s.value / total) * circumference;
            const dash = `${len} ${circumference - len}`;
            const el = (
              <circle
                key={s.label}
                cx="50"
                cy="50"
                r={r}
                fill="none"
                stroke={s.color}
                strokeWidth="13"
                strokeDasharray={dash}
                strokeDashoffset={-offset}
              />
            );
            offset += len;
            return el;
          })}
        <text
          x="50"
          y="47"
          textAnchor="middle"
          className="rotate-90"
          style={{ transformOrigin: '50px 50px', fill: 'hsl(var(--foreground))' }}
          fontSize="19"
          fontWeight="700"
        >
          {centerValue}
        </text>
        <text
          x="50"
          y="61"
          textAnchor="middle"
          className="rotate-90"
          style={{ transformOrigin: '50px 50px', fill: 'hsl(var(--muted-foreground))' }}
          fontSize="8"
        >
          {centerLabel}
        </text>
      </svg>
      <div className="space-y-1.5 flex-1 min-w-0">
        {segments.map((s) => (
          <div key={s.label} className="flex items-center gap-2 text-xs">
            <span
              className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
              style={{ background: s.color }}
            />
            <span className="truncate flex-1">{s.label}</span>
            <span className="font-mono text-muted-foreground">{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function EmptyChart({ message }: { message: string }) {
  return (
    <div className="text-center py-12 text-xs text-muted-foreground">{message}</div>
  );
}

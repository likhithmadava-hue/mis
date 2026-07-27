import type { AppMode, TrackId } from '../../core/db';
import { DAY_TARGET, MODE_META, TRACK_META, heat, type ScoredDay } from '../../core/scoring';

interface TrackSummaryProps {
  days: ScoredDay[];
  /** this mode's tracks, already ordered by priority */
  tracks: TrackId[];
  mode: AppMode;
}

/**
 * The heat grid: one row per track, one column per day, scored 0–10.
 *
 * A day with no log renders as a muted dash rather than a zero — a day you
 * didn't record and a day you wasted are not the same thing.
 */
export default function TrackSummary({ days, tracks, mode }: TrackSummaryProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-1" style={{ minWidth: days.length * 34 + 90 }}>
        <thead>
          <tr>
            <th className="text-left text-[10px] text-muted-foreground font-medium pr-2" />
            {days.map((d) => (
              <th key={d.date} className="text-[10px] text-muted-foreground font-medium">
                {d.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tracks.map((id) => (
            <tr key={id}>
              <td className="text-xs text-muted-foreground pr-2 whitespace-nowrap">
                {TRACK_META[id].label}
              </td>
              {days.map((d) => (
                <td key={d.date}>
                  <div
                    title={`${TRACK_META[id].label} · ${d.dateLabel}`}
                    className={`h-7 min-w-[26px] rounded-md border flex items-center justify-center text-[10px] font-mono font-bold ${
                      d.scores ? heat(d.scores[id]) : 'bg-muted/30 border-border text-transparent'
                    }`}
                  >
                    {d.scores ? Math.round(d.scores[id]) : '·'}
                  </div>
                </td>
              ))}
            </tr>
          ))}
          <tr>
            <td className="text-xs font-bold pr-2 whitespace-nowrap pt-1">{MODE_META[mode].label} Day</td>
            {days.map((d) => {
              const v = d.byMode?.[mode] ?? null;
              return (
                <td key={d.date} className="pt-1">
                  <div
                    title={d.dateLabel}
                    className={`h-7 min-w-[26px] rounded-md border flex items-center justify-center text-[10px] font-mono font-bold ${
                      v !== null ? heat((v / DAY_TARGET) * 10) : 'bg-muted/30 border-border text-transparent'
                    }`}
                  >
                    {v !== null ? v : '·'}
                  </div>
                </td>
              );
            })}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

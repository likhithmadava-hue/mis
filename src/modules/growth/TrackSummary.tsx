import { For, Show } from 'solid-js';

import { longDate, shortDate } from '../../core/dates';
import type { AppMode, ScoredDay, TrackId } from '../../core/db';
import { DAY_TARGET, heat, MODE_META, TRACK_META } from '../../core/scoring';

interface TrackSummaryProps {
  days: ScoredDay[];
  /** this mode's tracks, already ordered by priority */
  tracks: TrackId[];
  mode: AppMode;
}

const submittedAt = (d: ScoredDay) =>
  d.metric?.submitted_at
    ? ` · submitted ${new Date(d.metric.submitted_at).toLocaleTimeString([], {
        hour: 'numeric',
        minute: '2-digit',
      })}`
    : '';

/** the cell for a day that was never logged: a dash, never a zero */
const BLANK = 'bg-muted/30 border-border text-transparent';

/**
 * The heat grid: one row per track, one column per day, scored 0–10.
 *
 * A day with no log renders as a muted dash rather than a zero — **a day you
 * didn't record and a day you wasted are not the same thing**, and this grid is
 * the place where confusing them would be most misleading, because a row of
 * red reads as a bad fortnight rather than a fortnight away from the app.
 */
export default function TrackSummary(props: TrackSummaryProps) {
  return (
    /* A 30-day range is ~1100px of grid, which a narrow window will never fit.
       Rather than crushing the cells, the grid keeps its natural size and
       scrolls inside this box — and the track-label column is pinned left so
       you can still tell which row you are reading once it has scrolled. */
    <div class="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
      <table
        class="w-full border-separate border-spacing-1"
        style={{ 'min-width': `${props.days.length * 34 + 90}px` }}
      >
        <thead>
          <tr>
            <th class="sticky left-0 z-10 bg-card text-left text-[0.625rem] text-muted-foreground font-medium pr-2" />
            <For each={props.days}>
              {(d) => (
                <th class="text-[0.625rem] text-muted-foreground font-medium">
                  {shortDate(d.date)}
                </th>
              )}
            </For>
          </tr>
        </thead>
        <tbody>
          <For each={props.tracks}>
            {(id) => (
              <tr>
                <td class="sticky left-0 z-10 bg-card text-xs text-muted-foreground pr-2 whitespace-nowrap">
                  {TRACK_META[id].label}
                </td>
                <For each={props.days}>
                  {(d) => (
                    <td>
                      <div
                        title={`${TRACK_META[id].label} · ${longDate(d.date)}${submittedAt(d)}`}
                        class={`h-7 min-w-[26px] rounded-md border flex items-center justify-center text-[0.625rem] font-mono font-bold ${
                          d.scores ? heat(d.scores[id]) : BLANK
                        }`}
                      >
                        {d.scores ? Math.round(d.scores[id]) : '·'}
                      </div>
                    </td>
                  )}
                </For>
              </tr>
            )}
          </For>

          <tr>
            <td class="sticky left-0 z-10 bg-card text-xs font-bold pr-2 whitespace-nowrap pt-1">
              {MODE_META[props.mode].label} Day
            </td>
            <For each={props.days}>
              {(d) => {
                const v = () => d.by_mode?.[props.mode] ?? null;
                return (
                  <td class="pt-1">
                    <div
                      title={longDate(d.date)}
                      class={`h-7 min-w-[26px] rounded-md border flex items-center justify-center text-[0.625rem] font-mono font-bold ${
                        // the day total is out of 50, so it is rescaled to the
                        // 0–10 the heatmap speaks
                        v() !== null ? heat((v()! / DAY_TARGET) * 10) : BLANK
                      }`}
                    >
                      <Show when={v() !== null} fallback="·">
                        {v()}
                      </Show>
                    </div>
                  </td>
                );
              }}
            </For>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

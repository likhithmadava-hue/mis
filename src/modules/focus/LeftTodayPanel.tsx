import { ClipboardList } from 'lucide-solid';
import { For, Show } from 'solid-js';
import { Dynamic } from 'solid-js/web';

import type { RemainingItem } from './todayProgress';

interface LeftTodayPanelProps {
  remaining: RemainingItem[];
  allClear: boolean;
}

/** what's still outstanding — read-only; the Daily Log owns every number here */
export default function LeftTodayPanel(props: LeftTodayPanelProps) {
  return (
    <div class="bg-card rounded-2xl border border-border card-shadow p-6 space-y-4">
      <div class="flex items-center justify-between gap-2">
        <h3 class="text-sm font-bold uppercase tracking-wider text-muted-foreground font-space flex items-center gap-2">
          <ClipboardList size={16} class="text-primary" /> Left Today
        </h3>
        <Show when={props.allClear}>
          <span class="text-[0.625rem] uppercase font-bold px-2 py-0.5 rounded-full bg-success/15 text-success border border-success/40">
            All clear
          </span>
        </Show>
      </div>

      <div class="space-y-3">
        <For each={props.remaining}>
          {(item) => {
            const cleared = () => item.left === 0;
            // Nothing assigned is not the same as nothing left. A dash says "you
            // set no DPPs today"; a green zero would claim you finished them.
            const nothingSet = () => item.total === 0;
            const pct = () => (item.total > 0 ? ((item.total - item.left) / item.total) * 100 : 0);
            // The round on the clock, as a ghost ahead of the banked bar. Capped
            // at the space that is actually left so an over-run round cannot
            // push the bar past full.
            const livePct = () => {
              const live = item.live?.() ?? 0;
              if (live <= 0 || item.total <= 0) return 0;
              return Math.min((live / item.total) * 100, 100 - pct());
            };
            return (
              <div class="space-y-1.5">
                <div class="flex items-center gap-2">
                  <Dynamic
                    component={item.icon}
                    size={14}
                    class={cleared() && !nothingSet() ? 'text-success' : 'text-muted-foreground'}
                  />
                  <span class="text-xs flex-1 min-w-0 truncate">{item.label}</span>
                  <span
                    class={`text-sm font-bold font-mono flex-shrink-0 ${
                      nothingSet()
                        ? 'text-muted-foreground/50'
                        : cleared()
                          ? 'text-success'
                          : 'text-foreground'
                    }`}
                  >
                    {nothingSet() ? '—' : `${item.left}${item.unit}`}
                  </span>
                </div>
                <div class="w-full bg-background h-1.5 rounded-full overflow-hidden flex">
                  <div
                    class={`h-full transition-all ${cleared() ? 'bg-success' : 'bg-primary'}`}
                    style={{ width: `${pct()}%` }}
                  />
                  <Show when={livePct() > 0}>
                    <div
                      class="h-full bg-primary/30 transition-all"
                      style={{ width: `${livePct()}%` }}
                    />
                  </Show>
                </div>
                <p class="text-[0.625rem] text-muted-foreground font-mono">
                  {nothingSet() ? 'nothing set for today' : item.done}
                </p>
                <Show when={!nothingSet() && item.note?.()}>
                  {(note) => <p class="text-[0.625rem] text-primary font-mono">{note()}</p>}
                </Show>
              </div>
            );
          }}
        </For>
      </div>

      <p class="text-[0.625rem] text-muted-foreground border-t border-border pt-3">
        Read-only — change any of these in the Daily Log.
      </p>
    </div>
  );
}

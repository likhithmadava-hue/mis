import { Show } from 'solid-js';

import type { FocusSession } from '../../core/db';
import type { RemainingItem } from './todayProgress';

interface DailyProgressPanelProps {
  sessions: FocusSession[];
  minutes: number;
  /** the study-hours row of `createTodayProgress`; absent only if that ever changes */
  study?: RemainingItem;
}

const Stat = (props: { value: string | number; label: string; lit: boolean }) => (
  <div class="px-2 text-center">
    <p class={`text-2xl sm:text-3xl font-bold font-mono tabular-nums ${props.lit ? 'text-success' : ''}`}>
      {props.value}
    </p>
    <p class="mt-1 text-[0.6875rem] uppercase tracking-wider font-bold text-muted-foreground font-space">
      {props.label}
    </p>
  </div>
);

/**
 * What the timer has banked today — rounds, minutes, hours — and how far that
 * takes you toward the day's study target, in one card.
 *
 * This replaces three things that said overlapping things: the Today's Focus
 * tiles, the session list under them, and the study-hours and focus-rounds bars
 * of Left Today. The rounds bar is gone because it was the study bar divided by
 * the round length — the same fact in a second unit. The round on the clock still
 * shows as a ghost ahead of the solid fill, so a round in progress is visible
 * without being counted as banked.
 */
export default function DailyProgressPanel(props: DailyProgressPanelProps) {
  const study = () => props.study;
  // Nothing set is not the same as nothing done: with no target there is no bar
  // to fill, and a 0% bar would say you had failed at a goal you never made.
  const hasTarget = () => (study()?.total ?? 0) > 0;
  const solid = () => {
    const s = study();
    return s && s.total > 0 ? Math.min(100, ((s.total - s.left) / s.total) * 100) : 0;
  };
  const ghost = () => {
    const s = study();
    const live = s?.live?.() ?? 0;
    if (!s || live <= 0 || s.total <= 0) return 0;
    return Math.min((live / s.total) * 100, 100 - solid());
  };

  return (
    <section
      aria-labelledby="daily-progress-title"
      class="bg-card rounded-2xl border border-border card-shadow p-6"
    >
      <div class="flex items-baseline justify-between gap-4">
        <h3 id="daily-progress-title" class="text-base font-bold font-space">
          Daily progress
        </h3>
        <p class="text-xs text-muted-foreground font-mono tabular-nums">
          {hasTarget()
            ? study()!.done
            : props.sessions.length === 0
              ? 'no rounds yet — plant your first tree 🌱'
              : 'no study target set'}
        </p>
      </div>

      <div class="mt-4 grid grid-cols-3 divide-x divide-border">
        <Stat value={props.sessions.length} label="Sessions" lit={props.sessions.length > 0} />
        <Stat value={props.minutes} label="Minutes" lit={props.minutes > 0} />
        <Stat
          value={(Math.round((props.minutes / 60) * 10) / 10).toFixed(1)}
          label="Hours"
          lit={props.minutes > 0}
        />
      </div>

      <div
        class="mt-4 h-2 rounded-full bg-background overflow-hidden flex"
        role="progressbar"
        aria-label="Progress toward today's study target"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(solid())}
      >
        <div class="h-full bg-primary transition-all" style={{ width: `${solid()}%` }} />
        <Show when={ghost() > 0}>
          <div class="h-full bg-primary/30 transition-all" style={{ width: `${ghost()}%` }} />
        </Show>
      </div>

    </section>
  );
}

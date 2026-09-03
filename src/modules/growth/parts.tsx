import { Dynamic } from 'solid-js/web';

import type { Icon } from '../../core/ui';

/**
 * The small pieces the two decks and the headline share.
 *
 * They live here rather than in core/ui because none of them is a chart or a
 * general control — they are the Growth Tracker's own vocabulary for "a
 * labelled bar" and "a number with a caption", and both decks draw them.
 */

/** a labelled progress bar — the gate benchmarks and the topic backlog */
export function Meter(props: {
  label: string;
  right: string;
  /** 0–100 */
  pct: number;
  class?: string;
}) {
  return (
    <div class="space-y-1.5">
      <div class="flex justify-between text-xs font-medium gap-2">
        <span class="truncate">{props.label}</span>
        <span class="font-mono text-muted-foreground flex-shrink-0">{props.right}</span>
      </div>
      <div class="w-full bg-background h-2.5 rounded-lg overflow-hidden">
        <div
          class={`h-full rounded-lg transition-all ${props.class ?? 'bg-primary'}`}
          style={{ width: `${Math.max(0, Math.min(100, props.pct))}%` }}
        />
      </div>
    </div>
  );
}

/** a boxed number with a caption, for the stat strips */
export function Stat(props: { label: string; value: string; tone?: string }) {
  return (
    <div class="p-2.5 bg-background rounded-xl border border-border">
      <span class="text-xs text-muted-foreground uppercase tracking-wider">{props.label}</span>
      <p class={`text-lg font-bold font-space ${props.tone ?? ''}`}>{props.value}</p>
    </div>
  );
}

/** the headline stat pills beside the score ring */
export function HeadlineStat(props: {
  icon: Icon;
  label: string;
  value: string | number;
  sub: string;
}) {
  return (
    <div class="p-2.5 sm:p-3 bg-background border border-border rounded-xl flex items-center gap-2.5 min-w-0 transition-colors hover:border-primary/30">
      <div class="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
        <Dynamic component={props.icon} size={15} class="text-primary" />
      </div>
      <div class="min-w-0">
        <p class="text-xs uppercase tracking-wider font-bold text-muted-foreground truncate">
          {props.label}
        </p>
        <p class="font-bold font-space leading-tight">
          <span class="text-xl">{props.value}</span>{' '}
          <span class="text-xs font-mono font-normal text-muted-foreground">{props.sub}</span>
        </p>
      </div>
    </div>
  );
}

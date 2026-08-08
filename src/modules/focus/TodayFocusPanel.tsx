import { Flame } from 'lucide-solid';
import { For, Show } from 'solid-js';

import type { FocusSession } from '../../core/db';

interface TodayFocusPanelProps {
  sessions: FocusSession[];
  minutes: number;
}

/** what you've already banked today: rounds completed and minutes logged */
export default function TodayFocusPanel(props: TodayFocusPanelProps) {
  return (
    <div class="bg-card rounded-2xl border border-border card-shadow p-6 space-y-4">
      <h3 class="text-sm font-bold uppercase tracking-wider text-muted-foreground font-space flex items-center gap-2">
        <Flame size={16} class="text-primary" /> Today's Focus
      </h3>

      <div class="grid grid-cols-2 gap-3">
        <div
          class={`p-4 rounded-xl border text-center ${
            props.sessions.length > 0
              ? 'bg-success/5 border-success/40'
              : 'bg-background border-border'
          }`}
        >
          <p class="text-[0.625rem] uppercase tracking-wider font-bold text-muted-foreground">
            Sessions
          </p>
          <p class={`text-2xl font-bold font-space ${props.sessions.length > 0 ? 'text-success' : ''}`}>
            {props.sessions.length}
          </p>
        </div>
        <div
          class={`p-4 rounded-xl border text-center ${
            props.minutes > 0 ? 'bg-success/5 border-success/40' : 'bg-background border-border'
          }`}
        >
          <p class="text-[0.625rem] uppercase tracking-wider font-bold text-muted-foreground">
            Minutes
          </p>
          <p class={`text-2xl font-bold font-space ${props.minutes > 0 ? 'text-success' : ''}`}>
            {props.minutes}
          </p>
        </div>
      </div>

      <div class="space-y-1.5 max-h-52 overflow-y-auto pr-1">
        <Show
          when={props.sessions.length > 0}
          fallback={
            <p class="text-xs text-muted-foreground text-center py-6">
              No sessions yet today — plant your first tree. 🌱
            </p>
          }
        >
          <For each={props.sessions}>
            {(s) => (
              <div class="px-3 py-2 bg-background border border-border rounded-lg flex items-center justify-between gap-2">
                <span class="text-xs truncate" title={s.tag}>
                  {s.tag}
                </span>
                <span class="text-[0.6875rem] font-mono text-success font-bold flex-shrink-0">
                  {s.duration_minutes}m
                </span>
              </div>
            )}
          </For>
        </Show>
      </div>
    </div>
  );
}

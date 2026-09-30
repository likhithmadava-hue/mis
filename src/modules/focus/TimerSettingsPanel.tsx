import { Minus, Plus, Settings2 } from 'lucide-solid';
import { createEffect, createSignal, For, Show } from 'solid-js';

import type { FocusSettings } from '../../core/db';
import { viewState } from '../../core/ui';

export type NumericSetting = 'focus_minutes' | 'short_break' | 'long_break' | 'rounds_before_long';

interface TimerSettingsPanelProps {
  settings: FocusSettings;
  onUpdate: (key: NumericSetting, value: number) => void;
}

const FIELDS: [NumericSetting, string][] = [
  ['focus_minutes', 'Focus (min)'],
  ['short_break', 'Short break'],
  ['long_break', 'Long break'],
  ['rounds_before_long', 'Rounds → long'],
];

const MIN = 1;
const MAX = 180;

/**
 * A number with − and + around it.
 *
 * It keeps its own copy of the value on purpose, which is the one place in this
 * app that breaks the "no component keeps its own copy" rule. Every step is a
 * vault write followed by a reload, so two quick clicks would both read the same
 * stale stored number and land as one step. The copy makes the second click
 * build on the first; the effect pulls it back into line with whatever the
 * vault says once the write has landed (or was clamped).
 */
function Stepper(props: { label: string; value: number; onChange: (value: number) => void }) {
  const [shown, setShown] = createSignal(props.value);
  createEffect(() => setShown(props.value));

  const step = (delta: number) => {
    const next = Math.max(MIN, Math.min(MAX, shown() + delta));
    if (next === shown()) return;
    setShown(next);
    props.onChange(next);
  };

  return (
    <div role="group" aria-label={props.label}>
      <div class="text-[0.6875rem] uppercase tracking-wider font-bold text-muted-foreground font-space">
        {props.label}
      </div>
      <div class="mt-2 flex items-center rounded-xl border border-border overflow-hidden">
        <button
          type="button"
          onClick={() => step(-1)}
          disabled={shown() <= MIN}
          aria-label={`Decrease ${props.label}`}
          class="grid place-items-center w-10 h-10 text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-40 disabled:hover:bg-transparent"
        >
          <Minus size={14} />
        </button>
        <output class="flex-1 text-center font-mono tabular-nums text-base font-bold">
          {shown()}
        </output>
        <button
          type="button"
          onClick={() => step(1)}
          disabled={shown() >= MAX}
          aria-label={`Increase ${props.label}`}
          class="grid place-items-center w-10 h-10 text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-40 disabled:hover:bg-transparent"
        >
          <Plus size={14} />
        </button>
      </div>
    </div>
  );
}

/**
 * The four numbers that shape the cycle. They sit in the sidebar rather than in
 * a popover above the clock: set once, then forgotten, and out of sight the
 * moment the sidebar is on Tasks.
 *
 * The toggle is the same small gear icon it always was — not a full-width
 * header bar — so collapsed it costs almost no space; open or closed is
 * remembered.
 */
export default function TimerSettingsPanel(props: TimerSettingsPanelProps) {
  const [open, setOpen] = viewState<boolean>('focus.timerSettingsOpen', false);
  const summary = () =>
    `${props.settings.focus_minutes} / ${props.settings.short_break} / ${props.settings.long_break} min`;

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title={`Timer settings — ${summary()}`}
        aria-label="Timer settings"
        aria-expanded={open()}
        aria-controls="timer-settings-body"
        class={`grid place-items-center w-9 h-9 rounded-xl border transition-colors ${
          open()
            ? 'bg-primary/10 border-primary/40 text-primary'
            : 'bg-background border-border text-muted-foreground hover:text-primary hover:border-primary/40'
        }`}
      >
        <Settings2 size={15} />
      </button>

      <Show when={open()}>
        <section
          id="timer-settings-body"
          aria-label="Timer settings"
          class="mt-3 bg-card rounded-2xl border border-border card-shadow p-6 animate-fade-in"
        >
          <h3 class="text-base font-bold font-space">Timer settings</h3>
          <div class="mt-4 grid grid-cols-2 gap-x-6 gap-y-4">
            <For each={FIELDS}>
              {([key, label]) => (
                <Stepper
                  label={label}
                  value={props.settings[key]}
                  onChange={(v) => props.onUpdate(key, v)}
                />
              )}
            </For>
          </div>
        </section>
      </Show>
    </div>
  );
}

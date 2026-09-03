import { CircleDashed, LayoutGrid, Maximize, Minimize, Settings2 } from 'lucide-solid';
import { createSignal, For, Show } from 'solid-js';
import { Dynamic } from 'solid-js/web';

import type { FocusSettings, TimerDesign } from '../../core/db';
import { MODE_LABEL, type TimerMode } from './constants';

type NumericSetting = 'focus_minutes' | 'short_break' | 'long_break' | 'rounds_before_long';

interface TimerToolbarProps {
  mode: TimerMode;
  onSwitchMode: (m: TimerMode) => void;
  settings: FocusSettings;
  onSetDesign: (d: TimerDesign) => void;
  onUpdateSetting: (key: NumericSetting, value: number) => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
}

const MODES = ['focus', 'short', 'long'] as const;

const DESIGNS = [
  { id: 'ring', label: 'Ring', icon: CircleDashed },
  { id: 'flip', label: 'Flip', icon: LayoutGrid },
] as const;

const SETTING_FIELDS: [NumericSetting, string][] = [
  ['focus_minutes', 'Focus (min)'],
  ['short_break', 'Short Break'],
  ['long_break', 'Long Break'],
  ['rounds_before_long', 'Rounds → Long'],
];

/**
 * Everything above the clock: which phase you're in, which face it wears, and
 * the gear that opens the durations. The settings live behind that gear rather
 * than in a permanent card — they are set once and then forgotten, and a
 * pomodoro timer that shows you four number boxes while you work is asking you
 * to fiddle with them instead of studying.
 */
export default function TimerToolbar(props: TimerToolbarProps) {
  const [showSettings, setShowSettings] = createSignal(false);

  return (
    <>
      <div class="w-full flex flex-wrap items-center justify-center gap-3">
        <div class="flex bg-background p-1 rounded-xl border border-border gap-1">
          <For each={MODES}>
            {(m) => (
              <button
                onClick={() => props.onSwitchMode(m)}
                class={`px-4 py-1.5 rounded-lg text-xs font-semibold font-space transition-colors ${
                  props.mode === m
                    ? m === 'focus'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-success text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {MODE_LABEL[m]}
              </button>
            )}
          </For>
        </div>

        {/* clock face + fullscreen */}
        <div class="flex items-center gap-2">
          <div class="flex bg-background p-1 rounded-xl border border-border gap-1">
            <For each={DESIGNS}>
              {(d) => (
                <button
                  onClick={() => props.onSetDesign(d.id)}
                  title={`${d.label} clock`}
                  class={`px-2.5 py-1.5 rounded-lg text-xs font-semibold font-space flex items-center gap-1.5 transition-colors ${
                    props.settings.timer_design === d.id
                      ? 'bg-muted text-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Dynamic component={d.icon} size={13} /> {d.label}
                </button>
              )}
            </For>
          </div>

          <button
            onClick={props.onToggleFullscreen}
            title={props.isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            class="p-2 rounded-xl bg-background border border-border text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors"
          >
            <Show when={props.isFullscreen} fallback={<Maximize size={15} />}>
              <Minimize size={15} />
            </Show>
          </button>

          <button
            onClick={() => setShowSettings((s) => !s)}
            title={`Timer settings — ${props.settings.focus_minutes}/${props.settings.short_break}/${props.settings.long_break} min`}
            aria-expanded={showSettings()}
            class={`p-2 rounded-xl border transition-colors ${
              showSettings()
                ? 'bg-primary/10 border-primary/40 text-primary'
                : 'bg-background border-border text-muted-foreground hover:text-primary hover:border-primary/40'
            }`}
          >
            <Settings2 size={15} />
          </button>
        </div>
      </div>

      <Show when={showSettings()}>
        <div class="w-full p-4 bg-background border border-border rounded-xl animate-fade-in">
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <For each={SETTING_FIELDS}>
              {([key, label]) => (
                <div>
                  <label class="text-[0.625rem] text-muted-foreground block mb-1">{label}</label>
                  <input
                    type="number"
                    min={1}
                    max={180}
                    value={props.settings[key]}
                    onChange={(e) => props.onUpdateSetting(key, Number(e.currentTarget.value))}
                    class="w-full h-9 px-3 bg-card border border-border rounded-lg text-xs font-mono"
                  />
                </div>
              )}
            </For>
          </div>
        </div>
      </Show>
    </>
  );
}

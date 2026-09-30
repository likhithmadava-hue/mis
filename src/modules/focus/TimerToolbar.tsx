import { Maximize, Minimize } from 'lucide-solid';
import { Show } from 'solid-js';

import { Segmented } from '../../core/ui';
import { MODE_LABEL, type TimerMode } from './constants';

interface TimerToolbarProps {
  mode: TimerMode;
  onSwitchMode: (m: TimerMode) => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
}

const MODES = (['focus', 'short', 'long'] as const).map((value) => ({
  value,
  label: MODE_LABEL[value],
}));

/**
 * The top of the timer card: which phase you are in, directly above the clock
 * it controls, and the fullscreen toggle. The durations are not here — they are
 * set once and then forgotten, so they live with the other settings in the
 * sidebar, and a pomodoro timer never shows you four number boxes while you work.
 *
 * The switcher is centred on the card, so the grid's outer columns are the same
 * width: the button on the right is balanced by an empty cell on the left.
 */
export default function TimerToolbar(props: TimerToolbarProps) {
  return (
    <div class="grid grid-cols-[2.5rem_minmax(0,1fr)_2.5rem] items-center gap-2">
      <span aria-hidden="true" />
      <Segmented
        ariaLabel="Timer mode"
        class="w-full max-w-md justify-self-center"
        size="sm"
        options={MODES}
        value={props.mode}
        onChange={props.onSwitchMode}
        activeClass={(m) =>
          m === 'focus'
            ? 'bg-primary text-primary-foreground'
            : 'bg-success text-primary-foreground'
        }
      />
      <button
        type="button"
        onClick={props.onToggleFullscreen}
        title={props.isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
        aria-label={props.isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
        class="justify-self-end grid place-items-center w-10 h-10 rounded-xl bg-background border border-border text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors"
      >
        <Show when={props.isFullscreen} fallback={<Maximize size={15} />}>
          <Minimize size={15} />
        </Show>
      </button>
    </div>
  );
}

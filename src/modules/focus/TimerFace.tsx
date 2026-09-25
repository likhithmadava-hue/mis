import { createSignal, onCleanup } from 'solid-js';

import { MODE_LABEL, TREE_STAGES, type TimerMode } from './constants';

interface TimerFaceProps {
  mode: TimerMode;
  isRunning: boolean;
  /** the round on the clock — during a break, the one coming next */
  round: number;
  /** rounds in a cycle, i.e. how many focus rounds before the long break */
  roundsPerCycle: number;
  /** 0 → 1 through the current phase */
  progress: number;
  secondsLeft: number;
}

/** `25:00`, or `1:05:00` once a round is long enough to have hours */
function clockText(total: number): string {
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const two = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${two(m)}:${two(s)}` : `${two(m)}:${two(s)}`;
}

/**
 * The clock itself: the tree, one unified readout, a thin progress bar and one
 * status line. Purely visual — it never touches the countdown, it only draws
 * what it is handed.
 *
 * The readout is a single string in tabular mono rather than a tile per digit,
 * so it reads as a number and the colon never shifts as the digits change.
 * `cqw` / `cqh` are the width and height of the size container in `FocusTimer`;
 * the digits take whatever is left after the tree, bar, status line, task box,
 * controls and the gaps between them (about 15.5rem), which is what lets the face
 * grow with the window instead of guessing from it.
 *
 * The tree is the payoff for focusing and is kept on purpose: it grows through
 * `TREE_STAGES` as the round progresses, and is a cup during a break.
 */
export default function TimerFace(props: TimerFaceProps) {
  const isFocus = () => props.mode === 'focus';
  const treeStage = () =>
    TREE_STAGES[Math.min(TREE_STAGES.length - 1, Math.floor(props.progress * TREE_STAGES.length))];

  // Where in the cycle the round is, not how many have ever been played — the
  // counter on the timer only ever goes up.
  const position = () => ((props.round - 1) % Math.max(1, props.roundsPerCycle)) + 1;
  const started = () => props.progress > 0;

  const status = () => {
    if (props.isRunning) return isFocus() ? 'Locked in' : 'On break';
    return started() ? 'Paused' : 'Ready';
  };
  const lockedIn = () => props.isRunning && isFocus();

  const caption = () =>
    isFocus()
      ? `Round ${position()} of ${props.roundsPerCycle}`
      : `${MODE_LABEL[props.mode]} · round ${position()} next`;

  // The wall clock, not the countdown — the one thing fullscreen focus mode
  // otherwise hides is what time it actually is.
  const [now, setNow] = createSignal(new Date());
  const clockTimer = setInterval(() => setNow(new Date()), 1000);
  onCleanup(() => clearInterval(clockTimer));
  const wall = () => now().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div class="w-full flex flex-col items-center gap-2 sm:gap-3">
      <span
        class="text-[length:clamp(2rem,min(9cqw,8cqh),3.75rem)] leading-none"
        title="Your tree grows as you focus"
      >
        {isFocus() ? treeStage() : '☕'}
      </span>

      <div
        role="timer"
        aria-label={`${MODE_LABEL[props.mode]}, ${clockText(props.secondsLeft)} left`}
        class="font-mono font-bold leading-none tracking-tight tabular-nums text-foreground text-[length:clamp(3.5rem,min(22cqw,calc((100cqh-15.5rem)/1.1)),10rem)]"
      >
        {clockText(props.secondsLeft)}
      </div>

      <div class="w-full max-w-md h-1.5 rounded-full bg-background overflow-hidden" aria-hidden="true">
        <div
          class={`h-full rounded-full ${isFocus() ? 'bg-primary' : 'bg-success'}`}
          // linear, not eased: the bar is a clock, and an eased tick would read
          // as the time speeding up and slowing down
          style={{
            width: `${Math.min(100, props.progress * 100)}%`,
            transition: 'width 0.3s linear',
          }}
        />
      </div>

      <div class="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5">
        <span
          class={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-[0.6875rem] font-bold uppercase tracking-[0.14em] font-space transition-colors ${
            lockedIn()
              ? 'bg-primary/10 border-primary/30 text-primary'
              : 'bg-muted border-border text-muted-foreground'
          }`}
        >
          <span
            class={`w-2 h-2 rounded-full ${
              lockedIn()
                ? 'bg-primary motion-safe:animate-pulse'
                : props.isRunning
                  ? 'bg-success'
                  : 'bg-subtle-foreground'
            }`}
          />
          {status()}
        </span>
        <span class="text-xs text-muted-foreground">{caption()}</span>
        <span class="text-xs text-subtle-foreground font-mono tabular-nums" title="The time now">
          {wall()}
        </span>
      </div>
    </div>
  );
}

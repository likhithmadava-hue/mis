import { createSignal, onCleanup, Show } from 'solid-js';

import type { TimerDesign } from '../../core/db';
import FlipClock from './FlipClock';
import {
  MODE_LABEL,
  RING_CIRCUMFERENCE,
  RING_RADIUS,
  TREE_STAGES,
  type TimerMode,
} from './constants';

interface TimerFaceProps {
  design: TimerDesign;
  mode: TimerMode;
  round: number;
  /** 0 → 1 through the current phase */
  progress: number;
  isFocus: boolean;
  mm: string;
  ss: string;
  secondsLeft: number;
  isFullscreen: boolean;
}

/**
 * The clock itself, in whichever of the two faces is selected. Purely visual —
 * it never touches the countdown, it only draws the numbers it is handed.
 */
export default function TimerFace(props: TimerFaceProps) {
  const treeStage = () =>
    TREE_STAGES[Math.min(TREE_STAGES.length - 1, Math.floor(props.progress * TREE_STAGES.length))];
  const caption = () => `${MODE_LABEL[props.mode]} · Round ${props.round}`;

  // The wall clock, not the countdown — the one thing fullscreen focus mode
  // otherwise hides is what time it actually is.
  const [now, setNow] = createSignal(new Date());
  const clockTimer = setInterval(() => setNow(new Date()), 1000);
  onCleanup(() => clearInterval(clockTimer));
  const clock = () => now().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <Show
      when={props.design === 'flip'}
      fallback={
        /* The ring fills the space its card actually has. `cqw` / `cqh` are the
           width and height of the timer's container (the size-contained slot in
           FocusTimer), so the ring is whatever is left after the pill, tag box
           and buttons, plus room for the round-finished banner (about 16rem of them) — never a guess from the window
           height. That is what stops a card stretched by the taller right-hand
           column from leaving a band of empty space around a small clock.
           `--ring` is also what the digits and the tree scale from, so the whole
           face grows together. The viewBox keeps the geometry identical at every
           size, so the arc maths is untouched. */
        <div
          style={{ '--ring': 'clamp(12rem, min(100cqw, calc(100cqh - 16rem)), 40rem)' }}
          class="relative flex items-center justify-center w-[var(--ring)] aspect-square"
        >
          <svg viewBox="0 0 280 280" class="w-full h-full -rotate-90">
            <circle
              cx="140"
              cy="140"
              r={RING_RADIUS}
              fill="none"
              stroke="hsl(var(--muted))"
              stroke-width="12"
            />
            <circle
              cx="140"
              cy="140"
              r={RING_RADIUS}
              fill="none"
              stroke={props.isFocus ? 'hsl(var(--primary))' : 'hsl(var(--success))'}
              stroke-width="12"
              stroke-linecap="round"
              stroke-dasharray={String(RING_CIRCUMFERENCE)}
              stroke-dashoffset={String(RING_CIRCUMFERENCE * (1 - props.progress))}
              // linear, not eased: the ring is a clock, and an eased tick would
              // read as the time speeding up and slowing down
              style={{ transition: 'stroke-dashoffset 0.3s linear' }}
            />
          </svg>
          <div class="absolute inset-0 flex flex-col items-center justify-center">
            <span
              class="text-[length:calc(var(--ring)*0.13)] leading-none mb-1"
              title="Your tree grows as you focus"
            >
              {props.isFocus ? treeStage() : '☕'}
            </span>
            <span class="text-[length:calc(var(--ring)*0.19)] leading-none font-bold font-mono tracking-tight tabular-nums">
              {props.mm}:{props.ss}
            </span>
            <span class="text-[0.625rem] sm:text-xs uppercase tracking-widest font-bold text-muted-foreground mt-1 font-space">
              {caption()}
            </span>
            <span class="text-[0.625rem] text-subtle-foreground font-mono tabular-nums mt-0.5">
              {clock()}
            </span>
          </div>
        </div>
      }
    >
      <div class="flex flex-col items-center gap-4 py-2">
        <span
          class="text-[length:clamp(2.5rem,min(9cqw,10cqh),6rem)] leading-none"
          title="Your tree grows as you focus"
        >
          {props.isFocus ? treeStage() : '☕'}
        </span>
        {/* HH:MM:SS off the raw countdown — six tiles need a smaller step than
            the old four, and hours mean a 180-minute round no longer overflows
            the minutes pair */}
        <FlipClock
          totalSeconds={props.secondsLeft}
          // fluid, not a breakpoint jump: a fixed text-4xl/text-6xl pair only
          // swaps once at 640px, so every window width in between (and every
          // width within a size) looked frozen while resizing. Every tile
          // dimension in .flip-digit is in em off this one font-size, so a
          // clamp() here scales the whole clock continuously with the window.
          size="text-[length:clamp(1.25rem,min(8.5cqw,calc((100cqh-20rem)/1.5)),6rem)]"
        />
        <span class="text-xs uppercase tracking-widest font-bold text-muted-foreground font-space">
          {caption()}
        </span>
        <span class="text-[0.625rem] text-subtle-foreground font-mono tabular-nums -mt-2.5">
          {clock()}
        </span>
      </div>
    </Show>
  );
}

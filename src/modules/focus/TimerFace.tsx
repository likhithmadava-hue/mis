import { Show } from 'solid-js';

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

  return (
    <Show
      when={props.design === 'flip'}
      fallback={
        /* The ring caps at 280px but shrinks with the window — the viewBox keeps
           the geometry identical at every size, so the arc maths is untouched.
           A fixed 280×280 used to overflow its card in a narrow window. */
        <div
          class={`relative flex items-center justify-center transition-transform w-[min(17.5rem,70vw)] aspect-square ${
            props.isFullscreen ? 'scale-125 my-8' : ''
          }`}
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
            <span class="text-4xl sm:text-5xl mb-1" title="Your tree grows as you focus">
              {props.isFocus ? treeStage() : '☕'}
            </span>
            <span class="text-4xl sm:text-5xl font-bold font-mono tracking-tight tabular-nums">
              {props.mm}:{props.ss}
            </span>
            <span class="text-[0.625rem] sm:text-xs uppercase tracking-widest font-bold text-muted-foreground mt-1 font-space">
              {caption()}
            </span>
          </div>
        </div>
      }
    >
      <div class="flex flex-col items-center gap-4 py-2">
        <span
          class={props.isFullscreen ? 'text-6xl' : 'text-5xl'}
          title="Your tree grows as you focus"
        >
          {props.isFocus ? treeStage() : '☕'}
        </span>
        <FlipClock
          minutes={Math.floor(props.secondsLeft / 60)}
          seconds={props.secondsLeft % 60}
          sizeClass={props.isFullscreen ? 'text-5xl sm:text-7xl' : 'text-3xl sm:text-5xl'}
          colorClass={props.isFocus ? 'text-primary' : 'text-success'}
        />
        <span class="text-xs uppercase tracking-widest font-bold text-muted-foreground font-space">
          {caption()}
        </span>
      </div>
    </Show>
  );
}

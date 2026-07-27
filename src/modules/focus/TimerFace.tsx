import type { TimerDesign } from '../../core/db';
import FlipClock from './FlipClock';
import { MODE_LABEL, RING_CIRCUMFERENCE, RING_RADIUS, TREE_STAGES, type TimerMode } from './constants';

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
export default function TimerFace({
  design,
  mode,
  round,
  progress,
  isFocus,
  mm,
  ss,
  secondsLeft,
  isFullscreen,
}: TimerFaceProps) {
  const treeStage = TREE_STAGES[Math.min(TREE_STAGES.length - 1, Math.floor(progress * TREE_STAGES.length))];
  const caption = `${MODE_LABEL[mode]} · Round ${round}`;

  if (design === 'flip') {
    return (
      <div className="flex flex-col items-center gap-4 py-2">
        <span className={isFullscreen ? 'text-6xl' : 'text-5xl'} title="Your tree grows as you focus">
          {isFocus ? treeStage : '☕'}
        </span>
        <FlipClock
          minutes={Math.floor(secondsLeft / 60)}
          seconds={secondsLeft % 60}
          sizeClass={isFullscreen ? 'text-7xl' : 'text-5xl'}
          colorClass={isFocus ? 'text-primary' : 'text-success'}
        />
        <span className="text-xs uppercase tracking-widest font-bold text-muted-foreground font-space">
          {caption}
        </span>
      </div>
    );
  }

  return (
    <div className={`relative flex items-center justify-center transition-transform ${isFullscreen ? 'scale-125 my-8' : ''}`}>
      <svg width="280" height="280" className="-rotate-90">
        <circle cx="140" cy="140" r={RING_RADIUS} fill="none" stroke="hsl(var(--muted))" strokeWidth="12" />
        <circle
          cx="140"
          cy="140"
          r={RING_RADIUS}
          fill="none"
          stroke={isFocus ? 'hsl(var(--primary))' : 'hsl(var(--success))'}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={RING_CIRCUMFERENCE}
          strokeDashoffset={RING_CIRCUMFERENCE * (1 - progress)}
          style={{ transition: 'stroke-dashoffset 0.3s linear' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-5xl mb-1" title="Your tree grows as you focus">
          {isFocus ? treeStage : '☕'}
        </span>
        <span className="text-5xl font-bold font-mono tracking-tight tabular-nums">{mm}:{ss}</span>
        <span className="text-xs uppercase tracking-widest font-bold text-muted-foreground mt-1 font-space">
          {caption}
        </span>
      </div>
    </div>
  );
}

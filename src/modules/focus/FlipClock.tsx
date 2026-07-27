interface FlipClockProps {
  minutes: number;
  seconds: number;
  /** tailwind text-size class — lets the timer grow in fullscreen */
  sizeClass?: string;
  /** colour of the digits, so breaks can render green like the ring does */
  colorClass?: string;
}

/**
 * A split-flap style clock face — the alternative to the progress ring.
 *
 * Each digit is its own card. Giving the inner <span> a `key` of the digit
 * makes React throw the old element away whenever that digit changes, which
 * restarts the flip animation — so only the digits that actually changed
 * animate, not the whole clock every second.
 */
function Digit({ value, sizeClass, colorClass }: { value: string; sizeClass: string; colorClass: string }) {
  return (
    <div
      className="relative bg-background border border-border rounded-xl px-3 py-3 sm:px-4 sm:py-4 card-shadow overflow-hidden"
      style={{ perspective: '260px' }}
    >
      {/* the seam across the middle of a real split-flap tile */}
      <div className="absolute inset-x-0 top-1/2 h-px bg-border z-10" />
      <span
        key={value}
        className={`block font-mono font-bold tabular-nums leading-none animate-flip ${sizeClass} ${colorClass}`}
        style={{ transformOrigin: 'center top' }}
      >
        {value}
      </span>
    </div>
  );
}

export default function FlipClock({
  minutes,
  seconds,
  sizeClass = 'text-5xl',
  colorClass = 'text-foreground',
}: FlipClockProps) {
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');

  return (
    <div className="flex items-center gap-1.5 sm:gap-2">
      <Digit value={mm[0]} sizeClass={sizeClass} colorClass={colorClass} />
      <Digit value={mm[1]} sizeClass={sizeClass} colorClass={colorClass} />
      <span className={`font-mono font-bold ${sizeClass} ${colorClass} opacity-40 pb-1`}>:</span>
      <Digit value={ss[0]} sizeClass={sizeClass} colorClass={colorClass} />
      <Digit value={ss[1]} sizeClass={sizeClass} colorClass={colorClass} />
    </div>
  );
}

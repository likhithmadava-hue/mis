import { Show } from 'solid-js';

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
 * Each digit is its own card, and each one has to *re-mount* when its value
 * changes for the CSS flip animation to replay. React got that from a `key`;
 * Solid updates text in place and would never re-mount, so `<Show keyed>` on
 * the digit's own value does the same job explicitly. The upside is the same
 * either way: only the digits that actually changed animate, not the whole
 * clock every second.
 */
function Digit(props: { value: string; sizeClass: string; colorClass: string }) {
  return (
    <div
      class="relative bg-background border border-border rounded-xl px-2 py-2 sm:px-4 sm:py-4 card-shadow overflow-hidden"
      style={{ perspective: '260px' }}
    >
      {/* the seam across the middle of a real split-flap tile */}
      <div class="absolute inset-x-0 top-1/2 h-px bg-border z-10" />
      <Show when={props.value} keyed>
        {(value) => (
          <span
            class={`block font-mono font-bold tabular-nums leading-none animate-flip ${props.sizeClass} ${props.colorClass}`}
            style={{ 'transform-origin': 'center top' }}
          >
            {value}
          </span>
        )}
      </Show>
    </div>
  );
}

export default function FlipClock(props: FlipClockProps) {
  const mm = () => String(props.minutes).padStart(2, '0');
  const ss = () => String(props.seconds).padStart(2, '0');
  const size = () => props.sizeClass ?? 'text-5xl';
  const color = () => props.colorClass ?? 'text-foreground';

  return (
    <div class="flex items-center gap-1.5 sm:gap-2">
      <Digit value={mm()[0]} sizeClass={size()} colorClass={color()} />
      <Digit value={mm()[1]} sizeClass={size()} colorClass={color()} />
      <span class={`font-mono font-bold ${size()} ${color()} opacity-40 pb-1`}>:</span>
      <Digit value={ss()[0]} sizeClass={size()} colorClass={color()} />
      <Digit value={ss()[1]} sizeClass={size()} colorClass={color()} />
    </div>
  );
}

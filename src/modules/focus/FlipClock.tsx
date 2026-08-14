import { createEffect, createSignal, onCleanup, onMount, Show, type JSX } from 'solid-js';

import { playFlipTick } from './flipSound';

/** the flip reads as mechanical between roughly 450–650ms; below that it is a
 *  blur, above it the clock feels slow */
const DEFAULT_DURATION = 520;

/** does this machine want motion at all */
function prefersReducedMotion() {
  const [reduced, setReduced] = createSignal(
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  onMount(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReduced(mq.matches);
    mq.addEventListener('change', sync);
    onCleanup(() => mq.removeEventListener('change', sync));
  });
  return reduced;
}

interface FlipDigitProps {
  /** the digit to show */
  value: string | number;
  /** the digit to flip *from*; omit to let the tile track its own last value,
   *  which is what the clock below does — see the note at its call site */
  previousValue?: string | number;
  /** whole-flip duration in ms, split evenly between fold and fall */
  duration?: number;
  /** tailwind text-size class; the card, hinge and perspective all scale off it */
  size?: string;
  /** digit colour; white by default, like a departure board */
  colorClass?: string;
}

/**
 * One split-flap tile.
 *
 * The sequence is what sells it: the *old* top folds down over the *old*
 * bottom, and as it passes edge-on the *new* bottom falls the rest of the way.
 * So at rest the tile shows one digit, and mid-flip it legitimately shows two —
 * new above the seam, old below it — which is exactly what the eye reads as
 * mechanical. Anything that shows the new digit on both halves at once looks
 * like a crossfade no matter how it is animated.
 *
 * Only the two transient flap layers mount and unmount; the static halves are
 * permanent, so the digit is never blank for a frame.
 */
export function FlipDigit(props: FlipDigitProps) {
  const reduced = prefersReducedMotion();
  const duration = () => props.duration ?? DEFAULT_DURATION;
  const value = () => String(props.value);

  /** the digit currently at rest on the card */
  const [settled, setSettled] = createSignal(value());
  /** non-null only while a flip is in flight; a fresh object each time, so the
   *  keyed <Show> below remounts the flaps and restarts the CSS animation even
   *  if the previous one had not finished */
  const [flip, setFlip] = createSignal<{ from: string } | null>(null);

  let last = value();
  let timer: number | undefined;

  createEffect(() => {
    const next = value();
    if (next === last) return;

    const from = props.previousValue !== undefined ? String(props.previousValue) : last;
    last = next;
    setSettled(next);

    if (reduced()) {
      setFlip(null);
      return;
    }

    setFlip({ from });
    playFlipTick();
    // a change landing mid-flip restarts the animation rather than being cut
    // short by the outgoing digit's timer
    clearTimeout(timer);
    timer = window.setTimeout(() => setFlip(null), duration());
  });

  onCleanup(() => clearTimeout(timer));

  /** the half still showing the outgoing digit until the new flap lands on it */
  const bottomValue = () => flip()?.from ?? settled();

  return (
    <div
      class={`flip-digit ${props.size ?? 'text-5xl'} ${props.colorClass ?? 'text-foreground'}`}
      style={{ '--flip-dur': `${duration()}ms` } as JSX.CSSProperties}
    >
      <div class="flip-half flip-half--top">
        <div class="flip-glyph">{settled()}</div>
      </div>
      <div class="flip-half flip-half--bottom">
        <div class="flip-glyph">{bottomValue()}</div>
      </div>

      <div class="flip-seam" />

      <Show when={flip()} keyed>
        {(state) => (
          <>
            <div class="flip-half flip-half--top flip-flap flip-flap--top">
              <div class="flip-glyph">{state.from}</div>
              <div class="flip-shade" />
            </div>
            <div class="flip-half flip-half--bottom flip-flap flip-flap--bottom">
              <div class="flip-glyph">{settled()}</div>
              <div class="flip-shade" />
            </div>
          </>
        )}
      </Show>
    </div>
  );
}

/** the separator: two dots on the seam line, and never animated */
function Colon(props: { size: string; colorClass: string }) {
  const dot: JSX.CSSProperties = {
    width: '0.13em',
    height: '0.13em',
    background: 'currentColor',
  };
  return (
    <span
      class={`flex flex-none flex-col items-center justify-center gap-[0.22em] ${props.size} ${props.colorClass}`}
      style={{ height: '1.5em' }}
    >
      <i class="block rounded-full opacity-70" style={dot} />
      <i class="block rounded-full opacity-70" style={dot} />
    </span>
  );
}

interface FlipClockProps {
  /** the whole time to display, in seconds */
  totalSeconds: number;
  /** tailwind text-size class — lets the clock grow in fullscreen */
  size?: string;
  /** digit colour; white by default */
  colorClass?: string;
  duration?: number;
}

/**
 * HH:MM:SS across six independent tiles. Each tile decides for itself whether
 * it changed, so 19:24:19 → 19:24:20 flips the two seconds digits and leaves
 * the other four — and both colons — completely still.
 *
 * Note it does not hand each tile a `previousValue`: a parent-held "previous"
 * signal would be written by an effect that may run either side of the tiles'
 * own effects, and on the wrong side the tile flips from the value it is
 * already showing. Each tile tracking its own last value has no such ordering
 * hazard. The prop stays on FlipDigit for callers that drive it explicitly.
 */
export default function FlipClock(props: FlipClockProps) {
  const total = () => Math.max(0, Math.floor(props.totalSeconds));
  const hh = () => String(Math.floor(total() / 3600)).padStart(2, '0');
  const mm = () => String(Math.floor(total() / 60) % 60).padStart(2, '0');
  const ss = () => String(total() % 60).padStart(2, '0');

  const size = () => props.size ?? 'text-5xl';
  const color = () => props.colorClass ?? 'text-foreground';
  const cell = () => ({ size: size(), colorClass: color(), duration: props.duration });

  return (
    <div class="flex items-center justify-center gap-[0.12em] font-space">
      <FlipDigit value={hh()[0]} {...cell()} />
      <FlipDigit value={hh()[1]} {...cell()} />
      <Colon size={size()} colorClass={color()} />
      <FlipDigit value={mm()[0]} {...cell()} />
      <FlipDigit value={mm()[1]} {...cell()} />
      <Colon size={size()} colorClass={color()} />
      <FlipDigit value={ss()[0]} {...cell()} />
      <FlipDigit value={ss()[1]} {...cell()} />
    </div>
  );
}

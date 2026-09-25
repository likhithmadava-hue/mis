import { createEffect, createSignal, onCleanup } from 'solid-js';

/** blunter than the Home quote on purpose — this one is read mid-session */
export const LOCK_IN_QUOTES = [
  'Your future self is watching you right now through memories. Make them proud.',
  'Every minute you waste is time you will beg for later.',
  'Stop scrolling. Start building.',
  'Discipline is choosing between what you want now and what you want most.',
  'You don’t need motivation. You need execution.',
  'Someone with less talent is outworking you right now.',
  'Small daily wins compound into massive lifetime achievements.',
  'Lock in. The hard work you put in today pays off tomorrow.',
];

const ROTATE_MS = 12_000;
/** how long the old line takes to fade out before the next one swaps in */
const FADE_MS = 200;

/**
 * The line under the timer. It rotates by itself only while `active()` — a
 * round is running — so an idle tab is still and the words change exactly when
 * you are most likely to be looking for a reason to keep going.
 *
 * The fade is two-phase (fade out → swap text → fade in) rather than a
 * crossfade, so the line is never half of one quote and half of another.
 */
export function createLockInQuote(active: () => boolean) {
  const [index, setIndex] = createSignal(Math.floor(Math.random() * LOCK_IN_QUOTES.length));
  const [visible, setVisible] = createSignal(true);
  let swap: number | undefined;

  const next = () => {
    setVisible(false);
    clearTimeout(swap);
    swap = window.setTimeout(() => {
      setIndex((i) => (i + 1) % LOCK_IN_QUOTES.length);
      setVisible(true);
    }, FADE_MS);
  };

  createEffect(() => {
    if (!active()) return;
    const timer = setInterval(next, ROTATE_MS);
    onCleanup(() => clearInterval(timer));
  });
  onCleanup(() => clearTimeout(swap));

  return { quote: () => LOCK_IN_QUOTES[index()], visible, next };
}

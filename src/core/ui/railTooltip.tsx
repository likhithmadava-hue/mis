import { createSignal, onCleanup, Show, type JSX } from 'solid-js';
import { Portal } from 'solid-js/web';

/**
 * The hover label for an icon-only control in the collapsed rail.
 *
 * When the sidebar collapses, every label is `display: none` and the buttons
 * become bare icons — so this tooltip is the only thing left that says what a
 * button does. That makes it load-bearing rather than decorative, which is why
 * it is not a `title` attribute: a native tooltip waits about a second, renders
 * one line of grey system text and cannot use the app's own typography. The
 * charts made the same call for the same reason (see `charts.tsx`).
 *
 * **It must portal out of the rail.** The `aside` is `sm:overflow-y-auto`, and
 * CSS resolves the other axis from `visible` to `auto` as soon as one axis is
 * not `visible` — so the rail clips horizontally too. A tooltip positioned
 * `absolute` inside it is cut off at the rail's edge however high its z-index
 * goes. Rendering into `<body>` with `position: fixed` is what actually gets it
 * over the main content.
 *
 * One controller serves the whole rail: there is a single tooltip element that
 * moves to whichever control is hovered, not one per button.
 */

/** gap between the rail's edge and the tooltip, in px */
const GAP = 10;

/** where the tooltip sits: the anchor's vertical band, just past its right edge */
interface Anchor {
  left: number;
  top: number;
  height: number;
}

/**
 * `true` from Tailwind's `sm` breakpoint up — the only widths where the rail is
 * a vertical rail at all. Below it the sidebar is a stacked header whose labels
 * are always visible, so a tooltip there would point at text you can already
 * read. `navCollapsed` can still be `true` at that size, left over from a wider
 * window, which is why this is checked separately rather than assumed.
 */
function createIsRailWidth() {
  const query = window.matchMedia('(min-width: 640px)');
  const [wide, setWide] = createSignal(query.matches);

  const onChange = (e: MediaQueryListEvent) => setWide(e.matches);
  query.addEventListener('change', onChange);
  onCleanup(() => query.removeEventListener('change', onChange));

  return wide;
}

/**
 * Exactly the four handlers and nothing else.
 *
 * Deliberately not `JSX.HTMLAttributes<HTMLElement>`: that type also carries
 * `ref`, typed for a bare `HTMLElement`, which then refuses to spread onto a
 * `<button>` whose ref must be an `HTMLButtonElement`. Naming the handlers is
 * both narrower and honest about what the spread actually contributes.
 */
export type RailTooltipTrigger<T extends HTMLElement = HTMLElement> = Pick<
  JSX.HTMLAttributes<T>,
  'onMouseEnter' | 'onMouseLeave' | 'onFocus' | 'onBlur'
>;

export interface RailTooltip {
  /**
   * Spread onto each icon-only control: `{...tip.trigger('Daily Log')}`.
   * Focus opens it too, so the label is reachable by keyboard and not only by
   * mouse.
   */
  trigger: <T extends HTMLElement>(label: string) => RailTooltipTrigger<T>;
  /** Render once anywhere inside the rail — it portals to `<body>` regardless. */
  Tooltip: () => JSX.Element;
}

/**
 * @param collapsed the rail's collapsed signal — the tooltip is silent while the
 *        labels are visible, because then it would only repeat them.
 */
export function createRailTooltip(collapsed: () => boolean): RailTooltip {
  const atRailWidth = createIsRailWidth();
  const [label, setLabel] = createSignal('');
  const [anchor, setAnchor] = createSignal<Anchor | null>(null);

  const armed = () => collapsed() && atRailWidth();

  const open = (text: string, el: HTMLElement) => {
    if (!armed()) return;
    const rect = el.getBoundingClientRect();
    setLabel(text);
    // Measured off the trigger, so the tooltip tracks the rail rather than
    // assuming its width. `height` lets the box centre itself against the
    // button without measuring its own height first.
    setAnchor({ left: rect.right + GAP, top: rect.top, height: rect.height });
  };

  const close = () => setAnchor(null);

  // A fixed-position box measured once goes stale the moment anything scrolls
  // underneath it, and the rail is its own scroll container. Closing is the
  // honest response — a tooltip that has drifted off its button is worse than
  // no tooltip. Capture phase so it also sees the rail's own scrolling.
  const onAnyScroll = () => {
    if (anchor()) close();
  };
  window.addEventListener('scroll', onAnyScroll, true);
  onCleanup(() => window.removeEventListener('scroll', onAnyScroll, true));

  const trigger = <T extends HTMLElement>(text: string): RailTooltipTrigger<T> => ({
    onMouseEnter: (e) => open(text, e.currentTarget),
    onMouseLeave: close,
    onFocus: (e) => open(text, e.currentTarget),
    onBlur: close,
  });

  const Tooltip = () => (
    <Show when={armed() && anchor()}>
      {(at) => (
        <Portal>
          {/* the positioner: the anchor's own vertical band, so the label
              centres against the button with no height measurement and cannot
              drift off-screen vertically */}
          <div
            role="tooltip"
            class="pointer-events-none fixed z-50 flex items-center"
            style={{
              left: `${at().left}px`,
              top: `${at().top}px`,
              height: `${at().height}px`,
            }}
          >
            <div class="w-max max-w-[14rem] rounded-lg border border-primary/30 bg-card px-2.5 py-1.5 card-shadow animate-fade-in">
              <p class="text-xs font-semibold font-space leading-snug">{label()}</p>
            </div>
          </div>
        </Portal>
      )}
    </Show>
  );

  return { trigger, Tooltip };
}

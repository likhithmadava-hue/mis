import { ChevronLeft, ChevronRight, Maximize2, X } from 'lucide-solid';
import type { JSX } from 'solid-js';
import { onCleanup, onMount } from 'solid-js';
import { Dynamic } from 'solid-js/web';

import type { Icon } from './icon';

/**
 * The chart deck: small tiles that open full-page.
 *
 * The Growth Tracker used to be one long column of full-size cards — you
 * scrolled past four charts to reach the one you wanted. A panel now declares
 * itself once and renders at two sizes: `tile` for the grid, where the whole
 * page fits on one screen, and `full` for the zoom view, where it gets the
 * window to itself. Same data, same component, two densities — so a tile can
 * never drift out of step with the chart it previews.
 *
 * Zooming is a *double*-click. Single-click is left free because the tiles
 * answer questions on their own: hovering a point shows which day it was and
 * when it was logged, and a single click that swallowed the page every time you
 * reached for a data point would make the small charts unreadable. The corner
 * button still opens on one click, for touch and for the keyboard.
 */

export type PanelView = 'tile' | 'full';

export interface PanelDef {
  id: string;
  title: string;
  /** shown in the zoom view; the tile has no room for it */
  subtitle: string;
  icon: Icon;
  /** which dropdown set this panel belongs to */
  group: string;
  /** spans two columns — for panels that are wide by nature, like the heat grid */
  wide?: boolean;
  render: (view: PanelView) => JSX.Element;
}

/** the caption above one series inside a merged panel */
export function SeriesLabel(props: { children: JSX.Element }) {
  return (
    <p class="text-[0.6875rem] uppercase tracking-wider font-bold text-muted-foreground/80 mb-1">
      {props.children}
    </p>
  );
}

export function PanelTile(props: { panel: PanelDef; onOpen: () => void }) {
  return (
    /* Text here is already unselectable app-wide (see index.css), which is what
       keeps a double-click from highlighting the label it landed on. The button
       in the corner keeps the same action one click away, reachable by keyboard
       and named for screen readers. */
    <div
      onDblClick={props.onOpen}
      class={`group relative bg-card rounded-2xl border border-border card-shadow p-3 flex flex-col gap-2 cursor-zoom-in transition-colors hover:border-primary/40 ${
        props.panel.wide ? 'lg:col-span-2' : ''
      }`}
    >
      <div class="flex items-start justify-between gap-2">
        <h3 class="text-[0.6875rem] font-bold uppercase tracking-wider text-muted-foreground font-space flex items-center gap-1.5 min-w-0">
          <Dynamic component={props.panel.icon} size={12} class="text-primary flex-shrink-0" />
          <span class="truncate">{props.panel.title}</span>
        </h3>
        <button
          type="button"
          onClick={props.onOpen}
          title={`Open ${props.panel.title}`}
          aria-label={`Open ${props.panel.title} full page`}
          class="flex-shrink-0 p-1 -m-1 rounded-md text-muted-foreground/40 group-hover:text-primary transition-colors"
        >
          <Maximize2 size={13} />
        </button>
      </div>

      <div class="flex-1 min-w-0">{props.panel.render('tile')}</div>
    </div>
  );
}

interface PanelZoomProps {
  panel: PanelDef;
  /** 1-based position in the visible deck, for the "3 of 7" counter */
  position: number;
  total: number;
  onClose: () => void;
  /** -1 / +1 — walks the deck without going back to the grid */
  onStep: (direction: number) => void;
}

export function PanelZoom(props: PanelZoomProps) {
  // Esc closes and the arrows walk the deck, so the zoom view is usable without
  // going back to the mouse. Scrolling behind the overlay is locked — otherwise
  // the page underneath drifts while you read the chart.
  //
  // In Solid this is bound once on mount rather than re-bound whenever the
  // callbacks change: `props.onClose` is read at the moment the key is pressed,
  // so the handler is always current without the effect having to re-run.
  onMount(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') props.onClose();
      else if (e.key === 'ArrowRight') props.onStep(1);
      else if (e.key === 'ArrowLeft') props.onStep(-1);
    };
    document.addEventListener('keydown', onKey);

    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    onCleanup(() => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    });
  });

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={props.panel.title}
      class="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex flex-col animate-fade-in"
    >
      <header class="flex-shrink-0 border-b border-border px-4 sm:px-6 py-3 flex items-center gap-3">
        <div class="w-9 h-9 rounded-xl bg-primary/10 border border-primary/25 flex items-center justify-center flex-shrink-0">
          <Dynamic component={props.panel.icon} size={16} class="text-primary" />
        </div>
        <div class="min-w-0 flex-1">
          <h2 class="text-base font-bold font-space tracking-tight truncate">
            {props.panel.title}
          </h2>
          <p class="text-xs text-muted-foreground truncate">{props.panel.subtitle}</p>
        </div>

        <div class="flex items-center gap-1 flex-shrink-0">
          <button
            type="button"
            onClick={() => props.onStep(-1)}
            title="Previous chart"
            aria-label="Previous chart"
            class="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <ChevronLeft size={16} />
          </button>
          <span class="text-xs font-mono text-muted-foreground w-12 text-center">
            {props.position} / {props.total}
          </span>
          <button
            type="button"
            onClick={() => props.onStep(1)}
            title="Next chart"
            aria-label="Next chart"
            class="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <ChevronRight size={16} />
          </button>
          <button
            type="button"
            onClick={props.onClose}
            title="Close (Esc)"
            aria-label="Close"
            class="ml-1 p-2 rounded-lg bg-muted border border-border text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      </header>

      {/* overscroll-contain so reaching the end of a tall chart doesn't hand the
          wheel to the page underneath, which is its own scroll pane now */}
      <div class="flex-1 overflow-y-auto overscroll-contain px-4 sm:px-6 py-5">
        {/* bg-card, because panels like the heat grid pin a column against it */}
        <div class="max-w-5xl mx-auto bg-card rounded-2xl border border-border card-shadow p-4 sm:p-6">
          {props.panel.render('full')}
        </div>
        <p class="max-w-5xl mx-auto mt-3 text-xs text-muted-foreground/70 text-center">
          Hover any point for the day it belongs to · Esc to close · ← → for the next chart
        </p>
      </div>
    </div>
  );
}

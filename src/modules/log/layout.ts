import type { WidgetPlacement, WidgetSize } from '../../core/db';

/**
 * Merge a saved Daily Log card order against the tracks this mode actually
 * shows right now.
 *
 * A saved layout can go stale — a track dropped from a mode, or, after an app
 * update, a track added to one — and there is no vault migration for that.
 * Instead this runs on every render: cards still shown keep the order and
 * size the user last dragged them to, and any card not yet in the saved
 * layout (including, for most people, every card — nobody has dragged
 * anything yet) falls back to its default placement, appended in default
 * order.
 */
export function reconcileLayout(
  saved: WidgetPlacement[],
  defaults: WidgetPlacement[],
): WidgetPlacement[] {
  const defaultIds = new Set(defaults.map((d) => d.id));
  const known = saved.filter((p) => defaultIds.has(p.id));
  const knownIds = new Set(known.map((p) => p.id));
  const fresh = defaults.filter((d) => !knownIds.has(d.id));
  return [...known, ...fresh];
}

/** Move the item at `from` to sit at `to`, without mutating the input. */
export function moveItem<T>(list: T[], from: number, to: number): T[] {
  const next = list.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/** Step a card between its two snapped widths. */
export function cycleSize(size: WidgetSize): WidgetSize {
  return size === 'sm' ? 'lg' : 'sm';
}

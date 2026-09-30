import { createEffect, createSignal, onCleanup, type Accessor, type Setter } from 'solid-js';

/**
 * View state that outlives the component that shows it.
 *
 * Tabs are mounted and unmounted by the shell's `<Switch>`, so a plain
 * `createSignal` inside `Report` or `DatabaseExplorer` is thrown away every time
 * you leave the tab — open Mistake Analytics, glance at Home, come back, and the
 * Report has reset itself to Overview. The signal has to live somewhere that is
 * not the component.
 *
 * `viewState` is that place: a signal created once per `key` at module level
 * (so it survives unmounts), mirrored to localStorage (so it also survives a
 * restart). It is for *where you were looking* — the selected sub-view, a range,
 * a filter — never for data, which belongs in the vault.
 *
 * Use one key per piece of state, namespaced by screen: `report.range`,
 * `db.filter.subject`. Values must be JSON-serialisable.
 */

const PREFIX = 'mis.view.';
const cache = new Map<string, [Accessor<unknown>, Setter<unknown>]>();

const read = <T>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    // storage blocked or the stored value is corrupt — start from the default
    return fallback;
  }
};

const write = (key: string, value: unknown) => {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // remembering is a convenience; failing to remember must never break the tab
  }
};

/**
 * @param valid optional guard for the restored value. A stored option that no
 * longer exists (a chart group from an older build) falls back to `initial`
 * instead of selecting nothing.
 */
export function viewState<T>(
  key: string,
  initial: T,
  valid?: (value: T) => boolean,
): [Accessor<T>, Setter<T>] {
  const hit = cache.get(key);
  if (hit) return hit as unknown as [Accessor<T>, Setter<T>];

  const stored = read(key, initial);
  const [get, set] = createSignal<T>(valid && !valid(stored) ? initial : stored);

  const setAndRemember = ((next: T | ((prev: T) => T)) => {
    const value = set(next as never) as T;
    write(key, value);
    return value;
  }) as Setter<T>;

  const entry: [Accessor<T>, Setter<T>] = [get, setAndRemember];
  cache.set(key, entry as unknown as [Accessor<unknown>, Setter<unknown>]);
  return entry;
}

/**
 * The name of the sub-view a tab is showing ("Mistake analytics" inside
 * Report), for the shell's breadcrumb. Not persisted — the tab that owns the
 * sub-view republishes it every time it mounts.
 */
const [subViewLabel, setSubViewLabel] = createSignal<string | null>(null);
export { subViewLabel };

/** Publish a sub-view label for as long as the calling component is mounted. */
export function useSubViewLabel(label: () => string | null) {
  createEffect(() => setSubViewLabel(label()));
  onCleanup(() => setSubViewLabel(null));
}

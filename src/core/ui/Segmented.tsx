import type { JSX } from 'solid-js';
import { For } from 'solid-js';

export interface SegmentedOption<T extends string> {
  value: T;
  label: JSX.Element;
}

interface SegmentedProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  class?: string;
  /** classes for the selected segment; the accent fill by default */
  activeClass?: (value: T) => string;
  /** `md` is a page-level switch, `sm` sits inside a card */
  size?: 'sm' | 'md';
}

/**
 * A row of mutually exclusive choices where one is always selected — the timer
 * mode, the sidebar view, an audio channel.
 *
 * It is a tablist, so it behaves like one: only the selected segment is in the
 * tab order, and the arrow keys move the selection (and the focus with it).
 * Selection is controlled — the caller owns the value, which is what lets a
 * caller keep it in `viewState` and have it survive a tab switch.
 */
export default function Segmented<T extends string>(props: SegmentedProps<T>) {
  let root!: HTMLDivElement;

  const step = (e: KeyboardEvent, from: number, delta: number) => {
    e.preventDefault();
    const n = props.options.length;
    props.onChange(props.options[(from + delta + n) % n].value);
    // the newly selected segment is the one carrying tabindex 0 once Solid has run
    queueMicrotask(() => root.querySelector<HTMLElement>('[aria-selected="true"]')?.focus());
  };

  return (
    <div
      ref={root}
      role="tablist"
      aria-label={props.ariaLabel}
      class={`flex gap-1 p-1 rounded-xl bg-background border border-border ${props.class ?? ''}`}
    >
      <For each={props.options}>
        {(opt, i) => {
          const selected = () => props.value === opt.value;
          return (
            <button
              type="button"
              role="tab"
              aria-selected={selected()}
              tabindex={selected() ? 0 : -1}
              onClick={() => props.onChange(opt.value)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowRight') step(e, i(), 1);
                else if (e.key === 'ArrowLeft') step(e, i(), -1);
              }}
              class={`flex-1 min-w-0 rounded-lg font-semibold font-space transition-colors ${
                props.size === 'sm' ? 'px-2 py-2 text-xs' : 'px-3 py-2.5 text-sm'
              } ${
                selected()
                  ? (props.activeClass?.(opt.value) ?? 'bg-primary text-primary-foreground')
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              {opt.label}
            </button>
          );
        }}
      </For>
    </div>
  );
}

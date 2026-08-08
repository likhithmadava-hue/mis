import { For } from 'solid-js';

import { PRIORITIES, type Priority } from '../../core/db';

const PRIORITY_STYLE: Record<Priority, string> = {
  high: 'bg-primary/15 text-primary border-primary/40',
  medium: 'bg-muted text-foreground border-border',
  low: 'bg-muted/50 text-muted-foreground border-border',
};

/**
 * H / M / L. Priority does double duty everywhere it appears: it sets how much
 * something counts toward the day's score *and* how far up the page it sits.
 */
export default function PriorityPicker(props: {
  value: Priority;
  onChange: (p: Priority) => void;
}) {
  return (
    <div class="flex gap-1">
      <For each={PRIORITIES}>
        {(p) => (
          <button
            onClick={() => props.onChange(p)}
            title={`${p} priority`}
            class={`px-2 py-0.5 rounded-md text-[0.5625rem] uppercase font-bold tracking-wider border transition-colors ${
              props.value === p
                ? PRIORITY_STYLE[p]
                : 'bg-transparent text-muted-foreground/50 border-transparent hover:border-border'
            }`}
          >
            {p[0]}
          </button>
        )}
      </For>
    </div>
  );
}

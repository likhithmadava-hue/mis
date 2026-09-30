import { Inbox } from 'lucide-solid';
import { Show } from 'solid-js';
import { Dynamic } from 'solid-js/web';

import type { Icon } from './icon';
import { navigateTo } from './navigate';

export interface EmptyAction {
  label: string;
  /** a tab id to open, or a handler for anything that is not navigation */
  to?: string;
  onClick?: () => void;
}

interface EmptyStateProps {
  message: string;
  title?: string;
  icon?: Icon;
  action?: EmptyAction;
  /** tile-sized: smaller icon, tighter padding, no title */
  compact?: boolean;
}

/**
 * What a panel shows when it has nothing to draw.
 *
 * A bare sentence in an otherwise empty card reads as a broken chart. This
 * gives the gap a shape — an icon well, the reason, and the one action that
 * would fill it — so an empty panel looks like a designed state with a way
 * forward. It is deliberately distinct from `ComingSoon`: this is something you
 * can fix by logging data; that is something that does not exist yet.
 */
export default function EmptyState(props: EmptyStateProps) {
  const act = () => {
    const a = props.action;
    if (!a) return;
    if (a.onClick) a.onClick();
    else if (a.to) navigateTo(a.to);
  };

  return (
    <div
      class={`flex flex-col items-center justify-center text-center ${
        props.compact ? 'gap-2 py-4' : 'gap-3 py-12'
      }`}
    >
      <div
        class={`grid place-items-center rounded-xl bg-primary/10 border border-primary/20 text-primary ${
          props.compact ? 'w-8 h-8' : 'w-11 h-11'
        }`}
      >
        <Dynamic component={props.icon ?? Inbox} size={props.compact ? 15 : 20} />
      </div>
      <div class="max-w-xs">
        <Show when={props.title && !props.compact}>
          <p class="text-sm font-bold font-space">{props.title}</p>
        </Show>
        <p class="text-xs text-muted-foreground leading-relaxed">{props.message}</p>
      </div>
      <Show when={props.action}>
        {(a) => (
          <button
            type="button"
            onClick={act}
            // a double-click on a Report tile zooms it; the button must not
            // start that
            onDblClick={(e) => e.stopPropagation()}
            class={`rounded-lg bg-primary text-primary-foreground font-semibold font-space active:scale-95 transition-transform ${
              props.compact ? 'px-2.5 py-1 text-[0.6875rem]' : 'px-4 py-2 text-xs'
            }`}
          >
            {a().label}
          </button>
        )}
      </Show>
    </div>
  );
}

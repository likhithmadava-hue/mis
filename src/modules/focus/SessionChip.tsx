import { BookOpen } from 'lucide-solid';
import { Show } from 'solid-js';

import { reasonShort } from '../../core/scoring';
import type { SessionChoice } from './sessionChoice';

interface SessionChipProps {
  choice: SessionChoice | null;
  /** true while a focus round is counting down — changing the topic then would rewrite what is already running */
  locked: boolean;
  onChange: () => void;
}

/**
 * The one line under the clock that says what this round is for, with a button
 * to change it. It replaced a free-text box: what you are studying is now a
 * subject, a topic and a reason chosen in `SessionSetup`, so this only shows the
 * answer.
 *
 * Its height is fixed and the same whether or not anything is chosen, so picking
 * a topic never moves the clock or the buttons around it.
 */
export default function SessionChip(props: SessionChipProps) {
  const summary = () => {
    const c = props.choice;
    if (!c) return null;
    return `${c.subject} · ${c.chapter} · ${reasonShort(c.reason) ?? c.reason}`;
  };

  return (
    <div class="w-full max-w-sm h-11 px-3 flex items-center gap-2 bg-background border border-border rounded-xl">
      <BookOpen
        size={14}
        class={props.choice ? 'text-primary flex-shrink-0' : 'text-subtle-foreground flex-shrink-0'}
      />
      <Show
        when={summary()}
        fallback={
          <span class="flex-1 min-w-0 truncate text-xs text-muted-foreground">
            No topic yet — Start will ask what you are studying
          </span>
        }
      >
        {(text) => (
          <span
            class="flex-1 min-w-0 truncate text-xs text-foreground"
            title={props.choice?.reason_note ? `${text()} — ${props.choice.reason_note}` : text()}
          >
            {text()}
          </span>
        )}
      </Show>
      <button
        type="button"
        onClick={props.onChange}
        disabled={props.locked}
        title={props.locked ? 'Pause the timer to change what you are studying' : undefined}
        class="flex-shrink-0 text-xs font-semibold text-primary hover:underline disabled:text-subtle-foreground disabled:no-underline disabled:cursor-not-allowed"
      >
        {props.choice ? 'Change' : 'Choose'}
      </button>
    </div>
  );
}

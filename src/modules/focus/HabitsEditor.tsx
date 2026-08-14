import { Check, Plus, Trash2 } from 'lucide-solid';
import { createSignal, For, Show } from 'solid-js';

import type { FocusHabitsState } from './createFocusHabits';

/**
 * The habit list as it appears inside the timer's "Left Today" panel: tick,
 * add, remove. Deliberately smaller than the Daily Log's version — no priority
 * picker — because this is the mid-session view, and re-weighting a habit is a
 * planning decision, not something you do with a round on the clock.
 */
export default function HabitsEditor(props: { habits: FocusHabitsState }) {
  const habits = props.habits;
  const [draft, setDraft] = createSignal('');

  const submit = () => {
    void habits.addHabit(draft());
    setDraft('');
  };

  return (
    <div class="space-y-1.5 pt-1">
      <For
        each={habits.habits()}
        fallback={
          <p class="text-[0.625rem] text-muted-foreground font-mono py-1">
            No habits yet — add the first one below.
          </p>
        }
      >
        {(h) => {
          const done = () => habits.isDone(h.id);
          return (
            <div
              class={`group flex items-center gap-2 px-2 py-1.5 rounded-lg border transition-colors ${
                done() ? 'bg-success/5 border-success/30' : 'bg-background border-border'
              }`}
            >
              <button
                onClick={() => void habits.toggleHabit(h.id)}
                title={done() ? 'Untick' : 'Tick off'}
                class={`w-4 h-4 flex-shrink-0 rounded border flex items-center justify-center transition-colors ${
                  done()
                    ? 'bg-success/25 text-success border-success/50'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <Show when={done()}>
                  <Check size={10} stroke-width={3} />
                </Show>
              </button>
              <span
                class={`flex-1 min-w-0 truncate text-[0.6875rem] ${
                  done() ? 'text-muted-foreground line-through' : ''
                }`}
                title={h.name}
              >
                {h.name}
              </span>
              <button
                onClick={() => void habits.deleteHabit(h.id)}
                title="Remove habit"
                class="text-muted-foreground/40 hover:text-destructive transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
              >
                <Trash2 size={12} />
              </button>
            </div>
          );
        }}
      </For>

      <div class="flex gap-1.5 pt-0.5">
        <input
          value={draft()}
          onInput={(e) => setDraft(e.currentTarget.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="Add a habit…"
          class="flex-1 min-w-0 h-8 px-2.5 bg-background border border-border rounded-lg text-[0.6875rem]"
        />
        <button
          onClick={submit}
          class="h-8 px-2.5 bg-muted hover:bg-muted/80 border border-border rounded-lg text-[0.6875rem] font-semibold flex items-center gap-1 flex-shrink-0"
        >
          <Plus size={12} /> Add
        </button>
      </div>

      <Show when={habits.nudge()}>
        {(msg) => <p class="text-[0.625rem] text-warning font-mono pt-0.5">{msg()}</p>}
      </Show>
    </div>
  );
}

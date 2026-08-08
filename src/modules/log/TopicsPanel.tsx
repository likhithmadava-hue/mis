import { BookOpen, Check, PlusCircle, Trash2 } from 'lucide-solid';
import { createSignal, For, Show } from 'solid-js';

import type { TopicItem, TopicType } from '../../core/db';
import { Select, TOPIC_COLUMNS } from '../../core/ui';

interface TopicsPanelProps {
  topics: TopicItem[];
  onAdd: (name: string, type: TopicType) => void;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}

/**
 * The running backlog of what's been taught, what still needs revising, and
 * what still needs solving. Academic mode only — the Growth Tracker charts the
 * same three buckets as progress bars.
 */
export default function TopicsPanel(props: TopicsPanelProps) {
  const [name, setName] = createSignal('');
  const [type, setType] = createSignal<TopicType>('taught');

  const submit = (e: Event) => {
    e.preventDefault();
    if (!name().trim()) return;
    props.onAdd(name(), type());
    setName('');
  };

  return (
    <div class="bg-card rounded-2xl border border-border card-shadow p-6 space-y-4">
      <h3 class="text-sm font-bold uppercase tracking-wider text-muted-foreground font-space flex items-center gap-2 border-b border-border pb-3">
        <BookOpen size={16} class="text-primary" /> Topics
      </h3>

      <form onSubmit={submit} class="flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          placeholder="e.g. Physics — Work & Energy"
          value={name()}
          onInput={(e) => setName(e.currentTarget.value)}
          class="flex-1 h-9 px-3 bg-background border border-border rounded-xl text-xs"
        />
        <Select
          ariaLabel="Topic list"
          class="sm:w-44"
          value={type()}
          onChange={setType}
          options={TOPIC_COLUMNS.map((c) => ({ value: c.type, label: c.title }))}
        />
        <button
          type="submit"
          class="h-9 px-4 bg-primary text-primary-foreground font-semibold rounded-xl text-xs flex items-center justify-center gap-1"
        >
          <PlusCircle size={14} /> Add
        </button>
      </form>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
        <For each={TOPIC_COLUMNS}>
          {({ type: colType, title }) => {
            const items = () => props.topics.filter((t) => t.type === colType);
            const remaining = () => items().filter((t) => !t.done).length;
            return (
              <div class="p-3 bg-background border border-border rounded-xl space-y-2">
                <div class="flex items-center justify-between px-1">
                  <span class="text-[0.625rem] uppercase tracking-wider font-bold text-muted-foreground">
                    {title}
                  </span>
                  {/* "Taught" is a tally, the other two are backlogs — so one
                      counts up and the others count what is left. */}
                  <span
                    class={`text-[0.625rem] font-mono font-bold px-1.5 py-0.5 rounded ${
                      colType === 'taught'
                        ? 'bg-primary/10 text-primary'
                        : remaining() === 0 && items().length > 0
                          ? 'bg-success/15 text-success'
                          : 'bg-yellow-500/10 text-yellow-500'
                    }`}
                  >
                    {colType === 'taught' ? items().length : `${remaining()} left`}
                  </span>
                </div>

                <Show
                  when={items().length > 0}
                  fallback={
                    <p class="text-xs text-muted-foreground text-center py-5">Nothing here yet.</p>
                  }
                >
                  <div class="space-y-1.5 max-h-48 overflow-y-auto pr-0.5">
                    <For each={items()}>
                      {(t) => (
                        <div
                          class={`px-3 py-2 border rounded-lg flex items-center justify-between gap-2 group ${
                            t.done ? 'bg-success/5 border-success/30' : 'bg-card border-border'
                          }`}
                        >
                          <span
                            class={`text-xs flex-1 min-w-0 truncate ${
                              t.done ? 'line-through text-success' : ''
                            }`}
                            title={t.name}
                          >
                            {t.name}
                          </span>
                          <span class="flex items-center gap-1 flex-shrink-0">
                            <Show when={colType !== 'taught'}>
                              <button
                                onClick={() => props.onToggle(t.id)}
                                title={t.done ? 'Mark as not done' : 'Mark as done'}
                                class={`w-5 h-5 rounded border flex items-center justify-center ${
                                  t.done
                                    ? 'bg-success/20 border-success text-success'
                                    : 'bg-muted border-border text-muted-foreground hover:border-success/60 hover:text-success'
                                }`}
                              >
                                <Show when={t.done}>
                                  <Check size={11} stroke-width={3} />
                                </Show>
                              </button>
                            </Show>
                            <button
                              onClick={() => props.onDelete(t.id)}
                              title="Remove topic"
                              class="text-muted-foreground hover:text-destructive p-0.5 opacity-0 group-hover:opacity-100"
                            >
                              <Trash2 size={12} />
                            </button>
                          </span>
                        </div>
                      )}
                    </For>
                  </div>
                </Show>
              </div>
            );
          }}
        </For>
      </div>
    </div>
  );
}

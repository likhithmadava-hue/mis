import { Check, ListTodo, PlusCircle, Trash2 } from 'lucide-solid';
import { createSignal, For, Show } from 'solid-js';

import { shortDate, todayIso } from '../../core/dates';
import type { AppMode, Task } from '../../core/db';

interface TasksPanelProps {
  mode: AppMode;
  tasks: Task[];
  onAdd: (title: string, subject: string, dueDate: string) => void;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}

/**
 * A plain to-do list — one per mode, both built off the same `Task` shape.
 * Academic and Life never share a list (a DPP and a chore are not the same
 * kind of "done"), but neither needs its own component either: the only
 * difference is what the category field is called.
 *
 * Open items sort above done ones, soonest due date first; done items sink to
 * the bottom rather than vanishing, so ticking one off stays a small reward
 * instead of the item just disappearing.
 */
export default function TasksPanel(props: TasksPanelProps) {
  const [title, setTitle] = createSignal('');
  const [subject, setSubject] = createSignal('');
  const [dueDate, setDueDate] = createSignal('');

  const submit = (e: Event) => {
    e.preventDefault();
    if (!title().trim()) return;
    props.onAdd(title(), subject(), dueDate());
    setTitle('');
    setSubject('');
    setDueDate('');
  };

  const sorted = () =>
    [...props.tasks].sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      return (a.due_date || '9999-99-99').localeCompare(b.due_date || '9999-99-99');
    });

  const overdue = (t: Task) => !t.completed && t.due_date !== '' && t.due_date < todayIso();

  return (
    <div class="bg-card rounded-2xl border border-border card-shadow p-6 space-y-4">
      <h3 class="text-sm font-bold uppercase tracking-wider text-muted-foreground font-space flex items-center gap-2 border-b border-border pb-3">
        <ListTodo size={16} class="text-primary" /> To-Do
      </h3>

      <form onSubmit={submit} class="flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          placeholder="What needs doing?"
          value={title()}
          onInput={(e) => setTitle(e.currentTarget.value)}
          class="flex-1 h-9 px-3 bg-background border border-border rounded-xl text-xs"
        />
        <input
          type="text"
          placeholder={props.mode === 'academic' ? 'e.g. Physics' : 'e.g. Chores'}
          value={subject()}
          onInput={(e) => setSubject(e.currentTarget.value)}
          class="sm:w-32 h-9 px-3 bg-background border border-border rounded-xl text-xs"
        />
        <input
          type="date"
          value={dueDate()}
          onInput={(e) => setDueDate(e.currentTarget.value)}
          class="sm:w-40 h-9 px-3 bg-background border border-border rounded-xl text-xs text-muted-foreground"
        />
        <button
          type="submit"
          class="h-9 px-4 bg-primary text-primary-foreground font-semibold rounded-xl text-xs flex items-center justify-center gap-1"
        >
          <PlusCircle size={14} /> Add
        </button>
      </form>

      <Show
        when={sorted().length > 0}
        fallback={
          <p class="text-xs text-muted-foreground text-center py-5">Nothing on the list yet.</p>
        }
      >
        <div class="space-y-1.5 max-h-64 overflow-y-auto pr-0.5">
          <For each={sorted()}>
            {(t) => (
              <div
                class={`px-3 py-2 border rounded-lg flex items-center gap-2.5 group ${
                  t.completed
                    ? 'bg-success/5 border-success/30'
                    : overdue(t)
                      ? 'bg-destructive/5 border-destructive/30'
                      : 'bg-background border-border'
                }`}
              >
                <button
                  onClick={() => props.onToggle(t.id)}
                  title={t.completed ? 'Mark as not done' : 'Mark as done'}
                  class={`w-5 h-5 flex-shrink-0 rounded border flex items-center justify-center ${
                    t.completed
                      ? 'bg-success/20 border-success text-success'
                      : 'bg-muted border-border text-muted-foreground hover:border-success/60 hover:text-success'
                  }`}
                >
                  <Show when={t.completed}>
                    <Check size={11} stroke-width={3} />
                  </Show>
                </button>

                <span
                  class={`text-xs flex-1 min-w-0 truncate ${t.completed ? 'line-through text-success' : ''}`}
                  title={t.title}
                >
                  {t.title}
                </span>

                <Show when={t.subject}>
                  <span class="text-[0.625rem] px-1.5 py-0.5 rounded bg-muted text-muted-foreground flex-shrink-0">
                    {t.subject}
                  </span>
                </Show>

                <Show when={t.due_date}>
                  <span
                    class={`text-[0.625rem] font-mono flex-shrink-0 ${
                      overdue(t) ? 'text-destructive font-semibold' : 'text-muted-foreground'
                    }`}
                  >
                    {shortDate(t.due_date)}
                  </span>
                </Show>

                <button
                  onClick={() => props.onDelete(t.id)}
                  title="Remove task"
                  class="text-muted-foreground hover:text-destructive p-0.5 opacity-0 group-hover:opacity-100 flex-shrink-0"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}

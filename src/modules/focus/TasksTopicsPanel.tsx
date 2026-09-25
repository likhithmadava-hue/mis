import { Check, ClipboardList, ListChecks, ListTodo, Repeat } from 'lucide-solid';
import type { JSX } from 'solid-js';
import { For, Show } from 'solid-js';

import { shortDate } from '../../core/dates';
import { EmptyState, type Icon } from '../../core/ui';
import type { FocusHabitsState } from './createFocusHabits';
import type { TasksTopicsState } from './createTasksTopics';
import HabitsEditor from './HabitsEditor';

interface TasksTopicsPanelProps {
  data: TasksTopicsState;
  habits: FocusHabitsState;
  /** put a row's title in the "what are you working on" box */
  onFocus: (title: string) => void;
}

interface RowProps {
  checked: boolean;
  onToggle: () => void;
  title: string;
  meta?: string;
  onFocus: () => void;
}

/** one tickable line, with a button that hands its title to the timer */
function Row(props: RowProps) {
  return (
    <div
      class={`flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors ${
        props.checked ? 'bg-success/5 border-success/30' : 'bg-background border-border'
      }`}
    >
      <button
        type="button"
        role="checkbox"
        aria-checked={props.checked}
        aria-label={`${props.checked ? 'Mark not done' : 'Mark done'}: ${props.title}`}
        onClick={props.onToggle}
        class={`w-5 h-5 flex-shrink-0 rounded-md border flex items-center justify-center transition-colors ${
          props.checked
            ? 'bg-success/20 border-success text-success'
            : 'bg-muted border-border text-transparent hover:border-success/60'
        }`}
      >
        <Check size={12} stroke-width={3} />
      </button>
      <div class="min-w-0 flex-1">
        <p
          title={props.title}
          class={`text-sm truncate ${props.checked ? 'line-through text-success' : ''}`}
        >
          {props.title}
        </p>
        <Show when={props.meta}>
          <p class="text-xs text-muted-foreground truncate" title={props.meta}>
            {props.meta}
          </p>
        </Show>
      </div>
      <button
        type="button"
        onClick={props.onFocus}
        disabled={props.checked}
        aria-label={`Work on ${props.title}`}
        class="flex-shrink-0 h-7 px-2.5 rounded-lg border border-border text-xs font-semibold text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors disabled:opacity-40 disabled:hover:text-muted-foreground disabled:hover:border-border"
      >
        Focus
      </button>
    </div>
  );
}

interface GroupProps {
  title: string;
  icon: Icon;
  /** open items — the number in the header */
  left: number;
  /** items of any state; 0 is "nothing here", which is not the same as "all done" */
  total: number;
  emptyMessage: string;
  /**
   * Draw the body even with nothing in it — for the habits list, whose body is
   * also where you add the first one. Skipping the `Show` keeps that body mounted
   * as items come and go, so a half-typed habit name is not thrown away.
   */
  always?: boolean;
  children: JSX.Element;
}

function Group(props: GroupProps) {
  const Glyph = props.icon;
  return (
    <section
      aria-label={props.title}
      class="bg-card rounded-2xl border border-border card-shadow p-6"
    >
      <header class="flex items-center justify-between gap-3">
        <h3 class="text-base font-bold font-space flex items-center gap-2">
          <Glyph size={16} class="text-primary" /> {props.title}
        </h3>
        <Show
          when={props.total > 0}
          fallback={<span class="text-xs text-subtle-foreground font-mono">—</span>}
        >
          <span
            class={`text-xs font-mono tabular-nums ${
              props.left === 0 ? 'text-success font-bold' : 'text-muted-foreground'
            }`}
          >
            {props.left === 0 ? 'all done' : `${props.left} left`}
          </span>
        </Show>
      </header>
      <div class="mt-4 space-y-2">
        <Show
          when={props.always}
          fallback={
            <Show
              when={props.total > 0}
              fallback={
                <EmptyState
                  compact
                  icon={ClipboardList}
                  message={props.emptyMessage}
                  action={{ label: 'Open Daily Log', to: 'log' }}
                />
              }
            >
              {props.children}
            </Show>
          }
        >
          {props.children}
        </Show>
      </div>
    </section>
  );
}

/**
 * Everything still open today, grouped: to-dos, DPPs, topics to revise, and the
 * habits you can tick without leaving the clock. The only view of the sidebar
 * that shows work, so it is the only one that needs the Focus buttons — picking
 * one puts its title in the timer's task box.
 */
export default function TasksTopicsPanel(props: TasksTopicsPanelProps) {
  const d = props.data;
  const open = <T,>(items: T[], isDone: (i: T) => boolean) => items.filter((i) => !isDone(i)).length;

  return (
    <div class="grid gap-4">
      <Group
        title="Left-out tasks"
        icon={ListTodo}
        left={open(d.tasks(), (t) => t.completed)}
        total={d.tasks().length}
        emptyMessage="No open tasks. Add them in the Daily Log and they show up here."
      >
        <For each={d.tasks()}>
          {(t) => (
            <Row
              checked={t.completed}
              onToggle={() => void d.toggleTask(t.id)}
              title={t.title}
              meta={[t.subject, t.due_date && `due ${shortDate(t.due_date)}`]
                .filter(Boolean)
                .join(' · ')}
              onFocus={() => props.onFocus(t.title)}
            />
          )}
        </For>
      </Group>

      <Group
        title="Pending DPPs"
        icon={ListChecks}
        left={d.dppCount() ? d.dppCount()!.total - d.dppCount()!.done : open(d.dpps(), (x) => x.done)}
        total={d.dppCount()?.total ?? d.dpps().length}
        emptyMessage="No DPPs set for today. Add them in the Daily Log."
      >
        <Show
          when={!d.dppCount()}
          fallback={
            <p class="text-xs text-muted-foreground leading-relaxed">
              {d.dppCount()!.done} of {d.dppCount()!.total} finished. This day was logged as a plain
              count, so there are no sets to tick — add them in the Daily Log to see them here.
            </p>
          }
        >
          <For each={d.dpps()}>
            {(x) => (
              <Row
                checked={x.done}
                onToggle={() => void d.toggleDpp(x.id)}
                title={x.topic || `${x.subject} DPP`}
                meta={[x.subject, x.teacher].filter(Boolean).join(' · ')}
                onFocus={() => props.onFocus(x.topic ? `${x.subject} DPP — ${x.topic}` : `${x.subject} DPP`)}
              />
            )}
          </For>
        </Show>
      </Group>

      <Group
        title="Revision topics"
        icon={ListTodo}
        left={open(d.revise(), (t) => t.done)}
        total={d.revise().length}
        emptyMessage="No topics to revise. Add them from the Topics card in the Daily Log."
      >
        <For each={d.revise()}>
          {(t) => (
            <Row
              checked={t.done}
              onToggle={() => void d.toggleTopic(t.id)}
              title={t.name}
              onFocus={() => props.onFocus(`Revise ${t.name}`)}
            />
          )}
        </For>
      </Group>

      {/* The habit list is capped and scrolls on its own: a long one must not
          lengthen the sidebar, and through it the whole page. */}
      <Group
        title="Habits"
        icon={Repeat}
        left={props.habits.habits().filter((h) => !props.habits.isDone(h.id)).length}
        total={props.habits.habits().length}
        emptyMessage=""
        always
      >
        <div class="max-h-56 overflow-y-auto pr-1">
          <HabitsEditor habits={props.habits} />
        </div>
      </Group>
    </div>
  );
}

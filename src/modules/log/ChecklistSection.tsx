import { Check, ChevronDown, Trash2 } from 'lucide-solid';
import type { JSX } from 'solid-js';
import { Show } from 'solid-js';
import { Dynamic } from 'solid-js/web';

import type { Priority } from '../../core/db';
import { heat } from '../../core/scoring';
import { viewState, type Icon } from '../../core/ui';
import PriorityPicker from './PriorityPicker';

/** section ids the person has collapsed — kept across tab switches and restarts */
const [collapsed, setCollapsed] = viewState<string[]>('log.collapsed', []);

interface SectionProps {
  id: string;
  title: string;
  icon: Icon;
  done: number;
  total: number;
  /** replaces "3/5" — for a section whose progress is not a plain count (hours) */
  countLabel?: string;
  /** a track's score out of 10, drawn as the same heat badge the cards used */
  score?: number;
  /** the track's priority, when this section is a scored track in this mode */
  priority?: { value: Priority; onChange: (p: Priority) => void };
  /** a short qualifier, e.g. "not scored" */
  note?: string;
  children: JSX.Element;
}

/**
 * One collapsible group inside the master checklist.
 *
 * The header is the whole summary — title, progress, score, priority — so a
 * collapsed section still tells you where you stand. The toggle is its own
 * button rather than the whole bar, because the priority picker lives in the bar
 * and a button inside a button is not valid.
 */
export default function ChecklistSection(props: SectionProps) {
  const open = () => !collapsed().includes(props.id);
  const toggle = () =>
    setCollapsed((c) =>
      c.includes(props.id) ? c.filter((x) => x !== props.id) : [...c, props.id],
    );
  const pct = () => (props.total > 0 ? Math.min(100, (props.done / props.total) * 100) : 0);
  const complete = () => props.total > 0 && props.done >= props.total;

  return (
    <section class="border-t border-border first:border-t-0">
      <div class="flex items-center gap-2 py-3">
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open()}
          aria-controls={`checklist-${props.id}`}
          class="flex flex-1 min-w-0 items-center gap-2.5 text-left rounded-lg -mx-1 px-1 py-0.5 hover:bg-muted/50 transition-colors"
        >
          <ChevronDown
            size={14}
            class={`flex-shrink-0 text-muted-foreground transition-transform ${
              open() ? '' : '-rotate-90'
            }`}
          />
          <Dynamic
            component={props.icon}
            size={15}
            class={`flex-shrink-0 ${complete() ? 'text-success' : 'text-primary'}`}
          />
          <span class="text-sm font-bold font-space truncate">{props.title}</span>
          <span
            class={`flex-shrink-0 text-[0.6875rem] font-mono font-bold ${
              complete() ? 'text-success' : 'text-muted-foreground'
            }`}
          >
            {props.countLabel ?? `${props.done}/${props.total}`}
          </span>
          <span class="hidden sm:block h-1.5 w-16 flex-shrink-0 overflow-hidden rounded-full bg-background">
            <span
              class={`block h-full rounded-full transition-all ${
                complete() ? 'bg-success' : 'bar-primary'
              }`}
              style={{ width: `${pct()}%` }}
            />
          </span>
        </button>

        <Show when={props.note}>
          <span class="hidden md:inline flex-shrink-0 rounded-full border border-border bg-muted px-2 py-0.5 text-[0.625rem] font-semibold text-muted-foreground">
            {props.note}
          </span>
        </Show>
        <Show when={props.priority}>
          {(p) => <PriorityPicker value={p().value} onChange={p().onChange} />}
        </Show>
        <Show when={props.score !== undefined}>
          <span
            title="This track's score today, out of 10"
            class={`w-8 h-8 flex-shrink-0 rounded-lg border flex items-center justify-center text-xs font-bold font-mono ${heat(
              props.score ?? 0,
            )}`}
          >
            {Math.round(props.score ?? 0)}
          </span>
        </Show>
      </div>

      <Show when={open()}>
        <div id={`checklist-${props.id}`} class="pb-4 space-y-1.5">
          {props.children}
        </div>
      </Show>
    </section>
  );
}

interface CheckRowProps {
  checked: boolean;
  onToggle: () => void;
  label: string;
  /** badges after the text — subject, due date, when it was added */
  chips?: JSX.Element;
  tone?: 'overdue';
  onDelete?: () => void;
  deleteLabel?: string;
}

/**
 * One tickable line. The text wraps to two lines and then clips with the full
 * string in a tooltip — so a long title can never push its badges into the
 * next column or run under the delete button, which is what the old rows did.
 */
export function CheckRow(props: CheckRowProps) {
  return (
    <div
      class={`flex items-start gap-2.5 rounded-lg border px-2.5 py-2 transition-colors ${
        props.checked
          ? 'bg-success/5 border-success/30'
          : props.tone === 'overdue'
            ? 'bg-destructive/5 border-destructive/30'
            : 'bg-background border-border'
      }`}
    >
      <button
        type="button"
        role="checkbox"
        aria-checked={props.checked}
        aria-label={`${props.checked ? 'Mark not done' : 'Mark done'}: ${props.label}`}
        onClick={props.onToggle}
        class={`mt-px w-5 h-5 flex-shrink-0 rounded-md border flex items-center justify-center transition-colors ${
          props.checked
            ? 'bg-success/20 border-success text-success'
            : 'bg-muted border-border text-transparent hover:border-success/60'
        }`}
      >
        <Check size={12} stroke-width={3} />
      </button>
      <span
        title={props.label}
        class={`flex-1 min-w-0 text-xs leading-snug break-words line-clamp-2 ${
          props.checked ? 'line-through text-success' : ''
        }`}
      >
        {props.label}
      </span>
      <Show when={props.chips}>
        <span class="flex flex-shrink-0 flex-wrap items-center justify-end gap-1.5">
          {props.chips}
        </span>
      </Show>
      <Show when={props.onDelete}>
        <button
          type="button"
          onClick={props.onDelete}
          aria-label={props.deleteLabel ?? 'Remove'}
          title={props.deleteLabel ?? 'Remove'}
          class="flex-shrink-0 p-0.5 text-subtle-foreground hover:text-destructive transition-colors"
        >
          <Trash2 size={13} />
        </button>
      </Show>
    </div>
  );
}

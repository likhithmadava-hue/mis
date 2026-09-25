import { ChevronDown, Pencil, Trash2 } from 'lucide-solid';
import { createSignal, Show } from 'solid-js';

import { shortDate } from '../../core/dates';
import { marksLost, type MarkLogbookEntry } from '../../core/db';
import { DIFFICULTY_BADGE, REASON_BADGE } from '../../core/ui';

interface EntryRowProps {
  entry: MarkLogbookEntry;
  /** row position, used only to stagger the entrance animation */
  index: number;
  onEdit: () => void;
  onDelete: () => void;
}

/** past this many characters the column truncates, so the full text gets a drawer */
const CHAPTER_CHARS = 20;
const NOTES_CHARS = 34;

/** one logged paper, as it reads at rest */
export default function EntryRow(props: EntryRowProps) {
  const e = () => props.entry;
  const [open, setOpen] = createSignal(false);
  const truncated = () =>
    (e().chapter?.length ?? 0) > CHAPTER_CHARS || (e().notes?.length ?? 0) > NOTES_CHARS;

  return (
    <>
      <tr
        class="group animate-row-in hover:bg-primary/5 transition-colors"
        // capped, so row 300 does not wait nine seconds to appear
        style={{ 'animation-delay': `${Math.min(props.index * 30, 400)}ms` }}
      >
        <td class="py-2.5 px-3 font-mono text-muted-foreground whitespace-nowrap">
          {shortDate(e().date)}
        </td>
        <td class="py-2.5 px-3 font-semibold whitespace-nowrap">{e().subject}</td>
        <td class="py-2.5 px-3 text-muted-foreground max-w-[160px] truncate" title={e().chapter}>
          {e().chapter || '—'}
        </td>
        <td class="py-2.5 px-3">
          <span
            class={`text-[0.625rem] font-bold px-2 py-0.5 rounded-md border whitespace-nowrap ${
              REASON_BADGE[e().mistake_reason]
            }`}
          >
            {e().mistake_reason}
          </span>
        </td>
        <td class="py-2.5 px-3">
          <span
            class={`text-[0.625rem] font-bold px-2 py-0.5 rounded-md border ${
              DIFFICULTY_BADGE[e().difficulty]
            }`}
          >
            {e().difficulty}
          </span>
        </td>
        {/* marks *lost*, not marks scored — the table exists to show where they go */}
        <td class="py-2.5 px-3 font-mono whitespace-nowrap">
          <span class="text-destructive font-bold">−{marksLost(e())}</span>
          <span class="text-muted-foreground"> / {e().max_score}</span>
        </td>
        <td class="py-2.5 px-3 font-mono text-muted-foreground whitespace-nowrap">
          {e().time_spent ? `${e().time_spent}m` : '—'}
        </td>
        <td class="py-2.5 px-3 text-muted-foreground max-w-[240px]">
          <div class="flex items-center gap-1.5">
            <span class="truncate" title={e().notes}>
              {e().notes || '—'}
            </span>
            {/* only when something is actually cut off — a chevron on every row
              would promise a drawer that has nothing more to say */}
            <Show when={truncated()}>
              <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                aria-expanded={open()}
                aria-label={open() ? 'Hide full text' : 'Show full text'}
                title={open() ? 'Hide full text' : 'Show full text'}
                class="flex-shrink-0 p-1 rounded-md text-subtle-foreground hover:text-primary hover:bg-muted transition-colors"
              >
                <ChevronDown
                  size={13}
                  class={`transition-transform ${open() ? 'rotate-180' : ''}`}
                />
              </button>
            </Show>
          </div>
        </td>
        <td class="py-2.5 px-3">
          <div class="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
            <button
              onClick={props.onEdit}
              title="Edit"
              class="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-muted"
            >
              <Pencil size={12} />
            </button>
            <button
              onClick={props.onDelete}
              title="Delete"
              class="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-muted"
            >
              <Trash2 size={12} />
            </button>
          </div>
        </td>
      </tr>
      <Show when={open()}>
        <tr class="bg-muted/30">
          <td colspan={9} class="px-3 py-3">
            <dl class="grid gap-x-8 gap-y-2 text-xs sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
              <div>
                <dt class="text-[0.625rem] font-bold uppercase tracking-wider text-subtle-foreground">
                  Chapter
                </dt>
                <dd class="mt-0.5 text-foreground select-text whitespace-pre-wrap break-words">
                  {e().chapter || '—'}
                </dd>
              </div>
              <div>
                <dt class="text-[0.625rem] font-bold uppercase tracking-wider text-subtle-foreground">
                  Notes
                </dt>
                <dd class="mt-0.5 text-foreground select-text whitespace-pre-wrap break-words">
                  {e().notes || '—'}
                </dd>
              </div>
            </dl>
          </td>
        </tr>
      </Show>
    </>
  );
}

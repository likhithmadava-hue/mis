import { Pencil, Trash2 } from 'lucide-solid';

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

/** one logged paper, as it reads at rest */
export default function EntryRow(props: EntryRowProps) {
  const e = () => props.entry;

  return (
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
          class={`text-[0.5625rem] font-bold px-2 py-0.5 rounded-md border whitespace-nowrap ${
            REASON_BADGE[e().mistake_reason]
          }`}
        >
          {e().mistake_reason}
        </span>
      </td>
      <td class="py-2.5 px-3">
        <span
          class={`text-[0.5625rem] font-bold px-2 py-0.5 rounded-md border ${
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
      <td class="py-2.5 px-3 text-muted-foreground max-w-[240px] truncate" title={e().notes}>
        {e().notes || '—'}
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
  );
}

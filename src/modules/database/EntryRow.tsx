import React from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { marksLost, type MarkLogbookEntry } from '../../core/db';
import { DIFFICULTY_BADGE, REASON_BADGE } from '../../core/ui/mistakes';

interface EntryRowProps {
  entry: MarkLogbookEntry;
  /** row position, used only to stagger the entrance animation */
  index: number;
  onEdit: (entry: MarkLogbookEntry) => void;
  onDelete: (entry: MarkLogbookEntry) => void;
}

/**
 * One logged paper, as it reads at rest.
 * Wrapped with React.memo to prevent unnecessary re-renders when list or parent state updates.
 */
function EntryRowComponent({ entry, index, onEdit, onDelete }: EntryRowProps) {
  return (
    <tr
      className="group animate-row-in hover:bg-primary/5 transition-colors"
      style={{ animationDelay: `${Math.min(index * 30, 400)}ms` }}
    >
      <td className="py-2.5 px-3 font-mono text-muted-foreground whitespace-nowrap">
        {new Date(entry.date).toLocaleDateString([], { month: 'short', day: 'numeric' })}
      </td>
      <td className="py-2.5 px-3 font-semibold whitespace-nowrap">{entry.subject}</td>
      <td className="py-2.5 px-3 text-muted-foreground max-w-[160px] truncate" title={entry.chapter}>
        {entry.chapter || '—'}
      </td>
      <td className="py-2.5 px-3">
        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md border whitespace-nowrap ${REASON_BADGE[entry.mistake_reason]}`}>
          {entry.mistake_reason}
        </span>
      </td>
      <td className="py-2.5 px-3">
        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md border ${DIFFICULTY_BADGE[entry.difficulty]}`}>
          {entry.difficulty}
        </span>
      </td>
      <td className="py-2.5 px-3 font-mono whitespace-nowrap">
        <span className="text-destructive font-bold">−{marksLost(entry)}</span>
        <span className="text-muted-foreground"> / {entry.max_score}</span>
      </td>
      <td className="py-2.5 px-3 font-mono text-muted-foreground whitespace-nowrap">
        {entry.time_spent ? `${entry.time_spent}m` : '—'}
      </td>
      <td className="py-2.5 px-3 text-muted-foreground max-w-[240px] truncate" title={entry.notes}>
        {entry.notes || '—'}
      </td>
      <td className="py-2.5 px-3">
        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
          <button onClick={() => onEdit(entry)} title="Edit" className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-muted">
            <Pencil size={12} />
          </button>
          <button onClick={() => onDelete(entry)} title="Delete" className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-muted">
            <Trash2 size={12} />
          </button>
        </div>
      </td>
    </tr>
  );
}

const EntryRow = React.memo(EntryRowComponent);
export default EntryRow;

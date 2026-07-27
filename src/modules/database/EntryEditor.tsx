import { Check } from 'lucide-react';
import { DIFFICULTIES, MISTAKE_REASONS, type MarkLogbookEntry } from '../../core/db';
import Select from '../../core/ui/Select';
import { DIFFICULTY_BADGE, REASON_BADGE } from '../../core/ui/mistakes';

interface EntryEditorProps {
  draft: MarkLogbookEntry;
  onChange: (draft: MarkLogbookEntry) => void;
  onSave: () => void;
  onCancel: () => void;
}

// one height for every text/number/date field so the grid lines up
const fieldClass =
  'h-9 px-3 bg-background border border-border rounded-xl text-xs text-foreground [color-scheme:dark] focus:border-primary/50 focus:outline-none';

/**
 * Editing a row in place. It takes over the whole width of the row it replaces
 * rather than opening a dialog, so the surrounding records stay visible while
 * you correct one.
 */
export default function EntryEditor({ draft, onChange, onSave, onCancel }: EntryEditorProps) {
  const set = (patch: Partial<MarkLogbookEntry>) => onChange({ ...draft, ...patch });

  return (
    <tr className="bg-primary/5">
      <td colSpan={9} className="p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 animate-fade-in">
          <label className="block">
            <span className="text-[10px] text-muted-foreground block mb-1">Date</span>
            <input type="date" value={draft.date} onChange={(e) => set({ date: e.target.value })} className={`w-full ${fieldClass}`} />
          </label>
          <label className="block">
            <span className="text-[10px] text-muted-foreground block mb-1">Subject</span>
            <input type="text" value={draft.subject} onChange={(e) => set({ subject: e.target.value })} className={`w-full ${fieldClass}`} />
          </label>
          <label className="block">
            <span className="text-[10px] text-muted-foreground block mb-1">Chapter</span>
            <input type="text" value={draft.chapter} onChange={(e) => set({ chapter: e.target.value })} className={`w-full ${fieldClass}`} />
          </label>
          <div>
            <span className="text-[10px] text-muted-foreground block mb-1">Error type</span>
            <Select
              ariaLabel="Error type"
              value={draft.mistake_reason}
              onChange={(v) => set({ mistake_reason: v })}
              options={MISTAKE_REASONS.map((r) => ({ value: r, label: r, badgeClass: REASON_BADGE[r] }))}
            />
          </div>
          <div>
            <span className="text-[10px] text-muted-foreground block mb-1">Difficulty</span>
            <Select
              ariaLabel="Difficulty"
              value={draft.difficulty}
              onChange={(v) => set({ difficulty: v })}
              options={DIFFICULTIES.map((d) => ({ value: d, label: d, badgeClass: DIFFICULTY_BADGE[d] }))}
            />
          </div>
          <label className="block">
            <span className="text-[10px] text-muted-foreground block mb-1">Score / Max</span>
            <div className="flex gap-2">
              <input type="number" value={draft.score} onChange={(e) => set({ score: Number(e.target.value) })} className={`w-full ${fieldClass}`} />
              <input type="number" value={draft.max_score} onChange={(e) => set({ max_score: Number(e.target.value) })} className={`w-full ${fieldClass}`} />
            </div>
          </label>
          <label className="block">
            <span className="text-[10px] text-muted-foreground block mb-1">Time (min)</span>
            <input type="number" value={draft.time_spent} onChange={(e) => set({ time_spent: Number(e.target.value) })} className={`w-full ${fieldClass}`} />
          </label>
          <label className="block">
            <span className="text-[10px] text-muted-foreground block mb-1">Grade</span>
            <input type="text" value={draft.grade} onChange={(e) => set({ grade: e.target.value })} className={`w-full ${fieldClass}`} />
          </label>
          <label className="block col-span-2 md:col-span-4">
            <span className="text-[10px] text-muted-foreground block mb-1">Notes</span>
            <input type="text" value={draft.notes} onChange={(e) => set({ notes: e.target.value })} className={`w-full ${fieldClass}`} />
          </label>
        </div>
        <div className="flex justify-end gap-2 mt-3">
          <button onClick={onCancel} className="px-3 py-1.5 bg-muted text-foreground rounded-lg text-xs">Cancel</button>
          <button onClick={onSave} className="px-4 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-semibold font-space flex items-center gap-1">
            <Check size={13} /> Save
          </button>
        </div>
      </td>
    </tr>
  );
}

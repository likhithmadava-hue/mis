import { Check } from 'lucide-solid';

import { DIFFICULTIES, MISTAKE_REASONS, type MarkLogbookEntry } from '../../core/db';
import { DIFFICULTY_BADGE, REASON_BADGE, Select } from '../../core/ui';

interface EntryEditorProps {
  draft: MarkLogbookEntry;
  onChange: (draft: MarkLogbookEntry) => void;
  onSave: () => void;
  onCancel: () => void;
}

// one height for every text/number/date field so the grid lines up
const field =
  'h-9 px-3 bg-background border border-border rounded-xl text-xs text-foreground [color-scheme:dark] focus:border-primary/50 focus:outline-none';

/**
 * Editing a row in place. It takes over the whole width of the row it replaces
 * rather than opening a dialog, so the surrounding records stay visible while
 * you correct one — which is usually how you spot that it needed correcting.
 */
export default function EntryEditor(props: EntryEditorProps) {
  const set = (patch: Partial<MarkLogbookEntry>) => props.onChange({ ...props.draft, ...patch });

  return (
    <tr class="bg-primary/5">
      <td colSpan={9} class="p-4">
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3 animate-fade-in">
          <label class="block">
            <span class="text-[0.625rem] text-muted-foreground block mb-1">Date</span>
            <input
              type="date"
              value={props.draft.date}
              onChange={(e) => set({ date: e.currentTarget.value })}
              class={`w-full ${field}`}
            />
          </label>
          <label class="block">
            <span class="text-[0.625rem] text-muted-foreground block mb-1">Subject</span>
            <input
              type="text"
              value={props.draft.subject}
              onInput={(e) => set({ subject: e.currentTarget.value })}
              class={`w-full ${field}`}
            />
          </label>
          <label class="block">
            <span class="text-[0.625rem] text-muted-foreground block mb-1">Chapter</span>
            <input
              type="text"
              value={props.draft.chapter}
              onInput={(e) => set({ chapter: e.currentTarget.value })}
              class={`w-full ${field}`}
            />
          </label>
          <div>
            <span class="text-[0.625rem] text-muted-foreground block mb-1">Error type</span>
            <Select
              ariaLabel="Error type"
              value={props.draft.mistake_reason}
              onChange={(v) => set({ mistake_reason: v })}
              options={MISTAKE_REASONS.map((r) => ({
                value: r,
                label: r,
                badgeClass: REASON_BADGE[r],
              }))}
            />
          </div>
          <div>
            <span class="text-[0.625rem] text-muted-foreground block mb-1">Difficulty</span>
            <Select
              ariaLabel="Difficulty"
              value={props.draft.difficulty}
              onChange={(v) => set({ difficulty: v })}
              options={DIFFICULTIES.map((d) => ({
                value: d,
                label: d,
                badgeClass: DIFFICULTY_BADGE[d],
              }))}
            />
          </div>
          <label class="block">
            <span class="text-[0.625rem] text-muted-foreground block mb-1">Score / Max</span>
            <div class="flex gap-2">
              <input
                type="number"
                value={props.draft.score}
                onInput={(e) => set({ score: Number(e.currentTarget.value) })}
                class={`w-full ${field}`}
              />
              <input
                type="number"
                min={1}
                value={props.draft.max_score}
                onInput={(e) => set({ max_score: Number(e.currentTarget.value) })}
                class={`w-full ${field}`}
              />
            </div>
          </label>
          <label class="block">
            <span class="text-[0.625rem] text-muted-foreground block mb-1">Time (min)</span>
            <input
              type="number"
              value={props.draft.time_spent}
              onInput={(e) => set({ time_spent: Number(e.currentTarget.value) })}
              class={`w-full ${field}`}
            />
          </label>
          <label class="block">
            <span class="text-[0.625rem] text-muted-foreground block mb-1">Grade</span>
            <input
              type="text"
              value={props.draft.grade}
              onInput={(e) => set({ grade: e.currentTarget.value })}
              class={`w-full ${field}`}
            />
          </label>
          <label class="block col-span-2 md:col-span-4">
            <span class="text-[0.625rem] text-muted-foreground block mb-1">Notes</span>
            <input
              type="text"
              value={props.draft.notes}
              onInput={(e) => set({ notes: e.currentTarget.value })}
              class={`w-full ${field}`}
            />
          </label>
        </div>

        <div class="flex justify-end gap-2 mt-3">
          <button
            onClick={props.onCancel}
            class="px-3 py-1.5 bg-muted text-foreground rounded-lg text-xs"
          >
            Cancel
          </button>
          <button
            onClick={props.onSave}
            class="px-4 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-semibold font-space flex items-center gap-1"
          >
            <Check size={13} /> Save
          </button>
        </div>
      </td>
    </tr>
  );
}

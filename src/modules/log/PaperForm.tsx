import { ClipboardList, PlusCircle } from 'lucide-solid';
import { createSignal, Show } from 'solid-js';

import {
  DIFFICULTIES,
  MISTAKE_REASONS,
  type Difficulty,
  type MarkLogbookEntry,
  type MistakeReason,
} from '../../core/db';
import { DIFFICULTY_BADGE, REASON_BADGE, Select } from '../../core/ui';

const GRADES = ['A+', 'A', 'B', 'C', 'D', 'F'];

interface PaperFormProps {
  onSubmit: (entry: Omit<MarkLogbookEntry, 'id' | 'date'>) => void;
}

/**
 * Logging a paper: what you scored, and — the part that matters — why you
 * dropped the marks. This is what feeds the Error Analysis, Subject Performance
 * and Score History charts on the Growth Tracker.
 *
 * The mistake reason is a fixed list rather than free text on purpose. Nine
 * choices you have to pick between force the question "which of these was it,
 * actually"; a text box gets "silly mistake" nine times and charts nothing.
 */
export default function PaperForm(props: PaperFormProps) {
  const [open, setOpen] = createSignal(false);
  const [subject, setSubject] = createSignal('');
  const [chapter, setChapter] = createSignal('');
  const [grade, setGrade] = createSignal('A');
  const [score, setScore] = createSignal(85);
  const [maxScore, setMaxScore] = createSignal(100);
  const [difficulty, setDifficulty] = createSignal<Difficulty>('Medium');
  const [timeSpent, setTimeSpent] = createSignal(60);
  const [reason, setReason] = createSignal<MistakeReason>('Careless');
  const [notes, setNotes] = createSignal('');

  const submit = (e: Event) => {
    e.preventDefault();
    if (!subject().trim()) return;
    props.onSubmit({
      subject: subject().trim(),
      chapter: chapter().trim(),
      grade: grade(),
      score: Number(score()),
      max_score: Number(maxScore()),
      difficulty: difficulty(),
      time_spent: Number(timeSpent()),
      mistake_reason: reason(),
      notes: notes().trim(),
    });
    // The paper's identity is cleared; the settings that describe *how you work*
    // — difficulty, time, grade scheme — are kept for the next one.
    setSubject('');
    setChapter('');
    setNotes('');
    setOpen(false);
  };

  return (
    <div class="bg-card rounded-2xl border border-border card-shadow p-6 space-y-4">
      <div class="flex items-center justify-between gap-3 border-b border-border pb-3">
        <div>
          <h3 class="text-sm font-bold uppercase tracking-wider text-muted-foreground font-space flex items-center gap-2">
            <ClipboardList size={16} class="text-primary" /> Log a Paper
          </h3>
          <p class="text-[0.6875rem] text-muted-foreground mt-1">
            Feeds the Error Analysis, Subject Performance and Score History charts.
          </p>
        </div>
        <button
          onClick={() => setOpen(!open())}
          class="px-3 py-1.5 bg-primary hover:bg-primary/90 text-primary-foreground font-space rounded-xl text-xs font-semibold flex items-center gap-1 shadow-md flex-shrink-0"
        >
          <PlusCircle size={14} /> {open() ? 'Close' : 'Log Mistake'}
        </button>
      </div>

      <Show when={open()}>
        <form
          onSubmit={submit}
          class="p-4 bg-background border border-primary/20 rounded-2xl space-y-4 animate-fade-in border-glow"
        >
          <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label class="text-[0.625rem] text-muted-foreground block mb-1">Subject</label>
              <input
                type="text"
                placeholder="e.g. Physics"
                required
                value={subject()}
                onInput={(e) => setSubject(e.currentTarget.value)}
                class="w-full h-9 px-3 bg-card border border-border rounded-lg text-xs"
              />
            </div>
            <div>
              <label class="text-[0.625rem] text-muted-foreground block mb-1">Chapter</label>
              <input
                type="text"
                placeholder="e.g. Kinematics"
                value={chapter()}
                onInput={(e) => setChapter(e.currentTarget.value)}
                class="w-full h-9 px-3 bg-card border border-border rounded-lg text-xs"
              />
            </div>
            <div>
              <label class="text-[0.625rem] text-muted-foreground block mb-1">Error Type</label>
              <Select
                ariaLabel="Error type"
                value={reason()}
                onChange={setReason}
                options={MISTAKE_REASONS.map((r) => ({
                  value: r,
                  label: r,
                  badgeClass: REASON_BADGE[r],
                }))}
              />
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label class="text-[0.625rem] text-muted-foreground block mb-1">Grade</label>
              <Select
                ariaLabel="Grade"
                value={grade()}
                onChange={setGrade}
                options={GRADES.map((g) => ({ value: g, label: g }))}
              />
            </div>
            <div>
              <label class="text-[0.625rem] text-muted-foreground block mb-1">Difficulty</label>
              <Select
                ariaLabel="Difficulty"
                value={difficulty()}
                onChange={setDifficulty}
                options={DIFFICULTIES.map((d) => ({
                  value: d,
                  label: d,
                  badgeClass: DIFFICULTY_BADGE[d],
                }))}
              />
            </div>
            <div>
              <label class="text-[0.625rem] text-muted-foreground block mb-1">Time (min)</label>
              <input
                type="number"
                min={0}
                value={timeSpent()}
                onInput={(e) => setTimeSpent(Number(e.currentTarget.value))}
                class="w-full h-9 px-3 bg-card border border-border rounded-lg text-xs"
              />
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div class="flex gap-2">
              <div class="flex-1">
                <label class="text-[0.625rem] text-muted-foreground block mb-1">Obtained</label>
                <input
                  type="number"
                  required
                  value={score()}
                  onInput={(e) => setScore(Number(e.currentTarget.value))}
                  class="w-full h-9 px-3 bg-card border border-border rounded-lg text-xs"
                />
              </div>
              <div class="flex-1">
                <label class="text-[0.625rem] text-muted-foreground block mb-1">Max</label>
                <input
                  type="number"
                  required
                  min={1}
                  value={maxScore()}
                  onInput={(e) => setMaxScore(Number(e.currentTarget.value))}
                  class="w-full h-9 px-3 bg-card border border-border rounded-lg text-xs"
                />
              </div>
            </div>
            <div>
              <label class="text-[0.625rem] text-muted-foreground block mb-1">Notes</label>
              <input
                type="text"
                placeholder="What corrected action?"
                value={notes()}
                onInput={(e) => setNotes(e.currentTarget.value)}
                class="w-full h-9 px-3 bg-card border border-border rounded-lg text-xs"
              />
            </div>
          </div>

          <div class="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => setOpen(false)}
              class="px-3 py-1.5 bg-muted text-foreground rounded-lg text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              class="px-4 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-semibold font-space"
            >
              Insert Entry
            </button>
          </div>
        </form>
      </Show>
    </div>
  );
}

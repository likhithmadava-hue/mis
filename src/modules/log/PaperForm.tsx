import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileText,
  RotateCcw,
  Save,
} from 'lucide-solid';
import { createSignal, Show } from 'solid-js';

import { todayIso } from '../../core/dates';
import {
  DIFFICULTIES,
  MISTAKE_REASONS,
  type Difficulty,
  type MarkLogbookEntry,
  type MistakeReason,
} from '../../core/db';
import { DIFFICULTY_BADGE, REASON_BADGE, Select } from '../../core/ui';

export interface PaperFormProps {
  onSubmit: (entry: Omit<MarkLogbookEntry, 'id'>) => void;
  onOpenDatabase?: () => void;
}

const inputClass =
  'w-full rounded-lg bg-background/80 border border-border px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-transparent transition';

/**
 * Log a mistake — modeled directly after mistakeintelligencesystem.lovable.app/add.
 *
 * Captures what went wrong while it's fresh: subject, chapter, question type,
 * marks lost, time taken, error type, difficulty, and notes. Feeds directly into
 * the Carelessness index, Revision priority engine, and Error analysis.
 */
export default function PaperForm(props: PaperFormProps) {
  const [open, setOpen] = createSignal(true);
  const [date, setDate] = createSignal(todayIso());
  const [subject, setSubject] = createSignal('');
  const [chapter, setChapter] = createSignal('');
  const [questionType, setQuestionType] = createSignal('');
  const [marksLostVal, setMarksLostVal] = createSignal(1);
  const [timeTaken, setTimeTaken] = createSignal(0);
  const [errorType, setErrorType] = createSignal<MistakeReason>('Conceptual');
  const [difficulty, setDifficulty] = createSignal<Difficulty>('Medium');
  const [notes, setNotes] = createSignal('');
  const [savedBanner, setSavedBanner] = createSignal<string | null>(null);

  const clearForm = () => {
    setSubject('');
    setChapter('');
    setQuestionType('');
    setMarksLostVal(1);
    setTimeTaken(0);
    setErrorType('Conceptual');
    setDifficulty('Medium');
    setNotes('');
  };

  const submit = (e: Event) => {
    e.preventDefault();
    const sub = subject().trim();
    const chap = chapter().trim();
    if (!sub || !chap) return;

    const lost = Math.max(0, Number(marksLostVal()) || 1);
    const qType = questionType().trim();
    const cleanNotes = notes().trim();
    const combinedNotes = qType
      ? `[${qType}] ${cleanNotes}`.trim()
      : cleanNotes;

    props.onSubmit({
      date: date() || todayIso(),
      subject: sub,
      chapter: chap,
      grade: lost === 0 ? 'A+' : lost <= 2 ? 'A' : lost <= 5 ? 'B' : 'C',
      score: 0,
      max_score: lost,
      difficulty: difficulty(),
      time_spent: Math.max(0, Number(timeTaken()) || 0),
      mistake_reason: errorType(),
      notes: combinedNotes,
    });

    setSavedBanner(`${sub} · ${chap}`);
    setTimeout(() => setSavedBanner(null), 4000);
    clearForm();
  };

  return (
    <div class="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)] space-y-5">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div class="flex items-start justify-between gap-4 border-b border-border/70 pb-4">
        <div>
          <div class="flex items-center gap-2">
            <h2 class="font-display text-lg font-semibold tracking-tight text-foreground flex items-center gap-2">
              <FileText size={18} class="text-primary" /> Log a mistake
            </h2>
          </div>
          <p class="text-xs text-muted-foreground mt-1">
            Capture what went wrong while it's fresh — the system will turn it into a pattern over time.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setOpen(!open())}
          class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          aria-label={open() ? 'Collapse form' : 'Expand form'}
        >
          <span>{open() ? 'Minimize' : 'Expand'}</span>
          <Show when={open()} fallback={<ChevronDown size={14} />}>
            <ChevronUp size={14} />
          </Show>
        </button>
      </div>

      <Show when={savedBanner()}>
        {(banner) => (
          <div class="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center gap-2.5 text-xs text-emerald-400 animate-fade-in">
            <CheckCircle2 size={16} class="flex-shrink-0" />
            <span>
              Mistake logged successfully: <strong class="text-foreground">{banner()}</strong>
            </span>
          </div>
        )}
      </Show>

      <Show when={open()}>
        <form onSubmit={submit} class="space-y-4">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Date */}
            <label class="block">
              <span class="text-[11px] uppercase tracking-[0.14em] text-muted-foreground font-medium">
                Date
              </span>
              <div class="mt-1.5">
                <input
                  type="date"
                  required
                  value={date()}
                  onInput={(e) => setDate(e.currentTarget.value)}
                  class={inputClass}
                />
              </div>
            </label>

            {/* Subject */}
            <label class="block">
              <span class="text-[11px] uppercase tracking-[0.14em] text-muted-foreground font-medium">
                Subject
              </span>
              <div class="mt-1.5">
                <input
                  type="text"
                  placeholder="Physics"
                  required
                  value={subject()}
                  onInput={(e) => setSubject(e.currentTarget.value)}
                  class={inputClass}
                />
              </div>
            </label>

            {/* Chapter */}
            <label class="block">
              <span class="text-[11px] uppercase tracking-[0.14em] text-muted-foreground font-medium">
                Chapter
              </span>
              <div class="mt-1.5">
                <input
                  type="text"
                  placeholder="Electrostatics"
                  required
                  value={chapter()}
                  onInput={(e) => setChapter(e.currentTarget.value)}
                  class={inputClass}
                />
              </div>
            </label>

            {/* Question type */}
            <label class="block">
              <span class="text-[11px] uppercase tracking-[0.14em] text-muted-foreground font-medium">
                Question type
              </span>
              <div class="mt-1.5">
                <input
                  type="text"
                  placeholder="MCQ / Numerical / Subjective"
                  value={questionType()}
                  onInput={(e) => setQuestionType(e.currentTarget.value)}
                  class={inputClass}
                />
              </div>
            </label>

            {/* Marks lost */}
            <label class="block">
              <span class="text-[11px] uppercase tracking-[0.14em] text-muted-foreground font-medium">
                Marks lost
              </span>
              <div class="mt-1.5">
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={marksLostVal()}
                  onInput={(e) => setMarksLostVal(Number(e.currentTarget.value))}
                  class={inputClass}
                />
              </div>
            </label>

            {/* Time taken (min) */}
            <label class="block">
              <span class="text-[11px] uppercase tracking-[0.14em] text-muted-foreground font-medium">
                Time taken (min)
              </span>
              <div class="mt-1.5">
                <input
                  type="number"
                  min="0"
                  value={timeTaken()}
                  onInput={(e) => setTimeTaken(Number(e.currentTarget.value))}
                  class={inputClass}
                />
              </div>
            </label>

            {/* Error type */}
            <label class="block">
              <span class="text-[11px] uppercase tracking-[0.14em] text-muted-foreground font-medium">
                Error type
              </span>
              <div class="mt-1.5">
                <Select
                  ariaLabel="Error type"
                  value={errorType()}
                  onChange={setErrorType}
                  options={MISTAKE_REASONS.map((r) => ({
                    value: r,
                    label: r,
                    badgeClass: REASON_BADGE[r],
                  }))}
                />
              </div>
            </label>

            {/* Difficulty */}
            <label class="block">
              <span class="text-[11px] uppercase tracking-[0.14em] text-muted-foreground font-medium">
                Difficulty
              </span>
              <div class="mt-1.5">
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
            </label>
          </div>

          {/* Notes */}
          <label class="block">
            <span class="text-[11px] uppercase tracking-[0.14em] text-muted-foreground font-medium">
              Notes
            </span>
            <div class="mt-1.5">
              <textarea
                rows={3}
                placeholder="What exactly went wrong? What will you do differently?"
                value={notes()}
                onInput={(e) => setNotes(e.currentTarget.value)}
                class={`${inputClass} resize-y min-h-[4.5rem]`}
              />
            </div>
          </label>

          {/* ── Actions ─────────────────────────────────────────────────── */}
          <div class="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="submit"
              class="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 transition-opacity font-space shadow-md"
            >
              <Save size={15} /> Save mistake
            </button>

            <button
              type="button"
              onClick={clearForm}
              class="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
            >
              <RotateCcw size={15} /> Clear form
            </button>

            <Show when={props.onOpenDatabase}>
              <button
                type="button"
                onClick={() => props.onOpenDatabase?.()}
                class="ml-auto text-xs text-primary hover:underline transition-all"
              >
                View database →
              </button>
            </Show>
          </div>
        </form>
      </Show>
    </div>
  );
}

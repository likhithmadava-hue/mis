import { BookOpen } from 'lucide-solid';
import { createMemo, createSignal, For, onCleanup, onMount } from 'solid-js';

import { db, type SessionDetails, type SessionReason } from '../../core/db';
import { SESSION_REASONS } from '../../core/scoring';
import { Combobox } from '../../core/ui';
import { LIMITS, problemWith, type SessionChoice } from './sessionChoice';
import { chapterOptions, latestSubject, subjectOptions } from './topicChoices';

interface SessionSetupProps {
  /** today's choice when changing it; `null` the first time */
  initial: SessionChoice | null;
  /** a topic to start the topic field on, when the dialog was opened from a task or topic row */
  topic?: string;
  /** the button that goes ahead — "Start focus", or "Continue" when finishing a round */
  confirmLabel: string;
  onConfirm: (details: SessionDetails & { reason: SessionReason }) => void;
  onCancel: () => void;
}

const field =
  'w-full h-9 px-3 bg-background border border-border rounded-lg text-xs text-foreground';

/**
 * Asks what a focus round is for: the subject, the topic, and why.
 *
 * It opens when you press Start with nothing chosen today, and again from the
 * chip's Change button. The **reason is never pre-filled** — the subject can
 * carry over from your last session (a run of physics is normal), but "why" has
 * to be a decision each day, or it would be answered by habit and the answers
 * would be worth nothing.
 *
 * Like the done-prompt this renders inside the timer's fullscreen container: a
 * `fixed` element outside a fullscreened node does not paint, so a dialog
 * mounted elsewhere would never appear over a fullscreen clock.
 *
 * Every field is always drawn and the hint line has a reserved height, so
 * filling it in never makes the dialog grow or jump. Rust decides whether the
 * answers are good enough; this only says what is missing before you ask it to.
 */
export default function SessionSetup(props: SessionSetupProps) {
  const [subject, setSubject] = createSignal(props.initial?.subject ?? latestSubject(db));
  const [chapter, setChapter] = createSignal(props.topic ?? props.initial?.chapter ?? '');
  const [reason, setReason] = createSignal<SessionReason | null>(props.initial?.reason ?? null);
  const [note, setNote] = createSignal(props.initial?.reason_note ?? '');

  const subjects = createMemo(() => subjectOptions(db));
  const chapters = createMemo(() => chapterOptions(db, subject()));

  const draft = () => ({
    subject: subject(),
    chapter: chapter(),
    reason: reason(),
    reason_note: note(),
  });
  const problem = () => problemWith(draft());
  const noteRequired = () => reason() === 'other';

  let root!: HTMLFormElement;

  const submit = (e?: Event) => {
    e?.preventDefault();
    const d = draft();
    if (problemWith(d) || d.reason === null) return;
    props.onConfirm({ ...d, reason: d.reason });
  };

  onMount(() => {
    // Subject and topic, in that order: a subject carried over from your last
    // session puts the cursor on the topic, which is the part that changes.
    const boxes = Array.from(root.querySelectorAll<HTMLInputElement>('input[role="combobox"]'));
    (boxes.find((el) => !el.value) ?? boxes[boxes.length - 1])?.focus();
    // Bubble phase and `defaultPrevented`: an open suggestion list closes on its
    // own Escape first, and only a second press closes the dialog.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) {
        e.preventDefault();
        props.onCancel();
      }
    };
    window.addEventListener('keydown', onKey);
    onCleanup(() => window.removeEventListener('keydown', onKey));
  });

  return (
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-fade-in"
      onMouseDown={(e) => e.target === e.currentTarget && props.onCancel()}
    >
      <form
        ref={root}
        role="dialog"
        aria-modal="true"
        aria-labelledby="session-setup-title"
        onSubmit={submit}
        class="bg-card border border-primary/30 rounded-2xl card-shadow p-6 w-full max-w-md space-y-4"
      >
        <div>
          <h3
            id="session-setup-title"
            class="text-lg font-bold font-space tracking-tight flex items-center gap-2"
          >
            <BookOpen size={18} class="text-primary" /> What are you studying?
          </h3>
          <p class="text-xs text-muted-foreground mt-1.5 leading-relaxed">
            Pick the topic and say why. It takes a few seconds, and it is how MIS can later tell
            you where your hours actually went.
          </p>
        </div>

        <div class="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-2">
          <div>
            <span class="text-xs font-semibold text-muted-foreground block mb-1">Subject</span>
            <Combobox
              ariaLabel="Subject"
              placeholder="e.g. Physics"
              value={subject()}
              onInput={setSubject}
              options={subjects()}
            />
          </div>
          <div>
            <span class="text-xs font-semibold text-muted-foreground block mb-1">Topic</span>
            <Combobox
              ariaLabel="Topic"
              placeholder="e.g. Laws of motion"
              value={chapter()}
              onInput={setChapter}
              options={chapters()}
            />
          </div>
        </div>
        <p class="text-xs text-muted-foreground -mt-2">Not on the list? Type your own.</p>

        <fieldset class="space-y-1.5">
          <legend class="text-xs font-semibold text-muted-foreground mb-1.5">Why this topic?</legend>
          <div role="radiogroup" aria-label="Why this topic?" class="flex flex-wrap gap-1.5">
            <For each={SESSION_REASONS}>
              {(r) => (
                <button
                  type="button"
                  role="radio"
                  aria-checked={reason() === r.id}
                  onClick={() => setReason(r.id)}
                  class={`px-3 py-1.5 rounded-full border text-xs font-semibold transition-colors ${
                    reason() === r.id
                      ? 'bg-primary/10 border-primary/40 text-primary'
                      : 'bg-background border-border text-muted-foreground hover:border-primary/40 hover:text-foreground'
                  }`}
                >
                  {r.label}
                </button>
              )}
            </For>
          </div>
        </fieldset>

        <label class="block">
          <span class="text-xs font-semibold text-muted-foreground block mb-1">
            Note {noteRequired() ? '(required)' : '(optional)'}
          </span>
          <input
            type="text"
            maxLength={LIMITS.note}
            placeholder={
              noteRequired() ? 'What is the reason?' : 'e.g. I found this confusing last week'
            }
            value={note()}
            onInput={(e) => setNote(e.currentTarget.value)}
            class={field}
          />
        </label>

        {/* reserved height: the hint appearing and disappearing must not move the buttons */}
        <p class="h-4 text-xs text-muted-foreground" role="status" aria-live="polite">
          {problem() ?? 'Ready when you are.'}
        </p>

        <div class="flex flex-col gap-2">
          <button
            type="submit"
            disabled={problem() !== null}
            class="px-4 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold font-space text-sm active:scale-95 transition-transform disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
          >
            {props.confirmLabel}
          </button>
          <button
            type="button"
            onClick={props.onCancel}
            class="px-4 py-2.5 rounded-xl bg-muted border border-border text-foreground font-semibold text-sm hover:border-primary/40 active:scale-95 transition-all"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

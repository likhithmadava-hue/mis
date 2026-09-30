import { Check, Lock, NotebookPen, Plus, Trash2 } from 'lucide-solid';
import type { JSX } from 'solid-js';
import { createMemo, createSignal, For, onCleanup, onMount, Show } from 'solid-js';

import { todayIso } from '../../core/dates';
import type { DoubtList } from '../../core/db';
import { Combobox, confirmDialog, Select } from '../../core/ui';
import type { Checklist } from './checklist';
import type { DailyLogState } from './createDailyLog';
import {
  addDoubt,
  addPlanned,
  closeWrapUp,
  draft,
  draftHasContent,
  removeDoubt,
  removePlanned,
  resetWrapUp,
  setDraft,
  toggleIn,
  toWrapInput,
  wrapProblem,
  type OpenIds,
} from './wrapUp';

const LISTS: { value: DoubtList; label: string }[] = [
  { value: 'solve', label: 'Left to solve' },
  { value: 'revise', label: 'Left to revise' },
];

const field = 'h-9 px-3 bg-background border border-border rounded-lg text-xs text-foreground';

/**
 * Wrap up a study session on three levels: what got done, what is still a
 * doubt, and what comes next — plus a note. Everything stays a draft in the
 * panel until Save, which is one all-or-nothing write in Rust
 * (`db::session_wrap`), so a session is either logged whole or not at all.
 *
 * On a locked day the first two levels are shut, because they write to today.
 * Planning tomorrow, the misses and the journal entry still go through.
 */
export default function WrapUpPanel(props: { log: DailyLogState; checklist: Checklist }) {
  const log = props.log;
  const [saving, setSaving] = createSignal(false);
  let firstField: HTMLInputElement | undefined;

  // what can still be ticked: open action items, today's open DPPs, open topics
  const openTasks = createMemo(() => props.checklist.tasks().filter((t) => !t.completed));
  const openDpps = createMemo(() => log.todayDpps().filter((d) => !d.done));
  const openTopics = createMemo(() =>
    [...props.checklist.revise(), ...props.checklist.solve()].filter((t) => !t.done),
  );
  const openIds = createMemo<OpenIds>(() => ({
    tasks: new Set(openTasks().map((t) => t.id)),
    dpps: new Set(openDpps().map((d) => d.id)),
    topics: new Set(openTopics().map((t) => t.id)),
  }));

  const problem = () => wrapProblem(draft, openIds(), log.locked());

  const cancel = async () => {
    if (draftHasContent(draft)) {
      const discard = await confirmDialog({
        title: 'Discard this wrap-up?',
        body: 'Nothing in it has been saved yet.',
        tone: 'danger',
        confirmLabel: 'Discard',
        cancelLabel: 'Keep editing',
      });
      if (!discard) return;
    }
    resetWrapUp();
    closeWrapUp();
  };

  const save = async () => {
    if (problem() || saving()) return;
    setSaving(true);
    const ok = await log.wrapUp(toWrapInput(draft, openIds()));
    setSaving(false);
    if (ok) {
      resetWrapUp();
      closeWrapUp();
    }
  };

  onMount(() => {
    firstField?.focus();
    // Bubble phase and `defaultPrevented`: an open dropdown (or the discard
    // dialog, which listens in the capture phase) handles its own Escape first.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) {
        e.preventDefault();
        void cancel();
      }
    };
    window.addEventListener('keydown', onKey);
    onCleanup(() => window.removeEventListener('keydown', onKey));
  });

  return (
    <div
      class="fixed inset-0 z-[90] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-fade-in"
      onMouseDown={(e) => e.target === e.currentTarget && void cancel()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="wrap-up-title"
        class="bg-card border border-border rounded-2xl card-shadow w-full max-w-2xl max-h-[90vh] flex flex-col"
      >
        <header class="px-5 pt-5 pb-4 border-b border-border">
          <h2 id="wrap-up-title" class="text-lg font-bold font-space flex items-center gap-2">
            <NotebookPen size={18} class="text-primary" /> Wrap up session
          </h2>
          <p class="text-xs text-muted-foreground mt-1">
            Log what you did, what is still unclear, and what comes next. Nothing is saved until
            you press Save.
          </p>
        </header>

        <div class="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-6">
          {/* the session itself */}
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <input
              ref={firstField}
              class={field}
              placeholder="Subject"
              aria-label="Session subject"
              value={draft.subject}
              onInput={(e) => setDraft('subject', e.currentTarget.value)}
            />
            <input
              class={field}
              placeholder="Chapter"
              aria-label="Session chapter"
              value={draft.chapter}
              onInput={(e) => setDraft('chapter', e.currentTarget.value)}
            />
            <Combobox
              ariaLabel="Kind of session"
              placeholder="Kind"
              value={draft.kind}
              onInput={(v) => setDraft('kind', v)}
              options={log.kindOptions()}
            />
            <input
              class={field}
              type="number"
              min="0"
              step="5"
              placeholder="Minutes"
              aria-label="Minutes studied"
              value={draft.minutes}
              onInput={(e) => setDraft('minutes', e.currentTarget.value)}
            />
          </div>

          <Show when={draft.pyq}>
            {(p) => (
              <p class="rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-xs text-primary">
                PYQ practice: {p().correct} correct · {p().wrong} wrong · {p().skipped} skipped ·{' '}
                {p().marks} / {p().max_marks} marks
                <Show when={draft.mistakes.length > 0}>
                  {' '}— {draft.mistakes.length} wrong{' '}
                  {draft.mistakes.length === 1 ? 'answer goes' : 'answers go'} to the mistake log.
                </Show>
              </p>
            )}
          </Show>

          {/* 1 — tasks done */}
          <Level n={1} title="Tasks done" hint="Tick what this session finished.">
            <Show when={log.locked()}>
              <LockedNote />
            </Show>
            <fieldset disabled={log.locked()} class={log.locked() ? 'opacity-50' : ''}>
              <Show
                when={openTasks().length + openDpps().length + openTopics().length > 0}
                fallback={
                  <p class="text-xs text-muted-foreground py-1">
                    Nothing open to tick today.
                  </p>
                }
              >
                <div class="space-y-3">
                  <Group title="Action items" show={openTasks().length > 0}>
                    <For each={openTasks()}>
                      {(t) => (
                        <Tick
                          label={t.title}
                          meta={[t.kind, t.chapter].filter(Boolean).join(' · ')}
                          checked={draft.taskIds.includes(t.id)}
                          onToggle={() => toggleIn('taskIds', t.id)}
                        />
                      )}
                    </For>
                  </Group>
                  <Group title="Today's DPPs" show={openDpps().length > 0}>
                    <For each={openDpps()}>
                      {(d) => (
                        <Tick
                          label={d.topic || 'Untitled DPP'}
                          meta={[d.subject, d.teacher].filter(Boolean).join(' · ')}
                          checked={draft.dppIds.includes(d.id)}
                          onToggle={() => toggleIn('dppIds', d.id)}
                        />
                      )}
                    </For>
                  </Group>
                  <Group title="Left to revise / solve" show={openTopics().length > 0}>
                    <For each={openTopics()}>
                      {(t) => (
                        <Tick
                          label={t.name}
                          meta={[t.type === 'solve' ? 'Solve' : 'Revise', t.chapter]
                            .filter(Boolean)
                            .join(' · ')}
                          checked={draft.topicIds.includes(t.id)}
                          onToggle={() => toggleIn('topicIds', t.id)}
                        />
                      )}
                    </For>
                  </Group>
                </div>
              </Show>
            </fieldset>
          </Level>

          {/* 2 — doubts left */}
          <Level n={2} title="Doubts left" hint="Each one lands in Left to solve or Left to revise.">
            <fieldset
              disabled={log.locked()}
              class={`space-y-2 ${log.locked() ? 'opacity-50' : ''}`}
            >
              <For each={draft.doubts}>
                {(d, i) => (
                  <div class="rounded-lg border border-border bg-background p-2 space-y-2">
                    <div class="flex gap-2">
                      <input
                        class={`${field} flex-1 min-w-0`}
                        placeholder="What is still unclear?"
                        aria-label="Doubt"
                        value={d.title}
                        onInput={(e) => setDraft('doubts', i(), 'title', e.currentTarget.value)}
                      />
                      <Select
                        ariaLabel="Which list"
                        class="w-36"
                        value={d.list}
                        onChange={(v) => setDraft('doubts', i(), 'list', v)}
                        options={LISTS}
                      />
                      <RemoveButton label="Remove doubt" onClick={() => removeDoubt(d.key)} />
                    </div>
                    <div class="grid grid-cols-1 sm:grid-cols-[8rem_10rem_1fr] gap-2">
                      <input
                        class={field}
                        placeholder="Subject"
                        aria-label="Doubt subject"
                        value={d.subject}
                        onInput={(e) => setDraft('doubts', i(), 'subject', e.currentTarget.value)}
                      />
                      <input
                        class={field}
                        placeholder="Chapter"
                        aria-label="Doubt chapter"
                        value={d.chapter}
                        onInput={(e) => setDraft('doubts', i(), 'chapter', e.currentTarget.value)}
                      />
                      <input
                        class={field}
                        placeholder="Note (optional)"
                        aria-label="Doubt note"
                        value={d.note}
                        onInput={(e) => setDraft('doubts', i(), 'note', e.currentTarget.value)}
                      />
                    </div>
                  </div>
                )}
              </For>
              <AddButton onClick={addDoubt}>Add a doubt</AddButton>
            </fieldset>
          </Level>

          {/* 3 — next session */}
          <Level n={3} title="Next session" hint="New action items, due tomorrow unless you change it.">
            <div class="space-y-2">
              <For each={draft.next}>
                {(p, i) => (
                  <div class="rounded-lg border border-border bg-background p-2 space-y-2">
                    <div class="flex gap-2">
                      <input
                        class={`${field} flex-1 min-w-0`}
                        placeholder="What to do next session"
                        aria-label="Next-session task"
                        value={p.title}
                        onInput={(e) => setDraft('next', i(), 'title', e.currentTarget.value)}
                      />
                      <input
                        type="date"
                        aria-label="Due date"
                        min={log.locked() ? undefined : todayIso()}
                        value={p.due_date}
                        onInput={(e) => setDraft('next', i(), 'due_date', e.currentTarget.value)}
                        class={`${field} w-36 text-muted-foreground [color-scheme:dark]`}
                      />
                      <RemoveButton label="Remove task" onClick={() => removePlanned(p.key)} />
                    </div>
                    <div class="grid grid-cols-1 sm:grid-cols-[12rem_1fr] gap-2">
                      <Combobox
                        ariaLabel="Kind of task"
                        placeholder="Kind"
                        value={p.kind}
                        onInput={(v) => setDraft('next', i(), 'kind', v)}
                        options={log.kindOptions()}
                      />
                      <input
                        class={field}
                        placeholder="Chapter"
                        aria-label="Task chapter"
                        value={p.chapter}
                        onInput={(e) => setDraft('next', i(), 'chapter', e.currentTarget.value)}
                      />
                    </div>
                  </div>
                )}
              </For>
              <AddButton onClick={addPlanned}>Add a task</AddButton>
            </div>
          </Level>

          <label class="block space-y-1.5">
            <span class="text-xs font-bold font-space">Note</span>
            <textarea
              rows="3"
              placeholder="Anything worth remembering about this session (optional)"
              value={draft.note}
              onInput={(e) => setDraft('note', e.currentTarget.value)}
              class="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs text-foreground resize-y"
            />
          </label>
        </div>

        <footer class="px-5 py-4 border-t border-border flex flex-wrap items-center gap-3">
          {/* always drawn, so the footer never jumps when the reason clears */}
          <p class="flex-1 min-w-[12rem] text-xs text-muted-foreground min-h-[1rem]" aria-live="polite">
            {problem() ?? ''}
          </p>
          <button
            type="button"
            onClick={() => void cancel()}
            class="px-4 py-2 rounded-xl bg-muted border border-border text-foreground font-semibold text-sm hover:border-primary/40 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={problem() !== null || saving()}
            class="px-4 py-2 rounded-xl bg-primary text-primary-foreground font-bold font-space text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving() ? 'Saving…' : 'Save session'}
          </button>
        </footer>
      </div>
    </div>
  );
}

function Level(props: { n: number; title: string; hint: string; children: JSX.Element }) {
  return (
    <section class="space-y-2.5">
      <div class="flex items-baseline gap-2">
        <span class="w-5 h-5 flex-shrink-0 rounded-md bg-primary/15 text-primary text-[0.6875rem] font-bold font-mono grid place-items-center">
          {props.n}
        </span>
        <h3 class="text-sm font-bold font-space">{props.title}</h3>
        <span class="text-[0.6875rem] text-muted-foreground">{props.hint}</span>
      </div>
      {props.children}
    </section>
  );
}

function Group(props: { title: string; show: boolean; children: JSX.Element }) {
  return (
    <Show when={props.show}>
      <div class="space-y-1.5">
        <p class="text-[0.625rem] uppercase tracking-wider font-bold text-muted-foreground">
          {props.title}
        </p>
        {props.children}
      </div>
    </Show>
  );
}

function Tick(props: { label: string; meta: string; checked: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={props.checked}
      onClick={() => props.onToggle()}
      class={`w-full flex items-start gap-2.5 rounded-lg border px-2.5 py-2 text-left transition-colors ${
        props.checked ? 'bg-success/5 border-success/30' : 'bg-background border-border hover:border-primary/40'
      }`}
    >
      <span
        class={`mt-px w-5 h-5 flex-shrink-0 rounded-md border flex items-center justify-center ${
          props.checked ? 'bg-success/20 border-success text-success' : 'bg-muted border-border text-transparent'
        }`}
      >
        <Check size={12} stroke-width={3} />
      </span>
      <span class="flex-1 min-w-0">
        <span class="block text-xs leading-snug line-clamp-2" title={props.label}>
          {props.label}
        </span>
        <Show when={props.meta}>
          <span class="block text-[0.6875rem] text-muted-foreground truncate">{props.meta}</span>
        </Show>
      </span>
    </button>
  );
}

function LockedNote() {
  return (
    <p class="flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-xs text-primary">
      <Lock size={13} class="flex-shrink-0 mt-0.5" />
      Today is submitted and locked, so nothing from today can be ticked and no doubts can be
      added. You can still plan the next session and save the note.
    </p>
  );
}

function AddButton(props: { onClick: () => void; children: JSX.Element }) {
  return (
    <button
      type="button"
      onClick={() => props.onClick()}
      class="h-8 px-3 rounded-lg border border-dashed border-border text-xs font-semibold text-muted-foreground flex items-center gap-1.5 hover:border-primary/40 hover:text-foreground transition-colors"
    >
      <Plus size={13} /> {props.children}
    </button>
  );
}

function RemoveButton(props: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={() => props.onClick()}
      aria-label={props.label}
      title={props.label}
      class="h-9 w-9 flex-shrink-0 grid place-items-center rounded-lg text-subtle-foreground hover:text-destructive transition-colors"
    >
      <Trash2 size={14} />
    </button>
  );
}

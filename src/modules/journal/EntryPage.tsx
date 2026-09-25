import { ArrowRight, CircleHelp, ListChecks, Save, Trash2, X } from 'lucide-solid';
import type { JSX } from 'solid-js';
import { createEffect, createSignal, For, on, Show } from 'solid-js';
import { Dynamic } from 'solid-js/web';

import { longDate, shortDate, todayIso } from '../../core/dates';
import {
  act,
  api,
  errorMessage,
  type AppMode,
  type JournalEntry,
  type JournalPatch,
} from '../../core/db';
import { Combobox, confirmDialog, messageDialog, type Icon } from '../../core/ui';
import { formatMinutes, isSession, savedAt } from './journalData';

interface EntryPageProps {
  /** the entry being read, or `null` while writing a new one */
  entry: JournalEntry | null;
  mode: AppMode;
  /** kinds already used in this journal, offered as suggestions */
  kinds: string[];
  onSaved: (id: string) => void;
  onCancel: () => void;
  onDeleted: () => void;
}

const field =
  'w-full h-9 px-3 bg-background border border-border rounded-lg text-xs text-foreground';

/**
 * One page of the journal: what an entry says, and the means to write it.
 *
 * There is no separate "edit mode". The page you read is the page you write on,
 * because a diary that has to be unlocked with an Edit button is one people
 * stop adding to. Save only wakes up once something has actually changed.
 *
 * What a page asks for depends on which journal it belongs to. The **Life
 * diary** asks for a date, a heading and the writing, and nothing else. The
 * **Academic logbook** also carries subject, chapter, kind and minutes, so a
 * hand-written page sits in the same list as a wrapped-up session and reads
 * the same way. A session's three levels are shown underneath, read-only —
 * they are a record of what happened, not prose to revise.
 */
export default function EntryPage(props: EntryPageProps) {
  const academic = () => props.mode === 'academic';
  const writing = () => props.entry === null;

  const [date, setDate] = createSignal(todayIso());
  const [title, setTitle] = createSignal('');
  const [subject, setSubject] = createSignal('');
  const [chapter, setChapter] = createSignal('');
  const [kind, setKind] = createSignal('');
  const [minutes, setMinutes] = createSignal('');
  const [note, setNote] = createSignal('');
  const [busy, setBusy] = createSignal(false);

  /** fill the page from whatever it is showing — a stored entry, or a blank */
  const load = () => {
    const e = props.entry;
    setDate(e?.date ?? todayIso());
    setTitle(e?.title ?? '');
    setSubject(e?.subject ?? '');
    setChapter(e?.chapter ?? '');
    setKind(e?.kind ?? '');
    setMinutes(e && e.minutes > 0 ? String(e.minutes) : '');
    setNote(e?.note ?? '');
  };
  load();
  // switching to another entry must not carry half-typed text across
  createEffect(on(() => props.entry?.id ?? null, load, { defer: true }));

  const minutesValue = () => (minutes().trim() === '' ? 0 : Number(minutes()));
  const minutesOk = () => Number.isFinite(minutesValue()) && minutesValue() >= 0;
  const hasWords = () => title().trim() !== '' || note().trim() !== '';

  const changed = () => {
    const e = props.entry;
    if (!e) return hasWords() || subject().trim() !== '' || chapter().trim() !== '';
    return (
      date() !== e.date ||
      title().trim() !== (e.title ?? '').trim() ||
      subject().trim() !== e.subject.trim() ||
      chapter().trim() !== e.chapter.trim() ||
      kind().trim() !== e.kind.trim() ||
      minutesValue() !== e.minutes ||
      note().trim() !== e.note.trim()
    );
  };

  const problem = () => {
    if (!minutesOk()) return 'Minutes must be a number.';
    if (!hasWords()) return 'Give the entry a title, or write something in it.';
    return null;
  };
  const canSave = () => changed() && problem() === null && !busy();

  const save = async () => {
    if (!canSave()) return;
    setBusy(true);
    try {
      if (writing()) {
        const id = await act(
          api.addJournalEntry({
            mode: props.mode,
            date: date(),
            title: title(),
            subject: subject(),
            chapter: chapter(),
            kind: kind(),
            minutes: minutesValue(),
            note: note(),
          }),
        );
        props.onSaved(id);
      } else {
        const patch: JournalPatch = {
          date: date(),
          title: title(),
          subject: subject(),
          chapter: chapter(),
          kind: kind(),
          minutes: minutesValue(),
          note: note(),
        };
        await act(api.updateJournalEntry(props.entry!.id, patch));
        props.onSaved(props.entry!.id);
      }
    } catch (err) {
      await messageDialog({ title: 'The entry was not saved', body: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    if (changed()) {
      const discard = await confirmDialog({
        title: writing() ? 'Discard this entry?' : 'Discard these changes?',
        body: 'What you have typed here has not been saved.',
        tone: 'danger',
        confirmLabel: 'Discard',
        cancelLabel: 'Keep writing',
      });
      if (!discard) return;
    }
    props.onCancel();
  };

  const remove = async () => {
    const e = props.entry;
    if (!e) return;
    const yes = await confirmDialog({
      title: 'Delete this entry?',
      body: isSession(e)
        ? 'The entry is removed from the journal. What the session recorded — ticked tasks, doubts, planned tasks and logged mistakes — stays where it was written.'
        : 'This page is removed from the journal. Nothing else changes.',
      tone: 'danger',
      confirmLabel: 'Delete',
    });
    if (!yes) return;
    setBusy(true);
    try {
      await act(api.deleteJournalEntry(e.id));
      props.onDeleted();
    } catch (err) {
      await messageDialog({ title: 'The entry was not deleted', body: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div class="bg-card rounded-2xl border border-border card-shadow p-4 sm:p-6 space-y-5 min-w-0">
      {/* the date is the page's masthead, as it is in a paper diary */}
      <div class="flex flex-wrap items-center gap-3 border-b border-border pb-4">
        <div class="flex-1 min-w-[12rem]">
          <input
            type="date"
            aria-label="Date of this entry"
            value={date()}
            onInput={(e) => setDate(e.currentTarget.value)}
            class="bg-transparent border-none p-0 text-sm font-bold font-space text-foreground [color-scheme:dark] focus:outline-none"
          />
          <p class="text-[0.6875rem] text-muted-foreground mt-0.5">
            {longDate(date() || todayIso())}
            <Show when={props.entry && savedAt(props.entry)}>
              {(t) => <> · written {t()}</>}
            </Show>
          </p>
        </div>
        <Show when={!writing()}>
          <button
            type="button"
            onClick={() => void remove()}
            disabled={busy()}
            class="h-9 px-3 rounded-lg bg-muted border border-border text-xs font-semibold text-muted-foreground flex items-center gap-1.5 hover:text-destructive hover:border-destructive/40 transition-colors disabled:opacity-50"
          >
            <Trash2 size={13} /> Delete
          </button>
        </Show>
      </div>

      <input
        type="text"
        aria-label="Title"
        placeholder={academic() ? 'What this page is about' : 'Give the day a heading'}
        value={title()}
        onInput={(e) => setTitle(e.currentTarget.value)}
        class="w-full bg-transparent border-none p-0 text-xl font-bold font-space text-foreground placeholder:text-subtle-foreground focus:outline-none"
      />

      {/* the logbook's extra columns — the diary has no use for them */}
      <Show when={academic()}>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <input
            class={field}
            placeholder="Subject"
            aria-label="Subject"
            value={subject()}
            onInput={(e) => setSubject(e.currentTarget.value)}
          />
          <input
            class={field}
            placeholder="Chapter"
            aria-label="Chapter"
            value={chapter()}
            onInput={(e) => setChapter(e.currentTarget.value)}
          />
          <Combobox
            ariaLabel="Kind of work"
            placeholder="Kind"
            value={kind()}
            onInput={setKind}
            options={props.kinds}
          />
          <input
            class={field}
            type="number"
            min="0"
            step="5"
            placeholder="Minutes"
            aria-label="Minutes"
            value={minutes()}
            onInput={(e) => setMinutes(e.currentTarget.value)}
          />
        </div>
      </Show>

      <textarea
        rows={academic() ? 8 : 14}
        aria-label="What happened"
        placeholder={
          academic()
            ? 'What you worked through, what went well, what to fix next time…'
            : 'How the day went…'
        }
        value={note()}
        onInput={(e) => setNote(e.currentTarget.value)}
        class={`w-full px-3 py-2.5 bg-background border border-border rounded-xl text-foreground resize-y leading-relaxed ${
          academic() ? 'text-xs' : 'text-sm'
        }`}
      />

      {/* what the wrap-up recorded: shown, never edited here */}
      <Show when={props.entry && isSession(props.entry)}>
        <div class="space-y-5 border-t border-border pt-5">
          <p class="text-[0.625rem] uppercase tracking-wider font-bold text-muted-foreground">
            Recorded by the session wrap-up
          </p>

          <Show when={props.entry!.pyq}>
            {(p) => (
              <div class="rounded-xl border border-primary/25 bg-primary/5 px-3 py-2.5">
                <p class="text-[0.625rem] uppercase tracking-wider font-bold text-primary">
                  PYQ practice
                </p>
                <p class="mt-1 text-xs text-foreground font-mono">
                  {p().correct} correct · {p().wrong} wrong · {p().skipped} skipped · {p().marks} /{' '}
                  {p().max_marks} marks
                </p>
              </div>
            )}
          </Show>

          <Section n={1} icon={ListChecks} title="Tasks done" count={props.entry!.tasks_done.length}>
            <For each={props.entry!.tasks_done}>
              {(t) => (
                <Row title={t.title}>
                  <Show when={t.kind}>
                    <Tag text={t.kind} />
                  </Show>
                </Row>
              )}
            </For>
          </Section>

          <Section n={2} icon={CircleHelp} title="Doubts left" count={props.entry!.doubts.length}>
            <For each={props.entry!.doubts}>
              {(d) => (
                <Row title={d.title} detail={d.note}>
                  <Tag text={d.list === 'solve' ? 'Left to solve' : 'Left to revise'} />
                  <Show when={d.chapter}>
                    <Tag text={d.chapter} muted />
                  </Show>
                </Row>
              )}
            </For>
          </Section>

          <Section n={3} icon={ArrowRight} title="Next session" count={props.entry!.next_plan.length}>
            <For each={props.entry!.next_plan}>
              {(p) => (
                <Row title={p.title}>
                  <Show when={p.kind}>
                    <Tag text={p.kind} />
                  </Show>
                  <Show when={p.due_date}>
                    <span class="text-[0.625rem] font-mono text-muted-foreground">
                      due {shortDate(p.due_date)}
                    </span>
                  </Show>
                </Row>
              )}
            </For>
          </Section>
        </div>
      </Show>

      <div class="flex flex-wrap items-center gap-3 border-t border-border pt-4">
        <p class="flex-1 min-w-[10rem] text-xs text-muted-foreground" aria-live="polite">
          <Show when={changed()} fallback={props.entry ? formatMinutes(props.entry.minutes) : ''}>
            {problem() ?? 'Unsaved changes.'}
          </Show>
        </p>
        <Show when={writing() || changed()}>
          <button
            type="button"
            onClick={() => void cancel()}
            class="px-4 py-2 rounded-xl bg-muted border border-border text-foreground font-semibold text-sm hover:border-primary/40 transition-colors flex items-center gap-1.5"
          >
            <X size={14} /> Cancel
          </button>
        </Show>
        <button
          type="button"
          onClick={() => void save()}
          disabled={!canSave()}
          class="px-4 py-2 rounded-xl bg-primary text-primary-foreground font-bold font-space text-sm flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Save size={14} /> {busy() ? 'Saving…' : writing() ? 'Save entry' : 'Save changes'}
        </button>
      </div>
    </div>
  );
}

function Section(props: {
  n: number;
  icon: Icon;
  title: string;
  count: number;
  children: JSX.Element;
}) {
  return (
    <section class="space-y-2">
      <div class="flex items-center gap-2">
        <span class="w-5 h-5 flex-shrink-0 rounded-md bg-primary/15 text-primary text-[0.6875rem] font-bold font-mono grid place-items-center">
          {props.n}
        </span>
        <Dynamic component={props.icon} size={14} class="flex-shrink-0 text-muted-foreground" />
        <h4 class="text-sm font-bold font-space">{props.title}</h4>
        <span class="text-[0.6875rem] font-mono text-muted-foreground">{props.count}</span>
      </div>
      <Show
        when={props.count > 0}
        fallback={<p class="text-xs text-muted-foreground pl-7">Nothing recorded here.</p>}
      >
        <div class="space-y-1.5 pl-7">{props.children}</div>
      </Show>
    </section>
  );
}

function Row(props: { title: string; detail?: string; children?: JSX.Element }) {
  return (
    <div class="rounded-lg border border-border bg-background px-2.5 py-2">
      <div class="flex items-start gap-2">
        <span class="flex-1 min-w-0 text-xs leading-snug break-words">{props.title}</span>
        <span class="flex flex-shrink-0 flex-wrap items-center justify-end gap-1.5">
          {props.children}
        </span>
      </div>
      <Show when={props.detail}>
        <p class="mt-0.5 text-[0.6875rem] text-muted-foreground leading-snug">{props.detail}</p>
      </Show>
    </div>
  );
}

function Tag(props: { text: string; muted?: boolean }) {
  return (
    <span
      title={props.text}
      class={`text-[0.625rem] px-1.5 py-0.5 rounded max-w-[9rem] truncate ${
        props.muted ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary'
      }`}
    >
      {props.text}
    </span>
  );
}

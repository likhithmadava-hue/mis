import { ArrowRight, CircleHelp, ListChecks, NotebookText, Save, Trash2 } from 'lucide-solid';
import type { JSX } from 'solid-js';
import { createEffect, createMemo, createSignal, For, on, Show } from 'solid-js';
import { Dynamic } from 'solid-js/web';

import { longDate, shortDate, todayIso } from '../../core/dates';
import { act, api, db, errorMessage, setMode, type JournalEntry } from '../../core/db';
import {
  confirmDialog,
  EmptyState,
  messageDialog,
  navigateTo,
  Select,
  viewState,
  Workspace,
  type Icon,
} from '../../core/ui';
import {
  ALL,
  filterEntries,
  formatMinutes,
  groupByDay,
  kindsOf,
  savedAt,
  subjectsOf,
  totalMinutes,
} from './journalData';

/**
 * The Journal — one entry per study session you wrapped up.
 *
 * It is the only screen in MIS that reads a session back as a whole: what got
 * done, what was still unclear, what comes next, and the note written at the
 * time. Every entry is written by the Daily Log's wrap-up in a single call
 * (`db::session_wrap`), so this tab never composes a session itself — it shows
 * and annotates what was recorded.
 *
 * The three lists are **snapshots taken when the session was saved**, not links
 * to live rows. A task deleted next week does not rewrite what you did today,
 * which is the point of a journal rather than a to-do list.
 */
export default function Journal() {
  const [subject, setSubject] = viewState<string>('journal.subject', ALL);
  const [kind, setKind] = viewState<string>('journal.kind', ALL);
  const [selectedId, setSelectedId] = viewState<string | null>('journal.selected', null);

  const entries = () => db.journal;
  const subjects = createMemo(() => subjectsOf(entries()));
  const kinds = createMemo(() => kindsOf(entries()));

  // A filter whose value has since disappeared — the last Physics session was
  // deleted — would otherwise hide everything with no way back.
  const liveSubject = () => (subject() !== ALL && !subjects().includes(subject()) ? ALL : subject());
  const liveKind = () => (kind() !== ALL && !kinds().includes(kind()) ? ALL : kind());

  const shown = createMemo(() => filterEntries(entries(), liveSubject(), liveKind()));
  const days = createMemo(() => groupByDay(shown()));
  const selected = createMemo(() => shown().find((e) => e.id === selectedId()) ?? null);
  const filtered = () => liveSubject() !== ALL || liveKind() !== ALL;

  const clearFilters = () => {
    setSubject(ALL);
    setKind(ALL);
  };

  const header = (
    <div class="bg-card rounded-2xl border border-border card-shadow p-4 sm:p-5 flex flex-wrap items-center gap-4">
      <div class="w-12 h-12 flex-shrink-0 rounded-2xl border border-primary/25 bg-primary/10 text-primary grid place-items-center">
        <NotebookText size={22} />
      </div>
      <div class="flex-1 min-w-[12rem]">
        <h3 class="text-lg font-bold font-space">Session Journal</h3>
        <p class="text-xs text-muted-foreground mt-1 leading-relaxed">
          {shown().length} {shown().length === 1 ? 'session' : 'sessions'} ·{' '}
          {formatMinutes(totalMinutes(shown()))} logged{filtered() ? ' in this view' : ''}
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <Select
          ariaLabel="Filter by subject"
          class="w-40"
          value={liveSubject()}
          onChange={setSubject}
          options={[
            { value: ALL, label: 'All subjects' },
            ...subjects().map((s) => ({ value: s, label: s })),
          ]}
        />
        <Select
          ariaLabel="Filter by kind"
          class="w-44"
          value={liveKind()}
          onChange={setKind}
          options={[
            { value: ALL, label: 'All kinds' },
            ...kinds().map((k) => ({ value: k, label: k })),
          ]}
        />
      </div>
    </div>
  );

  return (
    <Workspace header={header}>
      <Show
        when={entries().length > 0}
        fallback={
          <div class="bg-card rounded-2xl border border-border card-shadow">
            <EmptyState
              icon={NotebookText}
              title="No sessions logged yet"
              message="Finish a study session, then use Wrap up session in the Daily Log (Academic mode). Each wrap-up lands here as one entry."
              action={{
                label: 'Open the Daily Log',
                onClick: () => void setMode('academic').then(() => navigateTo('log')),
              }}
            />
          </div>
        }
      >
        <Show
          when={shown().length > 0}
          fallback={
            <div class="bg-card rounded-2xl border border-border card-shadow">
              <EmptyState
                icon={NotebookText}
                title="Nothing matches these filters"
                message="No session in the journal has both of the things you filtered for."
                action={{ label: 'Clear filters', onClick: clearFilters }}
              />
            </div>
          }
        >
          <div class="grid gap-4 items-start lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
            <div class="space-y-4 min-w-0">
              <For each={days()}>
                {(day) => (
                  <section class="space-y-2">
                    <h4 class="text-[0.6875rem] uppercase tracking-wider font-bold text-muted-foreground px-1">
                      {day.date === todayIso() ? 'Today' : longDate(day.date)}
                    </h4>
                    <For each={day.entries}>
                      {(e) => (
                        <EntryCard
                          entry={e}
                          active={e.id === selectedId()}
                          onPick={() => setSelectedId(e.id)}
                        />
                      )}
                    </For>
                  </section>
                )}
              </For>
            </div>

            <Show
              when={selected()}
              fallback={
                <div class="bg-card rounded-2xl border border-border card-shadow">
                  <EmptyState
                    compact
                    icon={ArrowRight}
                    message="Pick a session to read what it recorded."
                  />
                </div>
              }
            >
              {(entry) => <Detail entry={entry()} onDeleted={() => setSelectedId(null)} />}
            </Show>
          </div>
        </Show>
      </Show>
    </Workspace>
  );
}

/** one session in the list — the summary that decides whether you open it */
function EntryCard(props: { entry: JournalEntry; active: boolean; onPick: () => void }) {
  const e = () => props.entry;
  const title = () =>
    [e().subject, e().chapter].filter(Boolean).join(' · ') || e().kind || 'Session';
  const counts = () =>
    [
      `${e().tasks_done.length} done`,
      `${e().doubts.length} ${e().doubts.length === 1 ? 'doubt' : 'doubts'}`,
      `${e().next_plan.length} planned`,
    ].join(' · ');

  return (
    <button
      type="button"
      onClick={() => props.onPick()}
      aria-current={props.active ? 'true' : undefined}
      class={`w-full text-left rounded-xl border p-3 transition-colors ${
        props.active
          ? 'bg-primary/10 border-primary/40'
          : 'bg-card border-border hover:border-primary/30'
      }`}
    >
      <div class="flex items-start gap-2">
        <span class="flex-1 min-w-0 text-sm font-semibold font-space leading-snug line-clamp-2">
          {title()}
        </span>
        <span class="flex-shrink-0 text-[0.6875rem] font-mono text-muted-foreground">
          {formatMinutes(e().minutes)}
        </span>
      </div>
      <div class="mt-1.5 flex flex-wrap items-center gap-1.5">
        <Show when={e().kind}>
          <span class="text-[0.625rem] px-1.5 py-0.5 rounded bg-primary/10 text-primary max-w-[9rem] truncate">
            {e().kind}
          </span>
        </Show>
        <Show when={e().pyq}>
          {(p) => (
            <span class="text-[0.625rem] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono">
              PYQ {p().correct}/{p().correct + p().wrong + p().skipped}
            </span>
          )}
        </Show>
      </div>
      <p class="mt-1.5 text-[0.6875rem] text-muted-foreground font-mono">{counts()}</p>
      <Show when={e().note}>
        <p class="mt-1 text-[0.6875rem] text-subtle-foreground line-clamp-1">{e().note}</p>
      </Show>
    </button>
  );
}

/** the whole session, and the two things about it that can still be changed */
function Detail(props: { entry: JournalEntry; onDeleted: () => void }) {
  const e = () => props.entry;
  const [note, setNote] = createSignal(props.entry.note);
  const [busy, setBusy] = createSignal(false);

  // switching to another session must not carry the half-edited note across
  createEffect(
    on(
      () => e().id,
      () => setNote(e().note),
      { defer: true },
    ),
  );
  const noteChanged = () => note().trim() !== e().note.trim();

  const saveNote = async () => {
    if (!noteChanged() || busy()) return;
    setBusy(true);
    try {
      await act(api.updateJournalNote(e().id, note()));
    } catch (err) {
      await messageDialog({ title: 'The note was not saved', body: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    const yes = await confirmDialog({
      title: 'Delete this session?',
      body: 'The entry is removed from the journal. What it recorded — ticked tasks, doubts, planned tasks and logged mistakes — stays where it was written.',
      tone: 'danger',
      confirmLabel: 'Delete',
    });
    if (!yes) return;
    setBusy(true);
    try {
      await act(api.deleteJournalEntry(e().id));
      props.onDeleted();
    } catch (err) {
      await messageDialog({ title: 'The entry was not deleted', body: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div class="bg-card rounded-2xl border border-border card-shadow p-4 sm:p-5 space-y-5 min-w-0">
      <div class="flex flex-wrap items-start gap-3 border-b border-border pb-4">
        <div class="flex-1 min-w-[12rem]">
          <h3 class="text-base font-bold font-space">
            {[e().subject, e().chapter].filter(Boolean).join(' · ') || 'Session'}
          </h3>
          <p class="text-xs text-muted-foreground mt-1">
            {longDate(e().date)}
            <Show when={savedAt(e())}>{(t) => <> · saved {t()}</>}</Show>
            <Show when={e().kind}> · {e().kind}</Show> · {formatMinutes(e().minutes)}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void remove()}
          disabled={busy()}
          class="h-9 px-3 rounded-lg bg-muted border border-border text-xs font-semibold text-muted-foreground flex items-center gap-1.5 hover:text-destructive hover:border-destructive/40 transition-colors disabled:opacity-50"
        >
          <Trash2 size={13} /> Delete
        </button>
      </div>

      <Show when={e().pyq}>
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

      <Section n={1} icon={ListChecks} title="Tasks done" count={e().tasks_done.length}>
        <For each={e().tasks_done}>
          {(t) => (
            <Row title={t.title}>
              <Show when={t.kind}>
                <Tag text={t.kind} />
              </Show>
            </Row>
          )}
        </For>
      </Section>

      <Section n={2} icon={CircleHelp} title="Doubts left" count={e().doubts.length}>
        <For each={e().doubts}>
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

      <Section n={3} icon={ArrowRight} title="Next session" count={e().next_plan.length}>
        <For each={e().next_plan}>
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

      <div class="space-y-2">
        <p class="text-xs font-bold font-space">Note</p>
        <textarea
          rows="3"
          value={note()}
          onInput={(ev) => setNote(ev.currentTarget.value)}
          placeholder="Anything worth remembering about this session"
          aria-label="Session note"
          class="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs text-foreground resize-y"
        />
        <div class="flex justify-end">
          <button
            type="button"
            onClick={() => void saveNote()}
            disabled={!noteChanged() || busy()}
            class="h-8 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-bold font-space flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save size={13} /> Save note
          </button>
        </div>
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

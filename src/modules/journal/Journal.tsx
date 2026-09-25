import { BookHeart, NotebookText, Plus } from 'lucide-solid';
import { createEffect, createMemo, createSignal, For, on, Show } from 'solid-js';
import { Dynamic } from 'solid-js/web';

import { longDate, todayIso } from '../../core/dates';
import { db, type AppMode, type JournalEntry } from '../../core/db';
import { EmptyState, Select, viewState, Workspace } from '../../core/ui';
import EntryPage from './EntryPage';
import {
  ALL,
  entriesFor,
  filterEntries,
  formatMinutes,
  groupByDay,
  headingOf,
  isSession,
  kindsOf,
  subjectsOf,
  totalMinutes,
} from './journalData';

/**
 * The Journal — two journals, actually, one per mode.
 *
 * **Academic** is a study logbook: formal, and structured like the work it
 * records. Every session wrap-up lands here on its own, and pages can also be
 * written by hand with the same columns — subject, chapter, kind, minutes.
 *
 * **Life** is a diary: a date, a heading and a page to write on.
 *
 * They are separate on purpose, the same way the two modes score separately. A
 * bad Tuesday belongs in one and a Rotational Motion session in the other, and
 * neither should have to be scrolled past to find the other. An entry is stored
 * with the mode it was written in (`JournalEntry.mode`), so switching modes
 * changes which journal you are looking at, never what it contains.
 *
 * Writing happens here, in the tab, whenever you want — the wrap-up is one way
 * an entry appears, not the only one.
 */

// One remembered selection per journal: coming back to Life should not land on
// the Physics session you last read in Academic.
const SELECTION = {
  academic: viewState<string | null>('journal.selected.academic', null),
  life: viewState<string | null>('journal.selected.life', null),
};

const META: Record<AppMode, { title: string; blurb: string; icon: typeof NotebookText }> = {
  academic: {
    title: 'Study Logbook',
    blurb: 'Every session you wrapped up, plus anything you write here yourself.',
    icon: NotebookText,
  },
  life: {
    title: 'Diary',
    blurb: 'Your own pages — write whenever you like, about whatever you like.',
    icon: BookHeart,
  },
};

export default function Journal(props: { mode: () => AppMode }) {
  const academic = () => props.mode() === 'academic';
  const meta = () => META[props.mode()];

  const selection = () => SELECTION[props.mode()];
  const selectedId = () => selection()[0]();
  const setSelectedId = (id: string | null) => selection()[1](id);

  /** true while a blank page is open and not yet saved */
  const [writing, setWriting] = createSignal(false);

  const [subject, setSubject] = viewState<string>('journal.subject', ALL);
  const [kind, setKind] = viewState<string>('journal.kind', ALL);

  const mine = createMemo(() => entriesFor(db.journal, props.mode()));
  const subjects = createMemo(() => subjectsOf(mine()));
  const kinds = createMemo(() => kindsOf(mine()));

  // A filter whose value has since disappeared — the last Physics page was
  // deleted — would otherwise hide everything with no way back.
  const liveSubject = () =>
    academic() && subject() !== ALL && !subjects().includes(subject()) ? ALL : subject();
  const liveKind = () => (academic() && kind() !== ALL && !kinds().includes(kind()) ? ALL : kind());
  const filtered = () => academic() && (liveSubject() !== ALL || liveKind() !== ALL);

  const shown = createMemo(() =>
    academic() ? filterEntries(mine(), liveSubject(), liveKind()) : mine(),
  );
  const days = createMemo(() => groupByDay(shown()));
  const selected = createMemo(() => shown().find((e) => e.id === selectedId()) ?? null);

  // leaving a half-written page behind when the mode changes would be a trap:
  // the Save button would write it into a journal you are no longer looking at
  createEffect(on(props.mode, () => setWriting(false), { defer: true }));

  const startWriting = () => {
    setSelectedId(null);
    setWriting(true);
  };

  const clearFilters = () => {
    setSubject(ALL);
    setKind(ALL);
  };

  const header = (
    <div class="bg-card rounded-2xl border border-border card-shadow p-4 sm:p-5 flex flex-wrap items-center gap-4">
      <div class="w-12 h-12 flex-shrink-0 rounded-2xl border border-primary/25 bg-primary/10 text-primary grid place-items-center">
        <Dynamic component={meta().icon} size={22} />
      </div>
      <div class="flex-1 min-w-[13rem]">
        <h3 class="text-lg font-bold font-space">{meta().title}</h3>
        <p class="text-xs text-muted-foreground mt-1 leading-relaxed">
          <Show when={shown().length > 0} fallback={meta().blurb}>
            {shown().length} {shown().length === 1 ? 'entry' : 'entries'}
            <Show when={academic()}> · {formatMinutes(totalMinutes(shown()))} logged</Show>
            {filtered() ? ' in this view' : ''}
          </Show>
        </p>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        {/* the logbook is long and worth filtering; the diary is read by date */}
        <Show when={academic() && mine().length > 0}>
          <Select
            ariaLabel="Filter by subject"
            class="w-36"
            value={liveSubject()}
            onChange={setSubject}
            options={[
              { value: ALL, label: 'All subjects' },
              ...subjects().map((s) => ({ value: s, label: s })),
            ]}
          />
          <Select
            ariaLabel="Filter by kind"
            class="w-40"
            value={liveKind()}
            onChange={setKind}
            options={[
              { value: ALL, label: 'All kinds' },
              ...kinds().map((k) => ({ value: k, label: k })),
            ]}
          />
        </Show>
        <button
          type="button"
          onClick={startWriting}
          class="h-9 px-3.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold font-space flex items-center gap-1.5 hover:brightness-110 transition"
        >
          <Plus size={14} /> {academic() ? 'New page' : 'New entry'}
        </button>
      </div>
    </div>
  );

  return (
    <Workspace header={header}>
      <div class="grid gap-4 items-start lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
        <div class="space-y-4 min-w-0">
          <Show
            when={shown().length > 0}
            fallback={
              <div class="bg-card rounded-2xl border border-border card-shadow">
                <Show
                  when={mine().length > 0}
                  fallback={
                    <EmptyState
                      icon={meta().icon}
                      title={academic() ? 'The logbook is empty' : 'Nothing written yet'}
                      message={
                        academic()
                          ? 'Wrap up a study session in the Daily Log, or write a page here yourself.'
                          : 'Write your first entry — a heading and whatever you want to say about the day.'
                      }
                    />
                  }
                >
                  <EmptyState
                    compact
                    icon={meta().icon}
                    message="Nothing matches these filters."
                    action={{ label: 'Clear filters', onClick: clearFilters }}
                  />
                </Show>
              </div>
            }
          >
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
                        academic={academic()}
                        active={!writing() && e.id === selectedId()}
                        onPick={() => {
                          setWriting(false);
                          setSelectedId(e.id);
                        }}
                      />
                    )}
                  </For>
                </section>
              )}
            </For>
          </Show>
        </div>

        <Show
          when={writing() || selected()}
          fallback={
            <div class="bg-card rounded-2xl border border-border card-shadow">
              <EmptyState
                compact
                icon={meta().icon}
                message={
                  shown().length > 0
                    ? 'Pick an entry to read it, or start a new one.'
                    : 'Start writing whenever you like.'
                }
                action={{
                  label: academic() ? 'New page' : 'New entry',
                  onClick: startWriting,
                }}
              />
            </div>
          }
        >
          <EntryPage
            entry={writing() ? null : selected()}
            mode={props.mode()}
            kinds={kinds()}
            onSaved={(id) => {
              setWriting(false);
              setSelectedId(id);
            }}
            onCancel={() => setWriting(false)}
            onDeleted={() => {
              setWriting(false);
              setSelectedId(null);
            }}
          />
        </Show>
      </div>
    </Workspace>
  );
}

/** one entry in the list — the summary that decides whether you open it */
function EntryCard(props: {
  entry: JournalEntry;
  academic: boolean;
  active: boolean;
  onPick: () => void;
}) {
  const e = () => props.entry;
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
          {headingOf(e())}
        </span>
        <Show when={e().minutes > 0}>
          <span class="flex-shrink-0 text-[0.6875rem] font-mono text-muted-foreground">
            {formatMinutes(e().minutes)}
          </span>
        </Show>
      </div>

      <Show when={props.academic}>
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
        <Show when={isSession(e())}>
          <p class="mt-1.5 text-[0.6875rem] text-muted-foreground font-mono">{counts()}</p>
        </Show>
      </Show>

      <Show when={e().note}>
        <p
          class={`mt-1 text-[0.6875rem] text-subtle-foreground ${
            props.academic ? 'line-clamp-1' : 'line-clamp-2'
          }`}
        >
          {e().note}
        </p>
      </Show>
    </button>
  );
}

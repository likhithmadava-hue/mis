import { createSignal } from 'solid-js';
import { createStore, reconcile } from 'solid-js/store';

import { todayIso, tomorrowIso } from '../../core/dates';
import type { DoubtList, NewEntry, PyqResult, WrapInput } from '../../core/db';

/**
 * The session wrap-up's draft, and the switch that opens the panel.
 *
 * Both live at module level rather than in a component, for two reasons. The
 * panel can be opened from outside the Daily Log — Practice and the Focus
 * Timer call `openWrapUp` with what they already know (the chapter, the
 * minutes, the PYQ result and the misses) — and a half-written wrap-up must
 * not vanish because a tab re-rendered. It is deliberately **not** persisted:
 * a draft is not data until Save sends it to the vault in one write.
 */

export interface DraftDoubt {
  key: number;
  title: string;
  subject: string;
  chapter: string;
  note: string;
  list: DoubtList;
}

export interface DraftPlanned {
  key: number;
  title: string;
  subject: string;
  kind: string;
  chapter: string;
  due_date: string;
}

export interface WrapDraft {
  subject: string;
  chapter: string;
  kind: string;
  /** as typed; parsed on save */
  minutes: string;
  /** level 1 — what is ticked in the panel (nothing is written until Save) */
  taskIds: string[];
  dppIds: string[];
  topicIds: string[];
  /** level 2 */
  doubts: DraftDoubt[];
  /** level 3 */
  next: DraftPlanned[];
  note: string;
  /** filled by Practice: the session's result and one logbook row per miss */
  pyq: PyqResult | null;
  mistakes: NewEntry[];
}

/** What a caller outside the Daily Log may hand over when opening the panel. */
export interface WrapPrefill {
  subject?: string;
  chapter?: string;
  kind?: string;
  minutes?: number;
  pyq?: PyqResult | null;
  mistakes?: NewEntry[];
}

const blank = (): WrapDraft => ({
  subject: '',
  chapter: '',
  kind: '',
  minutes: '',
  taskIds: [],
  dppIds: [],
  topicIds: [],
  doubts: [],
  next: [],
  note: '',
  pyq: null,
  mistakes: [],
});

const [draft, setDraft] = createStore<WrapDraft>(blank());
const [isOpen, setIsOpen] = createSignal(false);

let nextKey = 1;
const key = () => nextKey++;

export { draft, setDraft };
export const wrapUpOpen = isOpen;

/**
 * Open the panel. With a prefill the draft starts fresh from it (a finished
 * practice session is a new session); without one, an unsaved draft is kept.
 */
export function openWrapUp(prefill?: WrapPrefill) {
  if (prefill) {
    setDraft(
      reconcile({
        ...blank(),
        subject: prefill.subject ?? '',
        chapter: prefill.chapter ?? '',
        kind: prefill.kind ?? '',
        minutes: prefill.minutes ? String(Math.round(prefill.minutes)) : '',
        pyq: prefill.pyq ?? null,
        mistakes: prefill.mistakes ?? [],
      }),
    );
  }
  setIsOpen(true);
}

export const closeWrapUp = () => setIsOpen(false);
export const resetWrapUp = () => setDraft(reconcile(blank()));

export const addDoubt = () =>
  setDraft('doubts', (d) => [
    ...d,
    {
      key: key(),
      title: '',
      subject: draft.subject,
      chapter: draft.chapter,
      note: '',
      list: 'solve',
    },
  ]);

export const addPlanned = () =>
  setDraft('next', (n) => [
    ...n,
    {
      key: key(),
      title: '',
      subject: draft.subject,
      kind: draft.kind,
      chapter: draft.chapter,
      due_date: tomorrowIso(),
    },
  ]);

export const removeDoubt = (k: number) => setDraft('doubts', (d) => d.filter((x) => x.key !== k));
export const removePlanned = (k: number) => setDraft('next', (n) => n.filter((x) => x.key !== k));

/** tick or untick one item in a level-1 list */
export function toggleIn(list: 'taskIds' | 'dppIds' | 'topicIds', id: string) {
  setDraft(list, (ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
}

const filled = (...parts: string[]) => parts.some((p) => p.trim() !== '');

/**
 * Rows the student added and left empty are dropped, not refused. A doubt with
 * a note but no title is kept, so `wrapProblem` can ask for the title.
 */
const usedDoubts = (d: WrapDraft) => d.doubts.filter((x) => filled(x.title, x.note));
const usedPlanned = (d: WrapDraft) => d.next.filter((x) => filled(x.title));

/**
 * Why Save is not available right now, or `null` when it is. The same rules
 * Rust applies, checked early so the button can say what is missing — Rust
 * still checks them all again.
 */
export function wrapProblem(d: WrapDraft, openIds: OpenIds, locked: boolean): string | null {
  const minutes = d.minutes.trim() === '' ? 0 : Number(d.minutes);
  if (!Number.isFinite(minutes) || minutes < 0) return 'Minutes must be a number.';
  if (d.doubts.some((x) => x.title.trim() === '' && x.note.trim() !== '')) {
    return 'A doubt needs a title.';
  }
  const ticks = ticked(d, openIds);
  const doubts = usedDoubts(d);
  const next = usedPlanned(d);
  if (locked && (ticks > 0 || doubts.length > 0)) {
    return 'Today is locked: nothing from today can be ticked or added.';
  }
  // `YYYY-MM-DD` compares correctly as text; an empty date means tomorrow in Rust
  if (locked && next.some((p) => p.due_date !== '' && p.due_date <= todayIso())) {
    return 'Today is locked: a planned task has to be due after today.';
  }
  const hasContent =
    minutes > 0 ||
    d.pyq !== null ||
    ticks > 0 ||
    doubts.length > 0 ||
    next.length > 0 ||
    d.mistakes.length > 0 ||
    d.note.trim() !== '';
  return hasContent ? null : 'Nothing to log yet.';
}

/** the ids that are still open right now — a tick on anything else is dropped */
export interface OpenIds {
  tasks: ReadonlySet<string>;
  dpps: ReadonlySet<string>;
  topics: ReadonlySet<string>;
}

const keep = (ids: string[], open: ReadonlySet<string>) => ids.filter((id) => open.has(id));

const ticked = (d: WrapDraft, o: OpenIds) =>
  keep(d.taskIds, o.tasks).length + keep(d.dppIds, o.dpps).length + keep(d.topicIds, o.topics).length;

/** The draft as the Rust command takes it. */
export function toWrapInput(d: WrapDraft, openIds: OpenIds): WrapInput {
  const minutes = d.minutes.trim() === '' ? 0 : Number(d.minutes);
  return {
    subject: d.subject,
    chapter: d.chapter,
    kind: d.kind,
    minutes: Number.isFinite(minutes) ? minutes : 0,
    pyq: d.pyq,
    done_task_ids: keep(d.taskIds, openIds.tasks),
    done_dpp_ids: keep(d.dppIds, openIds.dpps),
    done_topic_ids: keep(d.topicIds, openIds.topics),
    doubts: usedDoubts(d).map((x) => ({
      title: x.title,
      subject: x.subject,
      chapter: x.chapter,
      note: x.note,
      list: x.list,
    })),
    next_plan: usedPlanned(d).map((x) => ({
      title: x.title,
      subject: x.subject,
      kind: x.kind,
      chapter: x.chapter,
      due_date: x.due_date || undefined,
    })),
    mistakes: d.mistakes,
    note: d.note,
  };
}

/** whether closing now would throw away something the student typed */
export const draftHasContent = (d: WrapDraft) =>
  filled(d.subject, d.chapter, d.kind, d.minutes, d.note) ||
  d.taskIds.length + d.dppIds.length + d.topicIds.length > 0 ||
  d.doubts.some((x) => filled(x.title, x.note)) ||
  d.next.some((x) => filled(x.title)) ||
  d.pyq !== null ||
  d.mistakes.length > 0;

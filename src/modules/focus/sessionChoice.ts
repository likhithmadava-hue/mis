import { todayIso } from '../../core/dates';
import type { SessionDetails, SessionReason } from '../../core/db';
import { viewState } from '../../core/ui';

/**
 * What the person said they are studying, and why.
 *
 * This is the answer to "what is this round for?", remembered for the day so the
 * pomodoro loop does not ask again every 25 minutes: pick a topic once, and
 * round two, three and four carry on with it until you press Change.
 *
 * It is **view state**, not data — the same kind of thing as which tab you were
 * on — so it lives in `viewState` and survives leaving the Focus tab or
 * restarting MIS. The data is the `FocusSession` Rust writes when a round is
 * confirmed, with these values copied into it.
 *
 * A choice is only good for the day it was made. A reason of "upcoming test"
 * picked on Monday is not a fact about Tuesday, and quietly logging it against a
 * new day would put a wrong answer in the record — so anything older than today
 * is ignored and the dialog asks again.
 */
export interface SessionChoice {
  /** the day it was made, `YYYY-MM-DD` */
  date: string;
  subject: string;
  chapter: string;
  reason: SessionReason;
  reason_note: string;
}

/** The longest each field may be. Mirrors the limits in `db::add_focus_session`, which decides. */
export const LIMITS = { subject: 60, chapter: 120, note: 300 } as const;

const isChoice = (v: unknown): v is SessionChoice =>
  typeof v === 'object' &&
  v !== null &&
  typeof (v as SessionChoice).date === 'string' &&
  typeof (v as SessionChoice).subject === 'string' &&
  typeof (v as SessionChoice).chapter === 'string' &&
  typeof (v as SessionChoice).reason === 'string' &&
  typeof (v as SessionChoice).reason_note === 'string';

// A stored value that is not a choice (an older build, a hand-edited storage
// entry) is dropped rather than half-trusted.
const [stored, setStored] = viewState<SessionChoice | null>(
  'focus.session',
  null,
  (v) => v === null || isChoice(v),
);

/** the choice for today, or `null` when nothing has been picked yet today */
export const todaysChoice = (): SessionChoice | null => {
  const c = stored();
  return c && c.date === todayIso() ? c : null;
};

/**
 * The last choice whatever day it was made — for finishing a round that began
 * before midnight, which must be logged with what it was actually for.
 */
export const lastChoice = (): SessionChoice | null => stored();

export function rememberChoice(details: SessionDetails & { reason: SessionReason }) {
  setStored({
    date: todayIso(),
    subject: details.subject.trim(),
    chapter: details.chapter.trim(),
    reason: details.reason,
    reason_note: details.reason_note.trim(),
  });
}

/** the shape Rust wants, from a remembered choice */
export const detailsOf = (c: SessionChoice): SessionDetails => ({
  subject: c.subject,
  chapter: c.chapter,
  reason: c.reason,
  reason_note: c.reason_note,
});

/**
 * What is still missing, in words, or `null` when the draft is good to go.
 *
 * This is the same rule Rust enforces — and Rust is the one that decides. It is
 * here so the dialog can say *which* thing is missing before you press Start
 * rather than after; a mismatch would only ever show as Rust's message instead.
 */
export function problemWith(d: {
  subject: string;
  chapter: string;
  reason: SessionReason | null;
  reason_note: string;
}): string | null {
  if (!d.subject.trim()) return 'Pick a subject';
  if (!d.chapter.trim()) return 'Pick or type the topic';
  if (!d.reason) return 'Say why you are studying it';
  if (d.reason === 'other' && !d.reason_note.trim()) return 'Add a few words on the reason';
  // Caught here as well as in Rust: a subject or topic too long to store would
  // otherwise be accepted now and only refused when the round is logged, a
  // whole session later, when there is nothing left to fix it with.
  if (d.subject.trim().length > LIMITS.subject) return `Subject: ${LIMITS.subject} characters at most`;
  if (d.chapter.trim().length > LIMITS.chapter) return `Topic: ${LIMITS.chapter} characters at most`;
  return null;
}

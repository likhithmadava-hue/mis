import type { DbShape } from '../../core/db';

/**
 * What to suggest when the person is choosing a subject and a topic.
 *
 * MIS has no syllabus of its own to offer yet, so the suggestions are what the
 * person has already told it: the subjects they named at onboarding, and every
 * subject and chapter they have used on a task, a doubt, a logbook row, a
 * wrapped-up session or an earlier focus round. That is enough to make the
 * second session of the week a two-click affair, and it never *restricts* — the
 * field is a combobox, so a topic not on the list is simply typed.
 *
 * Pure functions over the database, so the list can be reasoned about without a
 * window. When a built-in syllabus lands it becomes one more source here.
 */

/** the comparable core of a name: case and spacing folded away */
const fold = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

/** each distinct value once, in the order first seen, spelt the way it was first typed */
function distinct(values: Iterable<string | undefined>, limit = Infinity): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    const text = (v ?? '').trim().replace(/\s+/g, ' ');
    if (!text) continue;
    const key = fold(text);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(text);
    if (out.length >= limit) break;
  }
  return out;
}

/**
 * Every place a subject and chapter have been recorded, newest first within
 * each source. Focus sessions and the journal go first: what you have actually
 * sat down to study is a better guess at what you will study next than what you
 * once filed a mistake under.
 */
const seen = (db: DbShape): { subject?: string; chapter?: string }[] => [
  ...db.focus_sessions,
  ...db.journal,
  ...db.tasks,
  ...db.topics,
  ...db.mark_logbook,
];

/** The person's own subjects first, then any others they have used. */
export function subjectOptions(db: DbShape): string[] {
  return distinct([...(db.profile?.subjects ?? []).map((s) => s.name), ...seen(db).map((s) => s.subject)]);
}

/**
 * Topics used before under this subject. With no subject chosen yet it offers
 * topics from every subject rather than nothing, so the list is never empty
 * just because the fields were filled in the other order.
 */
export function chapterOptions(db: DbShape, subject: string): string[] {
  const want = fold(subject);
  return distinct(
    seen(db)
      .filter((s) => !want || fold(s.subject ?? '') === want)
      .map((s) => s.chapter),
    40,
  );
}

/** The subject of the most recent focus session, to start the dialog on. */
export const latestSubject = (db: DbShape): string =>
  db.focus_sessions.find((s) => s.subject)?.subject ?? '';

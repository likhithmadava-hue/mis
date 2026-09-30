import type { AppMode, JournalEntry } from '../../core/db';

/**
 * The Journal's arithmetic, kept out of the component: which subjects and kinds
 * exist to filter by, which entries match, and how they group by day.
 */

/** the filter value meaning "don't filter on this" */
export const ALL = '__all__';

/**
 * The entries belonging to one journal. An entry written before the diary
 * existed has no mode and is a study session, so it reads as Academic — the
 * same default Rust applies.
 */
export const entriesFor = (entries: readonly JournalEntry[], mode: AppMode) =>
  entries.filter((e) => (e.mode ?? 'academic') === mode);

/** whether an entry was produced by a session wrap-up rather than written */
export const isSession = (entry: JournalEntry) =>
  entry.pyq !== null ||
  entry.tasks_done.length > 0 ||
  entry.doubts.length > 0 ||
  entry.next_plan.length > 0;

/** the heading to show for an entry, whichever of its fields carry it */
export const headingOf = (entry: JournalEntry) =>
  entry.title?.trim() ||
  [entry.subject, entry.chapter].filter(Boolean).join(' · ') ||
  entry.kind ||
  'Untitled entry';

const distinct = (values: string[]) =>
  [...new Set(values.map((v) => v.trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: 'base' }),
  );

export const subjectsOf = (entries: readonly JournalEntry[]) => distinct(entries.map((e) => e.subject));
export const kindsOf = (entries: readonly JournalEntry[]) => distinct(entries.map((e) => e.kind));

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export function filterEntries(entries: readonly JournalEntry[], subject: string, kind: string) {
  return entries.filter(
    (e) => (subject === ALL || same(e.subject, subject)) && (kind === ALL || same(e.kind, kind)),
  );
}

/** newest first — by the day, then by when the wrap-up was saved */
const newestFirst = (a: JournalEntry, b: JournalEntry) =>
  b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at);

export interface DayGroup {
  date: string;
  entries: JournalEntry[];
}

export function groupByDay(entries: readonly JournalEntry[]): DayGroup[] {
  const groups: DayGroup[] = [];
  for (const e of [...entries].sort(newestFirst)) {
    const last = groups[groups.length - 1];
    if (last && last.date === e.date) last.entries.push(e);
    else groups.push({ date: e.date, entries: [e] });
  }
  return groups;
}

export const totalMinutes = (entries: readonly JournalEntry[]) =>
  entries.reduce((sum, e) => sum + (Number.isFinite(e.minutes) ? e.minutes : 0), 0);

/** `95` → `1h 35m`, `40` → `40m`, `0` → `—` */
export function formatMinutes(minutes: number) {
  const m = Math.round(minutes);
  if (m <= 0) return '—';
  const h = Math.floor(m / 60);
  return h > 0 ? `${h}h${m % 60 ? ` ${m % 60}m` : ''}` : `${m}m`;
}

/** the entry's saved time as a clock, e.g. `6:40 pm`; empty if it cannot be read */
export function savedAt(entry: JournalEntry) {
  const d = new Date(entry.created_at);
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

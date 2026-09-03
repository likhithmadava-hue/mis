import { createEffect, createMemo, createSignal } from 'solid-js';

import { marksLost, type MarkLogbookEntry } from '../../core/db';

/**
 * The "no filter" sentinel.
 *
 * It is a real string rather than `null` or `''` because it has to be a
 * selectable option in a `Select`, and because an empty-string subject would be
 * indistinguishable from a paper logged without one.
 */
export const ALL = '__all__';

export type SortKey = 'date' | 'marks';

/**
 * Search, filtering and sorting for the mistake table.
 *
 * The filter options are derived from the data rather than hardcoded, so the
 * subject list is always exactly the subjects you have actually logged — no
 * empty "Chemistry" option on a vault that only contains physics papers.
 */
export function createLogbookFilters(entries: () => MarkLogbookEntry[]) {
  const [search, setSearch] = createSignal('');
  const [fSubject, setFSubject] = createSignal<string>(ALL);
  const [fChapter, setFChapter] = createSignal<string>(ALL);
  const [fReason, setFReason] = createSignal<string>(ALL);
  const [fDifficulty, setFDifficulty] = createSignal<string>(ALL);

  const [sortKey, setSortKey] = createSignal<SortKey>('date');
  const [sortDesc, setSortDesc] = createSignal(true);

  const subjects = createMemo(() =>
    [...new Set(entries().map((e) => e.subject).filter(Boolean))].sort(),
  );

  // Chapters narrow to the chosen subject, so the list stays short and never
  // offers a chapter that belongs to a subject you have filtered out.
  const chapters = createMemo(() => {
    const pool = fSubject() === ALL ? entries() : entries().filter((e) => e.subject === fSubject());
    return [...new Set(pool.map((e) => e.chapter).filter(Boolean))].sort();
  });

  // Picking a new subject can orphan the chapter filter, which would silently
  // filter the table down to nothing.
  createEffect(() => {
    if (fChapter() !== ALL && !chapters().includes(fChapter())) setFChapter(ALL);
  });

  const filtered = createMemo(() => {
    const q = search().trim().toLowerCase();
    const rows = entries().filter((e) => {
      if (fSubject() !== ALL && e.subject !== fSubject()) return false;
      if (fChapter() !== ALL && e.chapter !== fChapter()) return false;
      if (fReason() !== ALL && e.mistake_reason !== fReason()) return false;
      if (fDifficulty() !== ALL && e.difficulty !== fDifficulty()) return false;
      if (!q) return true;
      return [e.subject, e.chapter, e.notes, e.mistake_reason, e.grade]
        .join(' ')
        .toLowerCase()
        .includes(q);
    });

    // A copy, because `entries()` is the store's own array and sorting in place
    // would mutate it behind the store's back.
    return rows.sort((a, b) => {
      const cmp =
        sortKey() === 'date' ? a.date.localeCompare(b.date) : marksLost(a) - marksLost(b);
      return sortDesc() ? -cmp : cmp;
    });
  });

  const toggleSort = (key: SortKey) => {
    if (sortKey() === key) setSortDesc((d) => !d);
    else {
      setSortKey(key);
      setSortDesc(true);
    }
  };

  const clearFilters = () => {
    setSearch('');
    setFSubject(ALL);
    setFChapter(ALL);
    setFReason(ALL);
    setFDifficulty(ALL);
  };

  return {
    search,
    setSearch,
    fSubject,
    setFSubject,
    fChapter,
    setFChapter,
    fReason,
    setFReason,
    fDifficulty,
    setFDifficulty,
    subjects,
    chapters,
    sortKey,
    sortDesc,
    toggleSort,
    clearFilters,
    filtersActive: () =>
      search().trim() !== '' ||
      [fSubject(), fChapter(), fReason(), fDifficulty()].some((f) => f !== ALL),
    filtered,
    /** marks lost across the *visible* rows, so it answers the filtered question */
    totalLost: createMemo(() => filtered().reduce((sum, e) => sum + marksLost(e), 0)),
  };
}

export type LogbookFilters = ReturnType<typeof createLogbookFilters>;

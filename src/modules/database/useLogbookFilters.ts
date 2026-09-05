import { useState, useEffect, useMemo } from 'react';
import { marksLost, type MarkLogbookEntry } from '../../core/db';

/** the "no filter" sentinel — a real value so it can sit in a Select */
export const ALL = '__all__';

export type SortKey = 'date' | 'marks';

/**
 * Search, filtering and sorting for the mistake table.
 *
 * The filter options are derived from the data rather than hardcoded, so the
 * subject list is always exactly the subjects you've actually logged.
 */
export function useLogbookFilters(entries: MarkLogbookEntry[]) {
  const [search, setSearch] = useState('');
  const [fSubject, setFSubject] = useState<string>(ALL);
  const [fChapter, setFChapter] = useState<string>(ALL);
  const [fReason, setFReason] = useState<string>(ALL);
  const [fDifficulty, setFDifficulty] = useState<string>(ALL);

  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDesc, setSortDesc] = useState(true);

  const subjects = useMemo(
    () => [...new Set(entries.map((e) => e.subject).filter(Boolean))].sort(),
    [entries]
  );

  // chapters narrow to the chosen subject, so the list stays short
  const chapters = useMemo(() => {
    const pool = fSubject === ALL ? entries : entries.filter((e) => e.subject === fSubject);
    return [...new Set(pool.map((e) => e.chapter).filter(Boolean))].sort();
  }, [entries, fSubject]);

  // picking a new subject can orphan the chapter filter — clear it
  useEffect(() => {
    if (fChapter !== ALL && !chapters.includes(fChapter)) setFChapter(ALL);
  }, [chapters, fChapter]);

  const { filtered, totalLost } = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = entries.filter((e) => {
      if (fSubject !== ALL && e.subject !== fSubject) return false;
      if (fChapter !== ALL && e.chapter !== fChapter) return false;
      if (fReason !== ALL && e.mistake_reason !== fReason) return false;
      if (fDifficulty !== ALL && e.difficulty !== fDifficulty) return false;
      if (!q) return true;
      // Direct field check avoids allocating array and joining string per logbook entry
      return (
        (e.subject && e.subject.toLowerCase().includes(q)) ||
        (e.chapter && e.chapter.toLowerCase().includes(q)) ||
        (e.notes && e.notes.toLowerCase().includes(q)) ||
        (e.mistake_reason && e.mistake_reason.toLowerCase().includes(q)) ||
        (e.grade && String(e.grade).toLowerCase().includes(q))
      );
    });

    rows.sort((a, b) => {
      // Direct string comparison for ISO dates (YYYY-MM-DD) avoids allocating Date objects during sorting
      const cmp =
        sortKey === 'date'
          ? (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)
          : marksLost(a) - marksLost(b);
      return sortDesc ? -cmp : cmp;
    });

    // Memoize total marks lost calculation along with filtered entries to avoid reduce on every component render
    const totalLost = rows.reduce((sum, e) => sum + marksLost(e), 0);

    return { filtered: rows, totalLost };
  }, [entries, search, fSubject, fChapter, fReason, fDifficulty, sortKey, sortDesc]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDesc((d) => !d);
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
    search, setSearch,
    fSubject, setFSubject,
    fChapter, setFChapter,
    fReason, setFReason,
    fDifficulty, setFDifficulty,
    subjects, chapters,
    sortKey, sortDesc, toggleSort,
    clearFilters,
    filtersActive:
      search.trim() !== '' || [fSubject, fChapter, fReason, fDifficulty].some((f) => f !== ALL),
    filtered,
    totalLost,
  };
}

export type LogbookFilters = ReturnType<typeof useLogbookFilters>;

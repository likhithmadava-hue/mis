import type { BankChapter, SyllabusChapter } from '../db';

/**
 * Matching free-text chapter names to the built-in syllabus.
 *
 * Tasks, doubts and mistake rows have always stored the chapter as whatever the
 * student typed — "Laws of motion", "4. Laws of Motion", "NLM". Nothing here
 * rewrites that data. Instead, anything that needs to know *which* chapter a
 * row means (the Mistake Quiz, the planner) asks this module, which folds
 * numbering, case, punctuation and "&"/"and" away and compares against the
 * syllabus and the question bank. Everything MIS writes from now on uses the
 * syllabus title, so new rows match exactly and old ones match when they can.
 *
 * Pure functions over the lists passed in, so they can be tested without Tauri.
 */

/** "Maths", "math", "MATHEMATICS" → "Mathematics"; anything else is trimmed as-is */
export function canonicalSubject(subject: string): string {
  const s = subject.trim().toLowerCase();
  if (s === 'maths' || s === 'math' || s === 'mathematics') return 'Mathematics';
  if (s === 'phy' || s === 'physics') return 'Physics';
  if (s === 'chem' || s === 'chemistry') return 'Chemistry';
  if (s === 'bio' || s === 'biology') return 'Biology';
  return subject.trim();
}

/** the comparable core of a chapter name: no numbering, case, punctuation or "and"/"&" drift */
export function chapterKey(title: string): string {
  return title
    .toLowerCase()
    .replace(/^\s*(ch(apter)?\.?\s*)?\d+\s*[.):-]?\s*/, '')
    .replace(/&/g, ' and ')
    .replace(/[‘’'`]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export interface ChapterMatch {
  /** the NCERT chapter, when the text names one */
  syllabus: SyllabusChapter | null;
  /** the question-bank chapter it can be practised from, when there is one */
  bankId: string | null;
  /** the canonical title to show and to write */
  title: string;
}

/**
 * Which chapter `text` means, within `subject` (or any subject when blank).
 * Tries NCERT titles first, then bank chapter titles. `null` when nothing
 * matches exactly after folding — a near miss is left unmatched rather than
 * guessed, because a wrong match would send the student to the wrong chapter.
 */
export function matchChapter(
  subject: string,
  text: string,
  syllabus: SyllabusChapter[],
  bank: BankChapter[],
): ChapterMatch | null {
  const key = chapterKey(text);
  if (!key) return null;
  const subj = subject.trim() ? canonicalSubject(subject) : null;
  const inSubject = <T extends { subject: string }>(c: T) => !subj || c.subject === subj;

  const s = syllabus.find((c) => inSubject(c) && chapterKey(c.title) === key);
  if (s) return { syllabus: s, bankId: s.bank_id, title: s.title };

  const b = bank.find((c) => inSubject(c) && chapterKey(c.title) === key);
  if (b) {
    // a bank title that stands for exactly one NCERT chapter is that chapter
    const only = b.syllabus_ids.length === 1 ? syllabus.find((c) => c.id === b.syllabus_ids[0]) : undefined;
    return { syllabus: only ?? null, bankId: b.id, title: only?.title ?? b.title };
  }
  return null;
}

/** NCERT chapter titles for a subject, in syllabus order — for chapter suggestions */
export function chapterTitles(subject: string, syllabus: SyllabusChapter[]): string[] {
  const subj = subject.trim() ? canonicalSubject(subject) : null;
  return syllabus.filter((c) => !subj || c.subject === subj).map((c) => c.title);
}

/**
 * The built-in study content — the JEE/NEET syllabus and the question bank —
 * as the frontend sees it.
 *
 * The data lives in Rust (`src-tauri/src/content/`), compiled into the app. Here
 * are two app-wide cached reads of it and the helpers that match the free-text
 * chapter names in the vault against it. Both reads depend on the exam track in
 * the profile, so they refetch when the profile's programme or target exam
 * changes, and on nothing else — the content itself never changes at runtime.
 */

import { createResource, createRoot } from 'solid-js';

import { api, db, ready, type BankChapter, type SyllabusChapter } from '../db';

export * from './chapters';

/**
 * The profile fields `content::track_of` reads — a change there changes what is
 * shown. `false` (no fetch) until the vault is open: the commands read the
 * profile, and Rust refuses that while locked.
 */
const trackKey = () =>
  ready() && `${db.profile?.program ?? ''}|${db.profile?.target_exam ?? ''}`;

// Created once, in their own root, so every screen shares one fetch instead of
// each mounting its own copy of ~100 chapters.
const { syllabus, bankChapters } = createRoot(() => {
  const [syllabus] = createResource(trackKey, () => api.contentSyllabus(), {
    initialValue: [] as SyllabusChapter[],
  });
  const [bankChapters] = createResource(trackKey, () => api.contentBankChapters(), {
    initialValue: [] as BankChapter[],
  });
  return { syllabus, bankChapters };
});

/** NCERT chapters on the student's exam track (empty until loaded) */
export { syllabus };
/** question-bank chapters on the student's exam track, without questions */
export { bankChapters };

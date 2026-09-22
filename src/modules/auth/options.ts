import type { ProductiveTime } from '../../core/db';

/**
 * The choices the questionnaire offers.
 *
 * Adapted from Apex's onboarding — programme, exam goal, class, subjects with a
 * self-rated confidence, productive time of day, school hours, daily study time —
 * but every option is a *suggestion*, not a gate: the two fields that take free
 * text (subjects, goals) accept anything, because an app that can't describe the
 * person's actual course has already failed at the first question.
 */

export const GRADES = [
  'Class 6',
  'Class 7',
  'Class 8',
  'Class 9',
  'Class 10',
  'Class 11',
  'Class 12',
  'Dropper / gap year',
  'Undergraduate',
  'Postgraduate',
  'Other',
] as const;

export const PROGRAMS = [
  'CBSE / ICSE / State board',
  'IGCSE (Cambridge)',
  'IB',
  'JEE (Main + Advanced)',
  'NEET',
  'JEE + NEET',
  'University degree',
  'Other',
] as const;

/** "What do you want out of MIS?" — pick as many as apply. */
export const GOALS = [
  'Score higher marks',
  'Crack an entrance exam',
  'Stop careless mistakes',
  'Fix weak chapters',
  'Build a study habit',
  'Get faster in exams',
  'Cut screen time',
  'Balance study and life',
] as const;

/** Suggested subjects; anything else can be typed in. */
export const SUBJECT_PRESETS = [
  'Physics',
  'Chemistry',
  'Mathematics',
  'Biology',
  'English',
  'Computer Science',
  'Economics',
  'Accountancy',
  'Business Studies',
  'History',
  'Geography',
  'Hindi',
] as const;

/** How the person likes to work — feeds nothing yet, but is remembered honestly. */
export const PREFERENCES = [
  'Timed practice papers',
  'Flashcards',
  'Video lectures',
  'Reading notes',
  'Solving problems',
  'Studying in groups',
  'Total silence',
  'Background music',
  'Short frequent sessions',
  'Long deep sessions',
] as const;

export const TIMES_OF_DAY: { value: ProductiveTime; label: string; hint: string }[] = [
  { value: 'morning', label: 'Morning', hint: '5 – 11' },
  { value: 'afternoon', label: 'Afternoon', hint: '11 – 5' },
  { value: 'evening', label: 'Evening', hint: '5 – 9' },
  { value: 'night', label: 'Night', hint: '9 – late' },
];

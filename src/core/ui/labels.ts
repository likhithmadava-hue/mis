import type { TopicType } from '../db';

/**
 * Display copy that more than one module has to agree on. The Daily Log adds
 * and ticks topics under these headings and the Growth Tracker charts the same
 * three buckets, so the titles live here rather than being typed out twice.
 */
export const TOPIC_COLUMNS: { type: TopicType; title: string }[] = [
  { type: 'taught', title: 'Taught in School' },
  { type: 'revise', title: 'Left to Revise' },
  { type: 'solve', title: 'Left to Solve' },
];

/**
 * The same three buckets named as the work still outstanding.
 *
 * The column titles above head a list of everything in the bucket, so `taught`
 * reads "Taught in School" — that bucket is a **record of what school has
 * already covered**, not a queue of lessons waiting to happen. Nothing in it is
 * ever outstanding, which is why the home board never proposes one: a topic the
 * teacher finished this morning must not come back as "still to be taught".
 */
export const TOPIC_ACTION: Record<TopicType, string> = {
  taught: 'Taught in school',
  revise: 'Left to revise',
  solve: 'Left to solve',
};

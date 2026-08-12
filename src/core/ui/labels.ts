import type { TopicType } from '../db';

/**
 * Display copy that more than one module has to agree on. The Daily Log adds
 * and ticks topics under these headings and the Growth Tracker charts the same
 * three buckets, so the titles live here rather than being typed out twice.
 */
export const TOPIC_COLUMNS: { type: TopicType; title: string }[] = [
  { type: 'taught', title: 'Topics Taught' },
  { type: 'revise', title: 'Left to Revise' },
  { type: 'solve', title: 'Left to Solve' },
];

/**
 * The same three buckets named as the work still outstanding.
 *
 * The column titles above head a list of everything in the bucket, done or not,
 * so `taught` reads "Topics Taught". The home page's continue card is pointing
 * at one row that is *not* done, where that heading would say the opposite of
 * what it means.
 */
export const TOPIC_ACTION: Record<TopicType, string> = {
  taught: 'Still to be taught',
  revise: 'Left to revise',
  solve: 'Left to solve',
};

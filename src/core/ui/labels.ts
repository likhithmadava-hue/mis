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

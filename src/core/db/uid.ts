/**
 * Row ids. Lives in its own file because both the seed and the database
 * facade need it — if it sat in storage.ts, seed.ts importing it would make
 * storage.ts and seed.ts import each other in a circle.
 */
export const uid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

/**
 * The one source of truth for what a score means.
 *
 *   meta.ts   targets, labels, icons, the red → green heat scale
 *   score.ts  the maths: per-track 0–10, per-mode out of DAY_TARGET
 *
 * Import from `core/scoring` rather than reaching into either file.
 */
export * from './meta';
export * from './score';

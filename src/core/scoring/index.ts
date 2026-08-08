/**
 * Scoring, as the frontend sees it.
 *
 * The maths used to be here — `score.ts` computed every track out of ten and
 * summed them. It now lives in `src-tauri/src/scoring.rs`, behind the
 * `score_range` and `study_streak` commands, with unit tests beside it. What
 * remains on this side is naming and presentation.
 *
 * Moving it was not only tidiness. The score is what the day *was*, and having
 * it computed in the window meant the browser could be handed a locked day's
 * data and reach a different number than the one the day was fingerprinted
 * with. Now there is exactly one implementation and the day hash agrees with it
 * by construction.
 */

export * from './meta';

/**
 * The data layer's front door.
 *
 * Import from `core/db`, not from the files inside it. There are three, and the
 * split is worth keeping straight:
 *
 * - `types.ts`  — the vocabulary. Mirrors `src-tauri/src/db/types.rs`.
 * - `api.ts`    — one function per Tauri command. The only caller of `invoke`.
 * - `store.ts`  — the live reactive view of the database.
 *
 * The commands are re-exported under `api` rather than flattened, so a call site
 * reads `api.lockToday()` and it is obvious at a glance that it crosses into
 * Rust and writes the vault. Everything that mutates should look like it costs
 * something.
 */

export * from './types';
export * as api from './api';
export { errorMessage, isDayLocked, type MisError } from './api';
export { act, boot, db, mode, ready, reload, revision, setMode } from './store';

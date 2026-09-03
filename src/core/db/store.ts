/**
 * The database, as one reactive value the whole app reads.
 *
 * Rust owns the data; this is the frontend's live view of it. Components never
 * hold their own copy of a record and never write one back — they read from
 * [`db`] and call a command through [`act`], which refreshes this view once the
 * vault has been written. There is one source of truth and it is in Rust.
 *
 * **Why a Solid store rather than a signal holding `DbShape`.** A signal would
 * be one dependency for everything: adding a topic would re-run every component
 * that reads `db`, including the whole logbook table. `createStore` tracks reads
 * per property, and [`reconcile`] diffs the incoming database against the one
 * already here — keyed by `id`, so an unchanged row is left strictly identical
 * and the components watching it never re-run. Reloading the entire database
 * after every write is therefore cheap enough to be the only strategy, which is
 * what lets the rule above be absolute.
 *
 * This is also what replaced React's `useState` copies and the 600 ms debounced
 * save. There is no window in which the screen and the vault disagree.
 */

import { createSignal } from 'solid-js';
import { createStore, reconcile } from 'solid-js/store';

import * as api from './api';
import type { AppMode, DbShape } from './types';

/**
 * The shape the store holds before [`boot`] has run.
 *
 * It exists so `db` is never null and no component has to guard against a
 * half-loaded database. Nothing renders against it in practice — `main.tsx`
 * awaits `boot()` before mounting the app — but a store needs an initial value
 * and an *empty* one is the only honest choice. Filling it with plausible
 * numbers would put figures on screen that were never anyone's data.
 */
const EMPTY: DbShape = {
  user: {
    id: 'user',
    name: '',
    target_study_hours: 6,
    water_target: 8,
    blocked_apps: [],
    is_focus_active: false,
    free_time_unlocked: false,
    sleep_bedtime: '23:00',
    sleep_wake: '07:00',
  },
  daily_metrics: [],
  mark_logbook: [],
  focus_sessions: [],
  tasks: [],
  topics: [],
  focus_settings: {
    focus_minutes: 25,
    short_break: 5,
    long_break: 15,
    rounds_before_long: 4,
    timer_design: 'ring',
    focus_music: 'off',
    music_volume: 0.5,
    ambient_sound: 'off',
    ambient_volume: 0.5,
    brainwave: 'off',
    brainwave_volume: 0.5,
  },
  habits: [],
  habit_log: [],
  track_priorities: {
    studies: 'high',
    dpps: 'high',
    well_spent: 'medium',
    mood: 'medium',
    habits: 'medium',
    wellness: 'low',
  },
  app_mode: 'academic',
};

const [state, setState] = createStore<DbShape>(EMPTY);

/** The database. Read it; never assign to it. */
export const db = state as Readonly<DbShape>;

/**
 * Bumped every time the database is reloaded.
 *
 * Anything Rust *derives* from the database rather than storing — the scored
 * range, the streak, a day's tamper check — cannot live in the store, because
 * it is not part of `DbShape`. Those are fetched with `createResource`, and
 * this is what they source on: read `revision()` in the resource's source and
 * it refetches whenever the data underneath it moved.
 */
const [revision, bumpRevision] = createSignal(0);
export { revision };

const [ready, setReady] = createSignal(false);
/** False until [`boot`] has completed. */
export { ready };

/** Pull the database across the bridge and reconcile it into the store. */
export async function reload(): Promise<void> {
  // `merge: false` so a record replaced wholesale is replaced, not blended.
  setState(reconcile(await api.dbLoad(), { key: 'id', merge: false }));
  bumpRevision((n) => n + 1);
}

/** Load the database for the first time. Called once, before the app mounts. */
export async function boot(): Promise<void> {
  await reload();
  setReady(true);
}

/**
 * Run a command, then refresh this view from what Rust actually stored.
 *
 * Every mutation in the app goes through here. The refresh is not optimism
 * being corrected afterwards — the command has *already* written the vault by
 * the time it resolves, so what comes back is the truth, and there is never a
 * frame where the screen shows a change that failed to persist.
 *
 * Failures propagate. A rejected write leaves both the vault and this store
 * untouched, so a caller that ignores the rejection still shows correct data —
 * it just fails to explain itself. Callers that can fail meaningfully (the
 * Daily Log against a locked day) catch it; see `isDayLocked` in `api.ts`.
 */
export async function act<T>(command: Promise<T>): Promise<T> {
  const out = await command;
  await reload();
  return out;
}

// ── Mode ────────────────────────────────────────────────────────────────────

/**
 * The current mode, and the one setter for it.
 *
 * Kept here rather than in the shell because the mode is stored data, not view
 * state: it survives a restart, and Rust reads it too. `App.tsx` mirrors it onto
 * `<html data-mode>`, which is the whole of how the app retints — see
 * `index.css`.
 */
export const mode = () => db.app_mode;

export const setMode = (next: AppMode) => act(api.setAppMode(next));

import { freshDb } from './seed';
import {
  isNamespaceEmpty,
  load,
  readGuestDb,
  replaceLocal,
  save,
  setNamespace,
  setSaveHook,
} from './storage';
import { getSyncState, pull, push, resetRemoteSeqs, setSyncState, subscribeSync } from './remote';
import type { DbShape } from './types';

export type { SyncState, SyncStatus } from './remote';
export { getSyncState, subscribeSync };

/**
 * Keeps the local database and the signed-in account's Supabase rows in step.
 *
 * `remote.ts` knows how to talk to Supabase; this file decides *when* to, and
 * handles the two moments that actually need judgement:
 *
 *   Signing in — whose data wins? The cloud's, always, if the account has any.
 *                An account with nothing in the cloud starts empty and clean.
 *   Saving     — debounced, so holding the water counter's + button is one
 *                request at the end rather than one per press.
 */

/** how long to wait for the typing/clicking to stop before sending */
const DEBOUNCE_MS = 800;

let userId: string | null = null;
/**
 * What the server is known to hold. Null means "not established yet" — until a
 * pull has actually succeeded we must not push, or a browser that opened
 * offline would upload its stale copy over good cloud data.
 */
let snapshot: DbShape | null = null;
let ready = false;
/**
 * Something was saved locally while syncing was broken. It decides who wins
 * when the connection comes back — see the reconnect branch in `attachUser`.
 */
let editedWhileOffline = false;
let timer: ReturnType<typeof setTimeout> | null = null;
let inFlight: Promise<void> | null = null;
let pendingRetry = false;

const clone = (db: DbShape): DbShape => JSON.parse(JSON.stringify(db)) as DbShape;

const describe = (e: unknown) => (e instanceof Error ? e.message : String(e));

// ─── pushing ─────────────────────────────────────────────────────────────────

const runPush = async () => {
  if (!userId || !ready) return;

  // one push at a time; a save that lands mid-flight sets the retry flag and
  // is picked up by the loop below rather than racing the request in progress
  if (inFlight) {
    pendingRetry = true;
    return;
  }

  inFlight = (async () => {
    while (true) {
      pendingRetry = false;
      const current = load();
      setSyncState({ status: 'pushing' });
      try {
        await push(userId as string, current, snapshot);
        snapshot = clone(current);
        setSyncState({ status: 'synced', lastSyncedAt: Date.now(), message: undefined });
      } catch (e) {
        setSyncState({ status: 'error', message: describe(e) });
        return;
      }
      if (!pendingRetry) return;
    }
  })();

  try {
    await inFlight;
  } finally {
    inFlight = null;
  }
};

const schedulePush = () => {
  if (!userId) return;
  if (!ready) {
    // saved locally with no working connection to send it over. The row is
    // safe in localStorage; remember that it never went up.
    editedWhileOffline = true;
    return;
  }
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    void runPush();
  }, DEBOUNCE_MS);
};

/** send anything still waiting on the debounce, now */
export const flushSync = async () => {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  await runPush();
};

// ─── signing in and out ──────────────────────────────────────────────────────

/**
 * Attach storage to an account and get its data in place. Resolves once the
 * app is safe to render — either with the account's rows loaded, or, if the
 * network is down, with whatever this browser had saved for that account.
 */
export const attachUser = async (id: string) => {
  userId = id;
  ready = false;
  snapshot = null;
  resetRemoteSeqs();
  setNamespace(id);
  setSyncState({ status: 'pulling', message: undefined });

  // A namespace nobody has written to starts from freshDb(), never the demo
  // seed: sample rows are a nicety for the offline desktop copy, and uploading
  // two weeks of invented papers into a real account would be worse than
  // useless. `load()` would apply the build's default seed, so pre-empt it.
  const firstTimeOnThisDevice = isNamespaceEmpty();
  if (firstTimeOnThisDevice) replaceLocal(freshDb());

  try {
    const { db } = await pull(id, load());

    if (db && editedWhileOffline) {
      // This browser has work that never reached the cloud — a session logged
      // on a train, say. Overwriting it with the cloud copy would silently
      // throw that away, so it goes up instead: local wins, and the pull is
      // used only for the row ids and ordering the server already has.
      //
      // The cost is that a change made on another device in the meantime can
      // be overwritten. That is the right way round: the rows in front of you
      // are the ones you would notice losing.
      editedWhileOffline = false;
      snapshot = null; // no assumptions about the server — send everything
      ready = true;
      await runPush();
    } else if (db) {
      // the account has cloud data — that is the truth, on every device
      replaceLocal(db);
      snapshot = clone(db);
      ready = true;
      editedWhileOffline = false;
      setSyncState({ status: 'synced', lastSyncedAt: Date.now() });
    } else {
      // brand-new account: whatever this device has becomes its starting point
      ready = true;
      editedWhileOffline = false;
      snapshot = null; // nothing up there yet, so the first push sends it all
      await runPush();
    }
  } catch (e) {
    // Offline, or the schema has not been run yet. The app still works — it is
    // reading the local copy — and syncing resumes on the next successful try.
    ready = false;
    setSyncState({ status: 'error', message: describe(e) });
  }

  setSaveHook(schedulePush);
};

/** Detach on sign-out. Local data stays where it is, under its own key. */
export const detachUser = () => {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  setSaveHook(null);
  userId = null;
  snapshot = null;
  ready = false;
  editedWhileOffline = false;
  resetRemoteSeqs();
  setNamespace(null);
  setSyncState({ status: 'off', message: undefined, lastSyncedAt: undefined });
};

/** Try again after an error — from the sidebar's retry button, or coming back online. */
export const retrySync = async () => {
  if (!userId) return;
  await attachUser(userId);
};

// ─── bringing offline data into an account ───────────────────────────────────

const COLLECTION_KEYS = [
  'daily_metrics',
  'mark_logbook',
  'focus_sessions',
  'tasks',
  'topics',
  'habits',
  'habit_log',
] as const;

const dismissKey = (id: string) => `mis_guest_import_done:${id}`;

/**
 * How many rows are sitting in the signed-out copy of MIS that this account
 * does not have. Zero means there is nothing worth offering to import.
 *
 * This is never done automatically. The desktop build seeds two weeks of demo
 * data on first run, and silently pushing that into a real account would be
 * indistinguishable from real study history — so importing is a decision, not
 * a default.
 */
export const countImportableGuestRows = (): number => {
  if (!userId) return 0;
  if (localStorage.getItem(dismissKey(userId))) return 0;

  const guest = readGuestDb();
  if (!guest) return 0;

  const current = load();
  let n = 0;
  for (const key of COLLECTION_KEYS) {
    const have = new Set((current[key] as { id: string }[]).map((r) => r.id));
    n += (guest[key] as { id: string }[]).filter((r) => !have.has(r.id)).length;
  }
  return n;
};

/**
 * Merge the signed-out copy's rows into this account, keeping the account's own
 * settings. Rows already present (matched on id) are left alone, so running it
 * twice does not duplicate anything.
 */
export const importGuestData = () => {
  if (!userId) return;
  const guest = readGuestDb();
  if (!guest) return;

  const db = load();
  for (const key of COLLECTION_KEYS) {
    const have = new Set((db[key] as { id: string }[]).map((r) => r.id));
    const incoming = (guest[key] as { id: string }[]).filter((r) => !have.has(r.id));
    (db[key] as unknown[]) = [...(db[key] as unknown[]), ...incoming];
  }
  localStorage.setItem(dismissKey(userId), '1');
  save(db);
};

/** "no thanks" — stop offering, without touching any data */
export const dismissGuestImport = () => {
  if (userId) localStorage.setItem(dismissKey(userId), '1');
};

// ─── keeping up with the browser ─────────────────────────────────────────────

if (typeof window !== 'undefined') {
  // a tab being hidden is the last reliable moment before it may be frozen or
  // closed, so send what is queued rather than losing the debounce window
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void flushSync();
  });

  window.addEventListener('online', () => {
    if (userId && getSyncState().status === 'error') void retrySync();
  });
}

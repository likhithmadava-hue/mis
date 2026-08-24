import { migrate } from './migrations';
import { seedDb } from './seed';
import type { DbShape } from './types';

/**
 * The localStorage layer, and the only code in MIS that touches it.
 *
 * ── The cache ────────────────────────────────────────────────────────────────
 * `load()` used to re-parse the whole blob out of localStorage on every call.
 * Now the parsed database is held in memory and localStorage is written through
 * on save. Same behaviour, far less parsing — and it is what lets an account's
 * rows be swapped in from Supabase at sign-in without every caller becoming
 * async.
 *
 * The object `load()` hands back *is* the live database, not a copy. That was
 * already how the write path worked (`const db = load(); db.x = y; save(db)`),
 * so it stays that way — but it does mean a caller that changes something and
 * never calls `save()` has changed the database. Read, then save.
 *
 * ── The namespace ────────────────────────────────────────────────────────────
 * Signed out, MIS saves to `arbor_db`, exactly where it always has. Signed in,
 * it saves to `arbor_db:<account id>`, so two people using the same computer
 * (or you signing into a second account) do not land on top of each other's
 * work. The plain `arbor_db` copy is left alone, and is what gets adopted the
 * first time an account signs in with nothing in the cloud yet.
 */

/**
 * Still `arbor_db` even though the app is now called MIS. Renaming the key
 * would orphan every existing user's data, so the old name stays until
 * something is written to move it.
 */
export const STORAGE_KEY = 'arbor_db';

let cache: DbShape | null = null;
let namespace: string | null = null;
let onSave: ((db: DbShape) => void) | null = null;

/** which localStorage key the current namespace writes to */
const storageKey = () => (namespace ? `${STORAGE_KEY}:${namespace}` : STORAGE_KEY);

/** parse one key, or null if it is absent or unreadable */
const readKey = (key: string): DbShape | null => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const db = JSON.parse(raw) as DbShape;
    if (migrate(db)) localStorage.setItem(key, JSON.stringify(db));
    return db;
  } catch {
    // corrupted storage is treated as absent
    return null;
  }
};

/** read the database, migrating it forward — reseeds if nothing is saved yet */
/** Boot/pull local vault storage cache before app renders. No-op in web/dev environment. */
export async function bootStorage(): Promise<void> {
  return;
}

export const load = (): DbShape => {
  if (cache) return cache;

  const saved = readKey(storageKey());
  if (saved) {
    cache = saved;
    return cache;
  }

  const db = seedDb();
  cache = db;
  localStorage.setItem(storageKey(), JSON.stringify(db));
  return db;
};

export const save = (db: DbShape) => {
  cache = db;
  localStorage.setItem(storageKey(), JSON.stringify(db));
  // tell the sync engine there is something new to send. It is called after
  // the local write, never before: a failed upload must not cost a local save.
  onSave?.(db);
};

/**
 * Point storage at an account (or at `null` for the signed-out, local-only
 * key). Drops the cache so the next `load()` reads the right one.
 */
export const setNamespace = (userId: string | null) => {
  namespace = userId;
  cache = null;
};

export const getNamespace = () => namespace;

/** whatever is saved under the signed-out key, if anything */
export const readGuestDb = () => readKey(STORAGE_KEY);

/** true when the current namespace has never been written to */
export const isNamespaceEmpty = () => localStorage.getItem(storageKey()) === null;

/**
 * Overwrite the whole database — used when an account's rows arrive from
 * Supabase. Deliberately does not run the save hook: this data *came from* the
 * server, so pushing it straight back would be a pointless round trip.
 */
export const replaceLocal = (db: DbShape) => {
  cache = db;
  localStorage.setItem(storageKey(), JSON.stringify(db));
};

/** registered once, by the sync controller */
export const setSaveHook = (fn: ((db: DbShape) => void) | null) => {
  onSave = fn;
};

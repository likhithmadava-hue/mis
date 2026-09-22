/**
 * Which screen the app is on, and how it moves between them.
 *
 * ```text
 *   checking ──► setup ──(account created)──► app
 *            ├─► locked ──(signed in)───────► app ──(lock)──► locked
 *            └─► failed
 * ```
 *
 * Rust decides the stage (`auth_status`) and enforces it — every command
 * refuses with `locked` until sign-in succeeds. This file only follows along:
 * it is the *routing*, not the lock, so a bug here can show the wrong screen but
 * cannot open the vault.
 *
 * The database is loaded by [`enterApp`] and dropped by [`lock`], so the store
 * never holds someone's marks while a lock screen is up.
 */

import { createSignal } from 'solid-js';

import { api, boot, clear, errorCode, errorMessage } from '../db';

export type Screen = 'checking' | 'setup' | 'locked' | 'app' | 'failed';

const [screen, setScreen] = createSignal<Screen>('checking');
const [failure, setFailure] = createSignal('');

export { failure, screen };

/** Load the database, then show the app. The only way into `app`. */
export async function enterApp(): Promise<void> {
  try {
    await boot();
    setScreen('app');
  } catch (e) {
    setFailure(errorMessage(e));
    setScreen('failed');
  }
}

/** Decide the first screen. Called once, at launch. */
export async function start(): Promise<void> {
  try {
    const { stage } = await api.authStatus();
    if (stage === 'unlocked') return await enterApp();
    setScreen(stage); // 'setup' | 'locked'
  } catch (e) {
    // The Android build has no account backend yet (see `MisPlugin.kt`), so
    // there is nothing to gate. Fall through to the app as it was before
    // accounts existed rather than strand the phone on a screen that cannot
    // be left. Desktop never takes this branch — its Rust side always answers.
    if (errorCode(e) === 'not-implemented') return await enterApp();
    setFailure(errorMessage(e));
    setScreen('failed');
  }
}

/** Lock MIS: forget the key in Rust, drop the data here, show the sign-in screen. */
export async function lock(): Promise<void> {
  await api.authLock();
  clear();
  setScreen('locked');
}

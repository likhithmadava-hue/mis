import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * The one Supabase connection MIS makes. Nothing else in the app calls
 * createClient — two clients would keep two copies of the session and fight
 * over which one is signed in.
 *
 * Both values come from `.env.local` and Vite inlines them at build time, so
 * they are visible in the shipped HTML. That is how Supabase is meant to be
 * used from a browser: the anon key is a public identifier, and the row-level
 * security policies in supabase/schema.sql are what actually protect the data.
 */

const url = (import.meta.env.VITE_SUPABASE_URL ?? '').trim();
const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim();

/**
 * ── Login is switched off ────────────────────────────────────────────────────
 * MIS is a device-first app for now: no accounts, no login screen, nothing
 * leaving this computer. The Supabase code below is left intact rather than
 * deleted so it is ready when accounts come back.
 *
 * This flag is the bottom layer. The app no longer imports any of this: the
 * auth gate in App.tsx and the AuthProvider in main.tsx are both commented
 * out, so nothing here is even reachable. Keeping the flag false as well means
 * `supabase` stays null, so `core/db/remote.ts` — which is still imported by
 * the sync layer — never tries to talk to the network.
 *
 * Flipping this to `true` alone will NOT bring the login screen back; the full
 * restore list is at the top of App.tsx. `.env.local` still holds the project
 * credentials, so nothing else needs restoring.
 */
export const LOGIN_ENABLED = false;

/**
 * False when login is switched off, or until `.env.local` is filled in. When it
 * is false MIS keeps working exactly as it did before Supabase existed — no
 * login screen, everything saved to this computer only — instead of showing a
 * login that cannot possibly work.
 */
export const isSupabaseConfigured = LOGIN_ENABLED && Boolean(url && anonKey);

/**
 * Null when unconfigured. Every caller has to check, which is deliberate: it
 * makes "there is no backend" a case the code handles rather than a crash.
 */
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        // Pick the session out of the URL fragment after a magic link or a
        // Google redirect lands back on the page.
        detectSessionInUrl: true,
      },
    })
  : null;

/**
 * True when MIS is running as a downloaded file (the desktop shortcut) rather
 * than from a web address.
 *
 * It matters for sign-in: a magic link and a Google redirect both have to send
 * the browser back to a URL, and `file:///C:/…/dist/index.html` is not one a
 * provider will redirect to. Email and password needs no redirect, so it is the
 * only method offered there.
 */
const inBrowser = typeof location !== 'undefined';

export const isFileBuild = inBrowser && location.protocol === 'file:';

/** where a magic link or OAuth provider should send the browser back to */
export const redirectTo =
  inBrowser && !isFileBuild ? `${location.origin}${location.pathname}` : undefined;

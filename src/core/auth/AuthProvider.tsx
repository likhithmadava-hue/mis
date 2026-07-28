import { createContext } from "preact";
import { useContext, useEffect, useState } from "preact/hooks";
import type { ComponentChildren } from "preact";
import type { User } from "@supabase/supabase-js";
import { supabase, isSupabaseConfigured } from "./client";
import { attachUser, detachUser, flushSync } from "../db/sync";

/**
 * Who is signed in, and whether their data is ready to render.
 *
 *   loading    working out whether there is a saved session
 *   disabled   `.env.local` has no Supabase project — MIS runs local-only,
 *              exactly as it did before any of this existed
 *   signed-out show the login screen
 *   preparing  signed in, fetching this account's rows
 *   ready      signed in and the database is loaded
 *
 * `preparing` is not cosmetic. Every module reads the database synchronously
 * while it renders, so the app must not mount until the right account's data is
 * actually in place — otherwise the first paint shows the previous account's
 * numbers, or an empty seed, and then jumps.
 */
export type AuthPhase =
  | "loading"
  | "disabled"
  | "signed-out"
  | "preparing"
  | "ready";

interface AuthValue {
  phase: AuthPhase;
  user: User | null;
  /** what to show as the account name — the email, or the Google display name */
  label: string;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthValue>({
  phase: "loading",
  user: null,
  label: "",
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ComponentChildren }) {
  const [phase, setPhase] = useState<AuthPhase>(
    isSupabaseConfigured ? "loading" : "disabled",
  );
  const [user, setUser] = useState<User | null>(null);

  // ── watch the session ──
  useEffect(() => {
    if (!supabase) return;

    let live = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!live) return;
      setUser(data.session?.user ?? null);
      if (!data.session) setPhase("signed-out");
    });

    // Only the session is touched in here. Supabase's own guidance is to keep
    // this callback free of awaits — doing the data fetch in the effect below,
    // keyed on the user id, keeps it that way and also means a token refresh
    // (same user, new token) does not re-download the database.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!live) return;
      setUser(session?.user ?? null);
      if (!session) setPhase("signed-out");
    });

    return () => {
      live = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // ── attach the database to whoever is signed in ──
  const userId = user?.id ?? null;

  useEffect(() => {
    if (!isSupabaseConfigured) return;

    if (!userId) {
      detachUser();
      return;
    }

    let live = true;
    setPhase("preparing");
    // attachUser resolves even when the network is down — it falls back to this
    // device's saved copy and leaves the sync indicator showing the problem, so
    // the app is never held hostage by a bad connection
    void attachUser(userId).then(() => {
      if (live) setPhase("ready");
    });

    return () => {
      live = false;
    };
  }, [userId]);

  const signOut = async () => {
    // get any queued changes up before the session goes away
    await flushSync();
    await supabase?.auth.signOut();
    detachUser();
    setUser(null);
    setPhase("signed-out");
  };

  const label =
    (user?.user_metadata?.full_name as string | undefined) ||
    (user?.user_metadata?.name as string | undefined) ||
    user?.email ||
    "";

  return (
    <AuthContext.Provider value={{ phase, user, label, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

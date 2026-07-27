import { useState, type FormEvent } from 'react';
import { AlertCircle, ArrowRight, CheckCircle2, Loader2, Mail, Sprout } from 'lucide-react';
import { supabase, isFileBuild, redirectTo } from './client';

/**
 * The sign-in screen. Three ways in:
 *
 *   password  email and a password. The only one that needs no redirect back
 *             to a web address, so the only one the downloaded desktop copy
 *             can offer.
 *   magic     Supabase emails a one-time link. No password to forget.
 *   google    Google decides who you are and sends the browser back.
 *
 * Whichever succeeds, the result is the same: a Supabase session, which
 * AuthProvider turns into a loaded database.
 */

type Method = 'password' | 'signup' | 'magic';

// Google sign-in is turned off for now. Set this back to true (and make sure the
// Google provider is enabled in Supabase) to bring the "Continue with Google"
// button back — nothing else needs to change.
const GOOGLE_ENABLED = false;

/** Google's mark, inline — the build must not fetch anything from the network */
const GoogleMark = () => (
  <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
    <path
      fill="#4285F4"
      d="M45.1 24.5c0-1.6-.1-3.2-.4-4.7H24v8.9h11.8c-.5 2.7-2.1 5-4.4 6.6v5.5h7.1c4.2-3.8 6.6-9.5 6.6-16.3z"
    />
    <path
      fill="#34A853"
      d="M24 46c6 0 11-2 14.6-5.3l-7.1-5.5c-2 1.3-4.5 2.1-7.5 2.1-5.8 0-10.6-3.9-12.4-9.1H4.3v5.7C7.9 41.1 15.4 46 24 46z"
    />
    <path
      fill="#FBBC05"
      d="M11.6 28.2c-.5-1.3-.7-2.7-.7-4.2s.3-2.9.7-4.2v-5.7H4.3A22 22 0 0 0 2 24c0 3.6.9 6.9 2.3 9.9l7.3-5.7z"
    />
    <path
      fill="#EA4335"
      d="M24 10.7c3.3 0 6.2 1.1 8.5 3.3l6.3-6.3C35 4.1 30 2 24 2 15.4 2 7.9 6.9 4.3 14.1l7.3 5.7c1.8-5.2 6.6-9.1 12.4-9.1z"
    />
  </svg>
);

const FIELD =
  'w-full h-9 px-3 rounded-lg bg-background border border-border text-sm text-foreground placeholder:text-muted-foreground/60 transition-colors';

export default function LoginScreen() {
  const [method, setMethod] = useState<Method>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // A magic link and a Google sign-in both end with the provider redirecting a
  // browser to a URL. `file:///C:/…/MIS.html` is not one, so the downloaded
  // copy gets the password form only.
  const canRedirect = !isFileBuild;

  const run = async (fn: () => Promise<{ error: { message: string } | null }>) => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const { error: err } = await fn();
      if (err) setError(err.message);
      return !err;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Try again.');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!supabase || busy) return;

    if (method === 'password') {
      // on success AuthProvider picks the session up and this screen unmounts
      await run(() => supabase.auth.signInWithPassword({ email, password }));
      return;
    }

    if (method === 'signup') {
      if (password.length < 6) {
        setError('Use at least 6 characters for the password.');
        return;
      }
      const ok = await run(async () => {
        const { data, error: err } = await supabase.auth.signUp({
          email,
          password,
          options: redirectTo ? { emailRedirectTo: redirectTo } : undefined,
        });
        // With "Confirm email" on (the Supabase default) signUp returns no
        // session — the account exists but cannot be used until the link in
        // the email is clicked. Saying so beats a form that silently does
        // nothing.
        if (!err && !data.session) {
          setNotice(`Account created. Check ${email} for a confirmation link, then sign in.`);
        }
        return { error: err };
      });
      if (ok) setMethod('password');
      return;
    }

    // magic link
    const ok = await run(() =>
      supabase.auth.signInWithOtp({
        email,
        options: redirectTo ? { emailRedirectTo: redirectTo } : undefined,
      })
    );
    if (ok) setNotice(`Sign-in link sent to ${email}. Open it in this browser.`);
  };

  const google = () => {
    if (!supabase) return;
    void run(async () => {
      const { error: err } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: redirectTo ? { redirectTo } : undefined,
      });
      return { error: err };
    });
  };

  const forgotPassword = async () => {
    if (!supabase) return;
    if (!email) {
      setError('Type your email address first, then choose Forgot password.');
      return;
    }
    const ok = await run(() =>
      supabase.auth.resetPasswordForEmail(email, redirectTo ? { redirectTo } : undefined)
    );
    if (ok) {
      setNotice(
        `Reset link sent to ${email}. Opening it signs you in — then set a new password from the account menu.`
      );
    }
  };

  const heading =
    method === 'signup' ? 'Create your account' : method === 'magic' ? 'Sign in by email' : 'Sign in';

  return (
    <div className="min-h-screen flex items-center justify-center px-5 py-10">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3 mb-7">
          <div className="w-11 h-11 flex-shrink-0 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center glow-primary">
            <Sprout className="text-primary" size={22} />
          </div>
          <div>
            <h1 className="text-xl font-bold font-space tracking-tight leading-tight">MIS</h1>
            <p className="text-[11px] text-muted-foreground font-medium">
              Study the way you solve
            </p>
          </div>
        </div>

        {!supabase && (
          <div className="mb-4 rounded-lg border border-primary/30 bg-accent px-3 py-2.5 flex items-start gap-2">
            <AlertCircle size={14} className="flex-shrink-0 mt-px text-primary" />
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Preview only — Supabase is not configured yet, so these buttons do
              nothing. Fill in <span className="font-mono">.env.local</span> and
              restart to make them work.
            </p>
          </div>
        )}

        <div className="bg-card rounded-2xl border border-border card-shadow p-6">
          <h2 className="text-lg font-bold font-space tracking-tight">{heading}</h2>
          <p className="text-sm text-muted-foreground mt-1 mb-5">
            {method === 'signup'
              ? 'Your logbook, habits and focus sessions follow you to any device.'
              : 'Welcome back — your data is waiting.'}
          </p>

          <form onSubmit={submit} className="space-y-3">
            <label className="block">
              <span className="text-xs font-medium text-muted-foreground">Email</span>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className={`${FIELD} mt-1.5`}
              />
            </label>

            {method !== 'magic' && (
              <label className="block">
                <span className="text-xs font-medium text-muted-foreground">Password</span>
                <input
                  type="password"
                  required
                  autoComplete={method === 'signup' ? 'new-password' : 'current-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={method === 'signup' ? 'At least 6 characters' : '••••••••'}
                  className={`${FIELD} mt-1.5`}
                />
              </label>
            )}

            {error && (
              <p className="flex items-start gap-2 text-xs text-destructive">
                <AlertCircle size={14} className="flex-shrink-0 mt-px" />
                <span>{error}</span>
              </p>
            )}
            {notice && (
              <p className="flex items-start gap-2 text-xs text-success">
                <CheckCircle2 size={14} className="flex-shrink-0 mt-px" />
                <span>{notice}</span>
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full h-9 rounded-lg bg-primary text-primary-foreground text-sm font-semibold font-space flex items-center justify-center gap-2 transition-opacity disabled:opacity-60"
            >
              {busy ? (
                <Loader2 size={15} className="animate-spin" />
              ) : method === 'magic' ? (
                <Mail size={15} />
              ) : (
                <ArrowRight size={15} />
              )}
              {method === 'signup'
                ? 'Create account'
                : method === 'magic'
                  ? 'Send me a link'
                  : 'Sign in'}
            </button>
          </form>

          {canRedirect && (
            <>
              <div className="flex items-center gap-3 my-4">
                <span className="h-px flex-1 bg-border" />
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">or</span>
                <span className="h-px flex-1 bg-border" />
              </div>

              <div className="space-y-2">
                {GOOGLE_ENABLED && (
                  <button
                    type="button"
                    onClick={google}
                    disabled={busy}
                    className="w-full h-9 rounded-lg bg-muted border border-border text-sm font-medium flex items-center justify-center gap-2 hover:border-primary/40 transition-colors disabled:opacity-60"
                  >
                    <GoogleMark />
                    Continue with Google
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setMethod(method === 'magic' ? 'password' : 'magic');
                    setError('');
                    setNotice('');
                  }}
                  className="w-full h-9 rounded-lg bg-muted border border-border text-sm font-medium flex items-center justify-center gap-2 hover:border-primary/40 transition-colors"
                >
                  <Mail size={15} className="text-muted-foreground" />
                  {method === 'magic' ? 'Use a password instead' : 'Email me a sign-in link'}
                </button>
              </div>
            </>
          )}

          <div className="mt-5 pt-4 border-t border-border flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={() => {
                setMethod(method === 'signup' ? 'password' : 'signup');
                setError('');
                setNotice('');
              }}
              className="text-primary hover:underline"
            >
              {method === 'signup' ? 'I already have an account' : 'Create an account'}
            </button>

            {method === 'password' && (
              <button
                type="button"
                onClick={forgotPassword}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                Forgot password?
              </button>
            )}
          </div>
        </div>

        {isFileBuild && (
          <p className="text-[11px] text-muted-foreground/80 leading-relaxed mt-4 px-1">
            This is the downloaded copy of MIS, so sign-in links and Google are unavailable —
            both have to send your browser back to a web address, and a file on your disk is
            not one. Email and password works exactly the same either way.
          </p>
        )}
      </div>
    </div>
  );
}

import { ArrowLeft, LogIn } from 'lucide-solid';
import { createSignal, Match, Show, Switch } from 'solid-js';

import { enterApp } from '../../core/auth';
import { api, errorCode, errorMessage } from '../../core/db';
import AuthShell from './AuthShell';
import { Field, PasswordInput, primaryButton, quietButton, TextInput } from './fields';
import RecoveryCode from './RecoveryCode';

type View = 'sign-in' | 'recover' | 'new-code';

/**
 * The lock screen.
 *
 * Nothing on it is drawn from the vault — it can't be, the vault is shut — so it
 * greets no one by name and shows no numbers. Both a wrong username and a wrong
 * password say the same thing, on purpose (see `MisError::BadCredentials`).
 *
 * "Forgot password?" is the recovery-code flow: the code plus a new password.
 * There is no email step because there is nothing to send one — see
 * `vault/passkey.rs`.
 */
export default function SignIn() {
  const [view, setView] = createSignal<View>('sign-in');
  const [newCode, setNewCode] = createSignal('');

  return (
    <AuthShell>
      <Switch>
        <Match when={view() === 'sign-in'}>
          <SignInForm onForgot={() => setView('recover')} />
        </Match>
        <Match when={view() === 'recover'}>
          <RecoverForm
            onBack={() => setView('sign-in')}
            onRecovered={(code) => {
              setNewCode(code);
              setView('new-code');
            }}
          />
        </Match>
        <Match when={view() === 'new-code'}>
          <RecoveryCode
            code={newCode()}
            doneLabel="Open MIS"
            onDone={() => void enterApp()}
          />
        </Match>
      </Switch>
    </AuthShell>
  );
}

function SignInForm(props: { onForgot: () => void }) {
  const [username, setUsername] = createSignal('');
  const [password, setPassword] = createSignal('');
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  const submit = async (e: SubmitEvent) => {
    e.preventDefault();
    if (busy() || !username().trim() || !password()) return;
    setBusy(true);
    setError(null);
    try {
      await api.authLogin(username().trim(), password());
      setPassword('');
      await enterApp();
    } catch (err) {
      setError(errorMessage(err));
      // Clear the password after a miss, but leave the username so it is one
      // field to retype, not two. A throttle wait keeps the password too —
      // nothing was actually checked.
      if (errorCode(err) !== 'throttled') setPassword('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form class="space-y-5" onSubmit={(e) => void submit(e)}>
      <div>
        <h2 class="text-xl font-bold font-space tracking-tight">Welcome back</h2>
        <p class="text-sm text-muted-foreground mt-1">Sign in to unlock MIS.</p>
      </div>

      <Field label="Username">
        <TextInput
          value={username()}
          onInput={setUsername}
          autocomplete="username"
          name="username"
          autofocus
        />
      </Field>

      <Field label="Password">
        <PasswordInput
          value={password()}
          onInput={setPassword}
          autocomplete="current-password"
          name="password"
        />
      </Field>

      <Show when={error()}>
        {(msg) => (
          <p role="alert" class="text-sm text-destructive">
            {msg()}
          </p>
        )}
      </Show>

      <button
        type="submit"
        disabled={busy() || !username().trim() || !password()}
        class={`${primaryButton} w-full`}
      >
        <LogIn size={15} /> {busy() ? 'Unlocking…' : 'Unlock'}
      </button>

      <button
        type="button"
        onClick={props.onForgot}
        class="w-full text-center text-xs text-muted-foreground hover:text-primary transition-colors"
      >
        Forgot password?
      </button>
    </form>
  );
}

function RecoverForm(props: { onBack: () => void; onRecovered: (newCode: string) => void }) {
  const [code, setCode] = createSignal('');
  const [password, setPassword] = createSignal('');
  const [confirm, setConfirm] = createSignal('');
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  const mismatch = () => confirm().length > 0 && confirm() !== password();

  const submit = async (e: SubmitEvent) => {
    e.preventDefault();
    if (busy()) return;
    if (password().length < 8) return setError('Use at least 8 characters for the new password');
    if (password() !== confirm()) return setError('The two passwords don’t match');

    setBusy(true);
    setError(null);
    try {
      const fresh = await api.authRecover(code(), password());
      setPassword('');
      setConfirm('');
      props.onRecovered(fresh);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form class="space-y-5" onSubmit={(e) => void submit(e)}>
      <div>
        <h2 class="text-xl font-bold font-space tracking-tight">Reset your password</h2>
        <p class="text-sm text-muted-foreground mt-1 leading-relaxed">
          Enter the recovery code you saved when you created your account, then choose a new
          password. Your data stays exactly as it is.
        </p>
      </div>

      <Field label="Recovery code">
        <TextInput
          value={code()}
          onInput={(v) => setCode(v.toUpperCase())}
          placeholder="XXXXX-XXXXX-XXXXX-XXXXX-XXXXX"
          class="font-mono tracking-wider"
          autofocus
        />
      </Field>

      <Field label="New password">
        <PasswordInput
          value={password()}
          onInput={setPassword}
          autocomplete="new-password"
          name="new-password"
          placeholder="At least 8 characters"
        />
      </Field>

      <Field label="Confirm new password">
        <PasswordInput
          value={confirm()}
          onInput={setConfirm}
          autocomplete="new-password"
          name="confirm-password"
          invalid={mismatch()}
        />
      </Field>

      <Show when={error()}>
        {(msg) => (
          <p role="alert" class="text-sm text-destructive">
            {msg()}
          </p>
        )}
      </Show>

      <div class="flex items-center justify-between gap-3">
        <button type="button" onClick={props.onBack} disabled={busy()} class={quietButton}>
          <ArrowLeft size={15} /> Back
        </button>
        <button
          type="submit"
          disabled={busy() || !code().trim() || !password() || !confirm()}
          class={primaryButton}
        >
          {busy() ? 'Resetting…' : 'Reset & unlock'}
        </button>
      </div>
    </form>
  );
}

import { KeyRound, Lock, ShieldCheck, X } from 'lucide-solid';
import { createSignal, Match, onCleanup, onMount, Show, Switch } from 'solid-js';
import { Portal } from 'solid-js/web';

import { lock } from '../../core/auth';
import { api, db, errorMessage } from '../../core/db';
import { Field, PasswordInput, primaryButton, quietButton } from './fields';
import RecoveryCode from './RecoveryCode';

type View = 'main' | 'password' | 'ask-code' | 'show-code';

/**
 * Who is signed in, and the three things you can do about it.
 *
 * Changing the password and issuing a new recovery code both ask for the
 * *current* password again. A window left unlocked on a desk is exactly the
 * situation the lock is for, and it should not be enough on its own to take the
 * account over.
 *
 * While a new recovery code is on screen, Escape and a click outside do nothing:
 * the old code is already retired, and closing would throw the only copy of the
 * new one away.
 */
export default function AccountDialog(props: { onClose: () => void }) {
  const [view, setView] = createSignal<View>('main');
  const [newCode, setNewCode] = createSignal('');
  const [notice, setNotice] = createSignal<string | null>(null);

  const closable = () => view() !== 'show-code';
  const close = () => closable() && props.onClose();

  onMount(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    document.addEventListener('keydown', onKey);
    onCleanup(() => document.removeEventListener('keydown', onKey));
  });

  const back = () => {
    setNotice(null);
    setView('main');
  };

  return (
    <Portal>
      <div
        class="fixed inset-0 z-50 grid place-items-center p-4 bg-background/80 backdrop-blur-sm animate-fade-in"
        onMouseDown={(e) => e.target === e.currentTarget && close()}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Account"
          class="w-full max-w-[27rem] max-h-[92dvh] overflow-y-auto bg-card border border-border rounded-2xl raised-shadow p-6"
        >
          <Show when={view() !== 'show-code'}>
            <div class="flex items-start justify-between gap-3 mb-5">
              <div class="flex items-center gap-3 min-w-0">
                <div class="w-10 h-10 flex-shrink-0 rounded-xl bg-primary/10 border border-primary/30 grid place-items-center">
                  <ShieldCheck size={18} class="text-primary" />
                </div>
                <div class="min-w-0">
                  <h2 class="text-base font-bold font-space truncate">
                    {db.profile?.full_name || 'Your account'}
                  </h2>
                  <p class="text-[0.6875rem] text-subtle-foreground truncate">
                    @{db.profile?.username} · {db.profile?.email}
                  </p>
                </div>
              </div>
              <button
                onClick={props.onClose}
                aria-label="Close"
                class="w-8 h-8 flex-shrink-0 grid place-items-center rounded-lg text-subtle-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <X size={16} />
              </button>
            </div>
          </Show>

          <Switch>
            <Match when={view() === 'main'}>
              <div class="space-y-2.5">
                <Show when={notice()}>
                  {(msg) => (
                    <p role="status" class="text-xs text-success pb-1">
                      {msg()}
                    </p>
                  )}
                </Show>
                <button onClick={() => setView('password')} class={`${quietButton} w-full justify-start`}>
                  <KeyRound size={15} /> Change password
                </button>
                <button onClick={() => setView('ask-code')} class={`${quietButton} w-full justify-start`}>
                  <ShieldCheck size={15} /> Get a new recovery code
                </button>
                <button
                  onClick={() => void lock()}
                  class={`${primaryButton} w-full mt-1`}
                >
                  <Lock size={15} /> Lock MIS now
                </button>
              </div>
            </Match>

            <Match when={view() === 'password'}>
              <ChangePassword
                onBack={back}
                onDone={() => {
                  setNotice('Password changed.');
                  setView('main');
                }}
              />
            </Match>

            <Match when={view() === 'ask-code'}>
              <AskForCode
                onBack={back}
                onCode={(c) => {
                  setNewCode(c);
                  setView('show-code');
                }}
              />
            </Match>

            <Match when={view() === 'show-code'}>
              <RecoveryCode
                code={newCode()}
                doneLabel="Done"
                onDone={() => {
                  setNewCode('');
                  setNotice('New recovery code saved. The old one no longer works.');
                  setView('main');
                }}
              />
            </Match>
          </Switch>
        </div>
      </div>
    </Portal>
  );
}

function ChangePassword(props: { onBack: () => void; onDone: () => void }) {
  const [current, setCurrent] = createSignal('');
  const [next, setNext] = createSignal('');
  const [confirm, setConfirm] = createSignal('');
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  const submit = async (e: SubmitEvent) => {
    e.preventDefault();
    if (busy()) return;
    if (next().length < 8) return setError('Use at least 8 characters for the new password');
    if (next() !== confirm()) return setError('The two new passwords don’t match');
    setBusy(true);
    setError(null);
    try {
      await api.authChangePassword(current(), next());
      setCurrent('');
      setNext('');
      setConfirm('');
      props.onDone();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form class="space-y-4" onSubmit={(e) => void submit(e)}>
      <h3 class="text-sm font-bold font-space">Change password</h3>
      <Field label="Current password">
        <PasswordInput value={current()} onInput={setCurrent} autocomplete="current-password" autofocus />
      </Field>
      <Field label="New password">
        <PasswordInput
          value={next()}
          onInput={setNext}
          autocomplete="new-password"
          placeholder="At least 8 characters"
        />
      </Field>
      <Field label="Confirm new password">
        <PasswordInput
          value={confirm()}
          onInput={setConfirm}
          autocomplete="new-password"
          invalid={confirm().length > 0 && confirm() !== next()}
        />
      </Field>
      <Show when={error()}>
        {(msg) => (
          <p role="alert" class="text-sm text-destructive">
            {msg()}
          </p>
        )}
      </Show>
      <div class="flex items-center justify-between gap-3 pt-1">
        <button type="button" onClick={props.onBack} disabled={busy()} class={quietButton}>
          Cancel
        </button>
        <button type="submit" disabled={busy() || !current() || !next() || !confirm()} class={primaryButton}>
          {busy() ? 'Saving…' : 'Change password'}
        </button>
      </div>
    </form>
  );
}

function AskForCode(props: { onBack: () => void; onCode: (code: string) => void }) {
  const [current, setCurrent] = createSignal('');
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  const submit = async (e: SubmitEvent) => {
    e.preventDefault();
    if (busy()) return;
    setBusy(true);
    setError(null);
    try {
      const code = await api.authNewRecoveryCode(current());
      setCurrent('');
      props.onCode(code);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form class="space-y-4" onSubmit={(e) => void submit(e)}>
      <div>
        <h3 class="text-sm font-bold font-space">Get a new recovery code</h3>
        <p class="text-xs text-muted-foreground mt-1 leading-relaxed">
          Your current code stops working the moment a new one is made. Confirm your password to
          continue.
        </p>
      </div>
      <Field label="Password">
        <PasswordInput value={current()} onInput={setCurrent} autocomplete="current-password" autofocus />
      </Field>
      <Show when={error()}>
        {(msg) => (
          <p role="alert" class="text-sm text-destructive">
            {msg()}
          </p>
        )}
      </Show>
      <div class="flex items-center justify-between gap-3 pt-1">
        <button type="button" onClick={props.onBack} disabled={busy()} class={quietButton}>
          Cancel
        </button>
        <button type="submit" disabled={busy() || !current()} class={primaryButton}>
          {busy() ? 'Working…' : 'Make new code'}
        </button>
      </div>
    </form>
  );
}

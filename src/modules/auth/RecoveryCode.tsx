import { save } from '@tauri-apps/plugin-dialog';
import { writeTextFile } from '@tauri-apps/plugin-fs';
import { Check, Copy, Download, KeyRound, TriangleAlert } from 'lucide-solid';
import { createSignal, Show } from 'solid-js';

import { errorMessage } from '../../core/db';
import { primaryButton, quietButton } from './fields';

interface RecoveryCodeProps {
  code: string;
  /** what the final button says: "Open MIS", "Done" */
  doneLabel: string;
  onDone: () => void;
}

/**
 * The one moment a recovery code exists on screen.
 *
 * MIS sends no email and runs no server, so this code *is* the way back in if
 * the password is forgotten — and it is not stored anywhere that could show it
 * again. Rust keeps only a wrapped copy of the vault key that this code can
 * open. So the panel does three things: makes the code easy to keep (copy, save
 * as a file), says plainly what losing it means, and will not continue until
 * the person has said they saved it.
 *
 * Saying "I saved it" is an honour system — nothing can check — but it turns
 * "I clicked past it" into a decision.
 */
export default function RecoveryCode(props: RecoveryCodeProps) {
  const [copied, setCopied] = createSignal(false);
  const [savedTo, setSavedTo] = createSignal<string | null>(null);
  const [confirmed, setConfirmed] = createSignal(false);
  const [problem, setProblem] = createSignal<string | null>(null);

  const copy = async () => {
    setProblem(null);
    try {
      await navigator.clipboard.writeText(props.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // A webview may refuse the clipboard; the code is on screen and
      // selectable, so say so rather than fail quietly.
      setProblem('Could not reach the clipboard — select the code and copy it by hand.');
    }
  };

  const saveFile = async () => {
    setProblem(null);
    try {
      const path = await save({
        defaultPath: 'MIS-recovery-code.txt',
        filters: [{ name: 'Text file', extensions: ['txt'] }],
      });
      if (!path) return; // cancelling is not an error
      await writeTextFile(
        path,
        [
          'MIS recovery code',
          '',
          props.code,
          '',
          'If you forget your MIS password, choose "Forgot password?" on the sign-in',
          'screen and enter this code. Each code works once — MIS gives you a new one',
          'when you use it.',
          '',
          'Keep this file somewhere only you can open (not next to your MIS data).',
          'Anyone who has it can reset your MIS password.',
          '',
        ].join('\r\n'),
      );
      setSavedTo(path);
    } catch (e) {
      setProblem(`Could not save the file — ${errorMessage(e)}`);
    }
  };

  return (
    <div class="space-y-5">
      <div class="flex items-start gap-3">
        <div class="w-10 h-10 flex-shrink-0 rounded-xl bg-warning/10 border border-warning/30 grid place-items-center">
          <KeyRound size={18} class="text-warning" />
        </div>
        <div>
          <h2 class="text-lg font-bold font-space tracking-tight">Save your recovery code</h2>
          <p class="text-sm text-muted-foreground mt-1 leading-relaxed">
            This is the only way back in if you forget your password. MIS can't email it to you —
            nothing leaves this device — so it is shown once, here.
          </p>
        </div>
      </div>

      <div class="rounded-xl border border-warning/30 bg-warning/[0.06] px-4 py-5 text-center">
        <code
          class="select-text block font-mono text-[1.0625rem] sm:text-xl font-semibold tracking-[0.08em] text-foreground break-all"
          aria-label="Recovery code"
        >
          {props.code}
        </code>
      </div>

      <div class="grid grid-cols-2 gap-3">
        <button type="button" onClick={() => void copy()} class={quietButton}>
          <Show when={copied()} fallback={<Copy size={15} />}>
            <Check size={15} class="text-success" />
          </Show>
          {copied() ? 'Copied' : 'Copy'}
        </button>
        <button type="button" onClick={() => void saveFile()} class={quietButton}>
          <Download size={15} /> Save as file
        </button>
      </div>

      <Show when={savedTo()}>
        {(path) => (
          <p class="text-[0.6875rem] text-success break-all">Saved to {path()}</p>
        )}
      </Show>
      <Show when={problem()}>
        {(msg) => (
          <p role="alert" class="text-[0.6875rem] text-destructive">
            {msg()}
          </p>
        )}
      </Show>

      <div class="flex items-start gap-2.5 text-[0.75rem] text-muted-foreground leading-relaxed">
        <TriangleAlert size={14} class="text-warning flex-shrink-0 mt-0.5" />
        <p>
          Anyone with this code can reset your password, so keep it somewhere private — a password
          manager or a piece of paper, not a file next to your MIS data. If you lose both the
          password and the code, your data can't be opened.
        </p>
      </div>

      <label class="flex items-center gap-2.5 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={confirmed()}
          onChange={(e) => setConfirmed(e.currentTarget.checked)}
          class="w-4 h-4 accent-[hsl(var(--primary))]"
        />
        <span class="text-sm">I've saved my recovery code somewhere safe</span>
      </label>

      <button
        type="button"
        disabled={!confirmed()}
        onClick={props.onDone}
        class={`${primaryButton} w-full`}
      >
        {props.doneLabel}
      </button>
    </div>
  );
}

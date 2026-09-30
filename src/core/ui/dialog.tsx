import { CircleAlert, Info, TriangleAlert } from 'lucide-solid';
import { createSignal, onCleanup, onMount, Show } from 'solid-js';
import { Dynamic } from 'solid-js/web';

import type { Icon } from './icon';

/**
 * The app's own confirm / message dialogs.
 *
 * These replace the OS dialogs from `@tauri-apps/plugin-dialog`. Those paint a
 * stock Windows window — white, system font, blue title bar — over a dark app,
 * which is the one place the interface stopped looking like MIS. Drawing the
 * dialog ourselves keeps it on the same tokens as every other card.
 *
 * Call sites stay as simple as the native version: `await confirmDialog(...)`
 * resolves to a boolean, `await messageDialog(...)` resolves when dismissed.
 * One `<DialogHost />` mounted at the app root renders whichever is pending.
 */

type Tone = 'warning' | 'danger' | 'info';

interface DialogOptions {
  title: string;
  body: string;
  /** `danger` is for irreversible actions: red accents, and Cancel takes focus */
  tone?: Tone;
  confirmLabel?: string;
  cancelLabel?: string;
}

interface Pending extends DialogOptions {
  /** a message dialog has no Cancel */
  kind: 'confirm' | 'message';
  resolve: (ok: boolean) => void;
}

/** requests wait their turn — two calls never stack two dialogs on screen */
const [queue, setQueue] = createSignal<Pending[]>([]);

const enqueue = (p: Omit<Pending, 'resolve'>) =>
  new Promise<boolean>((resolve) => setQueue((q) => [...q, { ...p, resolve }]));

/** Resolves true on confirm, false on Cancel, Escape or a click on the backdrop. */
export const confirmDialog = (opts: DialogOptions) => enqueue({ kind: 'confirm', ...opts });

/** Resolves once the person has read it and dismissed it. */
export const messageDialog = async (opts: Omit<DialogOptions, 'cancelLabel'>) => {
  await enqueue({ kind: 'message', ...opts });
};

const TONE: Record<Tone, { icon: Icon; badge: string; button: string }> = {
  warning: {
    icon: TriangleAlert,
    badge: 'bg-primary/10 border-primary/30 text-primary',
    button: 'bg-primary text-primary-foreground',
  },
  danger: {
    icon: CircleAlert,
    badge: 'bg-destructive/10 border-destructive/40 text-destructive',
    button: 'bg-destructive text-background',
  },
  info: {
    icon: Info,
    badge: 'bg-primary/10 border-primary/30 text-primary',
    button: 'bg-primary text-primary-foreground',
  },
};

function Dialog(props: { pending: Pending; onClose: (ok: boolean) => void }) {
  const tone = () => TONE[props.pending.tone ?? 'warning'];
  let confirmBtn!: HTMLButtonElement;
  let cancelBtn: HTMLButtonElement | undefined;

  onMount(() => {
    // an irreversible action must not be one stray Enter away
    const safe = props.pending.tone === 'danger' ? cancelBtn : undefined;
    (safe ?? confirmBtn).focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        props.onClose(false);
      }
    };
    // capture, so a page-level shortcut can't act while the dialog is up
    window.addEventListener('keydown', onKey, true);
    onCleanup(() => window.removeEventListener('keydown', onKey, true));
  });

  return (
    <div
      class="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-fade-in"
      onMouseDown={(e) => e.target === e.currentTarget && props.onClose(false)}
    >
      <div
        role={props.pending.kind === 'confirm' ? 'alertdialog' : 'dialog'}
        aria-modal="true"
        aria-labelledby="mis-dialog-title"
        aria-describedby="mis-dialog-body"
        class="bg-card border border-border rounded-2xl card-shadow p-6 max-w-sm w-full space-y-5"
      >
        <div class="flex items-start gap-3.5">
          <div
            class={`w-10 h-10 shrink-0 rounded-xl border flex items-center justify-center ${
              tone().badge
            }`}
          >
            <Dynamic component={tone().icon} size={20} />
          </div>
          <div class="min-w-0 pt-0.5">
            <h3
              id="mis-dialog-title"
              class="text-base font-bold font-space tracking-tight leading-snug"
            >
              {props.pending.title}
            </h3>
            <p
              id="mis-dialog-body"
              class="text-xs text-muted-foreground mt-1.5 leading-relaxed whitespace-pre-line"
            >
              {props.pending.body}
            </p>
          </div>
        </div>

        <div class="flex justify-end gap-2">
          <Show when={props.pending.kind === 'confirm'}>
            <button
              ref={cancelBtn}
              onClick={() => props.onClose(false)}
              class="px-4 py-2 rounded-xl bg-muted border border-border text-foreground font-semibold text-sm hover:border-primary/40 active:scale-95 transition-all"
            >
              {props.pending.cancelLabel ?? 'Cancel'}
            </button>
          </Show>
          <button
            ref={confirmBtn}
            onClick={() => props.onClose(true)}
            class={`px-4 py-2 rounded-xl font-bold font-space text-sm active:scale-95 transition-transform ${
              tone().button
            }`}
          >
            {props.pending.confirmLabel ?? (props.pending.kind === 'confirm' ? 'Confirm' : 'OK')}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Mount once, at the app root. */
export function DialogHost() {
  const current = () => queue()[0];

  const close = (ok: boolean) => {
    const p = current();
    if (!p) return;
    setQueue((q) => q.slice(1));
    p.resolve(ok);
  };

  return (
    // keyed on the pending request, so a queued dialog mounts fresh and re-takes focus
    <Show when={current()} keyed>
      {(p) => <Dialog pending={p} onClose={close} />}
    </Show>
  );
}

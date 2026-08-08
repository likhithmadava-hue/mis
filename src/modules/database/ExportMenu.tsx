import { ChevronDown, Download, FileDown, FileJson, FileSpreadsheet } from 'lucide-solid';
import { createEffect, createSignal, For, onCleanup, Show } from 'solid-js';
import { Dynamic } from 'solid-js/web';

import { errorMessage, type MarkLogbookEntry } from '../../core/db';
import { exportCsv, exportJson, exportTemplate, exportXlsx } from './sheetImport';

/**
 * The four ways the logbook can leave the app.
 *
 * All four go through a native Save dialog. That the data can *always* get out,
 * in formats other programs read, is the counterweight to storing it in an
 * encrypted vault only this app can open — a lock you cannot export from is a
 * lock on your own data.
 */
export default function ExportMenu(props: { entries: MarkLogbookEntry[] }) {
  const [open, setOpen] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  let wrap!: HTMLDivElement;

  // close on an outside click, the way Select does
  createEffect(() => {
    if (!open()) return;
    const onDown = (e: MouseEvent) => {
      if (!wrap.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    onCleanup(() => document.removeEventListener('mousedown', onDown));
  });

  const actions = [
    { label: 'Excel (.xlsx)', icon: FileSpreadsheet, run: () => exportXlsx(props.entries) },
    { label: 'CSV (.csv)', icon: FileDown, run: () => exportCsv(props.entries) },
    { label: 'JSON backup', icon: FileJson, run: () => exportJson(props.entries) },
    { label: 'Blank template', icon: FileSpreadsheet, run: exportTemplate },
  ];

  const run = async (action: () => Promise<string | null>) => {
    setOpen(false);
    setError(null);
    try {
      await action();
    } catch (e) {
      // A failed export is worth saying out loud. Silently doing nothing after
      // the user picked a filename reads as the app being broken.
      setError(errorMessage(e));
    }
  };

  return (
    <div class="relative" ref={wrap}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open()}
        class="px-3 py-1.5 bg-background border border-border rounded-xl text-xs font-semibold text-muted-foreground hover:text-primary hover:border-primary/40 flex items-center gap-1.5 active:scale-95 transition-all"
      >
        <Download size={13} /> Export
        <ChevronDown size={12} class={`transition-transform ${open() ? 'rotate-180' : ''}`} />
      </button>

      <Show when={open()}>
        <div
          role="menu"
          class="absolute right-0 top-full mt-1.5 z-20 w-44 bg-card border border-border rounded-xl card-shadow p-1 animate-fade-in"
        >
          <For each={actions}>
            {(action) => (
              <button
                role="menuitem"
                onClick={() => void run(action.run)}
                class="w-full px-2.5 py-2 rounded-lg text-xs text-left text-muted-foreground hover:text-foreground hover:bg-muted flex items-center gap-2 transition-colors"
              >
                <Dynamic component={action.icon} size={13} class="flex-shrink-0" /> {action.label}
              </button>
            )}
          </For>
        </div>
      </Show>

      <Show when={error()}>
        {(msg) => (
          <p class="absolute right-0 top-full mt-1.5 z-20 w-56 rounded-lg border border-destructive/40 bg-card px-2.5 py-2 text-[0.625rem] text-destructive card-shadow">
            Export failed — {msg()}
          </p>
        )}
      </Show>
    </div>
  );
}

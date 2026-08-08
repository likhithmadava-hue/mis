import { confirm, message } from '@tauri-apps/plugin-dialog';
import { ArrowDown, ArrowUp, Check, Database, Upload } from 'lucide-solid';
import { createSignal, For, onCleanup, Show } from 'solid-js';

import { act, api, db, errorMessage, type MarkLogbookEntry } from '../../core/db';
import EntryEditor from './EntryEditor';
import EntryRow from './EntryRow';
import ExportMenu from './ExportMenu';
import FilterBar from './FilterBar';
import ImportSheet from './ImportSheet';
import { createLogbookFilters } from './logbookFilters';

/**
 * The Database tab: the raw record of every paper logged, searchable and
 * editable, with import and export around it.
 *
 * Filtering lives in `logbookFilters.ts`, each row in `EntryRow` /
 * `EntryEditor` — this file wires them together and owns the writes.
 */
export default function DatabaseExplorer() {
  const entries = () => db.mark_logbook;
  const [draft, setDraft] = createSignal<MarkLogbookEntry | null>(null);
  /** the spreadsheet awaiting column mapping; null when no import is in flight */
  const [sheetFile, setSheetFile] = createSignal<File | null>(null);
  const [flash, setFlash] = createSignal<string | null>(null);

  let importInput!: HTMLInputElement;
  let flashTimer: number | undefined;

  const filters = createLogbookFilters(entries);

  const notify = (msg: string) => {
    setFlash(msg);
    clearTimeout(flashTimer);
    flashTimer = setTimeout(() => setFlash(null), 5000);
  };
  onCleanup(() => clearTimeout(flashTimer));

  const saveEdit = async () => {
    const d = draft();
    if (!d) return;
    const { id, ...patch } = d;
    setDraft(null);
    await act(api.updateMarkEntry(id, patch));
  };

  const handleDelete = async (entry: MarkLogbookEntry) => {
    const yes = await confirm(
      `Delete the ${entry.subject} — ${entry.chapter || 'entry'} record? This cannot be undone.`,
      { title: 'Delete record', kind: 'warning' },
    );
    if (yes) await act(api.deleteMarkEntry(entry.id));
  };

  /**
   * JSON is our own backup format, so it replaces the logbook wholesale — that
   * is what restoring a backup means. Spreadsheets come from elsewhere and get
   * the mapping dialog, which appends. The two are deliberately different
   * operations behind one button, which is why the JSON path asks first and
   * says exactly how many records it is about to replace.
   */
  const handleImport = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.json')) {
      setSheetFile(file);
      return;
    }

    try {
      const parsed: unknown = JSON.parse(await file.text());
      if (!Array.isArray(parsed)) throw new Error('not a list');

      const yes = await confirm(
        `Replace all ${entries().length} records with ${parsed.length} from the backup?`,
        { title: 'Restore backup', kind: 'warning' },
      );
      if (!yes) return;

      await act(api.replaceMarkLogbook(parsed as MarkLogbookEntry[]));
      notify(`Restored ${parsed.length} records from the backup.`);
    } catch (e) {
      await message(
        `A .json import has to be a backup MIS exported.\n\n${errorMessage(e)}`,
        { title: "Couldn't read that file", kind: 'error' },
      );
    }
  };

  const SortArrow = (props: { for: 'date' | 'marks' }) => (
    <Show when={filters.sortKey() === props.for}>
      <Show when={filters.sortDesc()} fallback={<ArrowUp size={10} />}>
        <ArrowDown size={10} />
      </Show>
    </Show>
  );

  return (
    <div class="bg-card rounded-2xl border border-border card-shadow p-4 sm:p-6 space-y-5">
      <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-border pb-4">
        <div>
          <h3 class="text-lg font-bold font-space tracking-tight flex items-center gap-2">
            <Database size={18} class="text-primary" /> Mistake database
          </h3>
          <p class="text-xs text-muted-foreground mt-1 max-w-xl">
            Search, filter, edit. The raw record of everything you've gotten wrong — and learned
            from. Import an Excel sheet or CSV you already keep, and it folds straight in.
          </p>
        </div>
        <div class="flex gap-2 flex-shrink-0">
          <ExportMenu entries={entries()} />
          <button
            onClick={() => importInput.click()}
            class="px-3 py-1.5 bg-background border border-border rounded-xl text-xs font-semibold text-muted-foreground hover:text-primary hover:border-primary/40 flex items-center gap-1.5 active:scale-95 transition-all"
          >
            <Upload size={13} /> Import
          </button>
          {/* A plain file input rather than the dialog plugin: it hands back a
              readable File without MIS needing permission to browse the disk. */}
          <input
            ref={importInput}
            type="file"
            accept=".xlsx,.xls,.csv,.json"
            class="hidden"
            onChange={(e) => {
              const file = e.currentTarget.files?.[0];
              if (file) void handleImport(file);
              e.currentTarget.value = '';
            }}
          />
        </div>
      </div>

      <Show when={flash()}>
        {(msg) => (
          <div class="p-3.5 rounded-xl bg-success/10 border border-success/30 text-success flex items-center gap-2.5 animate-fade-in">
            <Check size={15} class="flex-shrink-0" />
            <p class="text-xs font-semibold">{msg()}</p>
          </div>
        )}
      </Show>

      <Show when={sheetFile()}>
        {(file) => (
          <ImportSheet
            file={file()}
            onClose={() => setSheetFile(null)}
            onImported={(count) => {
              const name = file().name;
              setSheetFile(null);
              notify(`Imported ${count} record${count === 1 ? '' : 's'} from ${name}.`);
            }}
          />
        )}
      </Show>

      <FilterBar filters={filters} />

      <div class="w-full overflow-x-auto bg-background rounded-xl border border-border">
        <Show
          when={filters.filtered().length > 0}
          fallback={
            <div class="text-center py-14 text-muted-foreground text-xs animate-fade-in">
              {entries().length === 0
                ? 'No mistakes logged yet — add one from the Daily Log, or import a spreadsheet.'
                : 'No mistakes match your filters.'}
            </div>
          }
        >
          {/* Nine columns will not fit a narrow window. min-w keeps them legible
              and lets the wrapper above scroll, rather than crushing Chapter and
              Notes into unreadable slivers. */}
          <table class="w-full min-w-[52rem] text-left text-[0.6875rem]">
            <thead>
              <tr class="border-b border-border text-muted-foreground uppercase text-[0.5625rem] tracking-wider">
                <th class="py-2.5 px-3 font-bold">
                  <button
                    onClick={() => filters.toggleSort('date')}
                    class="flex items-center gap-1 hover:text-primary transition-colors"
                  >
                    Date <SortArrow for="date" />
                  </button>
                </th>
                <th class="py-2.5 px-3 font-bold">Subject</th>
                <th class="py-2.5 px-3 font-bold">Chapter</th>
                <th class="py-2.5 px-3 font-bold">Error</th>
                <th class="py-2.5 px-3 font-bold">Diff</th>
                <th class="py-2.5 px-3 font-bold">
                  <button
                    onClick={() => filters.toggleSort('marks')}
                    class="flex items-center gap-1 hover:text-primary transition-colors"
                  >
                    Marks <SortArrow for="marks" />
                  </button>
                </th>
                <th class="py-2.5 px-3 font-bold">Time</th>
                <th class="py-2.5 px-3 font-bold">Notes</th>
                <th class="py-2.5 px-3 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-border/40">
              <For each={filters.filtered()}>
                {(entry, idx) => (
                  <Show
                    when={draft()?.id === entry.id}
                    fallback={
                      <EntryRow
                        entry={entry}
                        index={idx()}
                        onEdit={() => setDraft({ ...entry })}
                        onDelete={() => void handleDelete(entry)}
                      />
                    }
                  >
                    <EntryEditor
                      draft={draft()!}
                      onChange={setDraft}
                      onSave={() => void saveEdit()}
                      onCancel={() => setDraft(null)}
                    />
                  </Show>
                )}
              </For>
            </tbody>
          </table>
        </Show>
      </div>

      <div class="flex flex-wrap items-center justify-between gap-3 text-[0.6875rem]">
        <span class="text-muted-foreground font-mono">
          {filters.filtered().length} of {entries().length} mistakes
        </span>
        {/* the total follows the filters, so it answers whatever question the
            filter bar is currently asking */}
        <span class="px-3 py-1.5 rounded-lg bg-background border border-border font-mono font-bold">
          <span class="text-muted-foreground">Σ marks lost: </span>
          <span class="text-destructive">{filters.totalLost()}</span>
        </span>
      </div>
    </div>
  );
}

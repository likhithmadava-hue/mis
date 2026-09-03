import { AlertTriangle, Check, CircleAlert, FileSpreadsheet, Loader2, X } from 'lucide-solid';
import { createMemo, createResource, createSignal, For, Show } from 'solid-js';

import { shortDate } from '../../core/dates';
import { act, api, errorMessage, marksLost } from '../../core/db';
import { Select } from '../../core/ui';
import {
  autoMap,
  buildEntries,
  FIELD_SPECS,
  readSheet,
  UNMAPPED,
  type Mapping,
} from './sheetImport';

interface ImportSheetProps {
  file: File;
  onClose: () => void;
  /** fired after rows are written, with how many landed */
  onImported: (count: number) => void;
}

const PREVIEW_ROWS = 5;

/**
 * The step between "user picked a file" and "rows are in the vault".
 *
 * It exists because an import that silently guesses wrong is worse than no
 * import at all — you would only notice months later when a chart looked odd.
 * So the guess is shown, every column is overridable, the first few finished
 * rows are rendered exactly as they will be saved, and anything about to be
 * dropped is counted and named before you commit.
 */
export default function ImportSheet(props: ImportSheetProps) {
  const [sheetName, setSheetName] = createSignal<string | undefined>(undefined);
  const [mapping, setMapping] = createSignal<Mapping | null>(null);
  const [importing, setImporting] = createSignal(false);
  const [failure, setFailure] = createSignal<string | null>(null);

  // Reading the file is a resource, so `sheet.loading` and `sheet.error` are the
  // spinner and the error banner — no separate flags to keep in step.
  const [sheet] = createResource(
    () => ({ file: props.file, name: sheetName() }),
    async ({ file, name }) => {
      const data = await readSheet(file, name);
      setMapping(autoMap(data.headers));
      return data;
    },
  );

  // The fingerprints already stored, so duplicates can be spotted without
  // pulling the whole logbook across the bridge.
  const [known] = createResource(() => api.logbookFingerprints(), { initialValue: [] });

  const result = createMemo(() => {
    const data = sheet();
    const map = mapping();
    return data && map ? buildEntries(data.rows, map, known()) : null;
  });

  const missingRequired = () =>
    FIELD_SPECS.filter((s) => s.required && mapping()?.[s.field] === UNMAPPED);

  const canImport = () =>
    !importing() && (result()?.entries.length ?? 0) > 0 && missingRequired().length === 0;

  const readError = () => {
    if (sheet.error) {
      const message = errorMessage(sheet.error);
      return message || "Couldn't read that file. Is it a real .xlsx or .csv?";
    }
    if (sheet() && sheet()!.rows.length === 0)
      return 'That sheet has a header row but no data under it.';
    return null;
  };

  const doImport = async () => {
    const rows = result()?.entries;
    if (!rows?.length) return;
    setImporting(true);
    setFailure(null);
    try {
      const landed = await act(api.addMarkEntries(rows));
      props.onImported(landed);
    } catch (e) {
      setFailure(errorMessage(e));
    } finally {
      setImporting(false);
    }
  };

  const columnOptions = () => [
    { value: UNMAPPED, label: '— not set —' },
    ...(sheet()?.headers ?? []).map((h) => ({ value: h, label: h })),
  ];

  return (
    <div
      class="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-background/80 backdrop-blur-sm p-4 overflow-y-auto animate-fade-in"
      onClick={props.onClose}
    >
      <div
        class="bg-card border border-border rounded-2xl card-shadow w-full max-w-3xl my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* header */}
        <div class="flex items-start justify-between gap-4 p-6 border-b border-border">
          <div class="min-w-0">
            <h3 class="text-lg font-bold font-space tracking-tight flex items-center gap-2">
              <FileSpreadsheet size={18} class="text-primary" /> Import from a spreadsheet
            </h3>
            <p class="text-xs text-muted-foreground mt-1 truncate" title={props.file.name}>
              {props.file.name}
              <Show when={sheet() && result()}>
                <span class="font-mono">
                  {' '}
                  · {sheet()!.rows.length} rows found · {result()!.entries.length} ready
                </span>
              </Show>
            </p>
          </div>
          <button
            onClick={props.onClose}
            title="Close"
            class="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted flex-shrink-0"
          >
            <X size={16} />
          </button>
        </div>

        <div class="p-6 space-y-5">
          <Show when={sheet.loading}>
            <div class="flex items-center justify-center gap-2 py-14 text-muted-foreground text-xs">
              <Loader2 size={15} class="animate-spin" /> Reading the file…
            </div>
          </Show>

          <Show when={!sheet.loading && (readError() || failure())}>
            <div class="p-4 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive flex items-start gap-2.5">
              <CircleAlert size={16} class="flex-shrink-0 mt-0.5" />
              <p class="text-xs font-semibold">{failure() ?? readError()}</p>
            </div>
          </Show>

          <Show when={!sheet.loading && sheet() && mapping()}>
            {/* which sheet — only worth showing for a multi-sheet workbook */}
            <Show when={sheet()!.sheetNames.length > 1}>
              <div class="flex items-center gap-3">
                <span class="text-[0.625rem] uppercase tracking-wider font-bold text-muted-foreground">
                  Sheet
                </span>
                <Select
                  ariaLabel="Which sheet to import"
                  class="w-52"
                  value={sheet()!.sheetName}
                  onChange={setSheetName}
                  options={sheet()!.sheetNames.map((n) => ({ value: n, label: n }))}
                />
              </div>
            </Show>

            {/* mapping */}
            <div>
              <h4 class="text-[0.625rem] uppercase tracking-wider font-bold text-muted-foreground mb-3">
                Map your columns
              </h4>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
                <For each={FIELD_SPECS}>
                  {(spec) => {
                    const chosen = () => mapping()![spec.field];
                    const unset = () => chosen() === UNMAPPED;
                    return (
                      <div class="flex items-center gap-3">
                        <div class="w-24 flex-shrink-0">
                          <p class="text-xs font-semibold leading-tight">
                            {spec.label}
                            <Show when={spec.required}>
                              <span class="text-primary"> *</span>
                            </Show>
                          </p>
                          <p class="text-[0.5625rem] text-muted-foreground leading-tight">
                            {spec.hint}
                          </p>
                        </div>
                        <Select
                          ariaLabel={`Column for ${spec.label}`}
                          class="flex-1 min-w-0"
                          value={chosen()}
                          onChange={(v) => setMapping({ ...mapping()!, [spec.field]: v })}
                          options={columnOptions()}
                        />
                        <span class="w-4 flex-shrink-0">
                          <Show when={!unset()} fallback={
                            <Show when={spec.required}>
                              <AlertTriangle size={13} class="text-destructive" />
                            </Show>
                          }>
                            <Check size={13} class="text-success" />
                          </Show>
                        </span>
                      </div>
                    );
                  }}
                </For>
              </div>
              <Show when={missingRequired().length > 0}>
                <p class="text-[0.6875rem] text-destructive mt-3 flex items-center gap-1.5">
                  <AlertTriangle size={12} />
                  Pick a column for {missingRequired().map((s) => s.label).join(', ')} to continue.
                </p>
              </Show>
            </div>

            {/* preview */}
            <Show when={(result()?.entries.length ?? 0) > 0}>
              <div>
                <h4 class="text-[0.625rem] uppercase tracking-wider font-bold text-muted-foreground mb-2">
                  Preview — first {Math.min(PREVIEW_ROWS, result()!.entries.length)} of{' '}
                  {result()!.entries.length}
                </h4>
                <div class="overflow-x-auto bg-background rounded-xl border border-border">
                  <table class="w-full text-left text-[0.6875rem]">
                    <thead>
                      <tr class="border-b border-border text-muted-foreground uppercase text-[0.5625rem] tracking-wider">
                        <th class="py-2 px-3 font-bold">Date</th>
                        <th class="py-2 px-3 font-bold">Subject</th>
                        <th class="py-2 px-3 font-bold">Chapter</th>
                        <th class="py-2 px-3 font-bold">Marks</th>
                        <th class="py-2 px-3 font-bold">Error</th>
                        <th class="py-2 px-3 font-bold">Diff</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-border/40">
                      <For each={result()!.entries.slice(0, PREVIEW_ROWS)}>
                        {(e) => (
                          <tr>
                            <td class="py-2 px-3 font-mono text-muted-foreground whitespace-nowrap">
                              {shortDate(e.date)}
                            </td>
                            <td class="py-2 px-3 font-semibold whitespace-nowrap">{e.subject}</td>
                            <td class="py-2 px-3 text-muted-foreground max-w-[140px] truncate">
                              {e.chapter || '—'}
                            </td>
                            <td class="py-2 px-3 font-mono whitespace-nowrap">
                              <span class="text-destructive font-bold">
                                −{marksLost({ ...e, id: '' })}
                              </span>
                              <span class="text-muted-foreground"> / {e.max_score}</span>
                            </td>
                            <td class="py-2 px-3 text-muted-foreground whitespace-nowrap">
                              {e.mistake_reason}
                            </td>
                            <td class="py-2 px-3 text-muted-foreground">{e.difficulty}</td>
                          </tr>
                        )}
                      </For>
                    </tbody>
                  </table>
                </div>
              </div>
            </Show>

            {/* what will be left behind */}
            <Show when={result() && (result()!.duplicates > 0 || result()!.problems.length > 0)}>
              <div class="p-3.5 rounded-xl bg-yellow-500/5 border border-yellow-500/25 space-y-1.5">
                <Show when={result()!.duplicates > 0}>
                  <p class="text-[0.6875rem] text-yellow-500/90 flex items-start gap-2">
                    <AlertTriangle size={12} class="flex-shrink-0 mt-0.5" />
                    <span>
                      <b class="font-mono">{result()!.duplicates}</b> row
                      {result()!.duplicates === 1 ? '' : 's'} already in your database — skipping
                      {result()!.duplicates === 1 ? ' it' : ' them'}.
                    </span>
                  </p>
                </Show>
                <Show when={result()!.problems.length > 0}>
                  <p class="text-[0.6875rem] text-yellow-500/90 flex items-start gap-2">
                    <AlertTriangle size={12} class="flex-shrink-0 mt-0.5" />
                    <span>
                      <b class="font-mono">{result()!.problems.length}</b> row
                      {result()!.problems.length === 1 ? '' : 's'} can't be read and will be left out
                      {' — '}
                      {result()!
                        .problems.slice(0, 3)
                        .map((p) => `row ${p.row} (${p.reason})`)
                        .join(', ')}
                      {result()!.problems.length > 3 &&
                        `, +${result()!.problems.length - 3} more`}
                      .
                    </span>
                  </p>
                </Show>
              </div>
            </Show>

            <Show when={result()?.entries.length === 0 && missingRequired().length === 0}>
              <p class="text-xs text-muted-foreground text-center py-6">
                Nothing new to import from this sheet.
              </p>
            </Show>
          </Show>
        </div>

        {/* actions */}
        <div class="flex justify-end gap-2 px-6 py-4 border-t border-border">
          <button
            onClick={props.onClose}
            class="px-3 py-1.5 bg-muted text-foreground rounded-lg text-xs font-semibold"
          >
            Cancel
          </button>
          <button
            onClick={() => void doImport()}
            disabled={!canImport()}
            class="px-4 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-semibold font-space flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Show when={!importing()} fallback={<Loader2 size={13} class="animate-spin" />}>
              <Check size={13} />
            </Show>
            {(result()?.entries.length ?? 0) > 0
              ? `Import ${result()!.entries.length} record${
                  result()!.entries.length === 1 ? '' : 's'
                }`
              : 'Import'}
          </button>
        </div>
      </div>
    </div>
  );
}

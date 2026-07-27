import { useState, useEffect, useMemo } from 'react';
import { FileSpreadsheet, X, AlertTriangle, Check, Loader2, CircleAlert } from 'lucide-react';
import { ArborDatabase, marksLost, type MarkLogbookEntry } from '../../core/db';
import {
  FIELD_SPECS,
  UNMAPPED,
  autoMap,
  buildEntries,
  readSheet,
  type Mapping,
  type SheetData,
} from './sheetImport';
import Select from '../../core/ui/Select';

interface ImportSheetProps {
  file: File;
  /** every record already stored, so the preview can flag duplicates */
  existing: MarkLogbookEntry[];
  onClose: () => void;
  /** fired after rows are written, with how many landed */
  onImported: (count: number) => void;
}

const PREVIEW_ROWS = 5;

/**
 * The step between "user picked a file" and "rows are in the database".
 *
 * It exists because an import that silently guesses wrong is worse than no
 * import at all — you'd only notice months later when a chart looked odd. So
 * the guess is shown, every column is overridable, and the first few finished
 * rows are rendered exactly as they will be saved.
 */
export default function ImportSheet({ file, existing, onClose, onImported }: ImportSheetProps) {
  const [data, setData] = useState<SheetData | null>(null);
  const [mapping, setMapping] = useState<Mapping | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // read the file, and re-read it when the user switches sheet
  const load = async (sheetName?: string) => {
    setLoading(true);
    setError(null);
    try {
      const sheet = await readSheet(file, sheetName);
      setData(sheet);
      setMapping(autoMap(sheet.headers));
      if (sheet.rows.length === 0) setError('That sheet has a header row but no data under it.');
    } catch (e) {
      setError(
        e instanceof Error && e.message
          ? e.message
          : "Couldn't read that file. Is it a real .xlsx or .csv?"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file]);

  const result = useMemo(
    () => (data && mapping ? buildEntries(data.rows, mapping, existing) : null),
    [data, mapping, existing]
  );

  const missingRequired = FIELD_SPECS.filter(
    (s) => s.required && mapping?.[s.field] === UNMAPPED
  );

  const canImport = !!result && result.entries.length > 0 && missingRequired.length === 0;

  const doImport = () => {
    if (!result || !canImport) return;
    ArborDatabase.addMarkLogbookEntries(result.entries);
    onImported(result.entries.length);
  };

  const columnOptions = [
    { value: UNMAPPED, label: '— not set —' },
    ...(data?.headers ?? []).map((h) => ({ value: h, label: h })),
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-background/80 backdrop-blur-sm p-4 overflow-y-auto animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-card border border-border rounded-2xl card-shadow w-full max-w-3xl my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* header */}
        <div className="flex items-start justify-between gap-4 p-6 border-b border-border">
          <div className="min-w-0">
            <h3 className="text-lg font-bold font-space tracking-tight flex items-center gap-2">
              <FileSpreadsheet size={18} className="text-primary" /> Import from a spreadsheet
            </h3>
            <p className="text-xs text-muted-foreground mt-1 truncate" title={file.name}>
              {file.name}
              {data && result && (
                <span className="font-mono">
                  {' '}
                  · {data.rows.length} rows found · {result.entries.length} ready
                </span>
              )}
            </p>
          </div>
          <button
            onClick={onClose}
            title="Close"
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted flex-shrink-0"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {loading && (
            <div className="flex items-center justify-center gap-2 py-14 text-muted-foreground text-xs">
              <Loader2 size={15} className="animate-spin" /> Reading the file…
            </div>
          )}

          {error && !loading && (
            <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive flex items-start gap-2.5">
              <CircleAlert size={16} className="flex-shrink-0 mt-0.5" />
              <p className="text-xs font-semibold">{error}</p>
            </div>
          )}

          {data && mapping && !loading && (
            <>
              {/* which sheet — only worth showing for a multi-sheet workbook */}
              {data.sheetNames.length > 1 && (
                <div className="flex items-center gap-3">
                  <span className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
                    Sheet
                  </span>
                  <Select
                    ariaLabel="Which sheet to import"
                    className="w-52"
                    value={data.sheetName}
                    onChange={(name) => load(name)}
                    options={data.sheetNames.map((n) => ({ value: n, label: n }))}
                  />
                </div>
              )}

              {/* mapping */}
              <div>
                <h4 className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-3">
                  Map your columns
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
                  {FIELD_SPECS.map((spec) => {
                    const chosen = mapping[spec.field];
                    const unset = chosen === UNMAPPED;
                    return (
                      <div key={spec.field} className="flex items-center gap-3">
                        <div className="w-24 flex-shrink-0">
                          <p className="text-xs font-semibold leading-tight">
                            {spec.label}
                            {spec.required && <span className="text-primary"> *</span>}
                          </p>
                          <p className="text-[9px] text-muted-foreground leading-tight">
                            {spec.hint}
                          </p>
                        </div>
                        <Select
                          ariaLabel={`Column for ${spec.label}`}
                          className="flex-1 min-w-0"
                          value={chosen}
                          onChange={(v) => setMapping({ ...mapping, [spec.field]: v })}
                          options={columnOptions}
                        />
                        <span className="w-4 flex-shrink-0">
                          {unset && spec.required ? (
                            <AlertTriangle size={13} className="text-destructive" />
                          ) : unset ? null : (
                            <Check size={13} className="text-success" />
                          )}
                        </span>
                      </div>
                    );
                  })}
                </div>
                {missingRequired.length > 0 && (
                  <p className="text-[11px] text-destructive mt-3 flex items-center gap-1.5">
                    <AlertTriangle size={12} />
                    Pick a column for {missingRequired.map((s) => s.label).join(', ')} to continue.
                  </p>
                )}
              </div>

              {/* preview */}
              {result && result.entries.length > 0 && (
                <div>
                  <h4 className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-2">
                    Preview — first {Math.min(PREVIEW_ROWS, result.entries.length)} of{' '}
                    {result.entries.length}
                  </h4>
                  <div className="overflow-x-auto bg-background rounded-xl border border-border">
                    <table className="w-full text-left text-[11px]">
                      <thead>
                        <tr className="border-b border-border text-muted-foreground uppercase text-[9px] tracking-wider">
                          <th className="py-2 px-3 font-bold">Date</th>
                          <th className="py-2 px-3 font-bold">Subject</th>
                          <th className="py-2 px-3 font-bold">Chapter</th>
                          <th className="py-2 px-3 font-bold">Marks</th>
                          <th className="py-2 px-3 font-bold">Error</th>
                          <th className="py-2 px-3 font-bold">Diff</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40">
                        {result.entries.slice(0, PREVIEW_ROWS).map((e, i) => (
                          <tr key={i}>
                            <td className="py-2 px-3 font-mono text-muted-foreground whitespace-nowrap">
                              {new Date(e.date).toLocaleDateString([], {
                                month: 'short',
                                day: 'numeric',
                              })}
                            </td>
                            <td className="py-2 px-3 font-semibold whitespace-nowrap">{e.subject}</td>
                            <td className="py-2 px-3 text-muted-foreground max-w-[140px] truncate">
                              {e.chapter || '—'}
                            </td>
                            <td className="py-2 px-3 font-mono whitespace-nowrap">
                              <span className="text-destructive font-bold">
                                −{marksLost({ ...e, id: '' })}
                              </span>
                              <span className="text-muted-foreground"> / {e.max_score}</span>
                            </td>
                            <td className="py-2 px-3 text-muted-foreground whitespace-nowrap">
                              {e.mistake_reason}
                            </td>
                            <td className="py-2 px-3 text-muted-foreground">{e.difficulty}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* what will be left behind */}
              {result && (result.duplicates > 0 || result.problems.length > 0) && (
                <div className="p-3.5 rounded-xl bg-yellow-500/5 border border-yellow-500/25 space-y-1.5">
                  {result.duplicates > 0 && (
                    <p className="text-[11px] text-yellow-500/90 flex items-start gap-2">
                      <AlertTriangle size={12} className="flex-shrink-0 mt-0.5" />
                      <span>
                        <b className="font-mono">{result.duplicates}</b> row
                        {result.duplicates === 1 ? '' : 's'} already in your database — skipping
                        {result.duplicates === 1 ? ' it' : ' them'}.
                      </span>
                    </p>
                  )}
                  {result.problems.length > 0 && (
                    <p className="text-[11px] text-yellow-500/90 flex items-start gap-2">
                      <AlertTriangle size={12} className="flex-shrink-0 mt-0.5" />
                      <span>
                        <b className="font-mono">{result.problems.length}</b> row
                        {result.problems.length === 1 ? '' : 's'} can't be read and will be left out
                        {' — '}
                        {result.problems
                          .slice(0, 3)
                          .map((p) => `row ${p.row} (${p.reason})`)
                          .join(', ')}
                        {result.problems.length > 3 && `, +${result.problems.length - 3} more`}.
                      </span>
                    </p>
                  )}
                </div>
              )}

              {result && result.entries.length === 0 && missingRequired.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-6">
                  Nothing new to import from this sheet.
                </p>
              )}
            </>
          )}
        </div>

        {/* actions */}
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-border">
          <button
            onClick={onClose}
            className="px-3 py-1.5 bg-muted text-foreground rounded-lg text-xs font-semibold"
          >
            Cancel
          </button>
          <button
            onClick={doImport}
            disabled={!canImport}
            className="px-4 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-semibold font-space flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Check size={13} />
            {result && result.entries.length > 0
              ? `Import ${result.entries.length} record${result.entries.length === 1 ? '' : 's'}`
              : 'Import'}
          </button>
        </div>
      </div>
    </div>
  );
}

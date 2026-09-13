import { useState, useEffect, useRef } from 'react';
import { ArrowDown, ArrowUp, Check, Database, Upload } from 'lucide-react';
import { ArborDatabase, type MarkLogbookEntry } from '../../core/db';
import { uid } from '../../core/db/uid';
import EntryEditor from './EntryEditor';
import EntryRow from './EntryRow';
import ExportMenu from './ExportMenu';
import FilterBar from './FilterBar';
import ImportSheet from './ImportSheet';
import { sanitizeFormula, toDifficulty, toReason } from './sheetImport';
import { useLogbookFilters } from './useLogbookFilters';

interface DatabaseExplorerProps {
  triggerUpdate: number;
  onChange: () => void;
}

/**
 * The Database tab: the raw record of every paper logged, searchable and
 * editable, with import and export around it.
 *
 * Filtering lives in useLogbookFilters, each row in EntryRow / EntryEditor —
 * this file wires them together and owns the writes.
 */
export default function DatabaseExplorer({ triggerUpdate, onChange }: DatabaseExplorerProps) {
  const [entries, setEntries] = useState<MarkLogbookEntry[]>(ArborDatabase.getMarkLogbook());
  const [draft, setDraft] = useState<MarkLogbookEntry | null>(null);
  /** the spreadsheet awaiting column mapping; null when no import is in flight */
  const [sheetFile, setSheetFile] = useState<File | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

  const filters = useLogbookFilters(entries);

  useEffect(() => {
    setEntries(ArborDatabase.getMarkLogbook());
  }, [triggerUpdate]);

  const reload = () => {
    setEntries(ArborDatabase.getMarkLogbook());
    onChange();
  };

  const notify = (msg: string) => {
    setFlash(msg);
    setTimeout(() => setFlash(null), 5000);
  };

  const saveEdit = () => {
    if (!draft) return;
    const { id, ...patch } = draft;
    ArborDatabase.updateMarkLogbookEntry(id, patch);
    setDraft(null);
    reload();
  };

  const handleDelete = (entry: MarkLogbookEntry) => {
    if (confirm(`Delete the ${entry.subject} — ${entry.chapter || 'entry'} record?`)) {
      ArborDatabase.deleteMarkLogbookEntry(entry.id);
      reload();
    }
  };

  /**
   * JSON is our own backup format, so it still replaces the logbook wholesale.
   * Spreadsheets come from elsewhere and get the mapping dialog, which appends.
   */
  const handleImport = (file: File) => {
    if (!file.name.toLowerCase().endsWith('.json')) {
      setSheetFile(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (!Array.isArray(parsed)) throw new Error('not a list');

        const sanitizedEntries: MarkLogbookEntry[] = parsed.map((item: unknown) => {
          if (!item || typeof item !== 'object') throw new Error('invalid entry');
          const entry = item as Record<string, unknown>;
          if (typeof entry.subject !== 'string' || !entry.subject.trim()) throw new Error('invalid subject');
          if (typeof entry.date !== 'string' || !entry.date.trim()) throw new Error('invalid date');
          if (typeof entry.score !== 'number' || isNaN(entry.score)) throw new Error('invalid score');
          if (typeof entry.max_score !== 'number' || isNaN(entry.max_score) || entry.max_score <= 0)
            throw new Error('invalid max_score');

          return {
            id: typeof entry.id === 'string' && entry.id ? entry.id : uid(),
            date: String(entry.date).trim(),
            subject: String(sanitizeFormula(entry.subject)).trim(),
            chapter: String(sanitizeFormula(entry.chapter ?? '')).trim(),
            grade: String(sanitizeFormula(entry.grade ?? '')).trim(),
            score: Number(entry.score),
            max_score: Number(entry.max_score),
            difficulty: toDifficulty(entry.difficulty),
            time_spent: typeof entry.time_spent === 'number' && isFinite(entry.time_spent) ? entry.time_spent : 0,
            mistake_reason: toReason(entry.mistake_reason),
            notes: String(sanitizeFormula(entry.notes ?? '')).trim(),
          };
        });

        if (!confirm(`Replace all ${entries.length} records with ${sanitizedEntries.length} from the backup?`))
          return;
        ArborDatabase.replaceMarkLogbook(sanitizedEntries);
        reload();
        notify(`Restored ${sanitizedEntries.length} records from the backup.`);
      } catch {
        alert("Couldn't read that file — a .json import has to be a backup MIS exported.");
      }
    };
    reader.readAsText(file);
  };

  const sortArrow = (key: 'date' | 'marks') =>
    filters.sortKey === key && (filters.sortDesc ? <ArrowDown size={10} /> : <ArrowUp size={10} />);

  return (
    <div className="bg-card rounded-2xl border border-border card-shadow p-6 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-border pb-4">
        <div>
          <h3 className="text-lg font-bold font-space tracking-tight flex items-center gap-2">
            <Database size={18} className="text-primary" /> Mistake database
          </h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-xl">
            Search, filter, edit. The raw record of everything you've gotten wrong — and learned from.
            Import an Excel sheet or CSV you already keep, and it folds straight in.
          </p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <ExportMenu entries={entries} />
          <button
            onClick={() => importRef.current?.click()}
            className="px-3 py-1.5 bg-background border border-border rounded-xl text-xs font-semibold text-muted-foreground hover:text-primary hover:border-primary/40 flex items-center gap-1.5 active:scale-95 transition-all"
          >
            <Upload size={13} /> Import
          </button>
          <input
            ref={importRef}
            type="file"
            accept=".xlsx,.xls,.csv,.json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleImport(file);
              e.target.value = '';
            }}
          />
        </div>
      </div>

      {flash && (
        <div className="p-3.5 rounded-xl bg-success/10 border border-success/30 text-success flex items-center gap-2.5 animate-fade-in">
          <Check size={15} className="flex-shrink-0" />
          <p className="text-xs font-semibold">{flash}</p>
        </div>
      )}

      {sheetFile && (
        <ImportSheet
          file={sheetFile}
          existing={entries}
          onClose={() => setSheetFile(null)}
          onImported={(count) => {
            setSheetFile(null);
            reload();
            notify(`Imported ${count} record${count === 1 ? '' : 's'} from ${sheetFile.name}.`);
          }}
        />
      )}

      <FilterBar filters={filters} />

      <div className="w-full overflow-x-auto bg-background rounded-xl border border-border">
        {filters.filtered.length === 0 ? (
          <div className="text-center py-14 text-muted-foreground text-xs animate-fade-in">
            {entries.length === 0
              ? 'No mistakes logged yet — add one from the Daily Log, or import a spreadsheet.'
              : 'No mistakes match your filters.'}
          </div>
        ) : (
          <table className="w-full text-left text-[11px]">
            <thead>
              <tr className="border-b border-border text-muted-foreground uppercase text-[9px] tracking-wider">
                <th className="py-2.5 px-3 font-bold">
                  <button onClick={() => filters.toggleSort('date')} className="flex items-center gap-1 hover:text-primary transition-colors">
                    Date {sortArrow('date')}
                  </button>
                </th>
                <th className="py-2.5 px-3 font-bold">Subject</th>
                <th className="py-2.5 px-3 font-bold">Chapter</th>
                <th className="py-2.5 px-3 font-bold">Error</th>
                <th className="py-2.5 px-3 font-bold">Diff</th>
                <th className="py-2.5 px-3 font-bold">
                  <button onClick={() => filters.toggleSort('marks')} className="flex items-center gap-1 hover:text-primary transition-colors">
                    Marks {sortArrow('marks')}
                  </button>
                </th>
                <th className="py-2.5 px-3 font-bold">Time</th>
                <th className="py-2.5 px-3 font-bold">Notes</th>
                <th className="py-2.5 px-3 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {filters.filtered.map((entry, idx) =>
                draft?.id === entry.id ? (
                  <EntryEditor
                    key={entry.id}
                    draft={draft}
                    onChange={setDraft}
                    onSave={saveEdit}
                    onCancel={() => setDraft(null)}
                  />
                ) : (
                  <EntryRow
                    key={entry.id}
                    entry={entry}
                    index={idx}
                    onEdit={() => setDraft({ ...entry })}
                    onDelete={() => handleDelete(entry)}
                  />
                )
              )}
            </tbody>
          </table>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-[11px]">
        <span className="text-muted-foreground font-mono">
          {filters.filtered.length} of {entries.length} mistakes
        </span>
        <span className="px-3 py-1.5 rounded-lg bg-background border border-border font-mono font-bold">
          <span className="text-muted-foreground">Σ marks lost: </span>
          <span className="text-destructive">{filters.totalLost}</span>
        </span>
      </div>
    </div>
  );
}

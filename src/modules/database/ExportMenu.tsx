import { useState, useEffect, useRef } from "preact/hooks";
import {
  ChevronDown,
  Download,
  FileDown,
  FileJson,
  FileSpreadsheet,
} from "lucide-preact";
import type { MarkLogbookEntry } from "../../core/db";
import { todayIso } from "../../core/dates";
import { exportCsv, exportTemplate, exportXlsx } from "./sheetImport";

/** our own backup format — the only export that can be read back in */
const downloadJson = (entries: MarkLogbookEntry[]) => {
  const blob = new Blob([JSON.stringify(entries, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `mis-mistakes-${todayIso()}.json`;
  a.click();
  URL.revokeObjectURL(url);
};

/** the four ways the logbook can leave the app */
export default function ExportMenu({
  entries,
}: {
  entries: MarkLogbookEntry[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // close on an outside click, the way Select does
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const actions = [
    {
      label: "Excel (.xlsx)",
      icon: FileSpreadsheet,
      run: () => exportXlsx(entries),
    },
    { label: "CSV (.csv)", icon: FileDown, run: () => exportCsv(entries) },
    { label: "JSON backup", icon: FileJson, run: () => downloadJson(entries) },
    { label: "Blank template", icon: FileSpreadsheet, run: exportTemplate },
  ];

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="px-3 py-1.5 bg-background border border-border rounded-xl text-xs font-semibold text-muted-foreground hover:text-primary hover:border-primary/40 flex items-center gap-1.5 active:scale-95 transition-all"
      >
        <Download size={13} /> Export
        <ChevronDown
          size={12}
          className={
            open ? "rotate-180 transition-transform" : "transition-transform"
          }
        />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-1.5 z-20 w-44 bg-card border border-border rounded-xl card-shadow p-1 animate-fade-in"
        >
          {actions.map(({ label, icon: Icon, run }) => (
            <button
              key={label}
              role="menuitem"
              onClick={() => {
                run();
                setOpen(false);
              }}
              className="w-full px-2.5 py-2 rounded-lg text-xs text-left text-muted-foreground hover:text-foreground hover:bg-muted flex items-center gap-2 transition-colors"
            >
              <Icon size={13} className="flex-shrink-0" /> {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

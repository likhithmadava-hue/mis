import { Search, X } from "lucide-preact";
import { DIFFICULTIES, MISTAKE_REASONS } from "../../core/db";
import Select from "../../core/ui/Select";
import { DIFFICULTY_BADGE, REASON_BADGE } from "../../core/ui/mistakes";
import { ALL, type LogbookFilters } from "./useLogbookFilters";

/** free-text search plus the four dropdowns that narrow the mistake table */
export default function FilterBar({ filters }: { filters: LogbookFilters }) {
  return (
    <div className="space-y-3">
      <div className="relative">
        <Search
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
        <input
          type="text"
          placeholder="Search subject, chapter, or notes…"
          value={filters.search}
          onChange={(e) => filters.setSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-2 bg-background border border-border rounded-xl text-xs focus:border-primary/50 focus:outline-none"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Select
          ariaLabel="Filter by subject"
          className="w-36"
          value={filters.fSubject}
          onChange={filters.setFSubject}
          options={[
            { value: ALL, label: "All subjects" },
            ...filters.subjects.map((s) => ({ value: s, label: s })),
          ]}
        />

        <Select
          ariaLabel="Filter by chapter"
          className="w-40"
          value={filters.fChapter}
          onChange={filters.setFChapter}
          options={[
            { value: ALL, label: "All chapters" },
            ...filters.chapters.map((c) => ({ value: c, label: c })),
          ]}
        />

        <Select
          ariaLabel="Filter by error type"
          className="w-40"
          value={filters.fReason}
          onChange={filters.setFReason}
          options={[
            { value: ALL, label: "All errors" },
            ...MISTAKE_REASONS.map((r) => ({
              value: r as string,
              label: r,
              badgeClass: REASON_BADGE[r],
            })),
          ]}
        />

        <Select
          ariaLabel="Filter by difficulty"
          className="w-36"
          value={filters.fDifficulty}
          onChange={filters.setFDifficulty}
          options={[
            { value: ALL, label: "Any difficulty" },
            ...DIFFICULTIES.map((d) => ({
              value: d as string,
              label: d,
              badgeClass: DIFFICULTY_BADGE[d],
            })),
          ]}
        />

        {filters.filtersActive && (
          <button
            onClick={filters.clearFilters}
            className="h-9 px-3 rounded-xl text-xs font-semibold text-muted-foreground hover:text-destructive flex items-center gap-1 animate-fade-in"
          >
            <X size={13} /> Clear
          </button>
        )}
      </div>
    </div>
  );
}

import { Search, X } from 'lucide-solid';
import { Show } from 'solid-js';

import { DIFFICULTIES, MISTAKE_REASONS } from '../../core/db';
import { DIFFICULTY_BADGE, REASON_BADGE, Select } from '../../core/ui';
import { ALL, type LogbookFilters } from './logbookFilters';

/** free-text search plus the four dropdowns that narrow the mistake table */
export default function FilterBar(props: { filters: LogbookFilters }) {
  const f = () => props.filters;

  return (
    <div class="space-y-3">
      <div class="relative">
        <Search size={14} class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search subject, chapter, or notes…"
          value={f().search()}
          onInput={(e) => f().setSearch(e.currentTarget.value)}
          class="w-full pl-9 pr-3 py-2 bg-background border border-border rounded-xl text-xs focus:border-primary/50 focus:outline-none"
        />
      </div>

      <div class="flex flex-wrap gap-2">
        {/* each dropdown takes half the row in a narrow window and its natural
            width from sm up, so four filters never spill off the side */}
        <Select
          ariaLabel="Filter by subject"
          class="flex-1 min-w-[8.5rem] sm:flex-none sm:w-36"
          value={f().fSubject()}
          onChange={f().setFSubject}
          options={[
            { value: ALL, label: 'All subjects' },
            ...f()
              .subjects()
              .map((s) => ({ value: s, label: s })),
          ]}
        />

        <Select
          ariaLabel="Filter by chapter"
          class="flex-1 min-w-[8.5rem] sm:flex-none sm:w-40"
          value={f().fChapter()}
          onChange={f().setFChapter}
          options={[
            { value: ALL, label: 'All chapters' },
            ...f()
              .chapters()
              .map((c) => ({ value: c, label: c })),
          ]}
        />

        <Select
          ariaLabel="Filter by error type"
          class="flex-1 min-w-[8.5rem] sm:flex-none sm:w-40"
          value={f().fReason()}
          onChange={f().setFReason}
          options={[
            { value: ALL, label: 'All errors' },
            ...MISTAKE_REASONS.map((r) => ({
              value: r as string,
              label: r,
              badgeClass: REASON_BADGE[r],
            })),
          ]}
        />

        <Select
          ariaLabel="Filter by difficulty"
          class="flex-1 min-w-[8.5rem] sm:flex-none sm:w-36"
          value={f().fDifficulty()}
          onChange={f().setFDifficulty}
          options={[
            { value: ALL, label: 'Any difficulty' },
            ...DIFFICULTIES.map((d) => ({
              value: d as string,
              label: d,
              badgeClass: DIFFICULTY_BADGE[d],
            })),
          ]}
        />

        <Show when={f().filtersActive()}>
          <button
            onClick={f().clearFilters}
            class="h-9 px-3 rounded-xl text-xs font-semibold text-muted-foreground hover:text-destructive flex items-center gap-1 animate-fade-in"
          >
            <X size={13} /> Clear
          </button>
        </Show>
      </div>
    </div>
  );
}

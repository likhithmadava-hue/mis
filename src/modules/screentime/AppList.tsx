import { ChevronDown, ChevronRight } from 'lucide-solid';
import { createSignal, For, Show } from 'solid-js';

import type { AppRow } from '../../core/db';
import { asCategory, CATEGORIES, CATEGORY_BAR, humanise, type Category } from './format';

/**
 * The per-app breakdown, longest first.
 *
 * The bar markup deliberately matches `core/ui/charts.tsx`'s `HBarList` so the
 * two read as the same component; this one is separate because each row also
 * has to carry a category control and an expandable list of window titles,
 * which that one has no business knowing about.
 *
 * Expanding a row is the honest answer to the browser problem. Windows reports
 * `msedge.exe` for a past paper and for YouTube alike, so rather than guess a
 * category, the titles that made up those hours are listed and the split can be
 * judged by eye.
 */
export default function AppList(props: {
  rows: AppRow[];
  total: number;
  onCategory: (app: string, category: Category) => void;
}) {
  const [open, setOpen] = createSignal<string | null>(null);

  return (
    <div class="space-y-3">
      <For each={props.rows}>
        {(row) => {
          const pct = () => (props.total > 0 ? (row.seconds / props.total) * 100 : 0);
          const expanded = () => open() === row.app;
          const hasTitles = () => row.titles.length > 0;
          const category = () => asCategory(row.category);

          return (
            <div class="space-y-1.5">
              <div class="flex justify-between items-center text-xs font-medium gap-2">
                <button
                  onClick={() => hasTitles() && setOpen(expanded() ? null : row.app)}
                  disabled={!hasTitles()}
                  class={`flex items-center gap-1.5 min-w-0 text-left ${
                    hasTitles() ? 'hover:text-primary transition-colors' : 'cursor-default'
                  }`}
                  title={hasTitles() ? 'Show the windows behind this total' : undefined}
                >
                  <Show
                    when={hasTitles()}
                    fallback={<span class="w-[13px] flex-shrink-0" />}
                  >
                    <Show
                      when={expanded()}
                      fallback={<ChevronRight size={13} class="flex-shrink-0" />}
                    >
                      <ChevronDown size={13} class="flex-shrink-0" />
                    </Show>
                  </Show>
                  <span class="truncate font-mono">{row.app}</span>
                </button>

                <div class="flex items-center gap-2 flex-shrink-0">
                  <span class="font-mono text-muted-foreground">{humanise(row.seconds)}</span>
                  <span class="text-[0.625rem] text-muted-foreground/60 font-mono w-9 text-right">
                    {Math.round(pct())}%
                  </span>
                  <CategoryPicker
                    value={category()}
                    onChange={(c) => props.onCategory(row.app, c)}
                  />
                </div>
              </div>

              <div class="w-full bg-background h-2.5 rounded-lg overflow-hidden">
                <div
                  class={`h-full rounded-lg transition-all ${CATEGORY_BAR[category()]}`}
                  style={{ width: `${Math.max(0, Math.min(100, pct()))}%` }}
                />
              </div>

              <Show when={expanded()}>
                <ul class="pl-5 pt-1 space-y-1">
                  <For each={row.titles}>
                    {(t) => (
                      <li class="flex justify-between gap-3 text-[0.6875rem] text-muted-foreground">
                        <span class="truncate">{t.title}</span>
                        <span class="font-mono flex-shrink-0">{humanise(t.seconds)}</span>
                      </li>
                    )}
                  </For>
                </ul>
              </Show>
            </div>
          );
        }}
      </For>
    </div>
  );
}

/** three small letters — S / N / D — rather than a dropdown per row */
function CategoryPicker(props: { value: Category; onChange: (c: Category) => void }) {
  return (
    <div class="flex bg-background rounded-md border border-border overflow-hidden">
      <For each={CATEGORIES}>
        {(c) => (
          <button
            onClick={() => props.onChange(c)}
            title={`Count this as ${c}`}
            aria-label={`Count this as ${c}`}
            aria-pressed={props.value === c}
            class={`w-5 h-5 text-[0.625rem] font-bold font-space uppercase transition-colors ${
              props.value === c
                ? c === 'study'
                  ? 'bg-[hsl(var(--success))] text-background'
                  : c === 'distraction'
                    ? 'bg-[hsl(var(--destructive))] text-background'
                    : 'bg-muted-foreground text-background'
                : 'text-muted-foreground/50 hover:text-foreground'
            }`}
          >
            {c[0]}
          </button>
        )}
      </For>
    </div>
  );
}

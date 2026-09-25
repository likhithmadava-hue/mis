import { ChevronDown, ChevronRight, Globe } from 'lucide-solid';
import { For, Show } from 'solid-js';

import type { ActivityRow, AppRow } from '../../core/db';
import { viewState } from '../../core/ui';
import { asCategory, CATEGORIES, CATEGORY_BAR, humanise, type Category } from './format';

/**
 * The per-app breakdown, longest first, and what was done inside each app.
 *
 * Expanding a row is the answer to the browser problem. Windows reports
 * `ulaa.exe` for a past paper and for a reel alike, so a browser row opens onto
 * the **sites** behind its hours — each with its own total, its own share of
 * the bar and its own S/N/D switch. A site assignment is more specific than the
 * browser it was made in, so it wins; the browser's own switch is what
 * everything unnamed falls back to.
 *
 * Anything that is not a browser has no second level — it is its own activity —
 * so those rows open straight onto their window titles, as before.
 *
 * The bar markup deliberately matches `core/ui/charts.tsx`'s `HBarList` so the
 * two read as the same component; this one is separate because each row also
 * carries filing controls and a nested list, which that one has no business
 * knowing about.
 */
export default function AppList(props: {
  rows: AppRow[];
  total: number;
  onCategory: (app: string, category: Category) => void;
  onSiteCategory: (key: string, category: Category) => void;
}) {
  // Persisted, so glancing at another tab and coming back does not collapse
  // what you had open.
  const [openApp, setOpenApp] = viewState<string | null>('screentime.openApp', null);
  const [openSite, setOpenSite] = viewState<string | null>('screentime.openSite', null);

  return (
    <div class="space-y-3">
      <For each={props.rows}>
        {(row) => {
          const pct = () => (props.total > 0 ? (row.seconds / props.total) * 100 : 0);
          const expanded = () => openApp() === row.app;
          const hasDetail = () => row.activities.length > 0 || row.titles.length > 0;
          const category = () => asCategory(row.category);
          const mixed = () =>
            Object.values(row.split ?? {}).filter((s) => s > 0).length > 1;

          return (
            <div class="space-y-1.5">
              <div class="flex justify-between items-center text-xs font-medium gap-2">
                <button
                  onClick={() => hasDetail() && setOpenApp(expanded() ? null : row.app)}
                  disabled={!hasDetail()}
                  class={`flex items-center gap-1.5 min-w-0 text-left ${
                    hasDetail() ? 'hover:text-primary transition-colors' : 'cursor-default'
                  }`}
                  title={
                    !hasDetail()
                      ? undefined
                      : row.browser
                        ? 'Show the sites behind this total'
                        : 'Show the windows behind this total'
                  }
                >
                  <Show when={hasDetail()} fallback={<span class="w-[13px] flex-shrink-0" />}>
                    <Show
                      when={expanded()}
                      fallback={<ChevronRight size={13} class="flex-shrink-0" />}
                    >
                      <ChevronDown size={13} class="flex-shrink-0" />
                    </Show>
                  </Show>
                  <span class="truncate font-mono">{row.app}</span>
                  <Show when={row.browser && mixed()}>
                    <span class="text-[0.625rem] text-muted-foreground font-space flex-shrink-0">
                      {row.activities.length} site{row.activities.length === 1 ? '' : 's'}
                    </span>
                  </Show>
                </button>

                <div class="flex items-center gap-2 flex-shrink-0">
                  <span class="font-mono text-muted-foreground">{humanise(row.seconds)}</span>
                  <span class="text-[0.625rem] text-subtle-foreground font-mono w-9 text-right">
                    {Math.round(pct())}%
                  </span>
                  <CategoryPicker
                    value={category()}
                    mixed={mixed()}
                    label={
                      row.browser
                        ? 'everything in this browser that no site overrides'
                        : 'this app'
                    }
                    onChange={(c) => props.onCategory(row.app, c)}
                  />
                </div>
              </div>

              <SplitBar split={row.split} seconds={row.seconds} width={pct()} />

              <Show when={expanded()}>
                {/* Capped so opening a browser with thirty sites in it cannot
                    push the rest of the page out of reach. */}
                <div class="pl-5 pt-1 max-h-60 overflow-y-auto">
                  <Show
                    when={row.activities.length > 0}
                    fallback={<TitleList titles={row.titles} />}
                  >
                    <ul class="space-y-2">
                      <For each={row.activities}>
                        {(site) => (
                          <SiteRow
                            site={site}
                            of={row.seconds}
                            open={openSite() === site.key}
                            onToggle={() =>
                              setOpenSite(openSite() === site.key ? null : site.key)
                            }
                            onCategory={(c) => props.onSiteCategory(site.key, c)}
                          />
                        )}
                      </For>
                    </ul>
                  </Show>
                </div>
              </Show>
            </div>
          );
        }}
      </For>
    </div>
  );
}

/**
 * One app's bar, stacked by what its time actually counted as.
 *
 * A single-colour bar is a claim that the app was one thing. For a browser that
 * claim is usually false, and this is the component that stops the chart making
 * it: the width is the app's share of the day, and the fill inside it is the
 * app's own split.
 */
function SplitBar(props: { split: Record<string, number>; seconds: number; width: number }) {
  const parts = () =>
    CATEGORIES.map((c) => ({ category: c, seconds: props.split?.[c] ?? 0 })).filter(
      (p) => p.seconds > 0,
    );

  return (
    <div class="w-full bg-background h-2.5 rounded-lg overflow-hidden">
      <div
        class="h-full rounded-lg overflow-hidden flex transition-all"
        style={{ width: `${Math.max(0, Math.min(100, props.width))}%` }}
      >
        <For each={parts()}>
          {(p) => (
            <div
              class={CATEGORY_BAR[p.category]}
              style={{ width: `${(p.seconds / Math.max(1, props.seconds)) * 100}%` }}
            />
          )}
        </For>
      </div>
    </div>
  );
}

/** One site inside a browser: its share of that browser, and its own filing. */
function SiteRow(props: {
  site: ActivityRow;
  of: number;
  open: boolean;
  onToggle: () => void;
  onCategory: (c: Category) => void;
}) {
  const pct = () => (props.of > 0 ? (props.site.seconds / props.of) * 100 : 0);
  const category = () => asCategory(props.site.category);
  const hasTitles = () => props.site.titles.length > 0;

  return (
    <li class="space-y-1">
      <div class="flex justify-between items-center gap-2 text-[0.6875rem]">
        <button
          onClick={() => hasTitles() && props.onToggle()}
          disabled={!hasTitles()}
          class={`flex items-center gap-1.5 min-w-0 text-left ${
            hasTitles() ? 'hover:text-primary transition-colors' : 'cursor-default'
          }`}
          title={hasTitles() ? 'Show the pages behind this total' : undefined}
        >
          <Show when={hasTitles()} fallback={<span class="w-[11px] flex-shrink-0" />}>
            <Show when={props.open} fallback={<ChevronRight size={11} class="flex-shrink-0" />}>
              <ChevronDown size={11} class="flex-shrink-0" />
            </Show>
          </Show>
          <Globe size={11} class="flex-shrink-0 text-muted-foreground" />
          <span class="truncate font-medium">{props.site.label}</span>
        </button>

        <div class="flex items-center gap-2 flex-shrink-0">
          <span class="font-mono text-muted-foreground">{humanise(props.site.seconds)}</span>
          <CategoryPicker
            value={category()}
            label={props.site.label}
            onChange={props.onCategory}
          />
        </div>
      </div>

      <div class="w-full bg-background h-1.5 rounded-lg overflow-hidden">
        <div
          class={`h-full rounded-lg transition-all ${CATEGORY_BAR[category()]}`}
          style={{ width: `${Math.max(1, Math.min(100, pct()))}%` }}
        />
      </div>

      <Show when={props.open}>
        <div class="pl-5">
          <TitleList titles={props.site.titles} />
        </div>
      </Show>
    </li>
  );
}

function TitleList(props: { titles: { title: string; seconds: number }[] }) {
  return (
    <ul class="space-y-1">
      <For each={props.titles}>
        {(t) => (
          <li class="flex justify-between gap-3 text-[0.6875rem] text-muted-foreground">
            <span class="truncate">{t.title}</span>
            <span class="font-mono flex-shrink-0">{humanise(t.seconds)}</span>
          </li>
        )}
      </For>
    </ul>
  );
}

/** three small letters — S / N / D — rather than a dropdown per row */
function CategoryPicker(props: {
  value: Category;
  label: string;
  /** the row's time landed in more than one category, so `value` is a fallback */
  mixed?: boolean;
  onChange: (c: Category) => void;
}) {
  return (
    <div
      class={`flex bg-background rounded-md border overflow-hidden ${
        props.mixed ? 'border-dashed border-border' : 'border-border'
      }`}
      title={
        props.mixed
          ? `Counts ${props.label}. Its sites are filed separately, so only some of this time follows it.`
          : undefined
      }
    >
      <For each={CATEGORIES}>
        {(c) => (
          <button
            onClick={() => props.onChange(c)}
            title={`Count ${props.label} as ${c}`}
            aria-label={`Count ${props.label} as ${c}`}
            aria-pressed={props.value === c}
            class={`w-5 h-5 text-[0.625rem] font-bold font-space uppercase transition-colors ${
              props.value === c
                ? c === 'study'
                  ? 'bg-[hsl(var(--success))] text-background'
                  : c === 'distraction'
                    ? 'bg-[hsl(var(--destructive))] text-background'
                    : 'bg-muted-foreground text-background'
                : 'text-subtle-foreground hover:text-foreground'
            }`}
          >
            {c[0]}
          </button>
        )}
      </For>
    </div>
  );
}

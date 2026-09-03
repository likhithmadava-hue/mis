import { CalendarRange, Flame, MousePointerClick } from 'lucide-solid';
import { createEffect, createMemo, createSignal, For, Show } from 'solid-js';

import type { AppMode } from '../../core/db';
import { DAY_TARGET, MODE_META } from '../../core/scoring';
import { PanelTile, PanelZoom, Select } from '../../core/ui';
import { ACADEMIC_GROUPS, academicPanels } from './AcademicPanels';
import { LIFE_GROUPS, lifePanels } from './LifePanels';
import { createGrowthData, RANGES, type Range } from './growthData';

/**
 * The Report tab: every chart MIS can draw, all on one screen.
 *
 * The home page answers "how is today going". This answers everything else, and
 * it is built so the answer is *visible* rather than scrolled to — the tiles are
 * small enough that a whole deck fits at once, the dropdown narrows them to the
 * set you are asking about, and any tile opens full-page on a double-click.
 * Nothing was dropped to make it fit: every panel renders at two sizes, and the
 * small one is a real chart, not a thumbnail.
 *
 * Read-only, like the whole tracker. Everything here comes from the Daily Log.
 */
export default function Report(props: { mode: () => AppMode }) {
  const [range, setRange] = createSignal<Range>(7);
  const [group, setGroup] = createSignal('overview');
  const [openId, setOpenId] = createSignal<string | null>(null);

  const data = createGrowthData(props.mode, range);

  const panels = createMemo(() =>
    props.mode() === 'academic' ? academicPanels(data, range()) : lifePanels(data, range()),
  );
  const groups = () => (props.mode() === 'academic' ? ACADEMIC_GROUPS : LIFE_GROUPS);
  const visible = createMemo(() =>
    group() === 'all' ? panels() : panels().filter((p) => p.group === group()),
  );

  // The two decks have different groups, so a group carried across a mode
  // switch could select nothing at all — the deck would go blank and look
  // broken rather than empty.
  createEffect(() => {
    props.mode();
    setGroup('overview');
    setOpenId(null);
  });

  const openIndex = () => visible().findIndex((p) => p.id === openId());
  const openPanel = () => (openIndex() >= 0 ? visible()[openIndex()] : null);

  /** walks the zoom view along the visible deck, wrapping at both ends */
  const step = (direction: number) => {
    const deck = visible();
    if (deck.length === 0) return;
    setOpenId(deck[(openIndex() + direction + deck.length) % deck.length].id);
  };

  return (
    <div class="space-y-4">
      {/* ── the controls, and the three numbers the charts are read against ── */}
      <section class="bg-card rounded-2xl border border-border card-shadow p-3.5 flex flex-wrap items-center gap-x-5 gap-y-3">
        <div class="flex items-center gap-2 flex-shrink-0">
          <CalendarRange size={14} class="text-muted-foreground" />
          <div class="flex bg-background p-1 rounded-lg border border-border gap-1">
            <For each={RANGES}>
              {(r) => (
                <button
                  onClick={() => setRange(r)}
                  class={`px-3 py-1 rounded-md text-xs font-semibold font-space uppercase tracking-wider transition-colors ${
                    range() === r
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {r}d
                </button>
              )}
            </For>
          </div>
        </div>

        <Select
          value={group()}
          onChange={(next) => {
            setGroup(next);
            setOpenId(null);
          }}
          options={groups()}
          ariaLabel="Which charts to show"
          class="w-44 flex-shrink-0"
        />

        <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground sm:ml-auto">
          <span>
            {MODE_META[props.mode()].label} avg{' '}
            <span class="font-mono font-bold text-foreground">{data.avgScore()}</span>/{DAY_TARGET}
          </span>
          <span>
            <span class="font-mono font-bold text-foreground">{data.totalStudy()}</span>h logged
          </span>
          <span class="flex items-center gap-1.5">
            <Flame size={12} class="text-orange-400" />
            <span class="font-mono font-bold text-foreground">{data.streak().days}</span>d
          </span>
        </div>
      </section>

      <p class="text-xs text-muted-foreground flex items-center gap-2">
        <MousePointerClick size={13} class="text-primary flex-shrink-0" />
        Hover any point to see the day and the time it was logged · double-click a chart to zoom.
      </p>

      {/* a fourth column from 2xl up — on a wide monitor three columns left the
          tiles stretched and the deck still ran off the bottom of the screen */}
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-3">
        <For each={visible()}>
          {(panel) => <PanelTile panel={panel} onOpen={() => setOpenId(panel.id)} />}
        </For>
      </div>

      <Show when={openPanel()}>
        {(panel) => (
          <PanelZoom
            panel={panel()}
            position={openIndex() + 1}
            total={visible().length}
            onClose={() => setOpenId(null)}
            onStep={step}
          />
        )}
      </Show>
    </div>
  );
}

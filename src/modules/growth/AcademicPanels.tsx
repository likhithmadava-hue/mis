import {
  Activity,
  Award,
  BarChart3,
  BookOpen,
  Flame,
  ShieldAlert,
  Sparkles,
  Target,
  TrendingUp,
} from 'lucide-solid';
import { For, Show } from 'solid-js';

import { longDate } from '../../core/dates';
import { DAY_TARGET } from '../../core/scoring';
import {
  BarChart,
  Donut,
  EmptyChart,
  HBarList,
  SeriesLabel,
  TOPIC_COLUMNS,
  TrendChart,
  type PanelDef,
} from '../../core/ui';
import { Meter, Stat } from './parts';
import TrackSummary from './TrackSummary';
import type { GrowthData, Range } from './growthData';

/**
 * The Academic deck: hours and papers, then everything the mistake logbook has
 * to say about where the marks are actually going.
 *
 * This was eleven full-width cards stacked down the page. It is now seven
 * panels, several of them merging two charts that were only ever read together
 * — hours with the papers they produced, subjects with the chapters inside
 * them, the gate with the backlog it is gating. Each panel renders small for
 * the grid and large for the zoom view; where a tile has to drop something it
 * drops rows off the end of a list, never a whole series.
 */

export const ACADEMIC_GROUPS = [
  { value: 'overview', label: 'Overview' },
  { value: 'papers', label: 'Papers & Marks' },
  { value: 'all', label: 'Everything' },
];

export function academicPanels(data: GrowthData, range: Range): PanelDef[] {
  const user = data.user();

  const backlog = () => data.topics().filter((t) => t.type !== 'taught');

  return [
    {
      id: 'day-score',
      title: 'Day Score',
      subtitle: `Out of ${DAY_TARGET}, one point per day. Gaps are days with no log.`,
      icon: Activity,
      group: 'overview',
      render: (view) => (
        <TrendChart data={data.scoreTrend()} max={DAY_TARGET} height={view === 'full' ? 300 : 76} />
      ),
    },

    {
      id: 'study',
      title: 'Study & DPPs',
      subtitle: `Hours studied against your ${user.target_study_hours}h target, and the papers finished each day.`,
      icon: Target,
      group: 'overview',
      render: (view) => {
        const full = view === 'full';
        const studyBars = () => data.academic().studyBars;
        const dppBars = () => data.academic().dppBars;
        return (
          <div class={full ? 'space-y-5' : 'space-y-2'}>
            <div>
              <SeriesLabel>Study hours · target {user.target_study_hours}h</SeriesLabel>
              {/* the axis never shrinks below the target, so a bad week still
                  shows how far short of it the bars fell */}
              <BarChart
                data={studyBars()}
                max={Math.max(user.target_study_hours, ...studyBars().map((b) => b.value))}
                height={full ? 180 : 44}
                unit="h"
                showLabels={full}
              />
            </div>
            <div>
              <SeriesLabel>DPPs completed</SeriesLabel>
              <BarChart
                data={dppBars()}
                max={Math.max(1, ...dppBars().map((b) => b.value))}
                height={full ? 180 : 44}
                showLabels={full}
              />
            </div>
          </div>
        );
      },
    },

    {
      id: 'tracks',
      title: `Last ${range} Days`,
      subtitle:
        'Each academic track scored 0–10 per day, ordered by the priority you set in the Log.',
      icon: BarChart3,
      group: 'overview',
      wide: true,
      render: () => (
        <TrackSummary days={data.days()} tracks={data.modeTracks()} mode="academic" />
      ),
    },

    {
      id: 'targets',
      title: "Today's Targets",
      subtitle:
        'Leisure stays restricted until both benchmarks hit 100%. The backlog is what you still owe yourself.',
      icon: Award,
      group: 'overview',
      render: (view) => {
        const full = view === 'full';
        const gate = () => data.academic().gate;
        return (
          <div class="space-y-3">
            <Meter
              label="Deep study"
              right={`${gate().studyHours}/${user.target_study_hours}h`}
              pct={gate().studyProgress}
              class={gate().studyProgress >= 100 ? 'bg-success' : 'bg-primary'}
            />
            <Meter
              label="DPPs complete"
              right={`${gate().dppsComplete}/${gate().dppTarget}`}
              pct={gate().dppProgress}
              class={gate().dppProgress >= 100 ? 'bg-success' : 'bg-yellow-500'}
            />

            <Show
              when={gate().unlocked}
              fallback={
                <div class="p-3 bg-red-500/5 border border-red-500/15 rounded-xl flex items-start gap-2.5">
                  <ShieldAlert class="text-red-400 mt-0.5 flex-shrink-0" size={15} />
                  <div class="text-xs text-muted-foreground">
                    <span class="font-bold block text-red-400">Gate locked</span>
                    {full && 'Finish the remaining study hours and DPPs.'}
                  </div>
                </div>
              }
            >
              <div class="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-start gap-2.5">
                <Sparkles class="text-emerald-400 mt-0.5 flex-shrink-0" size={15} />
                <div class="text-xs text-muted-foreground">
                  <span class="font-bold block text-emerald-400">Gate open</span>
                  {full && 'Both benchmarks cleared. Enjoy the leisure guilt-free.'}
                </div>
              </div>
            </Show>

            {/* the tile says how big the backlog is; the zoom view breaks it down */}
            <Show
              when={full}
              fallback={
                <p class="text-xs text-muted-foreground">
                  Backlog ·{' '}
                  <span class="font-mono text-foreground font-semibold">
                    {backlog().filter((t) => !t.done).length}
                  </span>{' '}
                  left of {backlog().length}
                </p>
              }
            >
              <div class="border-t border-border pt-4 space-y-3">
                <For each={TOPIC_COLUMNS}>
                  {({ type, title }) => {
                    const items = () => data.topics().filter((t) => t.type === type);
                    const done = () => items().filter((t) => t.done).length;
                    const pct = () => (items().length > 0 ? (done() / items().length) * 100 : 0);
                    return (
                      <Meter
                        label={title}
                        right={
                          type === 'taught'
                            ? `${items().length} total`
                            : `${items().length - done()} left of ${items().length}`
                        }
                        // "Taught" is a tally, not a backlog — there is nothing
                        // to complete, so its bar is always full.
                        pct={type === 'taught' ? 100 : pct()}
                        class={
                          type === 'taught'
                            ? 'bg-primary'
                            : pct() === 100
                              ? 'bg-success'
                              : 'bg-yellow-500'
                        }
                      />
                    );
                  }}
                </For>
                <Show when={data.bestDay()}>
                  {(best) => (
                    <p class="pt-2 border-t border-border text-xs text-muted-foreground">
                      Best day in this range:{' '}
                      <span class="text-foreground font-semibold">{longDate(best().date)}</span> at{' '}
                      <span class="font-mono font-bold text-primary">
                        {best().by_mode?.academic}
                      </span>
                      /{DAY_TARGET}
                    </p>
                  )}
                </Show>
              </div>
            </Show>
          </div>
        );
      },
    },

    {
      id: 'errors',
      title: 'Error Analysis',
      subtitle: 'How your mistakes classify, and what kind of paper you actually attempt.',
      icon: Flame,
      group: 'papers',
      render: (view) => {
        const full = view === 'full';
        const papers = () => data.papers();
        return (
          <div class="space-y-4">
            <Show when={full && papers().difficultySegments.length > 0}>
              <Donut
                segments={papers().difficultySegments}
                centerValue={String(papers().totalEntries)}
                centerLabel="papers"
              />
            </Show>
            <HBarList
              data={full ? papers().reasonBars : papers().reasonBars.slice(0, 3)}
              empty="No mistakes logged yet."
            />
            <div
              class={`grid grid-cols-3 gap-2 text-center ${
                full ? 'border-t border-border pt-4' : ''
              }`}
            >
              <Stat label="Avg" value={`${papers().avgPaper}%`} />
              <Stat label="Papers" value={String(papers().totalEntries)} />
              <Stat label="Lost" value={String(papers().totalMarksLost)} tone="text-destructive" />
            </div>
          </div>
        );
      },
    },

    {
      id: 'subjects',
      title: 'Subjects & Chapters',
      subtitle:
        'Average percentage per subject, weakest first — then the chapters those marks were lost in.',
      icon: BookOpen,
      group: 'papers',
      render: (view) => {
        const full = view === 'full';
        const papers = () => data.papers();
        return (
          <div class={full ? 'grid grid-cols-1 lg:grid-cols-2 gap-6' : 'space-y-3'}>
            <div>
              <SeriesLabel>Subject performance</SeriesLabel>
              <HBarList
                data={full ? papers().subjectBars : papers().subjectBars.slice(0, 2)}
                empty="No papers logged yet."
              />
            </div>
            <div>
              <SeriesLabel>Where marks go</SeriesLabel>
              <HBarList
                data={full ? papers().chapterBars : papers().chapterBars.slice(0, 2)}
                empty="No marks lost yet."
              />
            </div>
          </div>
        );
      },
    },

    {
      id: 'history',
      title: 'Score History',
      subtitle: 'Every paper in the logbook, in order, as a percentage.',
      icon: TrendingUp,
      group: 'papers',
      render: (view) => (
        <Show
          when={data.papers().markTrend.length >= 2}
          fallback={
            <EmptyChart
              message="Log at least two papers to see a trend."
              compact={view === 'tile'}
            />
          }
        >
          <TrendChart
            data={data.papers().markTrend}
            max={100}
            height={view === 'full' ? 300 : 76}
            unit="%"
            color="#10b981"
          />
        </Show>
      ),
    },
  ];
}

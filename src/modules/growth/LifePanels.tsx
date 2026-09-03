import { Activity, BarChart3, Droplets, Hourglass, Smile, Sparkles } from 'lucide-solid';
import { Show } from 'solid-js';

import { longDate } from '../../core/dates';
import { DAY_TARGET, POSTURE_TARGET, WELL_SPENT_TARGET } from '../../core/scoring';
import { BarChart, EmptyChart, SeriesLabel, TrendChart, type PanelDef } from '../../core/ui';
import TrackSummary from './TrackSummary';
import type { GrowthData, Range } from './growthData';

/**
 * The Life deck: how the stretch actually felt, and whether the body keeping
 * the studying going is being looked after.
 *
 * Same shape as the Academic deck — mood and habits share one panel because the
 * question is always whether one moved with the other, and hydration and
 * posture were already a pair.
 */

export const LIFE_GROUPS = [
  { value: 'overview', label: 'Overview' },
  { value: 'body', label: 'Body & Balance' },
  { value: 'all', label: 'Everything' },
];

export function lifePanels(data: GrowthData, range: Range): PanelDef[] {
  const user = data.user();
  const life = () => data.life();

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
      id: 'mood',
      title: 'Mood & Habits',
      subtitle:
        'Mood is self-reported out of 10; habits are the priority-weighted share you ticked that day.',
      icon: Smile,
      group: 'overview',
      render: (view) => {
        const full = view === 'full';
        return (
          <div class={full ? 'space-y-5' : 'space-y-2'}>
            <div>
              <SeriesLabel>Mood</SeriesLabel>
              <TrendChart
                data={life().moodTrend}
                max={10}
                height={full ? 180 : 46}
                color="#a855f7"
                showLabels={full}
              />
            </div>
            <div>
              <SeriesLabel>Habit consistency</SeriesLabel>
              <TrendChart
                data={life().habitTrend}
                max={10}
                height={full ? 180 : 46}
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
      subtitle: 'Each life track scored 0–10 per day, ordered by the priority you set in the Log.',
      icon: BarChart3,
      group: 'overview',
      wide: true,
      render: () => <TrackSummary days={data.days()} tracks={data.modeTracks()} mode="life" />,
    },

    {
      id: 'best-day',
      title: 'Best Day',
      subtitle: 'Your strongest day in this range.',
      icon: Sparkles,
      group: 'overview',
      render: (view) => (
        <Show
          when={data.bestDay()}
          fallback={
            <EmptyChart message="Nothing logged in this range yet." compact={view === 'tile'} />
          }
        >
          {(best) => (
            <div class="text-sm text-muted-foreground">
              <span class="text-foreground font-semibold">{longDate(best().date)}</span> scored{' '}
              <span class="font-mono font-bold text-primary">{best().by_mode?.life}</span> out of{' '}
              {DAY_TARGET}
              <Show when={best().metric}>
                {(m) => (
                  <>
                    {' '}
                    — mood {m().mood_score}/10, {m().water_count} cups, {m().well_spent_time}{' '}
                    minutes of leisure.
                  </>
                )}
              </Show>
            </div>
          )}
        </Show>
      ),
    },

    {
      id: 'leisure',
      title: 'Leisure Minutes',
      subtitle: `Amber is healthy; red is past ${WELL_SPENT_TARGET * 2} minutes.`,
      icon: Hourglass,
      group: 'body',
      render: (view) => (
        <BarChart
          data={life().leisureBars}
          max={Math.max(WELL_SPENT_TARGET, ...life().leisureBars.map((b) => b.value))}
          height={view === 'full' ? 300 : 76}
          unit="m"
        />
      ),
    },

    {
      id: 'wellness',
      title: 'Hydration & Posture',
      subtitle: `Cups against your ${user.water_target}-cup target, and posture checks below.`,
      icon: Droplets,
      group: 'body',
      render: (view) => {
        const full = view === 'full';
        return (
          <div class={full ? 'space-y-5' : 'space-y-2'}>
            <div>
              <SeriesLabel>Water · target {user.water_target} cups</SeriesLabel>
              <BarChart
                data={life().waterBars}
                max={Math.max(user.water_target, ...life().waterBars.map((b) => b.value))}
                height={full ? 180 : 44}
                showLabels={full}
              />
            </div>
            <div>
              <SeriesLabel>Posture checks</SeriesLabel>
              <BarChart
                data={life().postureBars}
                max={Math.max(POSTURE_TARGET, ...life().postureBars.map((b) => b.value))}
                height={full ? 180 : 44}
                showLabels={full}
              />
            </div>
          </div>
        );
      },
    },
  ];
}

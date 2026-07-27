import { BarChart3, Droplets, Hourglass, Repeat, Smile, Sparkles } from 'lucide-react';
import { DAY_TARGET, POSTURE_TARGET, WELL_SPENT_TARGET } from '../../core/scoring';
import Card from '../../core/ui/Card';
import { BarChart, TrendChart } from '../../core/ui/charts';
import TrackSummary from './TrackSummary';
import type { Range, useGrowthData } from './useGrowthData';

interface LifePanelsProps {
  data: ReturnType<typeof useGrowthData>;
  range: Range;
}

/**
 * The Life half of the tracker: how the week actually felt, and whether the
 * body keeping the studying going is being looked after.
 */
export default function LifePanels({ data, range }: LifePanelsProps) {
  const { days, user, bestDay, modeTracks, life } = data;
  const { moodTrend, habitTrend, leisureBars, waterBars, postureBars } = life;

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Mood" subtitle="Self-reported, out of 10." icon={Smile}>
          <TrendChart data={moodTrend} max={10} height={150} color="#a855f7" />
        </Card>

        <Card
          title="Habit Consistency"
          subtitle="Priority-weighted share of habits ticked each day."
          icon={Repeat}
        >
          <TrendChart data={habitTrend} max={10} height={150} />
        </Card>

        <Card
          title="Leisure Minutes"
          subtitle={`Amber is healthy; red is past ${WELL_SPENT_TARGET * 2} minutes.`}
          icon={Hourglass}
        >
          <BarChart
            data={leisureBars}
            max={Math.max(WELL_SPENT_TARGET, ...leisureBars.map((b) => b.value))}
            height={150}
            unit="m"
          />
        </Card>

        <Card
          title="Hydration & Posture"
          subtitle={`Cups against your ${user.water_target}-cup target, and posture checks below.`}
          icon={Droplets}
        >
          <BarChart
            data={waterBars}
            max={Math.max(user.water_target, ...waterBars.map((b) => b.value))}
            height={110}
          />
          <div className="border-t border-border pt-3">
            <BarChart
              data={postureBars}
              max={Math.max(POSTURE_TARGET, ...postureBars.map((b) => b.value))}
              height={70}
            />
          </div>
        </Card>
      </div>

      <Card
        title={`Last ${range} Days`}
        subtitle="Each life track scored 0–10 per day, ordered by the priority you set in the Log."
        icon={BarChart3}
      >
        <TrackSummary days={days} tracks={modeTracks} mode="life" />
      </Card>

      {bestDay && (
        <Card title="Best Day" subtitle="Your strongest day in this range." icon={Sparkles}>
          <div className="text-sm text-muted-foreground">
            <span className="text-foreground font-semibold">{bestDay.dateLabel}</span> scored{' '}
            <span className="font-mono font-bold text-primary">{bestDay.byMode?.life}</span> out of{' '}
            {DAY_TARGET}
            {bestDay.metric && (
              <>
                {' '}— mood {bestDay.metric.mood_score}/10, {bestDay.metric.water_count} cups,{' '}
                {bestDay.metric.well_spent_time} minutes of leisure.
              </>
            )}
          </div>
        </Card>
      )}
    </>
  );
}

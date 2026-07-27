import { useState } from 'react';
import { Activity, CalendarRange } from 'lucide-react';
import type { AppMode } from '../../core/db';
import { DAY_TARGET, MODE_META, TRACK_META, heat } from '../../core/scoring';
import Card from '../../core/ui/Card';
import { TrendChart } from '../../core/ui/charts';
import AcademicPanels from './AcademicPanels';
import LifePanels from './LifePanels';
import { RANGES, useGrowthData, type Range } from './useGrowthData';

interface GrowTrackProps {
  mode: AppMode;
  triggerUpdate: number;
  /** kept so App.tsx can still pass a refresh callback; nothing here writes */
  onLogbookChange: () => void;
}

/**
 * The Growth Tracker tab: the headline score and the range picker, then
 * whichever set of charts the current mode calls for.
 *
 * Strictly read-only. Everything on this tab is drawn from what the Daily Log
 * wrote — do not add a form here, that separation is the point of the layout.
 */
export default function GrowTrack({ mode, triggerUpdate }: GrowTrackProps) {
  const [range, setRange] = useState<Range>(7);
  const data = useGrowthData(mode, range, triggerUpdate);
  const { today, todayScore, avgScore, streak, totalStudy, modeTracks, scoreTrend } = data;

  const meta = MODE_META[mode];
  const ModeIcon = meta.icon;

  return (
    <div className="space-y-6">
      {/* headline: this mode's score, its average, and the range picker */}
      <div className="bg-card rounded-2xl border border-border card-shadow p-6 space-y-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h3 className="text-lg font-bold font-space flex items-center gap-2">
              <ModeIcon size={18} className="text-primary" /> {meta.label} Progress
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Read-only. Everything here is drawn from what you enter in the Daily Log.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <CalendarRange size={14} className="text-muted-foreground" />
            <div className="flex bg-background p-1 rounded-lg border border-border gap-1">
              {RANGES.map((r) => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  className={`px-3 py-1 rounded-md text-[11px] font-semibold font-space uppercase tracking-wider transition-colors ${
                    range === r
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {r}d
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-6 flex-wrap">
          <div
            className={`w-24 h-24 flex-shrink-0 rounded-2xl border flex flex-col items-center justify-center ${heat(
              (todayScore / DAY_TARGET) * 10
            )}`}
          >
            <span className="text-3xl font-bold font-mono leading-none">{todayScore}</span>
            <span className="text-[10px] opacity-70 mt-1">of {DAY_TARGET}</span>
          </div>
          <div className="grid grid-cols-3 gap-3 flex-1 min-w-[240px]">
            <div className="p-3 bg-background border border-border rounded-xl text-center">
              <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
                {range}-Day Avg
              </p>
              <p className="text-2xl font-bold font-space mt-1">{avgScore}</p>
              <p className="text-[10px] text-muted-foreground font-mono">of {DAY_TARGET}</p>
            </div>
            <div className="p-3 bg-background border border-border rounded-xl text-center">
              <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
                Study Streak
              </p>
              <p className="text-2xl font-bold font-space mt-1">{streak}</p>
              <p className="text-[10px] text-muted-foreground font-mono">
                {streak === 1 ? 'day' : 'days'}
              </p>
            </div>
            <div className="p-3 bg-background border border-border rounded-xl text-center">
              <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
                Hours Logged
              </p>
              <p className="text-2xl font-bold font-space mt-1">{totalStudy}</p>
              <p className="text-[10px] text-muted-foreground font-mono">last {range}d</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {modeTracks.map((id) => {
            const score = today?.scores?.[id] ?? 0;
            const { label, icon: Icon } = TRACK_META[id];
            return (
              <div
                key={id}
                className={`p-3 rounded-xl border flex flex-col items-center gap-1 ${heat(score)}`}
              >
                <Icon size={14} className="opacity-70" />
                <span className="text-lg font-bold font-mono leading-none">{Math.round(score)}</span>
                <span className="text-[9px] uppercase tracking-wider opacity-80 text-center leading-tight">
                  {label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <Card
        title={`${meta.label} Day Score`}
        subtitle={`Out of ${DAY_TARGET}, one point per day. Gaps are days with no log.`}
        icon={Activity}
      >
        <TrendChart data={scoreTrend} max={DAY_TARGET} height={160} />
      </Card>

      {mode === 'academic' ? (
        <AcademicPanels data={data} range={range} />
      ) : (
        <LifePanels data={data} range={range} />
      )}
    </div>
  );
}

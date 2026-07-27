import {
  Award,
  BarChart3,
  BookOpen,
  Flame,
  Layers,
  ShieldAlert,
  Sparkles,
  Target,
  TrendingUp,
} from 'lucide-react';
import { DAY_TARGET } from '../../core/scoring';
import Card from '../../core/ui/Card';
import { BarChart, Donut, EmptyChart, HBarList, TrendChart } from '../../core/ui/charts';
import { TOPIC_COLUMNS } from '../../core/ui/labels';
import TrackSummary from './TrackSummary';
import type { Range, useGrowthData } from './useGrowthData';

interface AcademicPanelsProps {
  data: ReturnType<typeof useGrowthData>;
  range: Range;
}

/**
 * The Academic half of the tracker: hours and papers, then everything the
 * mistake logbook has to say about where the marks are actually going.
 */
export default function AcademicPanels({ data, range }: AcademicPanelsProps) {
  const { days, user, topics, bestDay, modeTracks, academic, papers } = data;
  const { studyBars, dppBars, gate } = academic;

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card
          title="Study Hours"
          subtitle={`Green bars cleared your ${user.target_study_hours}h target.`}
          icon={Target}
        >
          <BarChart
            data={studyBars}
            max={Math.max(user.target_study_hours, ...studyBars.map((b) => b.value))}
            height={150}
            unit="h"
          />
        </Card>

        <Card title="DPPs Completed" subtitle="Papers finished each day." icon={Layers}>
          <BarChart data={dppBars} max={Math.max(1, ...dppBars.map((b) => b.value))} height={150} />
        </Card>
      </div>

      <Card
        title={`Last ${range} Days`}
        subtitle="Each academic track scored 0–10 per day, ordered by the priority you set in the Log."
        icon={BarChart3}
      >
        <TrackSummary days={days} tracks={modeTracks} mode="academic" />
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card
          title="Error Analysis Engine"
          subtitle="Classified distribution across every paper logged."
          icon={Flame}
        >
          <HBarList data={papers.reasonBars} empty="No mistakes logged yet." />
          <div className="border-t border-border pt-4 grid grid-cols-3 gap-2 text-center">
            <div className="p-3 bg-background rounded-xl border border-border">
              <span className="text-[10px] text-muted-foreground uppercase">Avg Score</span>
              <p className="text-lg font-bold font-space">{papers.avgPaper}%</p>
            </div>
            <div className="p-3 bg-background rounded-xl border border-border">
              <span className="text-[10px] text-muted-foreground uppercase">Papers</span>
              <p className="text-lg font-bold font-space">{papers.totalEntries}</p>
            </div>
            <div className="p-3 bg-background rounded-xl border border-border">
              <span className="text-[10px] text-muted-foreground uppercase">Marks Lost</span>
              <p className="text-lg font-bold font-space text-destructive">{papers.totalMarksLost}</p>
            </div>
          </div>
        </Card>

        <Card title="Difficulty Mix" subtitle="What kind of paper you actually attempt." icon={Layers}>
          {papers.difficultySegments.length === 0 ? (
            <EmptyChart message="No papers logged yet." />
          ) : (
            <Donut
              segments={papers.difficultySegments}
              centerValue={String(papers.totalEntries)}
              centerLabel="papers"
            />
          )}
        </Card>

        <Card
          title="Subject Performance"
          subtitle="Average percentage per subject — weakest first."
          icon={BookOpen}
        >
          <HBarList data={papers.subjectBars} empty="No papers logged yet." />
        </Card>

        <Card
          title="Where Marks Go"
          subtitle="Total marks lost per chapter. Your top six revision targets."
          icon={ShieldAlert}
        >
          <HBarList data={papers.chapterBars} empty="No marks lost yet — or nothing logged." />
        </Card>
      </div>

      <Card title="Score History" subtitle="Every paper in order, as a percentage." icon={TrendingUp}>
        {papers.markTrend.length < 2 ? (
          <EmptyChart message="Log at least two papers to see a trend." />
        ) : (
          <TrendChart data={papers.markTrend} max={100} height={170} unit="%" color="#10b981" />
        )}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card
          title="Free Time Gate"
          subtitle="Leisure apps stay restricted until today's academic benchmarks hit 100%."
          icon={Award}
        >
          <div className="p-4 bg-background rounded-xl border border-border space-y-4">
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Deep Study Hours</span>
                <span className={`font-bold ${gate.studyProgress >= 100 ? 'text-success' : ''}`}>
                  {gate.studyHours}/{user.target_study_hours}h
                </span>
              </div>
              <div className="w-full bg-card h-2 rounded-full overflow-hidden">
                <div
                  className={`h-full ${gate.studyProgress >= 100 ? 'bg-success' : 'bg-primary'}`}
                  style={{ width: `${gate.studyProgress}%` }}
                />
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">DPPs Complete</span>
                <span className={`font-bold ${gate.dppProgress >= 100 ? 'text-success' : ''}`}>
                  {gate.dppsComplete}/{gate.dppTarget}
                </span>
              </div>
              <div className="w-full bg-card h-2 rounded-full overflow-hidden">
                <div
                  className={`h-full ${gate.dppProgress >= 100 ? 'bg-success' : 'bg-yellow-500'}`}
                  style={{ width: `${gate.dppProgress}%` }}
                />
              </div>
            </div>
          </div>
          {gate.unlocked ? (
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-start gap-2.5 animate-fade-in">
              <Sparkles className="text-emerald-400 mt-0.5 flex-shrink-0" size={16} />
              <div className="text-xs text-muted-foreground">
                <span className="font-bold block text-emerald-400">Gate open</span>
                Both benchmarks cleared. Enjoy the leisure guilt-free.
              </div>
            </div>
          ) : (
            <div className="p-4 bg-red-500/5 border border-red-500/15 rounded-xl flex items-start gap-2.5">
              <ShieldAlert className="text-red-400 mt-0.5 flex-shrink-0" size={16} />
              <div className="text-xs text-muted-foreground">
                <span className="font-bold block text-red-400">Gate locked</span>
                Finish the remaining study hours and DPPs.
              </div>
            </div>
          )}
        </Card>

        <Card title="Topic Backlog" subtitle="Add and tick topics in the Daily Log." icon={BookOpen}>
          <div className="space-y-4">
            {TOPIC_COLUMNS.map(({ type, title }) => {
              const items = topics.filter((t) => t.type === type);
              const done = items.filter((t) => t.done).length;
              const pct = items.length > 0 ? (done / items.length) * 100 : 0;
              return (
                <div key={type} className="space-y-1.5">
                  <div className="flex justify-between text-xs font-medium">
                    <span>{title}</span>
                    <span className="font-mono text-muted-foreground">
                      {type === 'taught'
                        ? `${items.length} total`
                        : `${items.length - done} left of ${items.length}`}
                    </span>
                  </div>
                  <div className="w-full bg-background h-2.5 rounded-lg overflow-hidden">
                    <div
                      className={`h-full rounded-lg transition-all ${
                        type === 'taught' ? 'bg-primary' : pct === 100 ? 'bg-success' : 'bg-yellow-500'
                      }`}
                      style={{ width: `${type === 'taught' ? 100 : pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
            {bestDay && (
              <div className="pt-2 border-t border-border text-xs text-muted-foreground">
                Best day in this range:{' '}
                <span className="text-foreground font-semibold">{bestDay.dateLabel}</span> at{' '}
                <span className="font-mono font-bold text-primary">{bestDay.byMode?.academic}</span>/
                {DAY_TARGET}
              </div>
            )}
          </div>
        </Card>
      </div>
    </>
  );
}

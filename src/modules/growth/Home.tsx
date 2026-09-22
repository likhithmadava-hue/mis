import {
  AlertTriangle,
  Ban,
  BarChart3,
  BookMarked,
  Clock,
  Eraser,
  FileText,
  Flame,
  Hourglass,
  ListTodo,
  MonitorPlay,
  Moon,
  Percent,
  Target,
  Timer,
  TrendingDown,
  TrendingUp,
  Trophy,
} from 'lucide-solid';
import type { JSX } from 'solid-js';
import { For, Show } from 'solid-js';

import { shortDate } from '../../core/dates';
import type { AppMode } from '../../core/db';
import { DAY_TARGET, TRACK_TARGET, WELL_SPENT_TARGET } from '../../core/scoring';
import { createHomeData, humanDuration } from './homeData';
import { DayStrip, ScoreRing, Spark, Widget, WidgetBar } from './widgets';

/** the tabs a widget can hand you off to */
export type HomeTab = 'log' | 'report' | 'db' | 'screen' | 'focus';

interface HomeProps {
  mode: () => AppMode;
  /** a widget is a shortcut as well as a readout — this is where it takes you */
  onOpen: (tab: HomeTab) => void;
}

/**
 * The home page: a board of small widgets, one fact each.
 *
 * This used to be two large cards — the score and the streak — and everything
 * else was a tab away. The trouble with two cards is that they can only answer
 * two questions, so the page said "you scored 34 today" and then stopped, while
 * the things you would actually act on (which chapter is bleeding marks, whether
 * the water is in, where the last two hours went) sat behind a click each. The
 * board answers a dozen at a glance and every tile is a shortcut to the tab that
 * owns it, so reading and acting are the same gesture.
 *
 * It is laid out in three bands, and the middle one is the point:
 *
 * - **Today** — the day's score, the streak, and the week around them.
 * - **Right now** — one tile per track in the current mode, each showing the
 *   score *and* the raw fact behind it, plus whatever else is outstanding.
 * - **What the data says** — the standing patterns. Papers, mistakes and marks
 *   lost in Academic; screen time, leisure and sleep in Life.
 *
 * **The two modes get different boards, not a filtered one.** Academic ends in
 * the paper analytics because that is what moves marks; Life ends in where the
 * day actually went. A tile only exists in the mode whose question it answers.
 *
 * Everything here is read-only, and every value that has no answer yet renders
 * as `—` rather than as a zero: a day you have not logged and a day you scored
 * nothing are different facts, and the board has to be able to say which.
 */
export default function Home(props: HomeProps) {
  const data = createHomeData(props.mode);
  const academic = () => props.mode() === 'academic';

  /** a score of ten, coloured — muted when there is no log to colour */
  const barTone = (score: number | null) =>
    score === null
      ? 'bg-border'
      : score >= 8
        ? 'bg-success'
        : score >= 5
          ? 'bg-primary'
          : score > 0
            ? 'bg-warning'
            : 'bg-border';

  const muted = (empty: boolean) => (empty ? 'text-muted-foreground/40' : 'text-foreground');

  /** today's screen time, but only when it is actually a reading */
  const screenOk = () => {
    const s = data.screen();
    return s.state === 'ok' ? s : null;
  };

  /** the sentence a screen-time tile shows when it has no reading to show */
  const screenExcuse = () => {
    const s = data.screen();
    if (s.state === 'off') return s.reason;
    if (s.state === 'error') return s.message;
    if (s.state === 'loading') return 'reading today’s recording…';
    return '';
  };

  const papers = () => data.papers();
  const topReason = () => papers().reasonBars[0];
  const topChapter = () => papers().chapterBars[0];

  return (
    <div class="flex-1 flex flex-col gap-5 min-h-0">
      {/* ── Today ──────────────────────────────────────────────────────────── */}
      <Band label="Today">
        <Widget
          icon={Target}
          label="Day score"
          value={data.logged() ? String(data.todayScore()) : '—'}
          sub={data.logged() ? `of ${DAY_TARGET} · ${data.submitted() ? 'submitted' : 'open'}` : 'nothing logged yet'}
          tone={muted(!data.logged())}
          aside={<ScoreRing value={data.todayScore()} max={DAY_TARGET} />}
          onClick={() => props.onOpen('log')}
          goes="Open the Daily Log"
          hint={`Today's ${props.mode()} score, out of ${DAY_TARGET}. Opens the Daily Log.`}
        />

        <Widget
          icon={Flame}
          label="Study streak"
          value={`${data.streak().days}`}
          sub={
            data.streak().today_done
              ? `day${data.streak().days === 1 ? '' : 's'} · today is in`
              : `day${data.streak().days === 1 ? '' : 's'} · best ${data.streak().best}`
          }
          tone={data.streak().days > 0 ? 'text-orange-400' : 'text-muted-foreground/40'}
          delay={60}
          hint="Days that cleared your study target, counted over your whole history."
        >
          <DayStrip
            days={data.recentDays()}
            targetHours={data.user().target_study_hours}
          />
        </Widget>

        <Widget
          icon={TrendingUp}
          label="7-day average"
          value={String(data.avgScore())}
          sub={`of ${DAY_TARGET}, across days you logged`}
          delay={120}
          onClick={() => props.onOpen('report')}
          goes="Open the Report"
          hint="Your mean day score over the last week. Opens the Report."
        >
          <Spark data={data.sparks().score} max={DAY_TARGET} />
        </Widget>

        <Show
          when={academic()}
          fallback={
            <Widget
              icon={Hourglass}
              label="Leisure"
              value={`${data.leisureWeek().avg}m`}
              sub={`a day, over ${data.leisureWeek().days} logged day${
                data.leisureWeek().days === 1 ? '' : 's'
              }`}
              tone={muted(data.leisureWeek().days === 0)}
              delay={180}
              hint={`Well-spent leisure per logged day. The target is ${WELL_SPENT_TARGET} minutes.`}
            >
              <Spark
                data={data.sparks().leisure}
                max={Math.max(WELL_SPENT_TARGET, ...data.sparks().leisure.map((v) => v ?? 0))}
              />
            </Widget>
          }
        >
          <Widget
            icon={Clock}
            label="Hours logged"
            value={`${data.totalStudy()}h`}
            sub="in the last 7 days"
            tone={muted(data.totalStudy() === 0)}
            delay={180}
            hint="Study hours across the week, however they were logged."
          >
            <Spark
              data={data.sparks().study}
              max={Math.max(data.user().target_study_hours, ...data.sparks().study.map((v) => v ?? 0))}
            />
          </Widget>
        </Show>
      </Band>

      {/* ── Right now ──────────────────────────────────────────────────────── */}
      <Band label={academic() ? 'Right now' : 'The day so far'}>
        <For each={data.tracks()}>
          {(t, i) => (
            <Widget
              icon={t.icon}
              label={t.label}
              value={t.score === null ? '—' : `${Math.round(t.score)}`}
              sub={t.score === null ? 'no log yet today' : t.detail}
              tone={muted(t.score === null)}
              delay={240 + i() * 50}
              onClick={() => props.onOpen('log')}
              goes={`Log ${t.label} in the Daily Log`}
              hint={`${t.label} — ${t.hint}. Scored out of ${TRACK_TARGET}.`}
            >
              <WidgetBar pct={t.pct} class={barTone(t.score)} />
            </Widget>
          )}
        </For>

        <Show when={academic()}>
          <Widget
            icon={Timer}
            label="Focus rounds"
            value={String(data.focusToday().rounds)}
            sub={
              data.focusToday().rounds
                ? `banked today · ${data.focusToday().minutes} min`
                : 'nothing banked today'
            }
            tone={muted(data.focusToday().rounds === 0)}
            delay={340}
            onClick={() => props.onOpen('focus')}
            goes="Open the Focus Timer"
            hint="Rounds you confirmed and banked today. Opens the Focus Timer."
          />

          <Widget
            icon={ListTodo}
            label="Topics left"
            value={String(data.topics().left)}
            sub={
              data.topics().total
                ? `of ${data.topics().total} on the list`
                : 'nothing on the list yet'
            }
            tone={muted(data.topics().total === 0)}
            delay={390}
            onClick={() => props.onOpen('log')}
            goes="Open the Daily Log"
            hint="Topics still to be taught, revised or solved. Opens the Daily Log."
          >
            <WidgetBar
              pct={
                data.topics().total
                  ? ((data.topics().total - data.topics().left) / data.topics().total) * 100
                  : 0
              }
              class="bg-primary"
            />
          </Widget>
        </Show>
      </Band>

      {/* ── What the data says ─────────────────────────────────────────────── */}
      <Band
        label={academic() ? 'What your papers say' : 'Where the day went'}
        cols={academic() ? 'grid-cols-2 lg:grid-cols-3' : 'grid-cols-2 lg:grid-cols-4'}
        action={
          <button
            type="button"
            onClick={() => props.onOpen('report')}
            class="flex-shrink-0 h-8 px-3 rounded-xl bg-muted border border-border text-[0.6875rem] font-semibold font-space flex items-center gap-2 text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors"
          >
            <BarChart3 size={13} />
            Open Report
          </button>
        }
      >
        <Show
          when={academic()}
          fallback={
            <>
              <Widget
                icon={MonitorPlay}
                label="Screen time"
                value={screenOk() ? humanDuration(screenOk()!.total) : '—'}
                sub={
                  screenOk()
                    ? screenOk()!.topApp
                      ? `most of it in ${screenOk()!.topApp}`
                      : 'nothing recorded yet today'
                    : screenExcuse()
                }
                tone={muted(!screenOk())}
                delay={440}
                onClick={() => props.onOpen('screen')}
                goes="Open Screen Time"
                hint="What the tracker measured in front of you today. Opens Screen Time."
              />

              <Widget
                icon={Ban}
                label="Distraction"
                value={screenOk() ? `${Math.round(screenOk()!.sharePct)}%` : '—'}
                sub={
                  screenOk()
                    ? `${humanDuration(screenOk()!.distraction)} of today`
                    : screenExcuse()
                }
                tone={muted(!screenOk())}
                delay={490}
                onClick={() => props.onOpen('screen')}
                goes="Open Screen Time"
                hint="The share of today's screen time spent in apps categorised as distractions."
              >
                <WidgetBar
                  pct={screenOk()?.sharePct ?? 0}
                  class="bg-[hsl(var(--destructive))]"
                />
              </Widget>

              <Widget
                icon={Trophy}
                label="Best day"
                value={data.bestDay() ? String(data.bestDay()?.by_mode?.[props.mode()] ?? 0) : '—'}
                sub={
                  data.bestDay()
                    ? `of ${DAY_TARGET} on ${shortDate(data.bestDay()!.date)}`
                    : 'no logged day this week'
                }
                tone={muted(!data.bestDay())}
                delay={540}
                hint="The highest Life score in the last seven days."
              />

              <Widget
                icon={Moon}
                label="Sleep window"
                value={`${data.sleep().bedtime}–${data.sleep().wake}`}
                sub={`${data.sleep().hours}h planned`}
                delay={590}
                hint="The sleep window set in your profile. It is a plan, not a measurement."
              />
            </>
          }
        >
          <Widget
            icon={FileText}
            label="Papers logged"
            value={String(papers().totalEntries)}
            sub={papers().totalEntries ? 'in the mark logbook' : 'log your first paper'}
            tone={muted(papers().totalEntries === 0)}
            delay={440}
            onClick={() => props.onOpen('db')}
            goes="Open the Database"
            hint="Every paper in the logbook, not just this week's. Opens the Database."
          />

          <Widget
            icon={TrendingDown}
            label="Marks lost"
            value={String(papers().totalMarksLost)}
            sub={papers().totalEntries ? 'across every paper' : 'nothing logged yet'}
            tone={papers().totalMarksLost > 0 ? 'text-[hsl(var(--destructive))]' : muted(true)}
            delay={490}
            onClick={() => props.onOpen('db')}
            goes="Open the Database"
            hint="Total marks dropped across the whole logbook."
          />

          <Widget
            icon={Percent}
            label="Average paper"
            value={papers().totalEntries ? `${papers().avgPaper}%` : '—'}
            sub={papers().totalEntries ? `over ${papers().totalEntries} papers` : 'nothing logged yet'}
            tone={muted(papers().totalEntries === 0)}
            delay={540}
            hint="The mean score across every paper in the logbook."
          >
            <WidgetBar
              pct={papers().avgPaper}
              class={
                papers().avgPaper >= 80
                  ? 'bg-success'
                  : papers().avgPaper >= 60
                    ? 'bg-warning'
                    : 'bg-[hsl(var(--destructive))]'
              }
            />
          </Widget>

          <Widget
            icon={AlertTriangle}
            label="Most common error"
            value={topReason()?.label ?? '—'}
            sub={topReason() ? topReason().right : 'no mistakes tagged yet'}
            tone={muted(!topReason())}
            delay={590}
            onClick={() => props.onOpen('report')}
            goes="Open the Report"
            hint={
              topReason()
                ? `${topReason().label} is your most frequent mistake type — ${topReason().right}.`
                : 'Tag a paper with a mistake reason to see this.'
            }
          />

          <Widget
            icon={BookMarked}
            label="Costliest chapter"
            value={topChapter()?.label ?? '—'}
            sub={topChapter() ? topChapter().right : 'no marks lost yet'}
            tone={muted(!topChapter())}
            delay={640}
            onClick={() => props.onOpen('report')}
            goes="Open the Report"
            hint={
              topChapter()
                ? `${topChapter().label} — ${topChapter().right}. Where revision time is worth the most.`
                : 'Log a paper with marks lost to see this.'
            }
          />

          <Widget
            icon={Eraser}
            label="Careless index"
            value={data.careless().anyLoss ? `${data.careless().pct}%` : '—'}
            sub={
              data.careless().anyLoss
                ? `${data.careless().marks} marks lost to slips`
                : 'no marks lost yet'
            }
            tone={muted(!data.careless().anyLoss)}
            delay={690}
            hint="Marks dropped on papers tagged Careless, as a share of every mark you have dropped. The part that costs nothing to fix."
          >
            <WidgetBar pct={data.careless().pct} class="bg-warning" />
          </Widget>
        </Show>
      </Band>

      <p class="flex-shrink-0 text-xs text-muted-foreground/70 text-center">
        Every tile opens the tab it came from. Charts, trends and paper analysis live in{' '}
        <button
          type="button"
          onClick={() => props.onOpen('report')}
          class="text-primary font-semibold hover:underline"
        >
          Report
        </button>
        .
      </p>
    </div>
  );
}

/**
 * One labelled row of the board.
 *
 * The heading is deliberately small and quiet: it groups the tiles without
 * competing with the numbers in them, which are the only thing on this page
 * anyone is here to read.
 */
function Band(props: {
  label: string;
  /** the grid, when this band is not the usual four across */
  cols?: string;
  /** a control that belongs to the whole band, e.g. "Open Report" */
  action?: JSX.Element;
  children: JSX.Element;
}) {
  return (
    <section class="flex flex-col gap-2">
      <div class="flex items-center justify-between gap-3">
        <h3 class="text-[0.625rem] font-bold uppercase tracking-[0.14em] text-muted-foreground/70 font-space">
          {props.label}
        </h3>
        {props.action}
      </div>
      <div class={`grid gap-3 items-stretch ${props.cols ?? 'grid-cols-2 lg:grid-cols-4'}`}>
        {props.children}
      </div>
    </section>
  );
}

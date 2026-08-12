import {
  Activity,
  AlertTriangle,
  Ban,
  BarChart3,
  BookMarked,
  Clock,
  Compass,
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
import {
  BoardCard,
  ContinueCard,
  DayStrip,
  InsightRow,
  ScoreHero,
  Spark,
  StatBlock,
  WeekChart,
  Widget,
  WidgetBar,
} from './widgets';

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
 * It is laid out in four bands, and they are deliberately **not** of equal
 * weight — that was the flaw in the first version of this board. Eleven
 * identical tiles meant the day score and the sleep window were drawn the same
 * size, so the page had no answer to "what am I looking at first?":
 *
 * - **Today** — the score as the anchor, at more than twice the type size of
 *   anything else, with the streak, the average and the week beside it.
 * - **Continue** — the one card that proposes rather than reports.
 * - **Right now** — one tile per track in the current mode, each showing the
 *   score *and* the raw fact behind it. Secondary weight: these are how today is
 *   going, not what today is worth.
 * - **What the data says** — the standing patterns, gathered into a single
 *   section rather than another row of identical cards, because a pattern drawn
 *   from the whole logbook should not compete with this morning's score.
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
          ? 'bar-primary'
          : score > 0
            ? 'bg-warning'
            : 'bg-border';

  const muted = (empty: boolean) => (empty ? 'text-subtle-foreground' : 'text-foreground');

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

  const openReport = (
    <button
      type="button"
      onClick={() => props.onOpen('report')}
      class="flex-shrink-0 h-9 px-3.5 rounded-xl bg-muted border border-border text-[0.75rem] font-semibold font-space flex items-center gap-2 text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors"
    >
      <BarChart3 size={14} />
      Open Report
    </button>
  );

  return (
    <div class="flex-1 flex flex-col gap-7 min-h-0">
      {/* ── Today ──────────────────────────────────────────────────────────── */}
      <Band label="Today">
        <ScoreHero
          icon={Target}
          label="Today’s score"
          value={data.todayScore()}
          max={DAY_TARGET}
          logged={data.logged()}
          status={
            data.logged()
              ? data.submitted()
                ? 'Submitted and locked'
                : 'Open — still editable'
              : 'Nothing logged yet today'
          }
          onOpen={() => props.onOpen('log')}
          goes="Open the Daily Log"
          hint={`Today's ${props.mode()} score, out of ${DAY_TARGET}. Opens the Daily Log.`}
          class="col-span-2"
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
          tone={data.streak().days > 0 ? 'text-primary' : 'text-subtle-foreground'}
          delay={60}
          hint="Days that cleared your study target, counted over your whole history."
        >
          <DayStrip days={data.recentDays()} targetHours={data.user().target_study_hours} />
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
              class="col-span-2 lg:col-span-1"
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
            class="col-span-2 lg:col-span-1"
          >
            <Spark
              data={data.sparks().study}
              max={Math.max(
                data.user().target_study_hours,
                ...data.sparks().study.map((v) => v ?? 0),
              )}
            />
          </Widget>
        </Show>

        <BoardCard
          icon={Activity}
          label="This week"
          delay={240}
          hint={`Each day's ${props.mode()} score out of ${DAY_TARGET}. A day with no log is drawn as a gap.`}
          class="col-span-2 lg:col-span-3"
        >
          <WeekChart days={data.week()} max={DAY_TARGET} />
        </BoardCard>
      </Band>

      {/* ── What to do next ────────────────────────────────────────────────── */}
      <Band label={academic() ? 'Continue studying' : 'Pick up where you left off'}>
        <ContinueCard
          icon={Compass}
          label={academic() ? 'Continue studying' : 'Still outstanding'}
          target={
            data.continuePick()
              ? { ...data.continuePick()!, onGo: () => props.onOpen(data.continuePick()!.goes) }
              : null
          }
          empty={{
            line: data.continueEmptyLine(),
            cta: 'Open Daily Log',
            onGo: () => props.onOpen('log'),
          }}
          delay={300}
          class="col-span-2 lg:col-span-4"
        />
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
              delay={440 + i() * 50}
              onClick={() => props.onOpen('log')}
              goes={`Log ${t.label} in the Daily Log`}
              hint={`${t.label} — ${t.hint}. Scored out of ${TRACK_TARGET}.`}
            >
              <WidgetBar pct={t.pct} class={barTone(t.score)} />
            </Widget>
          )}
        </For>

        {/* Academic has two tracks to Life's four; these two are the rest of
            "right now" in that mode, and they also square the row off. */}
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
            />
          </Widget>
        </Show>
      </Band>

      {/* ── What the data says ─────────────────────────────────────────────── */}
      <Section
        label={academic() ? 'What your papers say' : 'Where the day went'}
        sub={
          academic()
            ? 'What your performance data is telling you, across the whole logbook — not just this week.'
            : 'What the tracker measured, and what you planned.'
        }
        action={openReport}
      >
        <Show
          when={academic()}
          fallback={
            <>
              <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <StatBlock
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
                  onClick={() => props.onOpen('screen')}
                  goes="Open Screen Time"
                  hint="What the tracker measured in front of you today. Opens Screen Time."
                />

                <StatBlock
                  icon={Ban}
                  label="Distraction"
                  value={screenOk() ? `${Math.round(screenOk()!.sharePct)}%` : '—'}
                  sub={
                    screenOk() ? `${humanDuration(screenOk()!.distraction)} of today` : screenExcuse()
                  }
                  tone={muted(!screenOk())}
                  onClick={() => props.onOpen('screen')}
                  goes="Open Screen Time"
                  hint="The share of today's screen time spent in apps categorised as distractions."
                >
                  <WidgetBar pct={screenOk()?.sharePct ?? 0} class="bg-destructive" />
                </StatBlock>

                <StatBlock
                  icon={Trophy}
                  label="Best day"
                  value={data.bestDay() ? String(data.bestDay()?.by_mode?.[props.mode()] ?? 0) : '—'}
                  sub={
                    data.bestDay()
                      ? `of ${DAY_TARGET} on ${shortDate(data.bestDay()!.date)}`
                      : 'no logged day this week'
                  }
                  tone={muted(!data.bestDay())}
                  hint="The highest Life score in the last seven days."
                />

                <StatBlock
                  icon={Moon}
                  label="Sleep window"
                  value={`${data.sleep().bedtime}–${data.sleep().wake}`}
                  sub={`${data.sleep().hours}h planned`}
                  hint="The sleep window set in your profile. It is a plan, not a measurement."
                />
              </div>
            </>
          }
        >
          <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatBlock
              icon={FileText}
              label="Papers logged"
              value={String(papers().totalEntries)}
              sub={papers().totalEntries ? 'in the mark logbook' : 'log your first paper'}
              tone={muted(papers().totalEntries === 0)}
              onClick={() => props.onOpen('db')}
              goes="Open the Database"
              hint="Every paper in the logbook, not just this week's. Opens the Database."
            />

            <StatBlock
              icon={TrendingDown}
              label="Marks lost"
              value={String(papers().totalMarksLost)}
              sub={papers().totalEntries ? 'across every paper' : 'nothing logged yet'}
              tone={papers().totalMarksLost > 0 ? 'text-destructive' : 'text-subtle-foreground'}
              onClick={() => props.onOpen('db')}
              goes="Open the Database"
              hint="Total marks dropped across the whole logbook."
            />

            <StatBlock
              icon={Percent}
              label="Average paper"
              value={papers().totalEntries ? `${papers().avgPaper}%` : '—'}
              sub={
                papers().totalEntries ? `over ${papers().totalEntries} papers` : 'nothing logged yet'
              }
              tone={muted(papers().totalEntries === 0)}
              hint="The mean score across every paper in the logbook."
            >
              <WidgetBar
                pct={papers().avgPaper}
                class={
                  papers().avgPaper >= 80
                    ? 'bg-success'
                    : papers().avgPaper >= 60
                      ? 'bg-warning'
                      : 'bg-destructive'
                }
              />
            </StatBlock>

            <StatBlock
              icon={Eraser}
              label="Careless index"
              value={data.careless().anyLoss ? `${data.careless().pct}%` : '—'}
              sub={
                data.careless().anyLoss
                  ? `${data.careless().marks} marks lost to slips`
                  : 'no marks lost yet'
              }
              tone={muted(!data.careless().anyLoss)}
              hint="Marks dropped on papers tagged Careless, as a share of every mark you have dropped. The part that costs nothing to fix."
            >
              <WidgetBar pct={data.careless().pct} class="bg-warning" />
            </StatBlock>
          </div>

          {/* The two findings, as rows rather than tiles: both values are names,
              and a chapter title in a card's number slot truncates every time. */}
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <InsightRow
              icon={AlertTriangle}
              label="Most common error"
              value={topReason()?.label ?? 'Nothing tagged yet'}
              detail={topReason()?.right ?? '—'}
              tone={topReason() ? 'text-foreground' : 'text-subtle-foreground'}
              onClick={() => props.onOpen('report')}
              goes="Open the Report"
              hint={
                topReason()
                  ? `${topReason().label} is your most frequent mistake type — ${topReason().right}.`
                  : 'Tag a paper with a mistake reason to see this.'
              }
            />

            <InsightRow
              icon={BookMarked}
              label="Costliest chapter"
              value={topChapter()?.label ?? 'No marks lost yet'}
              detail={topChapter()?.right ?? '—'}
              tone={topChapter() ? 'text-foreground' : 'text-subtle-foreground'}
              onClick={() => props.onOpen('report')}
              goes="Open the Report"
              hint={
                topChapter()
                  ? `${topChapter().label} — ${topChapter().right}. Where revision time is worth the most.`
                  : 'Log a paper with marks lost to see this.'
              }
            />
          </div>
        </Show>
      </Section>

      <p class="flex-shrink-0 text-[0.75rem] text-subtle-foreground text-center">
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
 * The heading is deliberately quiet: it groups the cards without competing with
 * the numbers in them, which are the only thing on this page anyone is here to
 * read. The grid is always four columns wide on a large window and two below
 * that — cards that want more claim it with `col-span-*` themselves, so the
 * spans live next to the card they describe rather than in a lookup here.
 */
function Band(props: {
  label: string;
  /** a control that belongs to the whole band */
  action?: JSX.Element;
  children: JSX.Element;
}) {
  return (
    <section class="flex flex-col gap-3">
      <div class="flex items-center justify-between gap-3">
        <h3 class="text-[0.75rem] font-bold uppercase tracking-[0.12em] text-muted-foreground font-space">
          {props.label}
        </h3>
        {props.action}
      </div>
      <div class="grid gap-4 items-stretch grid-cols-2 lg:grid-cols-4">{props.children}</div>
    </section>
  );
}

/**
 * The analytics band: one bordered box, not another row of tiles.
 *
 * These numbers are drawn from the whole logbook rather than from today, and
 * they were previously indistinguishable from the day's own score — six
 * identical cards saying "this is exactly as urgent as everything above". The
 * container is the hierarchy: inside it the statistics can stay borderless and
 * quiet and still read as belonging together.
 */
function Section(props: {
  label: string;
  sub: string;
  action?: JSX.Element;
  children: JSX.Element;
}) {
  return (
    <section
      style={{ 'animation-delay': '520ms' }}
      class="animate-rise-in bg-card rounded-2xl border border-border card-shadow p-5 flex flex-col gap-4"
    >
      <div class="flex items-start justify-between gap-3 flex-wrap">
        <div class="min-w-0">
          <h3 class="text-[0.75rem] font-bold uppercase tracking-[0.12em] text-muted-foreground font-space">
            {props.label}
          </h3>
          <p class="text-[0.8125rem] text-subtle-foreground mt-1.5">{props.sub}</p>
        </div>
        {props.action}
      </div>
      {props.children}
    </section>
  );
}

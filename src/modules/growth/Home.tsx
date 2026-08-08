import { BarChart3, Clock, Flame, TrendingUp } from 'lucide-solid';
import { createSignal, For, onMount, Show } from 'solid-js';
import { Dynamic } from 'solid-js/web';

import type { AppMode, Streak } from '../../core/db';
import { DAY_TARGET, heat, MODE_META, TRACK_META } from '../../core/scoring';
import { HeadlineStat } from './parts';
import { createGrowthData } from './growthData';

interface HomeProps {
  mode: () => AppMode;
  /** takes you to the Report tab — the home page holds no charts of its own */
  onOpenReport: () => void;
}

/**
 * The home page: today, at a glance, and nothing else.
 *
 * This used to be the whole Growth Tracker — the headline plus a deck of eleven
 * charts — and it was several screens of scrolling before you had read a single
 * number. Every chart moved to the Report tab. What is left is the one question
 * the app is opened to answer: how is today going, and is the streak alive.
 *
 * It is built to fit one screen — and to *fill* it. In a narrow window the two
 * cards stack; from `xl` up they sit side by side, because a card stretched
 * across a 4K monitor is not more readable, only wider. Vertically the page is
 * a flex column that claims the whole pane — granted by the `flex-1` tab slot
 * in App.tsx — and hands the surplus to the two cards, which centre their
 * contents in it. Left to their natural height they sat in the top third of a
 * large monitor with a third of the window empty below them.
 *
 * Nothing is sized in a way that depends on that surplus existing: on a short
 * window the cards fall back to their content height and the pane scrolls.
 *
 * A fixed seven-day window is deliberate: the range switch belongs with the
 * charts it changes, and the streak is counted over the whole history anyway.
 * Strictly read-only, like the rest of the tracker.
 */
export default function Home(props: HomeProps) {
  const data = createGrowthData(props.mode, () => 7);
  const meta = () => MODE_META[props.mode()];

  return (
    <div class="flex-1 flex flex-col gap-4 min-h-0">
      <div class="flex-1 grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] items-stretch">
        {/* ── today's score and the week around it ───────────────────────── */}
        <section class="animate-rise-in relative overflow-hidden bg-card rounded-2xl border border-border card-shadow flex flex-col transition-colors hover:border-primary/25">
          {/* a soft echo of the page's top glow, so the headline reads as the
              brightest thing on the tab without needing a heavier border */}
          <div
            aria-hidden
            class="pointer-events-none absolute -top-24 -right-16 w-72 h-72 rounded-full bg-primary/10 blur-3xl"
          />

          <div class="relative flex-1 min-h-0 p-4 sm:p-5 flex flex-col gap-4">
            <div class="flex-shrink-0 flex items-start justify-between gap-3">
              <div class="min-w-0">
                <h3 class="text-lg font-bold font-space flex items-center gap-2">
                  <Dynamic component={meta().icon} size={18} class="text-primary flex-shrink-0" />{' '}
                  {meta().label} Progress
                </h3>
                <p class="text-xs text-muted-foreground mt-0.5">
                  Today and the last 7 days, from your Daily Log.
                </p>
              </div>
              <button
                type="button"
                onClick={props.onOpenReport}
                class="flex-shrink-0 h-9 px-3 rounded-xl bg-muted border border-border text-xs font-semibold font-space flex items-center gap-2 text-muted-foreground hover:text-primary hover:border-primary/40 hover:-translate-y-px active:translate-y-0 transition-all"
              >
                <BarChart3 size={14} />
                <span class="hidden sm:inline">Open Report</span>
              </button>
            </div>

            {/* Vertically centred rather than pinned under the heading: on a
                tall window the surplus becomes even air above and below the
                ring instead of a void at the foot of the card. The stat column
                is capped so that past ~34rem the pills stop growing and the row
                simply centres, rather than a 900px box holding "0". */}
            <div class="flex-1 flex items-center justify-center flex-wrap gap-4 sm:gap-5">
              <ScoreRing value={data.todayScore()} max={DAY_TARGET} />
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 flex-1 min-w-[13rem] max-w-[34rem]">
                <HeadlineStat
                  icon={TrendingUp}
                  label="7-day avg"
                  value={data.avgScore()}
                  sub={`of ${DAY_TARGET}`}
                />
                <HeadlineStat
                  icon={Clock}
                  label="Hours logged"
                  value={data.totalStudy()}
                  sub="last 7d"
                />
              </div>
            </div>
          </div>

          {/* today's per-track scores. A grid rather than a scrolling strip:
              two tracks stretched across a wide card looked like a mistake, and
              a narrow window had to swipe sideways to see the fourth. */}
          <div class="relative flex-shrink-0 border-t border-border px-4 sm:px-5 py-3 grid grid-cols-2 lg:grid-cols-3 gap-2">
            <For each={data.modeTracks()}>
              {(id, i) => {
                const score = () => data.today()?.scores?.[id] ?? 0;
                return (
                  <div
                    title={`${TRACK_META[id].label} · ${TRACK_META[id].hint}`}
                    style={{ 'animation-delay': `${120 + i() * 45}ms` }}
                    class={`animate-rise-in px-2.5 py-2 rounded-xl border flex items-center gap-2 min-w-0 transition-transform hover:-translate-y-px ${heat(
                      score(),
                    )}`}
                  >
                    <Dynamic
                      component={TRACK_META[id].icon}
                      size={13}
                      class="opacity-70 flex-shrink-0"
                    />
                    <span class="text-[0.6875rem] uppercase tracking-wider opacity-80 truncate flex-1">
                      {TRACK_META[id].label}
                    </span>
                    <span class="text-base font-bold font-mono leading-none">
                      {Math.round(score())}
                    </span>
                  </div>
                );
              }}
            </For>
          </div>
        </section>

        <StreakCard
          streak={data.streak()}
          recent={data.recentDays()}
          targetHours={data.user().target_study_hours}
          todayHours={data.academic().gate.studyHours}
        />
      </div>

      <p class="flex-shrink-0 text-xs text-muted-foreground/70 text-center">
        Charts, trends and paper analysis all live in{' '}
        <button
          type="button"
          onClick={props.onOpenReport}
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
 * The streak, counted in days that cleared the study target.
 *
 * The number alone says very little, so it comes with the two things that make
 * it mean something: the best run to date, and whether today has been earned
 * yet. Today missing does not break the count — the streak stands on yesterday
 * until the hours are in — so the card says plainly what is still owed.
 *
 * The fortnight strip carries no per-day letters. Fourteen labels are illegible
 * in a narrow column and were never the point; the ends are captioned, and
 * hovering any block names its date in full.
 */
function StreakCard(props: {
  streak: Streak;
  recent: { date: string; hit: boolean; fullLabel: string }[];
  targetHours: number;
  todayHours: number;
}) {
  const remaining = () =>
    Math.max(0, Math.round((props.targetHours - props.todayHours) * 10) / 10);
  const alive = () => props.streak.days > 0;

  return (
    <section
      style={{ 'animation-delay': '80ms' }}
      class="animate-rise-in bg-card rounded-2xl border border-border card-shadow p-4 sm:p-5 flex flex-col gap-3.5 h-full transition-colors hover:border-primary/25"
    >
      <div class="flex-shrink-0 flex items-center gap-3.5">
        <div
          class={`w-12 h-12 flex-shrink-0 rounded-2xl border flex items-center justify-center ${
            alive() ? 'bg-orange-500/10 border-orange-500/30' : 'bg-muted border-border'
          }`}
        >
          <Flame size={24} class={alive() ? 'text-orange-400' : 'text-muted-foreground/50'} />
        </div>
        <div class="min-w-0 flex-1">
          <p class="font-space font-bold leading-none">
            <span class="text-3xl">{props.streak.days}</span>{' '}
            <span class="text-sm text-muted-foreground font-normal">
              day{props.streak.days === 1 ? '' : 's'}
            </span>
          </p>
          <p class="text-xs uppercase tracking-wider text-muted-foreground font-bold mt-1">
            Study streak
          </p>
        </div>
        <div class="text-right flex-shrink-0">
          <p class="text-xs text-muted-foreground uppercase tracking-wider">Best</p>
          <p class="font-mono font-bold">
            {props.streak.best}
            <span class="text-xs text-muted-foreground font-normal">
              {' '}
              day{props.streak.best === 1 ? '' : 's'}
            </span>
          </p>
        </div>
      </div>

      {/* The strip is what absorbs the card's spare height: the blocks grow
          taller with the window instead of leaving a gap under them, up to a
          ceiling past which a fortnight of bars stops reading as a strip and
          starts reading as a chart it is not. */}
      <div class="flex-1 min-h-0 flex flex-col justify-center gap-1">
        <div class="flex items-stretch gap-1 flex-1 min-h-[1.75rem] max-h-[8rem]">
          <For each={props.recent}>
            {(d, i) => (
              <div
                title={`${d.fullLabel} — ${
                  d.hit ? `${props.targetHours}h target cleared` : 'target missed'
                }`}
                style={{ 'animation-delay': `${140 + i() * 25}ms` }}
                class={`animate-rise-in flex-1 min-w-0 rounded-md border transition-colors ${
                  d.hit
                    ? 'bg-orange-500/25 border-orange-500/40 hover:bg-orange-500/40'
                    : 'bg-muted/40 border-border hover:bg-muted'
                }`}
              />
            )}
          </For>
        </div>
        <div class="flex justify-between text-[0.5625rem] text-muted-foreground font-mono">
          <span>14 days ago</span>
          <span>Today</span>
        </div>
      </div>

      <p class="flex-shrink-0 text-xs text-muted-foreground">
        <Show
          when={props.streak.today_done}
          fallback={
            <>
              <span class="text-foreground font-semibold">
                {props.todayHours}h of {props.targetHours}h
              </span>{' '}
              today · {remaining()}h more keeps the streak alive.
            </>
          }
        >
          <>
            Today is in — <span class="text-foreground font-semibold">streak safe</span>.
          </>
        </Show>
      </p>
    </section>
  );
}

/**
 * The day's score as a ring rather than a filled box.
 *
 * A box coloured by `heat` told you the score twice — once as a number and once
 * as a colour — but never showed how far through the day's target you were. The
 * ring does, and it keeps the mode accent instead of turning the brightest
 * element on the page red on a slow morning.
 */
function ScoreRing(props: { value: number; max: number }) {
  const R = 42;
  const CIRCUMFERENCE = 2 * Math.PI * R;
  const target = () => (props.max > 0 ? Math.max(0, Math.min(1, props.value / props.max)) : 0);

  // The arc already animates whenever the score changes, but on the first paint
  // it was simply *there*. Holding it at zero for a frame lets the same
  // transition draw it in when the tab opens.
  const [drawn, setDrawn] = createSignal(false);
  onMount(() => requestAnimationFrame(() => setDrawn(true)));
  const fraction = () => (drawn() ? target() : 0);

  return (
    <div class="relative w-24 h-24 2xl:w-28 2xl:h-28 flex-shrink-0">
      <svg viewBox="0 0 100 100" class="w-full h-full -rotate-90">
        <circle cx="50" cy="50" r={R} fill="none" stroke="hsl(var(--muted))" stroke-width="9" />
        {/* A round cap on a zero-length arc still paints a dot, which read as
            "something is logged" on a blank day — so at zero, draw nothing. */}
        <Show when={fraction() > 0}>
          <circle
            cx="50"
            cy="50"
            r={R}
            fill="none"
            stroke="hsl(var(--primary))"
            stroke-width="9"
            stroke-linecap="round"
            stroke-dasharray={`${fraction() * CIRCUMFERENCE} ${CIRCUMFERENCE}`}
            class="transition-all duration-700 ease-out"
          />
        </Show>
      </svg>
      <div class="absolute inset-0 flex flex-col items-center justify-center">
        <span class="text-[0.625rem] uppercase tracking-wider text-muted-foreground leading-none">
          Today
        </span>
        <span class="text-2xl 2xl:text-3xl font-bold font-space leading-tight">{props.value}</span>
        <span class="text-[0.625rem] text-muted-foreground font-mono leading-none">
          of {props.max}
        </span>
      </div>
    </div>
  );
}

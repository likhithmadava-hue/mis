import { confirm } from '@tauri-apps/plugin-dialog';
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Clock,
  Layers,
  Loader2,
  MonitorPlay,
  Pause,
  Play,
  Repeat,
  Trash2,
} from 'lucide-solid';
import { createMemo, createResource, createSignal, For, onCleanup, Show } from 'solid-js';

import { isoDaysAgo, todayIso } from '../../core/dates';
import { api, errorMessage, type CompactDay, type TrackerStatus } from '../../core/db';
import { Card, Donut, EmptyChart } from '../../core/ui';
import AppList from './AppList';
import Timeline from './Timeline';
import { asCategory, CATEGORIES, CATEGORY_COLOR, clockOf, humanise } from './format';

/** how often today's figures refresh while the tab is open */
const REFRESH_MS = 15_000;

const WEEK = 7;

const shiftDay = (day: string, by: number) => {
  const [y, m, d] = day.split('-').map(Number);
  const date = new Date(y, m - 1, d + by);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`;
};

const prettyDay = (day: string) => {
  if (day === todayIso()) return 'Today';
  if (day === isoDaysAgo(1)) return 'Yesterday';
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString([], {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
};

/**
 * The Screen Time tab.
 *
 * Everything on this screen is measured by the tracker in `screentime/` — the
 * foreground window, sampled every few seconds, with idle time excluded. None
 * of it is typed in, and none of it is inferred.
 *
 * The tab is only as truthful as the tracker is present, so its first job is to
 * ask [`api.stAvailability`] and say clearly when nothing was watching. **An
 * empty chart and "you used nothing" look identical, and only one of them is
 * ever true.**
 */
export default function ScreenTime() {
  const [day, setDay] = createSignal(todayIso());
  /** bumped to force a refetch after a pause, a recategorise, or a delete */
  const [tick, setTick] = createSignal(0);
  const refresh = () => setTick((n) => n + 1);

  const [availability] = createResource(() => api.stAvailability());
  const [status, { refetch: refetchStatus }] = createResource(
    () => ({ tick: tick() }),
    () => api.stStatus(),
  );
  const [summary] = createResource(
    () => ({ day: day(), tick: tick() }),
    ({ day }) => api.stDay(day),
  );
  const [week] = createResource(() => ({ tick: tick() }), () => api.stRange(WEEK));

  const onToday = () => day() === todayIso();

  // Today keeps ticking while you watch it; a past day is finished and static,
  // so there is nothing to poll for.
  const poller = setInterval(() => {
    if (onToday()) refresh();
  }, REFRESH_MS);
  onCleanup(() => clearInterval(poller));

  const total = () => summary()?.total_seconds ?? 0;
  const paused = () => status()?.paused ?? false;

  const categoryOf = (app: string) =>
    asCategory(summary()?.by_app.find((r) => r.app === app)?.category);

  const segments = createMemo(() =>
    CATEGORIES.map((c) => ({
      label: c[0].toUpperCase() + c.slice(1),
      value: Math.round((summary()?.by_category[c] ?? 0) / 60),
      color: CATEGORY_COLOR[c],
    })).filter((s) => s.value > 0),
  );

  const failure = () => summary.error ?? week.error ?? status.error;

  return (
    <Show
      when={availability()?.available !== false}
      fallback={<NotWatching reason={availability()?.reason ?? ''} />}
    >
      <Show
        when={!availability.loading && !summary.loading}
        fallback={
          <div class="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
            <Loader2 size={14} class="animate-spin" /> Reading today’s screen time…
          </div>
        }
      >
        <Show
          when={!failure()}
          fallback={
            <Card title="Screen time unavailable" icon={AlertTriangle}>
              <p class="text-sm text-muted-foreground leading-relaxed">
                The tracker did not answer:{' '}
                <span class="font-mono text-xs select-text">{errorMessage(failure())}</span>
              </p>
              <button
                onClick={refresh}
                class="h-8 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-semibold font-space"
              >
                Try again
              </button>
            </Card>
          }
        >
          <div class="space-y-6">
            {/* ── the day, and how much of it ── */}
            <div class="bg-card rounded-2xl border border-border card-shadow p-5 sm:p-6">
              <div class="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div class="flex items-center gap-2">
                    <button
                      onClick={() => setDay(shiftDay(day(), -1))}
                      title="Previous day"
                      aria-label="Previous day"
                      class="p-1 rounded-lg text-muted-foreground hover:text-primary transition-colors"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <span class="text-xs font-semibold font-space uppercase tracking-wider text-muted-foreground">
                      {prettyDay(day())}
                    </span>
                    <button
                      onClick={() => setDay(shiftDay(day(), 1))}
                      disabled={onToday()}
                      title="Next day"
                      aria-label="Next day"
                      class="p-1 rounded-lg text-muted-foreground hover:text-primary transition-colors disabled:opacity-25 disabled:hover:text-muted-foreground"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                  <p class="text-4xl font-bold font-space tracking-tight mt-1">
                    {humanise(total())}
                  </p>
                  <p class="text-xs text-muted-foreground mt-1">
                    at the keyboard
                    <Show when={status()}>
                      {(s) => `, idle over ${Math.round(s().idle_after_seconds)}s not counted`}
                    </Show>
                  </p>
                </div>

                <div class="flex items-center gap-2">
                  <StatusPill status={status()} />
                  <button
                    onClick={async () => {
                      await api.stSetPaused(!paused());
                      void refetchStatus();
                      refresh();
                    }}
                    class="h-9 px-3 rounded-xl bg-muted border border-border text-xs font-semibold font-space flex items-center gap-2 hover:border-primary/40 transition-colors"
                  >
                    <Show when={paused()} fallback={<Pause size={13} />}>
                      <Play size={13} />
                    </Show>
                    {paused() ? 'Resume' : 'Pause'}
                  </button>
                </div>
              </div>
            </div>

            <Show
              when={total() > 0}
              fallback={
                <Card title="Nothing recorded" subtitle={prettyDay(day())} icon={MonitorPlay}>
                  <EmptyChart
                    message={
                      onToday()
                        ? 'Nothing yet today. Anything you do while MIS is open will appear here.'
                        : 'No screen time was recorded on this day — MIS was closed, or the tracker was paused.'
                    }
                  />
                </Card>
              }
            >
              <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card title="How it split" subtitle="minutes, by category" icon={Layers}>
                  <Donut
                    segments={segments()}
                    centerValue={humanise(total())}
                    centerLabel={prettyDay(day())}
                  />
                </Card>

                <Card
                  title="Shape of the day"
                  subtitle="focus, and how often it broke"
                  icon={Repeat}
                >
                  <div class="grid grid-cols-2 gap-4">
                    <Stat
                      label="Longest unbroken stretch"
                      value={
                        summary()?.longest_stretch
                          ? humanise(summary()!.longest_stretch!.seconds)
                          : '—'
                      }
                      sub={
                        summary()?.longest_stretch
                          ? `${summary()!.longest_stretch!.app} · from ${clockOf(
                              summary()!.longest_stretch!.start,
                            )}`
                          : 'nothing long enough to count'
                      }
                    />
                    <Stat
                      label="Window switches"
                      value={String(summary()?.switches ?? 0)}
                      sub={
                        summary()
                          ? `about one every ${humanise(
                              total() / Math.max(1, summary()!.switches),
                            )}`
                          : ''
                      }
                    />
                  </div>
                </Card>
              </div>

              <Card
                title="Where the time went"
                subtitle="click an app to see the windows behind its total"
                icon={MonitorPlay}
              >
                <AppList
                  rows={summary()?.by_app ?? []}
                  total={total()}
                  onCategory={async (app, category) => {
                    await api.stSetCategory(app, category);
                    refresh();
                  }}
                />
              </Card>

              <Card
                title="The day, end to end"
                subtitle="gaps are idle, or MIS closed"
                icon={Clock}
              >
                <Timeline blocks={summary()?.timeline ?? []} categoryOf={categoryOf} />
              </Card>
            </Show>

            <Card title="Last 7 days" subtitle="stacked by category" icon={Layers}>
              <WeekBars days={week() ?? []} onPick={setDay} selected={day()} />
            </Card>

            <Privacy day={day()} onDone={refresh} />
          </div>
        </Show>
      </Show>
    </Show>
  );
}

function Stat(props: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <p class="text-[0.6875rem] uppercase tracking-wider text-muted-foreground font-space">
        {props.label}
      </p>
      <p class="text-2xl font-bold font-space mt-1">{props.value}</p>
      <Show when={props.sub}>
        <p class="text-[0.6875rem] text-muted-foreground mt-0.5 truncate">{props.sub}</p>
      </Show>
    </div>
  );
}

function StatusPill(props: { status: TrackerStatus | undefined }) {
  const running = () => props.status?.running;
  const paused = () => props.status?.paused;

  const tone = () =>
    !running()
      ? 'text-muted-foreground border-border'
      : paused()
        ? 'text-[hsl(var(--warning))] border-[hsl(var(--warning))]/40'
        : 'text-[hsl(var(--success))] border-[hsl(var(--success))]/40';

  return (
    <span
      class={`h-9 px-3 rounded-xl border bg-background text-xs font-semibold font-space flex items-center gap-2 ${tone()}`}
    >
      <span class="w-1.5 h-1.5 rounded-full bg-current" />
      {!running() ? 'Tracker stopped' : paused() ? 'Paused' : 'Recording'}
    </span>
  );
}

/**
 * Seven stacked bars.
 *
 * Not the shared `BarChart`: that one draws a single value per column, and the
 * question this answers — whether the study share is growing — only shows up in
 * the split.
 */
function WeekBars(props: { days: CompactDay[]; selected: string; onPick: (day: string) => void }) {
  const max = () => Math.max(...props.days.map((d) => d.total_seconds), 1);

  return (
    <Show
      when={props.days.length > 0}
      fallback={<EmptyChart message="No days recorded yet." />}
    >
      <div class="w-full">
        <div class="flex items-end gap-1.5 w-full" style={{ height: '150px' }}>
          <For each={props.days}>
            {(d) => (
              <button
                onClick={() => props.onPick(d.day)}
                title={`${prettyDay(d.day)} — ${humanise(d.total_seconds)}`}
                class="flex-1 h-full flex flex-col justify-end min-w-0 group"
              >
                <div
                  class={`w-full rounded-t-md overflow-hidden flex flex-col-reverse transition-opacity group-hover:opacity-80 ${
                    d.day === props.selected
                      ? 'ring-2 ring-primary ring-offset-2 ring-offset-card'
                      : ''
                  }`}
                  style={{
                    height: `${Math.max(
                      (d.total_seconds / max()) * 100,
                      d.total_seconds > 0 ? 3 : 1,
                    )}%`,
                  }}
                >
                  <For each={CATEGORIES}>
                    {(c) => (
                      <Show when={(d.by_category[c] ?? 0) > 0}>
                        <div
                          style={{
                            height: `${
                              ((d.by_category[c] ?? 0) / Math.max(1, d.total_seconds)) * 100
                            }%`,
                            background: CATEGORY_COLOR[c],
                          }}
                        />
                      </Show>
                    )}
                  </For>
                </div>
              </button>
            )}
          </For>
        </div>
        <div class="flex gap-1.5 mt-2">
          <For each={props.days}>
            {(d) => (
              <span class="text-[0.5625rem] text-muted-foreground font-mono flex-1 text-center truncate">
                {d.day.slice(5)}
              </span>
            )}
          </For>
        </div>
      </div>
    </Show>
  );
}

/**
 * Deleting is part of the feature, not a footnote.
 *
 * A record of every program someone opened is worth keeping only for as long as
 * they want it kept, so the way out is on the same screen as the data — not
 * buried in a settings page where you would have to already know it existed.
 */
function Privacy(props: { day: string; onDone: () => void }) {
  const [busy, setBusy] = createSignal(false);

  const run = async (title: string, question: string, fn: () => Promise<unknown>) => {
    if (!(await confirm(question, { title, kind: 'warning' }))) return;
    setBusy(true);
    try {
      await fn();
      props.onDone();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div class="bg-card rounded-2xl border border-border card-shadow p-5 flex flex-wrap items-center justify-between gap-4">
      <p class="text-xs text-muted-foreground leading-relaxed max-w-xl">
        Screen time is recorded only while MIS is open, kept encrypted on this computer, and never
        sent anywhere.
      </p>
      <div class="flex gap-2 flex-shrink-0">
        <button
          disabled={busy()}
          onClick={() =>
            void run(
              'Forget this day',
              `Delete the screen time recorded on ${props.day}?`,
              () => api.stForget(props.day),
            )
          }
          class="h-8 px-3 rounded-lg bg-muted border border-border text-xs font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5"
        >
          <Trash2 size={13} /> Forget this day
        </button>
        <button
          disabled={busy()}
          onClick={() =>
            void run(
              'Forget everything',
              'Delete every day of screen time MIS has recorded? This cannot be undone.',
              () => api.stForget(),
            )
          }
          class="h-8 px-3 rounded-lg bg-muted border border-border text-xs font-medium text-[hsl(var(--destructive))] hover:border-[hsl(var(--destructive))]/40 transition-colors flex items-center gap-1.5"
        >
          <Trash2 size={13} /> Forget everything
        </button>
      </div>
    </div>
  );
}

/**
 * Shown when nothing is recording.
 *
 * The old version of this card was three paragraphs explaining that MIS had to
 * be started through the desktop shortcut so the Python host would run, with
 * two alternative commands to try. None of that is true any more — the tracker
 * lives inside the app and starts with the window. The only cases left are a
 * machine that cannot watch the foreground window at all, and a tracker that
 * failed to start, so the card simply prints the sentence Rust sent.
 */
function NotWatching(props: { reason: string }) {
  return (
    <Card title="Nothing is watching" icon={MonitorPlay}>
      <div class="space-y-3 text-sm text-muted-foreground leading-relaxed">
        <p class="text-foreground font-medium">{props.reason}</p>
        <p>
          There is nothing to show rather than nothing to report — an empty chart here would read
          as a day you spent no time at the keyboard, which is not what happened.
        </p>
      </div>
    </Card>
  );
}

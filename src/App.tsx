import {
  BarChart3,
  CalendarCheck,
  Database,
  Dices,
  House,
  MonitorPlay,
  PanelLeftClose,
  PanelLeftOpen,
  Quote,
  Sprout,
  Timer,
} from 'lucide-solid';
import { createEffect, createSignal, For, Match, Show, Switch } from 'solid-js';
import { Dynamic } from 'solid-js/web';

import { db, MODES, setMode, type AppMode } from './core/db';
import { MODE_META } from './core/scoring';
import { createRailTooltip, type Icon } from './core/ui';
import { DatabaseExplorer } from './modules/database';
import { FocusTimer } from './modules/focus';
import { Home, Report } from './modules/growth';
import { DailyLog } from './modules/log';
import { ScreenTime } from './modules/screentime';

/**
 * Home leads — the Focus Timer is deliberately not the landing tab.
 *
 * Home and Report were one tab until the tracker outgrew a single screen. Home
 * is today's numbers and the streak, nothing you have to scroll for; Report is
 * where every chart lives. Splitting them is what lets each page be short.
 *
 * `modes` decides which tabs exist in which mode. The Database is an exam-paper
 * archive and the Focus Timer credits its minutes to `study_hours`, so both are
 * Academic-only. Screen Time lives in Life instead: it watches everything in
 * front of you, not just study apps, so it answers "where did the time
 * actually go" rather than "where did the study time go".
 *
 * Screen Time is new to the shell. The tab was fully built in the old app and
 * never wired in, because it needed the Python host to be running and the shell
 * had no way to know whether it was. The tracker now starts with the window, so
 * there is nothing left to be unsure about.
 */
const TABS = [
  { id: 'home', label: 'Home', icon: House, modes: ['academic', 'life'] },
  { id: 'log', label: 'Daily Log', icon: CalendarCheck, modes: ['academic', 'life'] },
  { id: 'report', label: 'Report', icon: BarChart3, modes: ['academic', 'life'] },
  { id: 'db', label: 'Database', icon: Database, modes: ['academic'] },
  { id: 'screen', label: 'Screen Time', icon: MonitorPlay, modes: ['life'] },
  { id: 'focus', label: 'Focus Timer', icon: Timer, modes: ['academic'] },
] as const satisfies readonly {
  id: string;
  label: string;
  icon: Icon;
  modes: readonly AppMode[];
}[];

type TabId = (typeof TABS)[number]['id'];

const QUOTES = [
  {
    text: 'A quiet lab for your mind. Capture every slip, watch the patterns surface, sharpen the next attempt.',
    author: 'MIS',
  },
  { text: 'The secret of getting ahead is getting started.', author: 'Mark Twain' },
  { text: 'It always seems impossible until it is done.', author: 'Nelson Mandela' },
  {
    text: 'Success is the sum of small efforts, repeated day in and day out.',
    author: 'Robert Collier',
  },
  { text: 'Don’t watch the clock; do what it does. Keep going.', author: 'Sam Levenson' },
  { text: 'A little progress each day adds up to big results.', author: 'Satya Nani' },
  { text: 'The expert in anything was once a beginner.', author: 'Helen Hayes' },
  { text: 'Push yourself, because no one else is going to do it for you.', author: 'Unknown' },
  { text: 'Great things never come from comfort zones.', author: 'Unknown' },
  { text: 'Strive for progress, not perfection.', author: 'Unknown' },
  { text: 'Your future is created by what you do today, not tomorrow.', author: 'Robert Kiyosaki' },
];

// same quote all day, a new one tomorrow (day-of-year picks the index)
const dayOfYear = Math.floor(
  (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000,
);

const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
};

/**
 * The shell: the rail, the heading, and whichever tab is open.
 *
 * There is no auth gate and no loading state. The old `App` had both — a spinner
 * while a session was worked out, then either a login screen or the workspace,
 * with a large commented-out block explaining how to switch accounts back on.
 * MIS is device-only: the vault is sealed to this Windows account and nothing
 * leaves the machine. If accounts ever come back they will be a new decision
 * with a new design, not a block waiting to be uncommented — so the dead code is
 * gone rather than carried.
 *
 * There is also no `triggerUpdate` counter. Every tab used to take one and
 * re-read the database when it changed; now they all read the same reactive
 * store, and a habit ticked in the Daily Log is in the Growth Tracker's numbers
 * before the click finishes. See `core/db/store.ts`.
 */
export default function App() {
  const [activeTab, setActiveTab] = createSignal<TabId>('home');
  const [navCollapsed, setNavCollapsed] = createSignal(false);
  const [quoteIndex, setQuoteIndex] = createSignal(dayOfYear % QUOTES.length);

  // Collapsed, every rail button is a bare icon — this is what says which is
  // which. It stays silent while the labels are on screen.
  const railTip = createRailTooltip(navCollapsed);

  const mode = () => db.app_mode;

  // Drives the `:root[data-mode='life']` token overrides in index.css. This one
  // line is the whole of how the app retints: every accent resolves through
  // --primary, so nothing else has to know the mode changed.
  createEffect(() => {
    document.documentElement.dataset.mode = mode();
  });

  const visibleTabs = () => TABS.filter((t) => (t.modes as readonly AppMode[]).includes(mode()));

  const switchMode = async (next: AppMode) => {
    await setMode(next);
    // The current tab may not exist in the new mode — fall back to the landing
    // tab rather than rendering nothing.
    const stillThere = TABS.some(
      (t) => t.id === activeTab() && (t.modes as readonly AppMode[]).includes(next),
    );
    if (!stillThere) setActiveTab('home');
  };

  const shuffleQuote = () =>
    setQuoteIndex(
      (i) => (i + 1 + Math.floor(Math.random() * (QUOTES.length - 1))) % QUOTES.length,
    );

  const quote = () => QUOTES[quoteIndex()];
  const activeLabel = () => TABS.find((t) => t.id === activeTab())?.label;

  return (
    /* From sm up the window itself never scrolls: the shell is exactly one
       viewport tall and the content pane scrolls inside it, so the rail and the
       page heading stay put at every window size. Below that the document
       scrolls normally. `dvh` rather than `vh` so a resized window never cuts
       the last card off. */
    <div class="min-h-[100dvh] sm:h-[100dvh] sm:overflow-hidden flex flex-col sm:flex-row">
      {/* Collapse only applies from sm up. In a narrow window this is a stacked
          header — brand and mode switch on one row, the tab strip beneath —
          because six tab labels plus the mode toggle cannot share one row. */}
      <aside
        class={`flex-shrink-0 bg-sidebar border-b sm:border-b-0 sm:border-r border-border flex flex-col sm:justify-between sm:overflow-y-auto px-4 py-3 sm:py-6 gap-3 sm:gap-0 transition-[width] duration-200 ${
          navCollapsed() ? 'sm:w-[4.75rem] sm:px-3' : 'sm:w-60'
        }`}
      >
        <div class="min-w-0">
          <div class="flex items-center justify-between gap-3 sm:block">
            <div
              class={`flex items-center gap-3 sm:mb-8 ${
                navCollapsed() ? 'sm:justify-center' : ''
              }`}
            >
              <div class="w-10 h-10 flex-shrink-0 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center glow-primary">
                <Sprout class="text-primary" size={20} />
              </div>
              <div class={navCollapsed() ? 'sm:hidden' : ''}>
                <h1 class="text-lg font-bold font-space tracking-tight leading-tight">MIS</h1>
                <p class="text-[0.625rem] text-muted-foreground font-medium">
                  {MODE_META[mode()].tagline}
                </p>
              </div>
            </div>

            <div
              class={`flex flex-shrink-0 bg-background p-1 rounded-lg border border-border gap-1 sm:mb-6 ${
                navCollapsed() ? 'sm:flex-col' : ''
              }`}
            >
              <For each={MODES}>
                {(m) => {
                  const hint = `${MODE_META[m].label} — ${MODE_META[m].blurb}`;
                  return (
                    <button
                      onClick={() => void switchMode(m)}
                      // expanded, the label is on the button and the blurb is at
                      // the foot of the rail; collapsed, the rail tooltip carries
                      // it instead — so only one of the two is ever armed
                      title={navCollapsed() ? undefined : hint}
                      aria-label={MODE_META[m].label}
                      {...railTip.trigger(hint)}
                      class={`flex-1 px-2 py-1.5 rounded-md text-[0.6875rem] font-semibold font-space uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5 ${
                        mode() === m
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <Dynamic component={MODE_META[m].icon} size={13} />
                      <span class={navCollapsed() ? 'sm:hidden' : ''}>{MODE_META[m].label}</span>
                    </button>
                  );
                }}
              </For>
            </div>
          </div>

          {/* the tab strip scrolls sideways in a narrow window instead of
              squeezing every label into one row; from sm up it is the rail */}
          <nav class="flex sm:flex-col gap-1 overflow-x-auto sm:overflow-visible -mx-4 px-4 sm:mx-0 sm:px-0">
            <For each={visibleTabs()}>
              {(tab) => (
                <button
                  onClick={() => setActiveTab(tab.id)}
                  aria-label={tab.label}
                  aria-current={activeTab() === tab.id ? 'page' : undefined}
                  {...railTip.trigger(tab.label)}
                  class={`py-2.5 rounded-xl text-sm font-medium flex flex-shrink-0 items-center gap-2.5 whitespace-nowrap transition-colors text-left ${
                    navCollapsed() ? 'px-3 sm:px-0 sm:justify-center' : 'px-3'
                  } ${
                    activeTab() === tab.id
                      ? 'bg-accent text-primary'
                      : 'text-muted-foreground hover:text-foreground hover:bg-sidebar-accent'
                  }`}
                >
                  <Dynamic component={tab.icon} size={16} class="flex-shrink-0" />
                  <span class={navCollapsed() ? 'sm:hidden' : ''}>{tab.label}</span>
                </button>
              )}
            </For>

            {/* sits directly under the last tab so it reads as part of the rail
                — hidden in a narrow window, where the bar is horizontal and
                never collapses */}
            <button
              onClick={() => setNavCollapsed((c) => !c)}
              title={navCollapsed() ? undefined : 'Collapse sidebar'}
              aria-label={navCollapsed() ? 'Expand sidebar' : 'Collapse sidebar'}
              aria-expanded={!navCollapsed()}
              {...railTip.trigger('Expand sidebar')}
              class={`hidden sm:flex py-2.5 rounded-xl text-sm font-medium items-center gap-2.5 whitespace-nowrap transition-colors text-left text-muted-foreground hover:text-foreground hover:bg-sidebar-accent ${
                navCollapsed() ? 'px-3 sm:px-0 sm:justify-center' : 'px-3'
              }`}
            >
              <Show
                when={navCollapsed()}
                fallback={<PanelLeftClose size={16} class="flex-shrink-0" />}
              >
                <PanelLeftOpen size={16} class="flex-shrink-0" />
              </Show>
              <span class={navCollapsed() ? 'sm:hidden' : ''}>Collapse</span>
            </button>
          </nav>
        </div>

        {/* the mode blurb is wide-window only — in the stacked header there is
            no column to sit at the bottom of, and the tagline under the logo
            already says the same thing */}
        <div class="flex-shrink-0 hidden sm:block">
          <Show when={!navCollapsed()}>
            <p class="hidden sm:block text-[0.625rem] text-muted-foreground/70 italic leading-relaxed sm:mb-3">
              {MODE_META[mode()].blurb}
            </p>
          </Show>
        </div>

        {/* one tooltip for the whole rail — it portals to <body>, so the rail's
            own `overflow-y-auto` cannot clip it */}
        <railTip.Tooltip />
      </aside>

      {/* `main` is the scroll container so the scrollbar sits against the window
          edge rather than halfway across a wide monitor; the column inside it is
          what carries the reading width, and mx-auto centres that column instead
          of pinning it to the left of a 4K window. */}
      <main class="flex-1 min-w-0 w-full sm:overflow-y-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-7">
        {/* A flex column at least one pane tall, so a tab that wants the whole
            screen can ask for it. Home does: without `min-h-full` here and
            `flex-1` on the tab slot, a short page pinned itself to the top of a
            large monitor and left a third of the window empty. Tabs that are
            taller than the pane simply overflow and `main` scrolls, exactly as
            before. */}
        <div class="mx-auto w-full max-w-6xl 2xl:max-w-[84rem] min-h-full flex flex-col gap-4 sm:gap-5">
          <header class="flex-shrink-0 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 class="text-2xl font-bold font-space tracking-tight">{activeLabel()}</h2>
              <p class="text-sm text-muted-foreground mt-0.5">
                {greeting()} —{' '}
                {new Date().toLocaleDateString([], {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
            </div>
          </header>

          {/* the quote is the home page's own — on a working tab it is one more
              card between you and the thing you opened the tab to do */}
          <Show when={activeTab() === 'home'}>
            <div class="flex-shrink-0 animate-rise-in bg-card rounded-2xl border border-border card-shadow p-4 flex items-center gap-3.5 transition-colors hover:border-primary/25">
              <div class="w-10 h-10 rounded-full bg-accent border border-primary/20 flex items-center justify-center flex-shrink-0">
                <Quote size={16} class="text-primary" />
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-base font-medium font-space leading-snug select-text">
                  “{quote().text}”
                </p>
                <p class="text-sm text-muted-foreground mt-0.5">— {quote().author}</p>
              </div>
              <button
                onClick={shuffleQuote}
                title="Another quote"
                aria-label="Another quote"
                class="flex-shrink-0 p-2.5 rounded-xl bg-muted border border-border text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors"
              >
                <Dices size={18} />
              </button>
            </div>
          </Show>

          <div class="flex-1 flex flex-col min-h-0">
            <Switch>
              <Match when={activeTab() === 'home'}>
                <Home mode={mode} onOpenReport={() => setActiveTab('report')} />
              </Match>
              <Match when={activeTab() === 'log'}>
                <DailyLog mode={mode} />
              </Match>
              <Match when={activeTab() === 'report'}>
                <Report mode={mode} />
              </Match>
              <Match when={activeTab() === 'db'}>
                <DatabaseExplorer />
              </Match>
              <Match when={activeTab() === 'screen'}>
                <ScreenTime />
              </Match>
              <Match when={activeTab() === 'focus'}>
                <FocusTimer />
              </Match>
            </Switch>
          </div>
        </div>
      </main>
    </div>
  );
}

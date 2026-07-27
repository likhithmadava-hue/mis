import { useState, useEffect } from 'react';
import {
  Sprout,
  LineChart,
  Database,
  Quote,
  Dices,
  Timer,
  CalendarCheck,
  PanelLeftClose,
  PanelLeftOpen,
  Loader2,
  UploadCloud,
  X,
} from 'lucide-react';
import FocusTimer from './modules/focus';
import DailyLog from './modules/log';
import GrowTrack from './modules/growth';
import DatabaseExplorer from './modules/database';
import {
  ArborDatabase,
  MODES,
  countImportableGuestRows,
  dismissGuestImport,
  importGuestData,
  type AppMode,
} from './core/db';
import { MODE_META } from './core/scoring';
import { AccountPanel, LoginScreen, useAuth } from './core/auth';

// ── App Guard (blocking) is disabled for now ─────────────────────────────
// Real blocking will be handled by the Python backend engine later.
// To re-enable the simulator tab: uncomment the two lines below, the tab
// entry in TABS, and the <ProtectGuard> line further down.
// import { Shield } from 'lucide-react';
// import ProtectGuard from './modules/guard';

// Growth Tracker leads — the Focus Timer is deliberately not the landing tab.
// Wellness is gone: its check-ins moved into the Daily Log and its Free Time
// gate into the Growth Tracker, so input and charts stay separated.
//
// `modes` decides which tabs exist in which mode. The Database is an exam-paper
// archive and the Focus Timer credits its minutes to study_hours, so both are
// Academic-only.
const TABS = [
  { id: 'grow', label: 'Growth Tracker', icon: LineChart, modes: ['academic', 'life'] },
  { id: 'log', label: 'Daily Log', icon: CalendarCheck, modes: ['academic', 'life'] },
  { id: 'db', label: 'Database', icon: Database, modes: ['academic'] },
  // { id: 'guard', label: 'App Guard', icon: Shield, modes: ['academic'] },
  { id: 'focus', label: 'Focus Timer', icon: Timer, modes: ['academic'] },
] as const satisfies readonly { id: string; label: string; icon: unknown; modes: readonly AppMode[] }[];

type TabId = (typeof TABS)[number]['id'];

const QUOTES = [
  { text: 'A quiet lab for your mind. Capture every slip, watch the patterns surface, sharpen the next attempt.', author: 'MIS' },
  { text: 'The secret of getting ahead is getting started.', author: 'Mark Twain' },
  { text: 'It always seems impossible until it is done.', author: 'Nelson Mandela' },
  { text: 'Success is the sum of small efforts, repeated day in and day out.', author: 'Robert Collier' },
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
  (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000
);

const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
};

/**
 * The gate in front of everything.
 *
 * `Workspace` reads the database as it renders, so it must not mount until the
 * right account's data is in place — hence the wait on `preparing` as well as
 * `loading`. When Supabase is not configured at all the phase is `disabled` and
 * MIS runs exactly as it always did: no login, saved to this computer only.
 */
export default function App() {
  const { phase } = useAuth();

  // ── Temporary preview hatch ──────────────────────────────────────────────
  // Open http://localhost:5173/?login to see the sign-in screen before Supabase
  // is set up. Without this, an empty .env.local means `phase` is 'disabled' and
  // the login is never mounted. The form buttons are inert here (there is no
  // backend to talk to) — it is purely to look at the design. Delete this block
  // once .env.local is filled in and the real login shows on its own.
  if (typeof location !== 'undefined' && new URLSearchParams(location.search).has('login')) {
    return <LoginScreen />;
  }

  if (phase === 'loading' || phase === 'preparing') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-muted-foreground">
        <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center glow-primary">
          <Sprout className="text-primary" size={24} />
        </div>
        <p className="text-sm flex items-center gap-2">
          <Loader2 size={14} className="animate-spin" />
          {phase === 'preparing' ? 'Loading your data…' : 'Starting MIS…'}
        </p>
      </div>
    );
  }

  if (phase === 'signed-out') return <LoginScreen />;

  return <Workspace signedIn={phase === 'ready'} />;
}

/**
 * Offered once, after signing in on a machine that already had MIS data saved
 * without an account. Never automatic: the desktop build seeds two weeks of
 * sample rows on first run, and quietly uploading those into a real account
 * would be indistinguishable from real study history.
 */
function ImportOfflineData() {
  const [rows, setRows] = useState(() => countImportableGuestRows());
  if (rows === 0) return null;

  return (
    <div className="bg-card rounded-2xl border border-primary/30 card-shadow p-5 flex items-start gap-4">
      <div className="w-10 h-10 rounded-full bg-accent border border-primary/20 flex items-center justify-center flex-shrink-0">
        <UploadCloud size={16} className="text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold font-space">
          {rows} row{rows === 1 ? '' : 's'} saved on this computer are not in your account
        </p>
        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
          These were logged before you signed in. Bring them in and they will sync to every
          device — but check first that they are yours and not the sample data MIS ships with.
        </p>
        <div className="flex gap-2 mt-3">
          <button
            onClick={() => {
              importGuestData();
              setRows(0);
              // the tabs each hold their own copy of the data they read, and a
              // wholesale merge is not something the triggerUpdate counter was
              // built to describe — reloading is the honest way to show it
              location.reload();
            }}
            className="h-8 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-semibold font-space"
          >
            Bring them in
          </button>
          <button
            onClick={() => {
              dismissGuestImport();
              setRows(0);
            }}
            className="h-8 px-3 rounded-lg bg-muted border border-border text-xs font-medium text-muted-foreground"
          >
            No thanks
          </button>
        </div>
      </div>
      <button
        onClick={() => {
          dismissGuestImport();
          setRows(0);
        }}
        title="Dismiss"
        aria-label="Dismiss"
        className="flex-shrink-0 p-1.5 rounded-lg text-muted-foreground hover:text-foreground transition-colors"
      >
        <X size={15} />
      </button>
    </div>
  );
}

function Workspace({ signedIn }: { signedIn: boolean }) {
  const [mode, setMode] = useState<AppMode>(() => ArborDatabase.getAppMode());
  const [activeTab, setActiveTab] = useState<TabId>('grow');
  const [navCollapsed, setNavCollapsed] = useState(false);
  const [triggerUpdate, setTriggerUpdate] = useState(0);
  const [quoteIndex, setQuoteIndex] = useState(dayOfYear % QUOTES.length);

  // drives the :root[data-mode='life'] token overrides in index.css
  useEffect(() => {
    document.documentElement.dataset.mode = mode;
  }, [mode]);

  const visibleTabs = TABS.filter((t) => (t.modes as readonly AppMode[]).includes(mode));

  const switchMode = (next: AppMode) => {
    setMode(next);
    ArborDatabase.setAppMode(next);
    // the current tab may not exist in the new mode — fall back to the landing
    // tab rather than rendering nothing
    const stillThere = TABS.some(
      (t) => t.id === activeTab && (t.modes as readonly AppMode[]).includes(next)
    );
    if (!stillThere) setActiveTab('grow');
  };

  const refresh = () => setTriggerUpdate((n) => n + 1);
  const shuffleQuote = () =>
    setQuoteIndex((i) => (i + 1 + Math.floor(Math.random() * (QUOTES.length - 1))) % QUOTES.length);

  const quote = QUOTES[quoteIndex];
  const activeLabel = TABS.find((t) => t.id === activeTab)?.label;

  return (
    <div className="min-h-screen flex flex-col sm:flex-row">
      {/* collapse only applies from sm up — on mobile the bar is already a
          horizontal strip, where an icon rail would gain nothing */}
      <aside
        className={`flex-shrink-0 bg-sidebar border-b sm:border-b-0 sm:border-r border-border flex sm:flex-col justify-between px-4 py-4 sm:py-6 transition-[width] duration-200 ${
          navCollapsed ? 'sm:w-[4.75rem] sm:px-3' : 'sm:w-60'
        }`}
      >
        <div className="flex sm:block items-center gap-4 min-w-0">
          <div className={`flex items-center gap-3 sm:mb-8 ${navCollapsed ? 'sm:justify-center' : ''}`}>
            <div className="w-10 h-10 flex-shrink-0 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center glow-primary">
              <Sprout className="text-primary" size={20} />
            </div>
            <div className={navCollapsed ? 'sm:hidden' : ''}>
              <h1 className="text-lg font-bold font-space tracking-tight leading-tight">MIS</h1>
              <p className="text-[10px] text-muted-foreground font-medium">
                {MODE_META[mode].tagline}
              </p>
            </div>
          </div>

          <div
            className={`flex bg-background p-1 rounded-lg border border-border gap-1 sm:mb-6 ${
              navCollapsed ? 'sm:flex-col' : ''
            }`}
          >
            {MODES.map((m) => {
              const { label, icon: ModeIcon } = MODE_META[m];
              return (
                <button
                  key={m}
                  onClick={() => switchMode(m)}
                  title={`${label} — ${MODE_META[m].blurb}`}
                  className={`flex-1 px-2 py-1.5 rounded-md text-[11px] font-semibold font-space uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5 ${
                    mode === m
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <ModeIcon size={13} />
                  <span className={navCollapsed ? 'sm:hidden' : ''}>{label}</span>
                </button>
              );
            })}
          </div>

          <nav className="flex sm:flex-col gap-1">
            {visibleTabs.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                title={label}
                className={`py-2.5 rounded-xl text-sm font-medium flex items-center gap-2.5 whitespace-nowrap transition-colors text-left ${
                  navCollapsed ? 'px-3 sm:px-0 sm:justify-center' : 'px-3'
                } ${
                  activeTab === id
                    ? 'bg-accent text-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-sidebar-accent'
                }`}
              >
                <Icon size={16} className="flex-shrink-0" />
                <span className={navCollapsed ? 'sm:hidden' : ''}>{label}</span>
              </button>
            ))}

            {/* sits directly under the last tab so it reads as part of the rail
                — hidden on mobile, where the bar is horizontal and never collapses */}
            <button
              onClick={() => setNavCollapsed((c) => !c)}
              title={navCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              aria-label={navCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              aria-expanded={!navCollapsed}
              className={`hidden sm:flex py-2.5 rounded-xl text-sm font-medium items-center gap-2.5 whitespace-nowrap transition-colors text-left text-muted-foreground hover:text-foreground hover:bg-sidebar-accent ${
                navCollapsed ? 'px-3 sm:px-0 sm:justify-center' : 'px-3'
              }`}
            >
              {navCollapsed ? (
                <PanelLeftOpen size={16} className="flex-shrink-0" />
              ) : (
                <PanelLeftClose size={16} className="flex-shrink-0" />
              )}
              <span className={navCollapsed ? 'sm:hidden' : ''}>Collapse</span>
            </button>
          </nav>
        </div>

        {/* on mobile the sidebar is a horizontal strip, so this sits at its
            right-hand end rather than at the bottom of a column */}
        <div className="flex-shrink-0 flex sm:block items-center">
          {!navCollapsed && (
            <p className="hidden sm:block text-[10px] text-muted-foreground/70 italic leading-relaxed sm:mb-3">
              {MODE_META[mode].blurb}
            </p>
          )}
          {signedIn && <AccountPanel collapsed={navCollapsed} />}
        </div>
      </aside>

      <main className="flex-1 min-w-0 px-5 sm:px-8 py-8 space-y-6 max-w-6xl">
        <header className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold font-space tracking-tight">{activeLabel}</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {greeting()} — {new Date().toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}
            </p>
          </div>
        </header>

        <div className="bg-card rounded-2xl border border-border card-shadow p-5 sm:p-6 flex items-start gap-4">
          <div className="w-10 h-10 rounded-full bg-accent border border-primary/20 flex items-center justify-center flex-shrink-0">
            <Quote size={16} className="text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-base sm:text-lg font-medium font-space leading-snug">“{quote.text}”</p>
            <p className="text-sm text-muted-foreground mt-1.5">— {quote.author}</p>
          </div>
          <button
            onClick={shuffleQuote}
            title="Another quote"
            className="flex-shrink-0 p-2.5 rounded-xl bg-muted border border-border text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors"
          >
            <Dices size={18} />
          </button>
        </div>

        {signedIn && <ImportOfflineData />}

        {activeTab === 'focus' && <FocusTimer triggerUpdate={triggerUpdate} onSessionComplete={refresh} />}
        {activeTab === 'grow' && <GrowTrack mode={mode} triggerUpdate={triggerUpdate} onLogbookChange={refresh} />}
        {activeTab === 'log' && <DailyLog mode={mode} triggerUpdate={triggerUpdate} onLogChange={refresh} />}
        {/* {activeTab === 'guard' && <ProtectGuard triggerUpdate={triggerUpdate} onBlocklistChange={refresh} />} */}
        {activeTab === 'db' && <DatabaseExplorer triggerUpdate={triggerUpdate} onChange={refresh} />}
      </main>
    </div>
  );
}

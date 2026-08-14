import { Check, Pause, Play, RotateCcw, SkipForward } from 'lucide-solid';
import { Show } from 'solid-js';

import { useFullscreen } from '../../core/ui';
import AmbientPanel from './AmbientPanel';
import DonePrompt from './DonePrompt';
import FocusMusicPanel from './FocusMusicPanel';
import HabitsEditor from './HabitsEditor';
import LeftTodayPanel from './LeftTodayPanel';
import TimerFace from './TimerFace';
import TimerToolbar from './TimerToolbar';
import TodayFocusPanel from './TodayFocusPanel';
import { createAmbientSound } from './createAmbientSound';
import { createBrainwave } from './createBrainwave';
import { createFocusHabits } from './createFocusHabits';
import { createFocusMusic } from './createFocusMusic';
import { createFocusTimer } from './createFocusTimer';
import { createTodayProgress } from './todayProgress';

/**
 * The Focus Timer tab. This file is only the layout — the countdown lives in
 * `createFocusTimer.ts`, the outstanding-work numbers in `todayProgress.ts`,
 * and each card in its own component.
 */
export default function FocusTimer() {
  let container!: HTMLDivElement;
  const { isFullscreen, toggle: toggleFullscreen } = useFullscreen(() => container);

  const timer = createFocusTimer();
  const music = createFocusMusic();
  const ambient = createAmbientSound();
  const brainwave = createBrainwave();
  // The panel tracks the clock: switching phase, running, and finishing a round
  // all move the "Left Today" numbers. Accessors, not values — read lazily so a
  // ticking clock only redraws the one bar it affects.
  const progress = createTodayProgress({
    mode: timer.mode,
    isRunning: timer.isRunning,
    phaseProgress: timer.progress,
    round: timer.round,
    awaitingConfirm: () => timer.askStage() !== null,
  });
  // Habits are the one line in that panel you can work on from here — see
  // `createFocusHabits`.
  const habits = createFocusHabits();
  // Built once and handed to the panel as the same node every time. Ticking a
  // habit rebuilds the "Left Today" rows; if this were built inside that render
  // it would be torn down and rebuilt with it, and a half-typed habit name in
  // the add box would vanish on an unrelated tick.
  const habitsEditor = <HabitsEditor habits={habits} />;

  return (
    <div
      ref={container}
      class={
        isFullscreen()
          ? 'flex items-center justify-center bg-background w-screen h-screen p-6'
          : 'grid grid-cols-1 lg:grid-cols-12 gap-6'
      }
    >
      <div
        class={`bg-card rounded-2xl border border-border card-shadow p-4 sm:p-8 flex flex-col items-center space-y-6 ${
          isFullscreen() ? 'w-full max-w-3xl' : 'lg:col-span-7'
        }`}
      >
        <TimerToolbar
          mode={timer.mode()}
          onSwitchMode={timer.switchMode}
          settings={timer.settings()}
          onSetDesign={(d) => void timer.setDesign(d)}
          onUpdateSetting={(key, value) => void timer.updateSetting(key, value)}
          isFullscreen={isFullscreen()}
          onToggleFullscreen={toggleFullscreen}
        />

        <TimerFace
          design={timer.settings().timer_design}
          mode={timer.mode()}
          round={timer.round()}
          progress={timer.progress()}
          isFocus={timer.isFocus()}
          mm={timer.mm()}
          ss={timer.ss()}
          secondsLeft={timer.secondsLeft()}
          isFullscreen={isFullscreen()}
        />

        <input
          type="text"
          placeholder="What are you working on? (e.g. Physics DPP)"
          value={timer.tag()}
          onInput={(e) => timer.setTag(e.currentTarget.value)}
          class="w-full max-w-sm px-4 py-2.5 bg-background border border-border rounded-xl text-xs text-center"
        />

        <div class="flex items-center gap-3">
          <button
            onClick={timer.reset}
            title="Reset"
            class="p-3 rounded-xl bg-muted border border-border text-muted-foreground hover:text-foreground transition-colors"
          >
            <RotateCcw size={18} />
          </button>
          <button
            onClick={timer.toggleRunning}
            class={`px-7 sm:px-10 py-3.5 rounded-xl font-bold font-space text-sm flex items-center gap-2 transition-all glow-primary ${
              timer.isFocus()
                ? 'bg-primary text-primary-foreground'
                : 'bg-success text-primary-foreground'
            }`}
          >
            <Show
              when={timer.isRunning()}
              fallback={
                <>
                  <Play size={18} /> Start
                </>
              }
            >
              <>
                <Pause size={18} /> Pause
              </>
            </Show>
          </button>
          <button
            onClick={timer.skip}
            title="Skip to next"
            class="p-3 rounded-xl bg-muted border border-border text-muted-foreground hover:text-foreground transition-colors"
          >
            <SkipForward size={18} />
          </button>
        </div>

        <Show when={timer.justFinished()}>
          {(msg) => (
            <div class="w-full p-3 rounded-xl bg-success/10 border border-success/30 text-success flex items-center justify-center gap-2 animate-fade-in">
              <Check size={16} />
              <span class="text-xs font-semibold">{msg()}</span>
            </div>
          )}
        </Show>
      </div>

      {/* side panels are noise in fullscreen — just the clock and controls */}
      <div class={`lg:col-span-5 space-y-6 ${isFullscreen() ? 'hidden' : ''}`}>
        <TodayFocusPanel sessions={timer.todaySessions()} minutes={timer.todayMinutes()} />
        <FocusMusicPanel music={music} />
        <AmbientPanel ambient={ambient} brainwave={brainwave} />
        <LeftTodayPanel
          remaining={progress.remaining()}
          allClear={progress.allClear()}
          detail={(key) => (key === 'habits' ? habitsEditor : undefined)}
        />
      </div>

      <Show when={timer.askStage() !== null}>
        <DonePrompt stage={timer.askStage()!} onYes={timer.answerYes} onNo={timer.keepGoing} />
      </Show>
    </div>
  );
}

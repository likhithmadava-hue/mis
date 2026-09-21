import { Check, Pause, Play, RotateCcw, SkipForward } from "lucide-solid";
import { Show } from "solid-js";

import { useFullscreen, Workspace } from "../../core/ui";
import AmbientPanel from "./AmbientPanel";
import DonePrompt from "./DonePrompt";
import FocusMusicPanel from "./FocusMusicPanel";
import HabitsEditor from "./HabitsEditor";
import LeftTodayPanel from "./LeftTodayPanel";
import LockInQuote from "./LockInQuote";
import TimerFace from "./TimerFace";
import TimerToolbar from "./TimerToolbar";
import TodayFocusPanel from "./TodayFocusPanel";
import { createAmbientSound } from "./createAmbientSound";
import { createBrainwave } from "./createBrainwave";
import { createFocusHabits } from "./createFocusHabits";
import { createFocusMusic } from "./createFocusMusic";
import { createFocusTimer } from "./createFocusTimer";
import { createLockInQuote } from "./createLockInQuote";
import { createTodayProgress } from "./todayProgress";

/**
 * The Focus Timer tab. This file is only the layout — the countdown lives in
 * `createFocusTimer.ts`, the outstanding-work numbers in `todayProgress.ts`,
 * and each card in its own component.
 */
export default function FocusTimer() {
  let container!: HTMLDivElement;
  const { isFullscreen, toggle: toggleFullscreen } = useFullscreen(
    () => container,
  );

  const timer = createFocusTimer();
  const lockedIn = () => timer.isRunning() && timer.isFocus();
  const lockIn = createLockInQuote(lockedIn);
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
          ? "flex items-center justify-center bg-background w-screen h-screen p-6"
          : "flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6"
      }
    >
      <div
        class={`bg-card rounded-2xl border border-border card-shadow p-4 sm:p-6 flex flex-col ${
          isFullscreen() ? "w-full max-w-3xl h-full" : "lg:col-span-7"
        }`}
      >
        {/* Three rows, auto · 1fr · auto (see Workspace). The body takes whatever
            height the outer grid gives this card and centres the clock in it, so
            extra height becomes breathing room around the timer, never a dead zone
            under the controls. The toolbar stays top, the quote stays bottom. */}
        <Workspace
          header={
            <TimerToolbar
              mode={timer.mode()}
              onSwitchMode={timer.switchMode}
              settings={timer.settings()}
              onSetDesign={(d) => void timer.setDesign(d)}
              onUpdateSetting={(key, value) => void timer.updateSetting(key, value)}
              isFullscreen={isFullscreen()}
              onToggleFullscreen={toggleFullscreen}
            />
          }
          footer={
            <LockInQuote
              text={lockIn.quote()}
              visible={lockIn.visible()}
              onNext={lockIn.next}
            />
          }
          bodyClass="flex"
        >
          {/* The clock's container. `container-type: size` makes this cell report
              its own width and height to the face inside (`cqw` / `cqh`), and
              because a size container contributes nothing to its parent's height,
              the card is exactly as tall as the right-hand column or the window
              makes it — and the ring, digits and controls then grow to fill it.
              `min-h` is what a short window falls back to: the smallest ring
              (14rem) plus the ~16rem of controls and the round-finished banner under it. */}
          <div class="flex-1 min-h-[30rem] [container-type:size] flex flex-col items-center justify-center gap-4 sm:gap-6">
          <div
            class={`inline-flex items-center gap-2 px-3.5 py-1 rounded-full border text-[0.6875rem] font-bold uppercase tracking-[0.14em] font-space transition-colors ${
              lockedIn()
                ? "bg-primary/10 border-primary/30 text-primary"
                : "bg-muted border-border text-muted-foreground"
            }`}
          >
            <span
              class={`w-2 h-2 rounded-full ${lockedIn() ? "bg-primary motion-safe:animate-pulse" : "bg-subtle-foreground"}`}
            />
            {lockedIn()
              ? "Locked in"
              : timer.isRunning()
                ? "On break"
                : "Ready"}
          </div>

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
                  ? "bg-primary text-primary-foreground"
                  : "bg-success text-primary-foreground"
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
        </Workspace>
      </div>

      {/* side panels are noise in fullscreen — just the clock and controls */}
      <div
        class={`lg:col-span-5 flex flex-col gap-4 ${isFullscreen() ? "hidden" : ""}`}
      >
        <TodayFocusPanel
          sessions={timer.todaySessions()}
          minutes={timer.todayMinutes()}
        />
        <FocusMusicPanel music={music} />
        <AmbientPanel ambient={ambient} brainwave={brainwave} />
        <LeftTodayPanel
          remaining={progress.remaining()}
          allClear={progress.allClear()}
          detail={(key) => (key === "habits" ? habitsEditor : undefined)}
        />
      </div>

      <Show when={timer.askStage() !== null}>
        <DonePrompt
          stage={timer.askStage()!}
          onYes={timer.answerYes}
          onNo={timer.keepGoing}
        />
      </Show>
    </div>
  );
}

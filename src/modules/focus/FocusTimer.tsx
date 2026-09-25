import { Check, Pause, Play, RotateCcw, SkipForward } from "lucide-solid";
import { Show } from "solid-js";

import { useFullscreen, Workspace } from "../../core/ui";
import DailyProgressPanel from "./DailyProgressPanel";
import DonePrompt from "./DonePrompt";
import FocusSidebar from "./FocusSidebar";
import LockInQuote from "./LockInQuote";
import TimerFace from "./TimerFace";
import TimerToolbar from "./TimerToolbar";
import { createAmbientSound } from "./createAmbientSound";
import { createBrainwave } from "./createBrainwave";
import { createFocusHabits } from "./createFocusHabits";
import { createFocusMusic } from "./createFocusMusic";
import { createFocusTimer } from "./createFocusTimer";
import { createLockInQuote } from "./createLockInQuote";
import { createTasksTopics } from "./createTasksTopics";
import { createTodayProgress } from "./todayProgress";

/**
 * The Focus Timer tab. This file is only the layout — the countdown lives in
 * `createFocusTimer.ts`, the outstanding-work numbers in `todayProgress.ts` and
 * `createTasksTopics.ts`, and each card in its own component.
 *
 * Two columns: the clock and the day's progress on the left; on the right a
 * switch between the audio and timer controls and the tasks and topics.
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
  // The progress card tracks the clock: running and finishing a round both move
  // the study bar. Accessors, not values — read lazily so a ticking clock only
  // redraws the one bar it affects.
  const progress = createTodayProgress({
    mode: timer.mode,
    isRunning: timer.isRunning,
    phaseProgress: timer.progress,
    round: timer.round,
    awaitingConfirm: () => timer.askStage() !== null,
  });
  const study = () => progress.remaining().find((r) => r.key === "study");
  // Habits are the one thing in the Tasks view you can add and remove, not just
  // tick — see `createFocusHabits`.
  const habits = createFocusHabits();
  const tasks = createTasksTopics();

  return (
    <div
      ref={container}
      class={
        isFullscreen()
          ? "flex items-center justify-center bg-background w-screen h-screen p-6"
          : "flex-1 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_23rem] xl:grid-cols-[minmax(0,1fr)_25rem] lg:items-start gap-4 lg:gap-6"
      }
    >
      {/* The clock column is sized to the window, not stretched to the sidebar.
          The Tasks view can run far past the fold; if this column grew to match
          it, Daily Progress would be pushed off screen, and scrolling the list
          would scroll the clock away. On a window tall enough to hold the whole
          column it also sticks, so the clock stays in view while you scroll the
          list. On a shorter one it scrolls with the page, because a stuck column
          taller than the window would hide its own bottom. */}
      <div
        class={`flex flex-col gap-4 lg:gap-6 min-w-0 ${
          isFullscreen()
            ? "w-full max-w-3xl h-full [&_[data-clock]]:!h-auto"
            : "[@media(min-height:52rem)]:lg:sticky lg:top-0"
        }`}
      >
        <div class="flex-1 bg-card rounded-2xl border border-border card-shadow p-6 sm:p-8 flex flex-col">
          {/* Three rows, auto · 1fr · auto (see Workspace). The body takes whatever
              height the outer grid gives this card and centres the clock in it, so
              extra height becomes breathing room around the timer, never a dead zone
              under the controls. The mode switch stays top, the quote stays bottom. */}
          <Workspace
            header={
              <TimerToolbar
                mode={timer.mode()}
                onSwitchMode={timer.switchMode}
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
                because a size container takes no size from its content, it is
                given one: a fixed height when the columns stack, and on a wide
                window whatever the viewport has left after the page title, this
                card's toolbar and quote, and Daily Progress (about 36rem of them).
                19rem is the floor — the smallest readout plus the tree, bar,
                status, task box and controls — below which the page scrolls. The
                digits then grow into any height above that. */}
            <div data-clock class="relative flex-1 h-[28rem] lg:h-[clamp(19rem,calc(100dvh-36rem),40rem)] [container-type:size] flex flex-col items-center justify-center gap-3 sm:gap-4">
              <TimerFace
                mode={timer.mode()}
                isRunning={timer.isRunning()}
                round={timer.round()}
                roundsPerCycle={timer.settings().rounds_before_long}
                progress={timer.progress()}
                secondsLeft={timer.secondsLeft()}
              />

              <div class="w-full max-w-md">
                <label for="focus-task" class="sr-only">
                  What are you working on?
                </label>
                <input
                  id="focus-task"
                  type="text"
                  maxLength={80}
                  autocomplete="off"
                  placeholder="What are you working on? (e.g. Physics DPP)"
                  value={timer.tag()}
                  onInput={(e) => timer.setTag(e.currentTarget.value)}
                  class="w-full px-4 py-3 bg-background border border-border rounded-xl text-sm text-center placeholder:text-muted-foreground"
                />
              </div>

              {/* One obvious primary, two quiet ghosts. On a narrow card Start takes
                  a row to itself and the ghosts share the one under it. */}
              <div class="w-full max-w-md grid grid-cols-2 gap-3 sm:flex sm:items-center sm:justify-center">
                <button
                  type="button"
                  onClick={timer.toggleRunning}
                  class={`col-span-2 order-first sm:order-2 sm:col-span-1 sm:min-w-[12rem] px-10 py-4 rounded-2xl font-bold font-space text-lg flex items-center justify-center gap-3 transition-all glow-primary active:scale-[0.98] ${
                    timer.isFocus()
                      ? "bg-primary text-primary-foreground"
                      : "bg-success text-primary-foreground"
                  }`}
                >
                  <Show
                    when={timer.isRunning()}
                    fallback={
                      <>
                        <Play size={20} /> {timer.progress() > 0 ? "Resume" : "Start"}
                      </>
                    }
                  >
                    <>
                      <Pause size={20} /> Pause
                    </>
                  </Show>
                </button>
                <button
                  type="button"
                  onClick={timer.reset}
                  class="sm:order-1 px-5 py-3 rounded-xl border border-border bg-transparent text-sm font-semibold text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors flex items-center justify-center gap-2"
                >
                  <RotateCcw size={16} /> Reset
                </button>
                <button
                  type="button"
                  onClick={timer.skip}
                  title="Skip to the next phase"
                  class="sm:order-3 px-5 py-3 rounded-xl border border-border bg-transparent text-sm font-semibold text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors flex items-center justify-center gap-2"
                >
                  Skip <SkipForward size={16} />
                </button>
              </div>

              {/* Floats over the foot of the clock rather than taking a row: it
                  comes and goes, and a row would jolt everything above it. */}
              <Show when={timer.justFinished()}>
                {(msg) => (
                  <div
                    role="status"
                    class="absolute inset-x-0 bottom-0 mx-auto w-full max-w-md p-3 rounded-xl bg-card border border-success/40 text-success shadow-lg flex items-center justify-center gap-2 animate-fade-in"
                  >
                    <Check size={16} />
                    <span class="text-xs font-semibold">{msg()}</span>
                  </div>
                )}
              </Show>
            </div>
          </Workspace>
        </div>

        {/* the day's numbers are noise in fullscreen — just the clock and controls */}
        <div class={isFullscreen() ? "hidden" : ""}>
          <DailyProgressPanel
            sessions={timer.todaySessions()}
            minutes={timer.todayMinutes()}
            study={study()}
          />
        </div>
      </div>

      <div class={isFullscreen() ? "hidden" : "min-w-0"}>
        <FocusSidebar
          timer={timer}
          music={music}
          ambient={ambient}
          brainwave={brainwave}
          habits={habits}
          tasks={tasks}
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

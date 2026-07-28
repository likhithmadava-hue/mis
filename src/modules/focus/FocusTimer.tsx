import { useRef } from "preact/hooks";
import { Play, Pause, RotateCcw, SkipForward, Check } from "lucide-preact";
import { useFullscreen } from "../../core/ui/useFullscreen";
import DonePrompt from "./DonePrompt";
import LeftTodayPanel from "./LeftTodayPanel";
import TimerFace from "./TimerFace";
import TimerToolbar from "./TimerToolbar";
import TodayFocusPanel from "./TodayFocusPanel";
import { useFocusTimer } from "./useFocusTimer";
import { useTodayProgress } from "./useTodayProgress";

interface FocusTimerProps {
  triggerUpdate: number;
  onSessionComplete: () => void;
}

/**
 * The Focus Timer tab. This file is only the layout — the countdown lives in
 * useFocusTimer, the outstanding-work numbers in useTodayProgress, and each
 * card in its own component.
 */
export default function FocusTimer({
  triggerUpdate,
  onSessionComplete,
}: FocusTimerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { isFullscreen, toggle: toggleFullscreen } =
    useFullscreen(containerRef);

  const timer = useFocusTimer(triggerUpdate, onSessionComplete);
  const { remaining, allClear } = useTodayProgress(triggerUpdate);

  return (
    <div
      ref={containerRef}
      className={
        isFullscreen
          ? "flex items-center justify-center bg-background w-screen h-screen p-6"
          : "grid grid-cols-1 lg:grid-cols-12 gap-6"
      }
    >
      <div
        className={`bg-card rounded-2xl border border-border card-shadow p-6 sm:p-8 flex flex-col items-center space-y-6 ${
          isFullscreen ? "w-full max-w-3xl" : "lg:col-span-7"
        }`}
      >
        <TimerToolbar
          mode={timer.mode}
          onSwitchMode={timer.switchMode}
          settings={timer.settings}
          onSetDesign={timer.setDesign}
          onUpdateSetting={timer.updateSetting}
          isFullscreen={isFullscreen}
          onToggleFullscreen={toggleFullscreen}
        />

        <TimerFace
          design={timer.settings.timer_design}
          mode={timer.mode}
          round={timer.round}
          progress={timer.progress}
          isFocus={timer.isFocus}
          mm={timer.mm}
          ss={timer.ss}
          secondsLeft={timer.secondsLeft}
          isFullscreen={isFullscreen}
        />

        <input
          type="text"
          placeholder="What are you working on? (e.g. Physics DPP)"
          value={timer.tag}
          onChange={(e) => timer.setTag(e.currentTarget.value)}
          className="w-full max-w-sm px-4 py-2.5 bg-background border border-border rounded-xl text-xs text-center"
        />

        <div className="flex items-center gap-3">
          <button
            onClick={timer.reset}
            title="Reset"
            className="p-3 rounded-xl bg-muted border border-border text-muted-foreground hover:text-foreground transition-colors"
          >
            <RotateCcw size={18} />
          </button>
          <button
            onClick={timer.toggleRunning}
            className={`px-10 py-3.5 rounded-xl font-bold font-space text-sm flex items-center gap-2 transition-all glow-primary ${
              timer.isFocus
                ? "bg-primary text-primary-foreground"
                : "bg-success text-primary-foreground"
            }`}
          >
            {timer.isRunning ? (
              <>
                <Pause size={18} /> Pause
              </>
            ) : (
              <>
                <Play size={18} /> Start
              </>
            )}
          </button>
          <button
            onClick={timer.skip}
            title="Skip to next"
            className="p-3 rounded-xl bg-muted border border-border text-muted-foreground hover:text-foreground transition-colors"
          >
            <SkipForward size={18} />
          </button>
        </div>

        {timer.justFinished && (
          <div className="w-full p-3 rounded-xl bg-success/10 border border-success/30 text-success flex items-center justify-center gap-2 animate-fade-in">
            <Check size={16} />
            <span className="text-xs font-semibold">{timer.justFinished}</span>
          </div>
        )}
      </div>

      {/* side panels are noise in fullscreen — just the clock and controls */}
      <div
        className={`lg:col-span-5 space-y-6 ${isFullscreen ? "hidden" : ""}`}
      >
        <TodayFocusPanel
          sessions={timer.todaySessions}
          minutes={timer.todayMinutes}
        />
        <LeftTodayPanel remaining={remaining} allClear={allClear} />
      </div>

      {timer.askStage !== null && (
        <DonePrompt
          stage={timer.askStage}
          onYes={timer.answerYes}
          onNo={timer.keepGoing}
        />
      )}
    </div>
  );
}

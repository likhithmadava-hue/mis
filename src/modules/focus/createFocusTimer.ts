import { getCurrentWindow } from '@tauri-apps/api/window';
import confetti from 'canvas-confetti';
import { createEffect, createMemo, createSignal, onCleanup } from 'solid-js';

import { todayIso } from '../../core/dates';
import { act, api, db, type FocusSettings, type TimerDesign } from '../../core/db';
import { startAlarm, playChime, type Alarm } from './audio';
import { DONE_PROMPTS, MODE_LABEL, type TimerMode } from './constants';

/** only the four numeric fields — `timer_design` is set by `setDesign` */
type NumericSetting = 'focus_minutes' | 'short_break' | 'long_break' | 'rounds_before_long';

/**
 * The whole timer engine: the countdown, the pomodoro cycle, the three-step
 * "are you done?" confirmation, and the writes it makes when a round is
 * confirmed. The components that use this only draw.
 *
 * Fullscreen and the clock face are deliberately not in here — those are how
 * the timer *looks*, not how it runs.
 */
export function createFocusTimer() {
  const settings = () => db.focus_settings;

  const [mode, setMode] = createSignal<TimerMode>('focus');
  const [secondsLeft, setSecondsLeft] = createSignal(settings().focus_minutes * 60);
  const [isRunning, setIsRunning] = createSignal(false);
  const [round, setRound] = createSignal(1);
  const [tag, setTag] = createSignal('');
  const [justFinished, setJustFinished] = createSignal<string | null>(null);
  /** which of DONE_PROMPTS is on screen; null when no dialog is open */
  const [askStage, setAskStage] = createSignal<number | null>(null);

  let alarm: Alarm | null = null;
  let noticeTimer: number | undefined;

  const beginAlarm = () => {
    alarm ??= startAlarm();
  };
  const stopAlarm = () => {
    alarm?.stop();
    alarm = null;
  };

  const notice = (msg: string, ms = 6000) => {
    setJustFinished(msg);
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => setJustFinished(null), ms);
  };

  // Never leave the alarm ringing after the tab is gone. Without this, leaving
  // the Focus tab mid-dialog would ring forever with no dialog to answer.
  onCleanup(() => {
    stopAlarm();
    clearTimeout(noticeTimer);
  });

  const minutesFor = (m: TimerMode) =>
    m === 'focus'
      ? settings().focus_minutes
      : m === 'short'
        ? settings().short_break
        : settings().long_break;

  /**
   * A focus round ending opens the "are you done?" dialog instead of logging
   * straight away — the session is only recorded once it is confirmed. A break
   * ending just chimes and re-arms the focus clock; nothing is written for a
   * break, because a break is not work.
   */
  const handleComplete = () => {
    setIsRunning(false);

    if (mode() === 'focus') {
      beginAlarm();
      setAskStage(0);
      return;
    }

    playChime();
    setMode('focus');
    setSecondsLeft(settings().focus_minutes * 60);
    notice('Break over — ready for the next round?');
  };

  /** three "yes"es in — log the round and queue up the break */
  const finishSession = async () => {
    stopAlarm();
    setAskStage(null);

    const minutes = settings().focus_minutes;
    await act(api.addFocusSession(minutes, tag().trim() || 'Focus session', true));

    // Focus minutes count toward the day's study hours — the Daily Log and the
    // timer must not be two separate accounts of the same afternoon. A locked
    // day refuses the credit, and that refusal is reported rather than hidden:
    // the session still happened and is still recorded, but the hours did not
    // move, and the message has to say which.
    let credited = true;
    try {
      await act(api.addStudyMinutes(minutes));
    } catch {
      credited = false;
    }

    confetti({ particleCount: 90, spread: 60, colors: ['#00ccf9', '#35c177', '#ffffff'] });
    notice(
      credited
        ? `Nice work! ${minutes} min added to today's study hours. 🌳`
        : `Session logged. Today is submitted and locked, so the ${minutes} min were not added to it.`,
    );

    const nextMode: TimerMode = round() % settings().rounds_before_long === 0 ? 'long' : 'short';
    setRound((r) => r + 1);
    setMode(nextMode);
    setSecondsLeft(minutesFor(nextMode) * 60);
  };

  /** "no" at any stage — put the full focus timer back on the clock */
  const keepGoing = () => {
    stopAlarm();
    setAskStage(null);
    setMode('focus');
    setSecondsLeft(settings().focus_minutes * 60);
    notice('Timer reset — back to it. 🌱', 5000);
  };

  const answerYes = () => {
    const stage = askStage();
    if (stage === null) return;
    if (stage >= DONE_PROMPTS.length - 1) void finishSession();
    else setAskStage(stage + 1);
  };

  /**
   * The countdown, driven by a target timestamp rather than by counting ticks.
   *
   * A `setInterval` that decrements a counter drifts, and drifts badly when the
   * window is minimised and timers get throttled — a 25-minute round could ring
   * several minutes late. Reading the wall clock every tick means the display
   * can lag but the *end time* cannot.
   */
  createEffect(() => {
    if (!isRunning()) return;

    const endAt = Date.now() + secondsLeft() * 1000;
    const tick = setInterval(() => {
      const remaining = Math.max(0, Math.round((endAt - Date.now()) / 1000));
      setSecondsLeft(remaining);
      if (remaining === 0) {
        clearInterval(tick);
        handleComplete();
      }
    }, 250);

    onCleanup(() => clearInterval(tick));
  });

  const mm = () => String(Math.floor(secondsLeft() / 60)).padStart(2, '0');
  const ss = () => String(secondsLeft() % 60).padStart(2, '0');

  // The countdown in the window title, which means it is also in the taskbar —
  // the one place you can still see it with MIS behind another window.
  createEffect(() => {
    const title = isRunning() ? `${mm()}:${ss()} — ${MODE_LABEL[mode()]} · MIS` : 'MIS';
    void getCurrentWindow().setTitle(title);
  });
  onCleanup(() => void getCurrentWindow().setTitle('MIS'));

  const switchMode = (m: TimerMode) => {
    setIsRunning(false);
    setMode(m);
    setSecondsLeft(minutesFor(m) * 60);
  };

  const reset = () => {
    setIsRunning(false);
    setSecondsLeft(minutesFor(mode()) * 60);
  };

  const skip = () => {
    setIsRunning(false);
    handleComplete();
  };

  const save = (next: FocusSettings) => act(api.saveFocusSettings(next));

  const setDesign = (timer_design: TimerDesign) => save({ ...settings(), timer_design });

  const updateSetting = async (key: NumericSetting, value: number) => {
    // Clamped rather than validated: an empty box or a typo becomes 1 minute,
    // never a timer of zero or one that runs for days.
    const next = { ...settings(), [key]: Math.max(1, Math.min(180, value || 1)) };
    await save(next);

    // A running clock is not moved out from under you — the new length applies
    // to the next round.
    if (isRunning()) return;
    const mins =
      key === 'focus_minutes' && mode() === 'focus'
        ? next.focus_minutes
        : key === 'short_break' && mode() === 'short'
          ? next.short_break
          : key === 'long_break' && mode() === 'long'
            ? next.long_break
            : null;
    if (mins !== null) setSecondsLeft(mins * 60);
  };

  const todaySessions = createMemo(() =>
    db.focus_sessions.filter((s) => s.date === todayIso() && s.completed),
  );

  return {
    settings,
    mode,
    round,
    isRunning,
    secondsLeft,
    /** 0 → 1 through the current phase, for the ring and the tree */
    progress: () => {
      const total = minutesFor(mode()) * 60;
      return total > 0 ? 1 - secondsLeft() / total : 0;
    },
    mm,
    ss,
    isFocus: () => mode() === 'focus',
    tag,
    setTag,
    justFinished,
    askStage,
    todaySessions,
    todayMinutes: createMemo(() =>
      todaySessions().reduce((sum, s) => sum + s.duration_minutes, 0),
    ),
    toggleRunning: () => setIsRunning((r) => !r),
    switchMode,
    reset,
    skip,
    answerYes,
    keepGoing,
    setDesign,
    updateSetting,
  };
}

export type FocusTimerState = ReturnType<typeof createFocusTimer>;

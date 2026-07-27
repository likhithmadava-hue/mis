import { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { ArborDatabase, type FocusSettings, type FocusSession, type TimerDesign } from '../../core/db';
import { todayIso } from '../../core/dates';
import { playChime, startAlarm, type Alarm } from './audio';
import { DONE_PROMPTS, MODE_LABEL, type TimerMode } from './constants';

/** only the four numeric fields — timer_design is set by setDesign */
type NumericSetting = 'focus_minutes' | 'short_break' | 'long_break' | 'rounds_before_long';

/**
 * The whole timer engine: the countdown, the pomodoro cycle, the three-step
 * "are you done?" confirmation, and the writes it makes when a round is
 * confirmed. The component that uses this only draws.
 *
 * Fullscreen and the clock face are deliberately not in here — those are how
 * the timer looks, not how it runs.
 */
export function useFocusTimer(triggerUpdate: number, onSessionComplete: () => void) {
  const [settings, setSettings] = useState<FocusSettings>(ArborDatabase.getFocusSettings());
  const [sessions, setSessions] = useState<FocusSession[]>(ArborDatabase.getFocusSessions());

  const [mode, setMode] = useState<TimerMode>('focus');
  const [secondsLeft, setSecondsLeft] = useState(settings.focus_minutes * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [round, setRound] = useState(1);
  const [tag, setTag] = useState('');
  const [justFinished, setJustFinished] = useState<string | null>(null);
  /** which of DONE_PROMPTS is on screen; null when no dialog is open */
  const [askStage, setAskStage] = useState<number | null>(null);

  const endTimeRef = useRef<number>(0);
  const completeRef = useRef<() => void>(() => {});
  const alarmRef = useRef<Alarm | null>(null);

  const beginAlarm = () => {
    if (alarmRef.current) return;
    alarmRef.current = startAlarm();
  };

  const stopAlarm = () => {
    alarmRef.current?.stop();
    alarmRef.current = null;
  };

  // never leave the alarm ringing if the tab unmounts mid-dialog
  useEffect(() => stopAlarm, []);

  const minutesFor = (m: TimerMode) =>
    m === 'focus' ? settings.focus_minutes : m === 'short' ? settings.short_break : settings.long_break;

  useEffect(() => {
    setSessions(ArborDatabase.getFocusSessions());
    setSettings(ArborDatabase.getFocusSettings());
  }, [triggerUpdate]);

  // a focus round ending opens the "are you done?" dialog instead of logging
  // straight away — the session is only recorded once it's confirmed
  const handleComplete = () => {
    setIsRunning(false);

    if (mode === 'focus') {
      beginAlarm();
      setAskStage(0);
      return;
    }

    playChime();
    setJustFinished('Break over — ready for the next round?');
    setMode('focus');
    setSecondsLeft(settings.focus_minutes * 60);
    setTimeout(() => setJustFinished(null), 6000);
  };

  /** three "yes"es in — log the round and queue up the break */
  const finishSession = () => {
    stopAlarm();
    setAskStage(null);

    const minutes = settings.focus_minutes;
    ArborDatabase.addFocusSession({
      date: todayIso(),
      duration_minutes: minutes,
      tag: tag.trim() || 'Focus session',
      completed: true,
    });
    ArborDatabase.addStudyMinutes(minutes);
    confetti({ particleCount: 90, spread: 60, colors: ['#00ccf9', '#35c177', '#ffffff'] });
    setJustFinished(`Nice work! ${minutes} min added to today's study hours. 🌳`);

    const nextIsLong = round % settings.rounds_before_long === 0;
    const nextMode: TimerMode = nextIsLong ? 'long' : 'short';
    setRound((r) => r + 1);
    setMode(nextMode);
    setSecondsLeft(minutesFor(nextMode) * 60);
    onSessionComplete();
    setTimeout(() => setJustFinished(null), 6000);
  };

  /** "no" at any stage — put the full focus timer back on the clock */
  const keepGoing = () => {
    stopAlarm();
    setAskStage(null);
    setMode('focus');
    setSecondsLeft(settings.focus_minutes * 60);
    setJustFinished('Timer reset — back to it. 🌱');
    setTimeout(() => setJustFinished(null), 5000);
  };

  const answerYes = () => {
    if (askStage === null) return;
    if (askStage >= DONE_PROMPTS.length - 1) finishSession();
    else setAskStage(askStage + 1);
  };

  completeRef.current = handleComplete;

  // countdown driven by a target timestamp, so it stays accurate even if
  // the window is backgrounded and timers get throttled
  useEffect(() => {
    if (!isRunning) return;
    endTimeRef.current = Date.now() + secondsLeft * 1000;

    const tick = setInterval(() => {
      const remaining = Math.max(0, Math.round((endTimeRef.current - Date.now()) / 1000));
      setSecondsLeft(remaining);
      if (remaining === 0) {
        clearInterval(tick);
        completeRef.current();
      }
    }, 250);

    return () => clearInterval(tick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRunning]);

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const ss = String(secondsLeft % 60).padStart(2, '0');

  // show the countdown in the window title bar
  useEffect(() => {
    document.title = isRunning ? `${mm}:${ss} — ${MODE_LABEL[mode]} | MIS` : 'MIS';
    return () => {
      document.title = 'MIS';
    };
  }, [mm, ss, isRunning, mode]);

  const switchMode = (m: TimerMode) => {
    setIsRunning(false);
    setMode(m);
    setSecondsLeft(minutesFor(m) * 60);
  };

  const reset = () => {
    setIsRunning(false);
    setSecondsLeft(minutesFor(mode) * 60);
  };

  const skip = () => {
    setIsRunning(false);
    completeRef.current();
  };

  const setDesign = (timer_design: TimerDesign) => {
    const next = { ...settings, timer_design };
    setSettings(next);
    ArborDatabase.saveFocusSettings(next);
  };

  const updateSetting = (key: NumericSetting, value: number) => {
    const next = { ...settings, [key]: Math.max(1, Math.min(180, value || 1)) };
    setSettings(next);
    ArborDatabase.saveFocusSettings(next);
    if (!isRunning) {
      const mins = key === 'focus_minutes' && mode === 'focus' ? next.focus_minutes
        : key === 'short_break' && mode === 'short' ? next.short_break
        : key === 'long_break' && mode === 'long' ? next.long_break
        : null;
      if (mins !== null) setSecondsLeft(mins * 60);
    }
  };

  const totalSeconds = minutesFor(mode) * 60;
  const today = todayIso();
  const todaySessions = sessions.filter((s) => s.date === today && s.completed);

  return {
    settings,
    mode,
    round,
    isRunning,
    secondsLeft,
    /** 0 → 1 through the current phase, for the ring and the tree */
    progress: totalSeconds > 0 ? 1 - secondsLeft / totalSeconds : 0,
    mm,
    ss,
    isFocus: mode === 'focus',
    tag,
    setTag,
    justFinished,
    askStage,
    todaySessions,
    todayMinutes: todaySessions.reduce((sum, s) => sum + s.duration_minutes, 0),
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

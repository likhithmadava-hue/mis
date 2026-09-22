import { createSignal } from 'solid-js';
import { createStore } from 'solid-js/store';

import { enterApp } from '../../core/auth';
import { api, errorMessage, type Profile, type ProductiveTime } from '../../core/db';

/**
 * The wizard's state and rules. The component is layout; everything that
 * decides whether a step is complete, and what is sent to Rust, is here.
 *
 * The checks below are a courtesy — they let a step say what is wrong before you
 * press Next. The real validation is `Profile::cleaned` in Rust, which refuses
 * the same things again on submit; if the two ever disagree, Rust wins and its
 * message is shown.
 */

export const STEPS = [
  { id: 'you', title: 'About you', blurb: 'So MIS can greet you properly.' },
  { id: 'goals', title: 'Your goals', blurb: 'What you are working towards.' },
  { id: 'subjects', title: 'Subjects', blurb: 'What you study, and how sure you feel.' },
  { id: 'habits', title: 'How you work', blurb: 'Your rhythm, so the targets fit you.' },
  { id: 'account', title: 'Lock MIS', blurb: 'A username and password for this device.' },
] as const;

/** one past the last question step: the recovery code screen */
export const CODE_STEP = STEPS.length;

export interface Draft {
  fullName: string;
  /** a string while typing — a number input is empty, not zero, until filled */
  age: string;
  grade: string;
  program: string;
  goals: string[];
  targetExam: string;
  examDate: string;
  targetScore: string;
  subjects: { name: string; confidence: number; lastResult: string }[];
  dailyHours: number;
  focusSpan: number;
  productiveTime: ProductiveTime;
  hasSchool: boolean;
  schoolStart: string;
  schoolEnd: string;
  bedtime: string;
  wake: string;
  preferences: string[];
  username: string;
  email: string;
  password: string;
  confirm: string;
}

const USERNAME = /^[a-z0-9_.-]{3,24}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** 0 (nothing typed) to 4, for the strength bar. Advice only — never blocks. */
export function passwordStrength(pw: string): number {
  if (!pw) return 0;
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) score++;
  return Math.max(1, score);
}

export function createOnboarding() {
  const [d, setD] = createStore<Draft>({
    fullName: '',
    age: '',
    grade: 'Class 12',
    program: 'JEE (Main + Advanced)',
    goals: [],
    targetExam: '',
    examDate: '',
    targetScore: '',
    subjects: [],
    dailyHours: 6,
    focusSpan: 45,
    productiveTime: 'morning',
    hasSchool: true,
    schoolStart: '08:00',
    schoolEnd: '14:30',
    bedtime: '23:00',
    wake: '06:30',
    preferences: [],
    username: '',
    email: '',
    password: '',
    confirm: '',
  });

  const [step, setStep] = createSignal(0);
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [code, setCode] = createSignal<string | null>(null);
  // Errors are shown only once a step has been tried, so an untouched form is
  // calm rather than covered in red.
  const [tried, setTried] = createSignal(false);

  const toggle = (key: 'goals' | 'preferences', value: string) =>
    setD(key, (list) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]));

  const hasSubject = (name: string) =>
    d.subjects.some((s) => s.name.toLowerCase() === name.trim().toLowerCase());

  const toggleSubject = (name: string) => {
    if (hasSubject(name)) {
      setD('subjects', (all) => all.filter((s) => s.name.toLowerCase() !== name.toLowerCase()));
    } else {
      setD('subjects', (all) => [...all, { name, confidence: 3, lastResult: '' }]);
    }
  };

  const addSubject = (raw: string): boolean => {
    const name = raw.trim();
    if (!name || name.length > 40 || hasSubject(name)) return false;
    setD('subjects', (all) => [...all, { name, confidence: 3, lastResult: '' }]);
    return true;
  };

  /** What is wrong with a step, or `null` when it is complete. */
  const problem = (i: number): string | null => {
    switch (i) {
      case 0: {
        if (!d.fullName.trim()) return 'Tell us your name';
        const age = Number(d.age);
        if (!d.age || !Number.isInteger(age) || age < 5 || age > 100) return 'Enter your age (5–100)';
        return null;
      }
      case 1:
        if (d.goals.length === 0) return 'Pick at least one goal';
        return null;
      case 2:
        if (d.subjects.length === 0) return 'Add at least one subject';
        return null;
      case 3:
        if (d.hasSchool && (!d.schoolStart || !d.schoolEnd)) return 'Set both school times, or turn school hours off';
        if (!d.bedtime || !d.wake) return 'Set your bedtime and wake-up time';
        return null;
      case 4: {
        if (!USERNAME.test(d.username.trim().toLowerCase()))
          return 'Username: 3–24 letters, numbers, dots, dashes or underscores';
        if (!EMAIL.test(d.email.trim())) return 'That email address doesn’t look right';
        if (d.password.length < 8) return 'Use at least 8 characters for the password';
        if (d.password !== d.confirm) return 'The two passwords don’t match';
        return null;
      }
      default:
        return null;
    }
  };

  const shownProblem = () => (tried() ? problem(step()) : null);

  const next = () => {
    setTried(true);
    if (problem(step()) !== null) return;
    setTried(false);
    setError(null);
    setStep((s) => s + 1);
  };

  const back = () => {
    setTried(false);
    setError(null);
    setStep((s) => Math.max(0, s - 1));
  };

  const toProfile = (): Profile => ({
    username: d.username.trim().toLowerCase(),
    email: d.email.trim(),
    full_name: d.fullName.trim(),
    age: Number(d.age),
    grade: d.grade,
    program: d.program,
    goals: [...d.goals],
    target_exam: d.targetExam.trim(),
    exam_date: d.examDate,
    target_score: d.targetScore.trim(),
    subjects: d.subjects.map((s) => ({
      name: s.name,
      confidence: s.confidence,
      last_result: s.lastResult.trim(),
    })),
    daily_study_hours: d.dailyHours,
    focus_span_minutes: d.focusSpan,
    productive_time: d.productiveTime,
    school_start: d.hasSchool ? d.schoolStart : '',
    school_end: d.hasSchool ? d.schoolEnd : '',
    sleep_bedtime: d.bedtime,
    sleep_wake: d.wake,
    preferences: [...d.preferences],
    created_at: '',
  });

  /** The last question step: create the account and lock the vault. */
  const submit = async () => {
    setTried(true);
    for (let i = 0; i < STEPS.length; i++) {
      const p = problem(i);
      if (p) {
        // an earlier step was somehow left incomplete — send them back to it
        setStep(i);
        setError(p);
        return;
      }
    }
    setBusy(true);
    setError(null);
    try {
      const recovery = await api.authSetup(toProfile(), d.password);
      // The password has done its job; do not leave it sitting in the store
      // for the rest of the session.
      setD({ password: '', confirm: '' });
      setCode(recovery);
      setStep(CODE_STEP);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return {
    d,
    setD,
    step,
    busy,
    error,
    code,
    toggle,
    toggleSubject,
    addSubject,
    hasSubject,
    problem: shownProblem,
    next,
    back,
    submit,
    finish: () => void enterApp(),
  };
}

export type Onboarding = ReturnType<typeof createOnboarding>;

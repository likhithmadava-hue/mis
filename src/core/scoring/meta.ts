/**
 * What the scores are worth and what they are called.
 *
 * The arithmetic is gone from the frontend — it lives in
 * `src-tauri/src/scoring.rs`, which is what `score_range` and `study_streak`
 * run. What is left here is everything the *maths file must not contain*:
 * labels, icons, Tailwind classes, the sentence under a track's name. That
 * split is why this file survived the port intact while `score.ts` did not.
 *
 * The three targets below are mirrored from Rust. They are here because the UI
 * needs them to draw a progress bar, never to compute a score — if these and
 * `scoring.rs` ever disagree, Rust is right and this file is the bug.
 */

import {
  BookOpen,
  GraduationCap,
  HeartPulse,
  Hourglass,
  Leaf,
  ListChecks,
  Repeat,
  Smile,
} from 'lucide-solid';

import { PRIORITY_WEIGHT, type AppMode, type Priority, type TrackId } from '../db';

/** the day's score is reported out of this, like the old sheet's target cell */
export const DAY_TARGET = 50;

/** minutes of well-spent leisure that counts as a full 10 */
export const WELL_SPENT_TARGET = 60;

/** posture checks that count as a full 10 */
export const POSTURE_TARGET = 3;

/** what a single track's score is out of */
export const TRACK_TARGET = 10;

type Icon = typeof BookOpen;

/**
 * Every track belongs to exactly one mode. Academic is the work that moves
 * marks; Life is what keeps that work sustainable. The mode a track belongs to
 * decides where it can be entered and where it is charted — **a track never
 * appears in both**, and the two modes never add up to a single number. Fifty
 * for the studying and fifty for the living are two different statements about
 * a day and combining them would destroy both.
 */
export const MODE_META: Record<
  AppMode,
  {
    label: string;
    tagline: string;
    blurb: string;
    icon: Icon;
    accent: string;
    dot: string;
    ring: string;
  }
> = {
  academic: {
    label: 'Academic',
    tagline: 'Study the way you solve',
    blurb: 'The work that moves your marks.',
    icon: GraduationCap,
    accent: 'text-primary',
    dot: 'bg-primary',
    ring: 'border-primary/30',
  },
  life: {
    label: 'Life',
    tagline: 'Keep the engine running',
    blurb: 'Everything that keeps the studying sustainable.',
    icon: Leaf,
    accent: 'text-primary',
    dot: 'bg-primary',
    ring: 'border-primary/30',
  },
};

/**
 * Note that both modes use `text-primary` rather than a hardcoded cyan and
 * green. Only one mode is on screen at a time, and `--primary` is what changes
 * with it — see the `:root[data-mode='life']` rule in `index.css`. Naming the
 * colours here would freeze them and the retint would stop working.
 */
export const TRACK_META: Record<
  TrackId,
  { label: string; icon: Icon; hint: string; mode: AppMode }
> = {
  studies:    { label: 'Studies',      icon: BookOpen,   hint: 'deep study hours',                  mode: 'academic' },
  dpps:       { label: 'DPPs/Records', icon: ListChecks, hint: 'papers finished vs assigned',       mode: 'academic' },
  habits:     { label: 'Habits',       icon: Repeat,     hint: 'weighted by each habit’s priority', mode: 'life' },
  mood:       { label: 'Mood',         icon: Smile,      hint: 'how today actually felt',           mode: 'life' },
  well_spent: { label: 'Well-Spent',   icon: Hourglass,  hint: 'leisure that was worth it',         mode: 'life' },
  wellness:   { label: 'Wellness',     icon: HeartPulse, hint: 'hydration and posture',             mode: 'life' },
};

/** the tracks belonging to a mode, in declaration order */
export const tracksOf = (mode: AppMode) =>
  (Object.keys(TRACK_META) as TrackId[]).filter((id) => TRACK_META[id].mode === mode);

/**
 * A mode's tracks, highest priority first.
 *
 * This is display order only — it decides which track heads the Daily Log and
 * the track summary, not what anything is worth. The weights that *do* decide
 * that are applied in `scoring.rs`, and reordering here can never change a
 * score.
 */
export const tracksIn = (mode: AppMode, priorities: Record<TrackId, Priority>) =>
  tracksOf(mode).sort((a, b) => PRIORITY_WEIGHT[priorities[b]] - PRIORITY_WEIGHT[priorities[a]]);

/** the sheet's red → green heatmap, for any 0–10 score */
export const heat = (score: number) => {
  if (score >= 8) return 'bg-emerald-500/25 text-emerald-300 border-emerald-500/40';
  if (score >= 6) return 'bg-lime-500/20 text-lime-300 border-lime-500/40';
  if (score >= 4) return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40';
  if (score >= 2) return 'bg-orange-500/20 text-orange-300 border-orange-500/40';
  if (score > 0) return 'bg-red-500/20 text-red-300 border-red-500/40';
  return 'bg-muted text-muted-foreground/50 border-border';
};

/**
 * The heat class for a day with no log at all.
 *
 * **This is not `heat(0)`.** A day you never opened the app and a day you did
 * nothing are different facts, and the grid has to be able to say so — zero is
 * red, absent is blank. The same distinction is why `ScoredDay.scores` is
 * nullable rather than defaulting to zeroes.
 */
export const NO_DATA = 'bg-transparent text-muted-foreground/30 border-border/50 border-dashed';

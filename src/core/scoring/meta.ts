import {
  BookOpen,
  ListChecks,
  Hourglass,
  Smile,
  Repeat,
  HeartPulse,
  GraduationCap,
  Leaf,
} from "lucide-preact";
import type { AppMode, TrackId } from "../db";

/**
 * What the scores are worth and what they are called. Split from score.ts so
 * the maths file stays free of icons and Tailwind classes — and so anything
 * that only needs a label doesn't pull the scoring engine in with it.
 */

/** the day's score is reported out of this, like the old sheet's target cell */
export const DAY_TARGET = 50;

/** minutes of well-spent leisure that counts as a full 10 */
export const WELL_SPENT_TARGET = 60;

/** posture checks that count as a full 10 */
export const POSTURE_TARGET = 3;

/**
 * Every track belongs to exactly one mode. Academic is the work that moves
 * marks; Life is what keeps that work sustainable. The mode a track belongs to
 * decides where it can be entered and where it is charted — a track never
 * appears in both.
 */
export const MODE_META: Record<
  AppMode,
  {
    label: string;
    tagline: string;
    blurb: string;
    icon: typeof BookOpen;
    accent: string;
    dot: string;
    ring: string;
  }
> = {
  academic: {
    label: "Academic",
    tagline: "Study the way you solve",
    blurb: "The work that moves your marks.",
    icon: GraduationCap,
    accent: "text-primary",
    dot: "bg-primary",
    ring: "border-primary/30",
  },
  life: {
    label: "Life",
    tagline: "Keep the engine running",
    blurb: "Everything that keeps the studying sustainable.",
    icon: Leaf,
    accent: "text-primary",
    dot: "bg-primary",
    ring: "border-primary/30",
  },
};

export const TRACK_META: Record<
  TrackId,
  { label: string; icon: typeof BookOpen; hint: string; mode: AppMode }
> = {
  studies: {
    label: "Studies",
    icon: BookOpen,
    hint: "deep study hours",
    mode: "academic",
  },
  dpps: {
    label: "DPPs/Records",
    icon: ListChecks,
    hint: "papers finished vs assigned",
    mode: "academic",
  },
  habits: {
    label: "Habits",
    icon: Repeat,
    hint: "weighted by each habit’s priority",
    mode: "life",
  },
  mood: {
    label: "Mood",
    icon: Smile,
    hint: "how today actually felt",
    mode: "life",
  },
  well_spent: {
    label: "Well-Spent",
    icon: Hourglass,
    hint: "leisure that was worth it",
    mode: "life",
  },
  wellness: {
    label: "Wellness",
    icon: HeartPulse,
    hint: "hydration and posture",
    mode: "life",
  },
};

/** the sheet's red → green heatmap, for any 0–10 score */
export const heat = (score: number) => {
  if (score >= 8)
    return "bg-emerald-500/25 text-emerald-300 border-emerald-500/40";
  if (score >= 6) return "bg-lime-500/20 text-lime-300 border-lime-500/40";
  if (score >= 4)
    return "bg-yellow-500/20 text-yellow-300 border-yellow-500/40";
  if (score >= 2)
    return "bg-orange-500/20 text-orange-300 border-orange-500/40";
  if (score > 0) return "bg-red-500/20 text-red-300 border-red-500/40";
  return "bg-muted text-muted-foreground/50 border-border";
};

import type { Difficulty, MistakeReason } from '../db';

/**
 * Colours for the mistake-type and difficulty badges.
 *
 * These live here rather than inside a component because both the Database
 * tab and the Growth Tracker's logbook draw the same badges — keeping one
 * copy means a colour only ever has to be changed in one place.
 */

export const REASON_BADGE: Record<MistakeReason, string> = {
  Conceptual: 'bg-primary/10 text-primary border-primary/30',
  Calculation: 'bg-violet-500/10 text-violet-400 border-violet-500/30',
  Careless: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30',
  Reading: 'bg-sky-500/10 text-sky-400 border-sky-500/30',
  Unit: 'bg-amber-600/10 text-amber-500 border-amber-600/30',
  Sign: 'bg-pink-500/10 text-pink-400 border-pink-500/30',
  'Formula Recall': 'bg-purple-500/10 text-purple-400 border-purple-500/30',
  'Time Pressure': 'bg-red-500/10 text-red-400 border-red-500/30',
  Other: 'bg-muted text-muted-foreground border-border',
};

export const DIFFICULTY_BADGE: Record<Difficulty, string> = {
  Easy: 'bg-success/10 text-success border-success/30',
  Medium: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30',
  Hard: 'bg-red-500/10 text-red-400 border-red-500/30',
};

/**
 * Raw colour values for SVG charts. `fill`/`stroke` cannot take a Tailwind
 * class, so the donut and line charts need the literal colour — these mirror
 * the maps above and must be kept in step with them.
 */
export const DIFFICULTY_COLOR: Record<Difficulty, string> = {
  Easy: '#10b981',
  Medium: '#eab308',
  Hard: '#ef4444',
};

export const REASON_COLOR: Record<MistakeReason, string> = {
  Conceptual: 'hsl(var(--primary))',
  Calculation: '#8b5cf6',
  Careless: '#eab308',
  Reading: '#0ea5e9',
  Unit: '#d97706',
  Sign: '#ec4899',
  'Formula Recall': '#a855f7',
  'Time Pressure': '#ef4444',
  Other: 'hsl(var(--muted-foreground))',
};

/** the bar colour used in the Error Analysis chart (no background/border) */
export const REASON_BAR: Record<MistakeReason, string> = {
  Conceptual: 'bg-primary',
  Calculation: 'bg-violet-500',
  Careless: 'bg-yellow-500',
  Reading: 'bg-sky-500',
  Unit: 'bg-amber-600',
  Sign: 'bg-pink-500',
  'Formula Recall': 'bg-purple-500',
  'Time Pressure': 'bg-red-500',
  Other: 'bg-muted-foreground',
};

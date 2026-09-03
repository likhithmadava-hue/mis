import { ST_CATEGORIES, type StCategory } from '../../core/db';

/**
 * The tab's shared vocabulary: how a duration is printed and what each category
 * looks like.
 *
 * This is all that survives of the old `client.ts`. That file was the HTTP layer
 * — a `fetch` per endpoint, aimed at `/api/screentime` on a loopback port, with
 * a per-launch token in every header, plus a `SCREENTIME_AVAILABLE` flag that
 * existed because under `npm run dev` there was no host to answer. The tracker
 * now runs inside this process, the calls are in `core/db/api.ts` with the rest,
 * and whether anything is recording is a question Rust answers directly
 * (`st_availability`) rather than something the frontend infers from a failed
 * request.
 */

export type Category = StCategory;

export const CATEGORIES = ST_CATEGORIES;

/** `3h 42m`, `42m`, `18s` — the same shape wherever a duration is printed */
export function humanise(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

/** seconds since midnight → `14:05` */
export function clockOf(secondsSinceMidnight: number): string {
  const h = Math.floor(secondsSinceMidnight / 3600);
  const m = Math.floor((secondsSinceMidnight % 3600) / 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** a category name Rust sent, narrowed — an unknown one reads as neutral */
export const asCategory = (value: string | undefined): Category =>
  (CATEGORIES as readonly string[]).includes(value ?? '') ? (value as Category) : 'neutral';

export const CATEGORY_COLOR: Record<Category, string> = {
  study: 'hsl(var(--success))',
  neutral: 'hsl(var(--muted-foreground))',
  distraction: 'hsl(var(--destructive))',
};

export const CATEGORY_BAR: Record<Category, string> = {
  study: 'bg-[hsl(var(--success))]',
  neutral: 'bg-muted-foreground',
  distraction: 'bg-[hsl(var(--destructive))]',
};

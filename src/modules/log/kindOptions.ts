import type { Task } from '../../core/db';

/**
 * What the task "kind" field suggests.
 *
 * A kind is free text on purpose — MIS never limits a student to a list — but
 * typing the same words every time is friction. So the dropdown offers the
 * presets, then any kind the student has **used at least three times** before,
 * most-used first. Three is the line between a one-off ("Mock test review") and
 * a habit ("Allen module"). The count is read from the tasks themselves, so
 * nothing extra is stored and deleting old tasks naturally retires a kind.
 *
 * Kept free of Solid so it is a plain function of its inputs.
 */

/** the session kinds the app always offers, in this order */
export const PRESET_KINDS = ['Practice PYQ', 'Reference problems', 'Doubt solving (AI)'] as const;

export const REFERENCE_KIND = 'Reference problems';

/** a custom kind appears in the dropdown once it has been used this many times */
export const PROMOTE_AFTER = 3;

const key = (kind: string) => kind.trim().toLowerCase();

/** whether a kind (however it was typed) is the reference-problems kind */
export const isReferenceKind = (kind: string) => key(kind) === key(REFERENCE_KIND);

/**
 * The dropdown list: presets first, then custom kinds used `PROMOTE_AFTER`+
 * times, most-used first. Kinds are grouped case-insensitively and shown in the
 * spelling used most recently (tasks are stored newest first).
 */
export function kindSuggestions(tasks: readonly Pick<Task, 'kind'>[]): string[] {
  const presetKeys = new Set(PRESET_KINDS.map(key));
  const counts = new Map<string, { label: string; count: number; firstSeen: number }>();

  tasks.forEach((t, i) => {
    const label = (t.kind ?? '').trim();
    if (!label) return;
    const k = key(label);
    if (presetKeys.has(k)) return;
    const hit = counts.get(k);
    if (hit) hit.count += 1;
    else counts.set(k, { label, count: 1, firstSeen: i });
  });

  const custom = [...counts.values()]
    .filter((c) => c.count >= PROMOTE_AFTER)
    // most-used first; ties go to the one used most recently
    .sort((a, b) => b.count - a.count || a.firstSeen - b.firstSeen)
    .map((c) => c.label);

  return [...PRESET_KINDS, ...custom];
}

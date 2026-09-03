import type { BookOpen } from 'lucide-solid';

/**
 * One name for "a Lucide icon component", so the dozen places that take an icon
 * as a prop don't each spell out the component type.
 *
 * It is derived from a real icon rather than written by hand: `lucide-solid`'s
 * own prop type has changed name across versions, and deriving it means an
 * upgrade that renames it is a compile error here instead of a wrong signature
 * everywhere.
 */
export type Icon = typeof BookOpen;

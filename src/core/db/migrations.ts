import { DEFAULT_FOCUS_SETTINGS, DEFAULT_TRACK_PRIORITIES, seedHabits } from './seed';
import { TRACK_IDS, type DbShape, type MistakeReason } from './types';

/**
 * Patches a saved database forward to the current shape.
 *
 * MIS keeps one JSON blob in localStorage, so a database saved by an older
 * build is missing whatever has been added since. Every new field, table, or
 * renamed value needs a step here, or returning users hit `undefined` on load.
 *
 * Mutates `db` in place and returns whether anything actually changed — the
 * caller only rewrites storage when it did.
 */
export const migrate = (db: DbShape): boolean => {
  let migrated = false;

  if (!db.topics) {
    db.topics = [];
    migrated = true;
  }

  if (!db.focus_settings) {
    db.focus_settings = { ...DEFAULT_FOCUS_SETTINGS };
    migrated = true;
  } else if (!db.focus_settings.timer_design) {
    // settings saved before the flip-clock option existed
    db.focus_settings.timer_design = 'ring';
    migrated = true;
  }

  // data saved before the app had modes opens in Academic
  if (!db.app_mode) {
    db.app_mode = 'academic';
    migrated = true;
  }

  // sleep window used to live in Wellness component state and was never saved
  if (db.user && !db.user.sleep_bedtime) {
    db.user.sleep_bedtime = '22:30';
    db.user.sleep_wake = '06:30';
    migrated = true;
  }

  // ── Daily Log tables ────────────────────────────────────────────────────
  if (!db.habits) {
    db.habits = seedHabits();
    migrated = true;
  }
  if (!db.habit_log) {
    db.habit_log = [];
    migrated = true;
  }
  if (!db.track_priorities) {
    db.track_priorities = { ...DEFAULT_TRACK_PRIORITIES };
    migrated = true;
  } else {
    // a track added after these priorities were saved
    for (const id of TRACK_IDS) {
      if (!db.track_priorities[id]) {
        db.track_priorities[id] = DEFAULT_TRACK_PRIORITIES[id];
        migrated = true;
      }
    }
  }

  // ── mark logbook ────────────────────────────────────────────────────────
  // it gained chapter / difficulty / time_spent, and the three original
  // mistake reasons became the nine MIS ones
  const OLD_REASONS: Record<string, MistakeReason> = {
    'Conceptual Error': 'Conceptual',
    'Silly Mistake': 'Careless',
  };
  for (const entry of db.mark_logbook ?? []) {
    const old = entry as unknown as Record<string, unknown>;
    if (old.chapter === undefined) {
      // subjects used to be stored as "Physics - Kinematics"
      const [subject, ...rest] = String(old.subject ?? '').split(' - ');
      entry.subject = subject.trim();
      entry.chapter = rest.join(' - ').trim();
      migrated = true;
    }
    if (old.difficulty === undefined) {
      entry.difficulty = 'Medium';
      migrated = true;
    }
    if (old.time_spent === undefined) {
      entry.time_spent = 0;
      migrated = true;
    }
    const remapped = OLD_REASONS[String(old.mistake_reason)];
    if (remapped) {
      entry.mistake_reason = remapped;
      migrated = true;
    }
  }

  return migrated;
};

import { supabase } from '../auth/client';
import { DEFAULT_FOCUS_SETTINGS, DEFAULT_TRACK_PRIORITIES } from './seed';
import type {
  DailyMetric,
  DbShape,
  FocusSession,
  Habit,
  HabitLogEntry,
  MarkLogbookEntry,
  Priority,
  Task,
  TopicItem,
  TrackId,
} from './types';

/**
 * The Supabase half of the data layer: pulling an account's rows down into a
 * DbShape, and pushing local changes back up.
 *
 * ── Why it works this way ────────────────────────────────────────────────────
 * Every component in MIS reads the database synchronously — `useState(() =>
 * ArborDatabase.getMarkLogbook())` runs during render and cannot await a
 * network call. Rewriting every module to be async would have meant touching
 * the whole app, so instead:
 *
 *   localStorage stays the thing the app reads and writes, instantly, offline.
 *   This file keeps Supabase in step with it in the background.
 *
 * So a write is never blocked on the network, and a flaky connection loses
 * nothing — the rows are already saved locally and go up on the next attempt.
 *
 * ── What gets sent ───────────────────────────────────────────────────────────
 * Not the whole database. After each successful sync we keep a snapshot of what
 * the server has; the next push diffs the current database against it and sends
 * only the rows that were added, changed or removed. Ticking one habit is one
 * small request, not a re-upload of two years of papers.
 */

// ─── sync status, for the indicator in the sidebar ───────────────────────────

export type SyncStatus =
  /** no account attached — running local-only */
  | 'off'
  /** first load of an account's rows */
  | 'pulling'
  /** sending local changes up */
  | 'pushing'
  /** everything local is on the server */
  | 'synced'
  /** the last attempt failed; changes are safe locally and will retry */
  | 'error';

export interface SyncState {
  status: SyncStatus;
  /** set when status is 'error' — shown on hover, kept short enough to read */
  message?: string;
  /** epoch ms of the last successful sync */
  lastSyncedAt?: number;
}

let state: SyncState = { status: 'off' };
const listeners = new Set<(s: SyncState) => void>();

const setState = (next: Partial<SyncState>) => {
  state = { ...state, ...next };
  listeners.forEach((fn) => fn(state));
};

export const getSyncState = () => state;

/** returns an unsubscribe function, shaped for `useEffect(() => subscribeSync(fn), [])` */
export const subscribeSync = (fn: (s: SyncState) => void): (() => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};

// ─── the collection table map ────────────────────────────────────────────────

/**
 * `order` is how the rows come back out of SQL to rebuild the JavaScript array
 * the app expects. A table is 'desc' when the app's array is newest-first
 * (`unshift`) and 'asc' when it appends.
 *
 * `conflict` is which columns decide "this is the same row" on upsert. Most
 * tables use the primary key, but `daily_metrics` and `habit_log` use their
 * natural key instead — see the note on convergence further down.
 */
interface Collection<T extends { id: string }> {
  table: string;
  order: 'asc' | 'desc';
  conflict: string;
  /** the DbShape field this table fills */
  key: keyof DbShape;
  toRow: (item: T, userId: string, seq: number) => Record<string, unknown>;
  fromRow: (row: Record<string, unknown>) => T;
}

const asNum = (v: unknown, fallback = 0) => (typeof v === 'number' ? v : Number(v) || fallback);
const asStr = (v: unknown, fallback = '') => (typeof v === 'string' ? v : fallback);
const asBool = (v: unknown) => v === true;

const dailyMetrics: Collection<DailyMetric> = {
  table: 'daily_metrics',
  order: 'asc',
  // one metric per day is the rule; conflicting on the date rather than the id
  // is what makes two devices that both created "today" merge instead of double
  conflict: 'user_id,date',
  key: 'daily_metrics',
  toRow: (m, user_id, seq) => ({
    id: m.id, user_id, seq,
    date: m.date,
    study_hours: m.study_hours,
    dpps_got: m.dpps_got,
    dpps_complete: m.dpps_complete,
    reading_habit: m.reading_habit,
    revision_habit: m.revision_habit,
    mood_score: m.mood_score,
    well_spent_time: m.well_spent_time,
    posture_count: m.posture_count,
    water_count: m.water_count,
  }),
  fromRow: (r) => ({
    id: asStr(r.id),
    date: asStr(r.date),
    study_hours: asNum(r.study_hours),
    dpps_got: asNum(r.dpps_got),
    dpps_complete: asNum(r.dpps_complete),
    reading_habit: asBool(r.reading_habit),
    revision_habit: asBool(r.revision_habit),
    mood_score: asNum(r.mood_score, 5),
    well_spent_time: asNum(r.well_spent_time),
    posture_count: asNum(r.posture_count),
    water_count: asNum(r.water_count),
  }),
};

const markLogbook: Collection<MarkLogbookEntry> = {
  table: 'mark_logbook',
  order: 'desc',
  conflict: 'user_id,id',
  key: 'mark_logbook',
  toRow: (e, user_id, seq) => ({
    id: e.id, user_id, seq,
    date: e.date,
    subject: e.subject,
    chapter: e.chapter,
    grade: e.grade,
    score: e.score,
    max_score: e.max_score,
    difficulty: e.difficulty,
    time_spent: e.time_spent,
    mistake_reason: e.mistake_reason,
    notes: e.notes,
  }),
  fromRow: (r) => ({
    id: asStr(r.id),
    date: asStr(r.date),
    subject: asStr(r.subject),
    chapter: asStr(r.chapter),
    grade: asStr(r.grade),
    score: asNum(r.score),
    max_score: asNum(r.max_score),
    difficulty: asStr(r.difficulty, 'Medium') as MarkLogbookEntry['difficulty'],
    time_spent: asNum(r.time_spent),
    mistake_reason: asStr(r.mistake_reason, 'Other') as MarkLogbookEntry['mistake_reason'],
    notes: asStr(r.notes),
  }),
};

const focusSessions: Collection<FocusSession> = {
  table: 'focus_sessions',
  order: 'desc',
  conflict: 'user_id,id',
  key: 'focus_sessions',
  toRow: (s, user_id, seq) => ({
    id: s.id, user_id, seq,
    date: s.date,
    duration_minutes: s.duration_minutes,
    tag: s.tag,
    completed: s.completed,
  }),
  fromRow: (r) => ({
    id: asStr(r.id),
    date: asStr(r.date),
    duration_minutes: asNum(r.duration_minutes),
    tag: asStr(r.tag),
    completed: asBool(r.completed),
  }),
};

const tasks: Collection<Task> = {
  table: 'tasks',
  order: 'asc',
  conflict: 'user_id,id',
  key: 'tasks',
  toRow: (t, user_id, seq) => ({
    id: t.id, user_id, seq,
    title: t.title,
    subject: t.subject,
    // '' is not a date as far as Postgres is concerned, so an empty due date
    // has to go up as null
    due_date: t.due_date || null,
    completed: t.completed,
  }),
  fromRow: (r) => ({
    id: asStr(r.id),
    title: asStr(r.title),
    subject: asStr(r.subject),
    due_date: asStr(r.due_date),
    completed: asBool(r.completed),
  }),
};

const topics: Collection<TopicItem> = {
  table: 'topics',
  order: 'desc',
  conflict: 'user_id,id',
  key: 'topics',
  toRow: (t, user_id, seq) => ({
    id: t.id, user_id, seq,
    date: t.date,
    name: t.name,
    type: t.type,
    done: t.done,
  }),
  fromRow: (r) => ({
    id: asStr(r.id),
    date: asStr(r.date),
    name: asStr(r.name),
    type: asStr(r.type, 'taught') as TopicItem['type'],
    done: asBool(r.done),
  }),
};

const habits: Collection<Habit> = {
  table: 'habits',
  order: 'asc',
  conflict: 'user_id,id',
  key: 'habits',
  toRow: (h, user_id, seq) => ({
    id: h.id, user_id, seq,
    name: h.name,
    priority: h.priority,
    legacy_key: h.legacy_key ?? null,
  }),
  fromRow: (r) => {
    const habit: Habit = {
      id: asStr(r.id),
      name: asStr(r.name),
      priority: asStr(r.priority, 'medium') as Priority,
    };
    // the field is optional in the type — only set it when it is really there,
    // so a habit without one does not gain a `legacy_key: undefined`
    if (r.legacy_key) habit.legacy_key = r.legacy_key as Habit['legacy_key'];
    return habit;
  },
};

const habitLog: Collection<HabitLogEntry> = {
  table: 'habit_log',
  order: 'asc',
  // a habit is either ticked on a day or it is not, so the day and the habit
  // together identify the row — same convergence reason as daily_metrics
  conflict: 'user_id,date,habit_id',
  key: 'habit_log',
  toRow: (l, user_id, seq) => ({
    id: l.id, user_id, seq,
    date: l.date,
    habit_id: l.habit_id,
  }),
  fromRow: (r) => ({
    id: asStr(r.id),
    date: asStr(r.date),
    habit_id: asStr(r.habit_id),
  }),
};

/**
 * Order matters. `habit_log.habit_id` has a foreign key to `habits`, so a new
 * habit has to exist before its ticks can be written. Pushing upserts in this
 * order and deletes in the reverse keeps that true without any special-casing.
 */
const COLLECTIONS = [
  habits,
  dailyMetrics,
  markLogbook,
  focusSessions,
  tasks,
  topics,
  habitLog,
] as unknown as Collection<{ id: string }>[];

// ─── profile (the four singletons) ───────────────────────────────────────────

const profileRow = (db: DbShape, user_id: string) => ({
  user_id,
  name: db.user.name,
  target_study_hours: db.user.target_study_hours,
  water_target: db.user.water_target,
  blocked_apps: db.user.blocked_apps,
  is_focus_active: db.user.is_focus_active,
  free_time_unlocked: db.user.free_time_unlocked,
  sleep_bedtime: db.user.sleep_bedtime,
  sleep_wake: db.user.sleep_wake,
  focus_minutes: db.focus_settings.focus_minutes,
  short_break: db.focus_settings.short_break,
  long_break: db.focus_settings.long_break,
  rounds_before_long: db.focus_settings.rounds_before_long,
  timer_design: db.focus_settings.timer_design,
  track_priorities: db.track_priorities,
  app_mode: db.app_mode,
});

const applyProfileRow = (db: DbShape, r: Record<string, unknown>, userId: string) => {
  db.user = {
    // the account *is* the identity now, so the old local id is replaced by it
    id: userId,
    name: asStr(r.name),
    target_study_hours: asNum(r.target_study_hours, 6),
    water_target: asNum(r.water_target, 8),
    blocked_apps: Array.isArray(r.blocked_apps) ? (r.blocked_apps as string[]) : [],
    is_focus_active: asBool(r.is_focus_active),
    free_time_unlocked: asBool(r.free_time_unlocked),
    sleep_bedtime: asStr(r.sleep_bedtime, '23:00'),
    sleep_wake: asStr(r.sleep_wake, '07:00'),
  };
  db.focus_settings = {
    focus_minutes: asNum(r.focus_minutes, DEFAULT_FOCUS_SETTINGS.focus_minutes),
    short_break: asNum(r.short_break, DEFAULT_FOCUS_SETTINGS.short_break),
    long_break: asNum(r.long_break, DEFAULT_FOCUS_SETTINGS.long_break),
    rounds_before_long: asNum(r.rounds_before_long, DEFAULT_FOCUS_SETTINGS.rounds_before_long),
    timer_design: asStr(r.timer_design, 'ring') === 'flip' ? 'flip' : 'ring',
  };
  // a saved profile from an older version can be missing a track the app has
  // since gained, so the defaults fill the gaps rather than leaving undefined
  db.track_priorities = {
    ...DEFAULT_TRACK_PRIORITIES,
    ...(r.track_priorities as Record<TrackId, Priority> | null),
  };
  db.app_mode = asStr(r.app_mode) === 'life' ? 'life' : 'academic';
};

// ─── ordering ────────────────────────────────────────────────────────────────

/**
 * Give every row a `seq` that puts the array back in the same order after a
 * round trip through SQL.
 *
 * Ranks always increase with array index; `seq` is the rank, negated for the
 * tables read back newest-first. A row that already has a seq keeps it, and a
 * new row gets a value between its neighbours — so adding one paper writes one
 * row instead of renumbering the archive.
 */
const assignSeqs = <T extends { id: string }>(
  items: T[],
  order: 'asc' | 'desc',
  known: Map<string, number>
): Map<string, number> => {
  const toRank = (seq: number) => (order === 'desc' ? -seq : seq);
  const toSeq = (rank: number) => (order === 'desc' ? -rank : rank);

  const ranks: (number | null)[] = items.map((it) => {
    const seq = known.get(it.id);
    return seq === undefined ? null : toRank(seq);
  });

  for (let i = 0; i < ranks.length; i++) {
    if (ranks[i] !== null) continue;

    // the run of consecutive new rows starting here
    let end = i;
    while (end < ranks.length && ranks[end] === null) end++;

    const before = i > 0 ? (ranks[i - 1] as number) : null;
    const after = end < ranks.length ? (ranks[end] as number) : null;
    const gap = end - i;

    for (let k = 0; k < gap; k++) {
      if (before !== null && after !== null) {
        // share the space between the two neighbours evenly
        ranks[i + k] = before + ((after - before) * (k + 1)) / (gap + 1);
      } else if (before !== null) {
        ranks[i + k] = before + k + 1;
      } else if (after !== null) {
        ranks[i + k] = after - (gap - k);
      } else {
        ranks[i + k] = i + k;
      }
    }
    i = end - 1;
  }

  return new Map(items.map((it, i) => [it.id, toSeq(ranks[i] as number)]));
};

// ─── pull ────────────────────────────────────────────────────────────────────

/** the seqs the server currently has, so a push does not renumber untouched rows */
let remoteSeqs = new Map<string, Map<string, number>>();

export interface PullResult {
  /** null when this account has never synced — nothing has been uploaded yet */
  db: DbShape | null;
}

/**
 * Read an account's whole database. `base` supplies the fields a brand-new
 * account has not stored yet (and is what gets returned untouched if the
 * account turns out to be empty).
 */
export const pull = async (userId: string, base: DbShape): Promise<PullResult> => {
  if (!supabase) return { db: null };

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (profileError) throw new Error(profileError.message);
  // no profile row means this account has never been synced from any device
  if (!profile) return { db: null };

  const db: DbShape = JSON.parse(JSON.stringify(base)) as DbShape;
  applyProfileRow(db, profile as Record<string, unknown>, userId);

  const seqs = new Map<string, Map<string, number>>();

  for (const coll of COLLECTIONS) {
    const { data, error } = await supabase
      .from(coll.table)
      .select('*')
      .eq('user_id', userId)
      .order('seq', { ascending: coll.order === 'asc' });

    if (error) throw new Error(`${coll.table}: ${error.message}`);

    const rows = (data ?? []) as Record<string, unknown>[];
    (db[coll.key] as unknown[]) = rows.map(coll.fromRow);
    seqs.set(coll.table, new Map(rows.map((r) => [asStr(r.id), asNum(r.seq)])));
  }

  remoteSeqs = seqs;
  return { db };
};

// ─── push ────────────────────────────────────────────────────────────────────

const sameRow = (a: Record<string, unknown>, b: Record<string, unknown>) =>
  JSON.stringify(a) === JSON.stringify(b);

/** Postgres rejects an oversized statement, so long tables go up in batches */
const CHUNK = 400;

const chunked = <T>(items: T[]) => {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += CHUNK) out.push(items.slice(i, i + CHUNK));
  return out;
};

/**
 * Send everything that differs between `next` and `previous` (the snapshot of
 * what the server last confirmed). Returns nothing — the caller takes its own
 * snapshot once this resolves without throwing.
 */
export const push = async (userId: string, next: DbShape, previous: DbShape | null) => {
  if (!supabase) return;

  // ── profile ──
  const nextProfile = profileRow(next, userId);
  if (!previous || !sameRow(nextProfile, profileRow(previous, userId))) {
    const { error } = await supabase.from('profiles').upsert(nextProfile, { onConflict: 'user_id' });
    if (error) throw new Error(`profiles: ${error.message}`);
  }

  const upserts: { coll: Collection<{ id: string }>; rows: Record<string, unknown>[] }[] = [];
  const deletes: { coll: Collection<{ id: string }>; ids: string[] }[] = [];

  for (const coll of COLLECTIONS) {
    const items = next[coll.key] as { id: string }[];
    const before = (previous?.[coll.key] ?? []) as { id: string }[];

    const seqs = assignSeqs(items, coll.order, remoteSeqs.get(coll.table) ?? new Map());
    const beforeById = new Map(before.map((it) => [it.id, it]));
    const knownSeqs = remoteSeqs.get(coll.table) ?? new Map<string, number>();

    const rows = items
      .filter((it) => {
        const was = beforeById.get(it.id);
        // new row, changed row, or a row whose position moved
        if (!was) return true;
        if (!sameRow(it as Record<string, unknown>, was as Record<string, unknown>)) return true;
        return knownSeqs.get(it.id) !== seqs.get(it.id);
      })
      .map((it) => coll.toRow(it, userId, seqs.get(it.id) as number));

    const liveIds = new Set(items.map((it) => it.id));
    const goneIds = before.filter((it) => !liveIds.has(it.id)).map((it) => it.id);

    if (rows.length) upserts.push({ coll, rows });
    if (goneIds.length) deletes.push({ coll, ids: goneIds });
  }

  // Deletes run first, and in reverse table order, so a habit's ticks are gone
  // before the habit they point at is.
  for (const { coll, ids } of [...deletes].reverse()) {
    for (const batch of chunked(ids)) {
      const { error } = await supabase
        .from(coll.table)
        .delete()
        .eq('user_id', userId)
        .in('id', batch);
      if (error) throw new Error(`${coll.table}: ${error.message}`);
    }
    const known = remoteSeqs.get(coll.table);
    ids.forEach((id) => known?.delete(id));
  }

  for (const { coll, rows } of upserts) {
    for (const batch of chunked(rows)) {
      const { error } = await supabase
        .from(coll.table)
        .upsert(batch, { onConflict: coll.conflict });
      if (error) throw new Error(`${coll.table}: ${error.message}`);
    }
    const known = remoteSeqs.get(coll.table) ?? new Map<string, number>();
    rows.forEach((r) => known.set(asStr(r.id), asNum(r.seq)));
    remoteSeqs.set(coll.table, known);
  }
};

/** forget what the server had — used when switching accounts */
export const resetRemoteSeqs = () => {
  remoteSeqs = new Map();
};

export { setState as setSyncState };

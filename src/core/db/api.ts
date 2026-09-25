/**
 * The bridge. One typed function per Tauri command in
 * `src-tauri/src/commands.rs`, and nothing else.
 *
 * **This is the only file in the frontend allowed to call `invoke`.** Everything
 * above it — stores, hooks, components — goes through these functions, so the
 * whole surface the UI can reach is this one list. That is deliberate: the old
 * app talked to its Python host over loopback HTTP with a per-launch token
 * spliced into `index.html`, and the call sites were scattered across three
 * modules. There is no port, no token and no fetch here; `invoke` is a function
 * call into the same process.
 *
 * Two conventions worth knowing:
 *
 * - **Arguments are camelCase here, snake_case in Rust.** Tauri converts between
 *   them. `durationMinutes` below is `duration_minutes` in `commands.rs`.
 * - **Every mutating command has already written the vault by the time its
 *   promise resolves.** There is no save step and no debounce to wait out. If a
 *   call rejects, nothing was persisted — see `state.rs::mutate`.
 *
 * Errors arrive as `{ code, message }` — see [`MisError`] below.
 */

import { invoke } from './bridge';

import type {
  AppMode,
  AuditRecord,
  AuthStatus,
  Availability,
  CompactDay,
  DailyMetric,
  DaySummary,
  DbShape,
  EntryPatch,
  FocusSettings,
  MarkLogbookEntry,
  JournalPatch,
  MetricPatch,
  NewEntry,
  NewJournalEntry,
  Priority,
  Profile,
  ScoredDay,
  StSettings,
  Streak,
  TaskDetails,
  TopicDetails,
  TopicType,
  TrackId,
  TrackerStatus,
  UserConfig,
  VaultInfo,
  WidgetPlacement,
  WrapInput,
  WrapOutcome,
} from './types';

// ── Errors ──────────────────────────────────────────────────────────────────

/** Every rejection from a command below. Mirrors `src-tauri/src/error.rs`. */
export interface MisError {
  code:
    | 'vault'
    | 'dpapi'
    | 'corrupt'
    | 'not-found'
    | 'day-locked'
    /** The vault is password-protected and nobody has signed in. */
    | 'locked'
    /** Wrong username or password — deliberately not told apart. */
    | 'bad-credentials'
    | 'bad-recovery-code'
    /** Too many failed sign-ins; the message says how long to wait. */
    | 'throttled'
    /** A form problem the user can fix; the message says which. */
    | 'invalid'
    | 'audit'
    | 'screen-time'
    | 'io'
    /** Android only: the command has no Kotlin backend implementation this pass (see `MisPlugin.kt`). */
    | 'not-implemented';
  message: string;
}

const isMisError = (e: unknown): e is MisError =>
  typeof e === 'object' && e !== null && 'code' in e && 'message' in e;

/**
 * Whether a rejection is the locked-day refusal.
 *
 * This one is *branched on* rather than displayed, because a locked day is an
 * ordinary outcome rather than a fault: the Daily Log greys out and says today
 * is submitted. Any other rejection is a real failure and is shown as one.
 */
export const isDayLocked = (e: unknown) => isMisError(e) && e.code === 'day-locked';

/** The stable tag of a rejection, or `undefined` if it wasn't one of ours. */
export const errorCode = (e: unknown): MisError['code'] | undefined =>
  isMisError(e) ? e.code : undefined;

/** The sentence to show the user for any rejection, however it arrived. */
export const errorMessage = (e: unknown) =>
  isMisError(e) ? e.message : e instanceof Error ? e.message : String(e);

// ── Account ─────────────────────────────────────────────────────────────────
//
// The only commands that work while the app is locked. Every other command
// rejects with `locked` until `authLogin` resolves — enforced in Rust, so this
// list is not the lock, only the way to open it.

export const authStatus = () => invoke<AuthStatus>('auth_status');

/**
 * Finish onboarding: store the profile and put the vault behind the password.
 * Resolves with the recovery code — the one and only time it is ever available.
 */
export const authSetup = (profile: Profile, password: string) =>
  invoke<string>('auth_setup', { profile, password });

export const authLogin = (username: string, password: string) =>
  invoke<void>('auth_login', { username, password });

/** Lock MIS without quitting. */
export const authLock = () => invoke<void>('auth_lock');

/**
 * Reset a forgotten password with the recovery code. Signs in, and resolves with
 * the *replacement* code — the one used is retired.
 */
export const authRecover = (code: string, newPassword: string) =>
  invoke<string>('auth_recover', { code, newPassword });

export const authChangePassword = (current: string, newPassword: string) =>
  invoke<void>('auth_change_password', { current, newPassword });

/** Retire the current recovery code and get a new one. Needs the password. */
export const authNewRecoveryCode = (current: string) =>
  invoke<string>('auth_new_recovery_code', { current });

// ── Database ────────────────────────────────────────────────────────────────

export const dbLoad = () => invoke<DbShape>('db_load');

export const todayMetric = () => invoke<DailyMetric>('db_today_metric');

export const todayIsLocked = () => invoke<boolean>('db_today_is_locked');

/** Patch today's metrics. Rejects with a `day-locked` error once the day is submitted. */
export const updateToday = (patch: MetricPatch) =>
  invoke<DailyMetric>('db_update_today', { patch });

export const saveUser = (user: UserConfig) => invoke<void>('db_save_user', { user });

/** Submit today. Returns the fingerprint Rust stored for it. */
export const lockToday = () => invoke<string>('db_lock_today');

export const unlockToday = () => invoke<void>('db_unlock_today');

/**
 * Whether a locked day still hashes to the fingerprint taken when it was
 * submitted. `false` means the day was edited outside the app.
 */
export const dayIsIntact = (date: string) => invoke<boolean>('db_day_is_intact', { date });

// ── Mark logbook ────────────────────────────────────────────────────────────

export const addMarkEntry = (entry: NewEntry) => invoke<void>('db_add_mark_entry', { entry });

/** Bulk insert from the sheet importer. Resolves with how many rows landed. */
export const addMarkEntries = (entries: NewEntry[]) =>
  invoke<number>('db_add_mark_entries', { entries });

export const updateMarkEntry = (id: string, patch: EntryPatch) =>
  invoke<void>('db_update_mark_entry', { id, patch });

export const deleteMarkEntry = (id: string) => invoke<void>('db_delete_mark_entry', { id });

export const replaceMarkLogbook = (entries: MarkLogbookEntry[]) =>
  invoke<void>('db_replace_mark_logbook', { entries });

/**
 * The fingerprints of every row already stored, so the importer can spot
 * duplicates without pulling the whole logbook across the bridge.
 */
export const logbookFingerprints = () => invoke<string[]>('db_logbook_fingerprints');

// ── Focus ───────────────────────────────────────────────────────────────────

export const addFocusSession = (durationMinutes: number, tag: string, completed: boolean) =>
  invoke<void>('db_add_focus_session', { durationMinutes, tag, completed });

/** Credit finished focus time to today's study hours. */
export const addStudyMinutes = (minutes: number) =>
  invoke<void>('db_add_study_minutes', { minutes });

export const saveFocusSettings = (settings: FocusSettings) =>
  invoke<void>('db_save_focus_settings', { settings });

// ── Tasks ───────────────────────────────────────────────────────────────────

export const addTask = (
  title: string,
  subject: string,
  dueDate: string,
  mode: AppMode,
  details?: TaskDetails,
) => invoke<void>('db_add_task', { title, subject, dueDate, mode, details: details ?? null });

export const toggleTask = (id: string) => invoke<void>('db_toggle_task', { id });

export const deleteTask = (id: string) => invoke<void>('db_delete_task', { id });

// ── DPPs ────────────────────────────────────────────────────────────────────

export const addDpp = (subject: string, topic: string, teacher: string) =>
  invoke<void>('db_add_dpp', { subject, topic, teacher });

export const toggleDpp = (id: string) => invoke<void>('db_toggle_dpp', { id });

export const deleteDpp = (id: string) => invoke<void>('db_delete_dpp', { id });

// ── Topics ──────────────────────────────────────────────────────────────────

export const addTopic = (name: string, kind: TopicType, details?: TopicDetails) =>
  invoke<void>('db_add_topic', { name, kind, details: details ?? null });

export const toggleTopic = (id: string) => invoke<void>('db_toggle_topic', { id });

export const deleteTopic = (id: string) => invoke<void>('db_delete_topic', { id });

// ── Session wrap-up and the journal ─────────────────────────────────────────

/**
 * Wrap up a study session in one all-or-nothing write: tick the tasks, record the
 * doubts, plan the next session, log the misses and write the journal entry. If
 * it rejects, nothing was written. On a locked day, ticks and doubts are refused
 * (`isDayLocked`) while next-session tasks due after today still go through.
 */
export const sessionWrap = (input: WrapInput) =>
  invoke<WrapOutcome>('db_session_wrap', { input });

/** Write a journal entry by hand. Returns its id. Not day-locked. */
export const addJournalEntry = (entry: NewJournalEntry) =>
  invoke<string>('db_add_journal_entry', { entry });

export const updateJournalEntry = (id: string, patch: JournalPatch) =>
  invoke<void>('db_update_journal_entry', { id, patch });

export const deleteJournalEntry = (id: string) =>
  invoke<void>('db_delete_journal_entry', { id });

// ── Habits ──────────────────────────────────────────────────────────────────

export const addHabit = (name: string, priority: Priority) =>
  invoke<void>('db_add_habit', { name, priority });

export const setHabitPriority = (id: string, priority: Priority) =>
  invoke<void>('db_set_habit_priority', { id, priority });

export const deleteHabit = (id: string) => invoke<void>('db_delete_habit', { id });

/** The ids of the habits ticked on a given day. */
export const habitsDoneOn = (date: string) => invoke<string[]>('db_habits_done_on', { date });

/** Rejects with a `day-locked` error once today is submitted. */
export const toggleHabitToday = (id: string) => invoke<void>('db_toggle_habit_today', { id });

// ── Tracks and mode ─────────────────────────────────────────────────────────

export const setTrackPriority = (id: TrackId, priority: Priority) =>
  invoke<void>('db_set_track_priority', { id, priority });

export const setAppMode = (mode: AppMode) => invoke<void>('db_set_app_mode', { mode });

export const setDailyLogLayout = (mode: AppMode, layout: WidgetPlacement[]) =>
  invoke<void>('db_set_daily_log_layout', { mode, layout });

/**
 * Wipe the database back to a starting state.
 *
 * `demo: false` gives a genuinely empty app — that is what a fresh install gets.
 * `demo: true` fills it with sample rows for looking around, and is offered in
 * Settings behind a confirmation, never on first launch.
 */
export const dbReset = (demo: boolean) => invoke<DbShape>('db_reset', { demo });

// ── Scoring ─────────────────────────────────────────────────────────────────

/**
 * The last `days` days, oldest first, each scored per mode.
 *
 * Days with no log come back with `scores: null` and `by_mode: null`. **Charts
 * draw a gap for those, never a zero** — a day you did not open the app is not a
 * day you scored nothing.
 */
export const scoreRange = (days: number) => invoke<ScoredDay[]>('score_range', { days });

export const studyStreak = () => invoke<Streak>('study_streak');

// ── Vault ───────────────────────────────────────────────────────────────────

export const vaultInfo = () => invoke<VaultInfo>('vault_info');

export const auditRecent = (limit: number) => invoke<AuditRecord[]>('audit_recent', { limit });

/** The whole database as pretty JSON, for the user to save wherever they like. */
export const exportJson = () => invoke<string>('db_export_json');

export const appVersion = () => invoke<string>('app_version');

// ── Screen time ─────────────────────────────────────────────────────────────

export const stStatus = () => invoke<TrackerStatus>('st_status');

/**
 * Whether screen time can be reported at all, and a sentence saying why not.
 *
 * **Ask this before drawing a zero.** "You used nothing today" and "nothing was
 * recording" look identical on a chart and only one of them is ever true.
 */
export const stAvailability = () => invoke<Availability>('st_availability');

/** One day in full, including its timeline. Omit `day` for today. */
export const stDay = (day?: string) => invoke<DaySummary>('st_day', { day: day ?? null });

/** The last `days` days, oldest first, without the per-day timelines. */
export const stRange = (days: number) => invoke<CompactDay[]>('st_range', { days });

/**
 * Opt in or out of background tracking: recording continues with no window open
 * (from a tray icon), and MIS starts with Windows. Rejects if Windows refuses
 * the startup entry, in which case nothing has changed.
 */
export const stSetBackground = (enabled: boolean) =>
  invoke<TrackerStatus>('st_set_background', { enabled });

/** Every app→category assignment in force, defaults and overrides merged. */
export const stCategories = () => invoke<Record<string, string>>('st_categories');

export const stSetCategory = (app: string, category: string) =>
  invoke<void>('st_set_category', { app, category });

export const stClearCategory = (app: string) => invoke<void>('st_clear_category', { app });

/** Every site→category assignment in force, shipped and overridden merged. */
export const stSiteCategories = () => invoke<Record<string, string>>('st_site_categories');

/** The name to print for every site MIS recognises, keyed by activity key. */
export const stSiteLabels = () => invoke<Record<string, string>>('st_site_labels');

/**
 * File one site rather than the whole browser it was opened in.
 *
 * `key` is an activity key (`web:youtube`), not an app name. A site assignment
 * is the most specific thing there is, so it beats an assignment made against
 * the browser itself — see `categories::category_for_activity`.
 */
export const stSetSiteCategory = (key: string, category: string) =>
  invoke<void>('st_set_site_category', { key, category });

export const stClearSiteCategory = (key: string) =>
  invoke<void>('st_clear_site_category', { key });

export const stRecordedDays = () => invoke<string[]>('st_recorded_days');

/** Delete a day's recording, or every day when `day` is omitted. */
export const stForget = (day?: string) => invoke<number>('st_forget', { day: day ?? null });

export const stSettings = () => invoke<StSettings>('st_settings');

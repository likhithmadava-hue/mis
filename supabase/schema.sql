-- MIS (Mistake Intelligence System) — Supabase schema
--
-- Paste this whole file into the Supabase dashboard's SQL Editor and press Run.
-- It is safe to run more than once: every statement is `if not exists` or
-- `drop policy … / create policy`, so re-running it repairs the schema rather
-- than erroring or wiping anything.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- The shape mirrors `src/core/db/types.ts` one-for-one, with two differences:
--
--   1. `DbShape`'s four singletons — `user`, `focus_settings`, `app_mode` and
--      `track_priorities` — are one row in `profiles`. They are settings, not a
--      collection, so there is exactly one per account.
--
--   2. Every table carries `seq double precision`. localStorage stored these
--      collections as JavaScript arrays, and array order is visible in the UI
--      (newest paper first, habits in the order you added them). SQL rows have
--      no order, so `seq` carries it. It is a float on purpose: inserting
--      between two rows takes the midpoint of their seqs, so one new entry
--      writes one row instead of renumbering the whole table.
--
-- Ids are `text`, not `uuid`, because the app generates them client-side with
-- `crypto.randomUUID()` and falls back to a short random string on browsers
-- that lack it. Text accepts both.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- Security model: every table is owned per-user and has row-level security on.
-- A logged-in browser holds the *anon* key, which by itself can read nothing —
-- the policies below are what grant access, and they only ever match rows where
-- `user_id = auth.uid()`. Two accounts on the same database cannot see each
-- other's data even though they use the identical key.

-- ══ profiles ═════════════════════════════════════════════════════════════════
-- One row per account: everything in DbShape that is not a list.
create table if not exists public.profiles (
  user_id            uuid primary key references auth.users (id) on delete cascade,
  name               text    not null default '',

  -- UserConfig
  target_study_hours numeric not null default 6,
  water_target       integer not null default 8,
  blocked_apps       jsonb   not null default '[]'::jsonb,
  is_focus_active    boolean not null default false,
  free_time_unlocked boolean not null default false,
  sleep_bedtime      text    not null default '23:00',
  sleep_wake         text    not null default '07:00',

  -- FocusSettings
  focus_minutes      integer not null default 25,
  short_break        integer not null default 5,
  long_break         integer not null default 15,
  rounds_before_long integer not null default 4,
  timer_design       text    not null default 'ring',

  -- Record<TrackId, Priority>, e.g. {"studies":"high","mood":"medium",…}
  track_priorities   jsonb   not null default '{}'::jsonb,

  -- 'academic' | 'life'
  app_mode           text    not null default 'academic',

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- ══ daily_metrics ════════════════════════════════════════════════════════════
-- One row per day you logged anything. `unique (user_id, date)` is the rule the
-- app already assumes: getTodayMetric() looks a day up by date and expects one.
create table if not exists public.daily_metrics (
  id              text        not null,
  user_id         uuid        not null default auth.uid()
                              references auth.users (id) on delete cascade,
  date            date        not null,
  study_hours     numeric     not null default 0,
  dpps_got        integer     not null default 0,
  dpps_complete   integer     not null default 0,
  reading_habit   boolean     not null default false,
  revision_habit  boolean     not null default false,
  mood_score      integer     not null default 5,
  well_spent_time integer     not null default 0,
  posture_count   integer     not null default 0,
  water_count     integer     not null default 0,
  seq             double precision not null default 0,
  created_at      timestamptz not null default now(),
  primary key (user_id, id),
  unique (user_id, date)
);

-- ══ mark_logbook ═════════════════════════════════════════════════════════════
-- The exam-paper archive. Marks lost is derived in the app (max_score - score)
-- and deliberately not stored, so it can never disagree with the two columns
-- it comes from.
create table if not exists public.mark_logbook (
  id             text        not null,
  user_id        uuid        not null default auth.uid()
                             references auth.users (id) on delete cascade,
  date           date        not null,
  subject        text        not null default '',
  chapter        text        not null default '',
  grade          text        not null default '',
  score          numeric     not null default 0,
  max_score      numeric     not null default 0,
  -- 'Easy' | 'Medium' | 'Hard'
  difficulty     text        not null default 'Medium',
  -- minutes spent on the paper
  time_spent     integer     not null default 0,
  -- one of the nine MISTAKE_REASONS
  mistake_reason text        not null default 'Other',
  notes          text        not null default '',
  seq            double precision not null default 0,
  created_at     timestamptz not null default now(),
  primary key (user_id, id)
);

create index if not exists mark_logbook_user_date_idx
  on public.mark_logbook (user_id, date desc);

-- ══ focus_sessions ═══════════════════════════════════════════════════════════
create table if not exists public.focus_sessions (
  id               text        not null,
  user_id          uuid        not null default auth.uid()
                               references auth.users (id) on delete cascade,
  date             date        not null,
  duration_minutes integer     not null default 0,
  tag              text        not null default '',
  completed        boolean     not null default false,
  seq              double precision not null default 0,
  created_at       timestamptz not null default now(),
  primary key (user_id, id)
);

-- ══ tasks ════════════════════════════════════════════════════════════════════
-- `due_date` is nullable: the app allows an empty due date, and '' is not a date.
create table if not exists public.tasks (
  id         text        not null,
  user_id    uuid        not null default auth.uid()
                         references auth.users (id) on delete cascade,
  title      text        not null default '',
  subject    text        not null default '',
  due_date   date,
  completed  boolean     not null default false,
  seq        double precision not null default 0,
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);

-- ══ topics ═══════════════════════════════════════════════════════════════════
create table if not exists public.topics (
  id         text        not null,
  user_id    uuid        not null default auth.uid()
                         references auth.users (id) on delete cascade,
  date       date        not null,
  name       text        not null default '',
  -- 'taught' | 'revise' | 'solve'
  type       text        not null default 'taught',
  done       boolean     not null default false,
  seq        double precision not null default 0,
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);

-- ══ habits ═══════════════════════════════════════════════════════════════════
-- `legacy_key` is set on only two habits, the ones the Growth Tracker's streak
-- matrix still reads out of daily_metrics. Null on every habit you add.
create table if not exists public.habits (
  id         text        not null,
  user_id    uuid        not null default auth.uid()
                         references auth.users (id) on delete cascade,
  name       text        not null default '',
  -- 'high' | 'medium' | 'low'
  priority   text        not null default 'medium',
  -- 'reading_habit' | 'revision_habit' | null
  legacy_key text,
  seq        double precision not null default 0,
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);

-- ══ habit_log ════════════════════════════════════════════════════════════════
-- One row per habit actually ticked. There is no row for "not done" — absence
-- is the answer, which is why unticking deletes rather than flipping a flag.
create table if not exists public.habit_log (
  id         text        not null,
  user_id    uuid        not null default auth.uid()
                         references auth.users (id) on delete cascade,
  date       date        not null,
  habit_id   text        not null,
  seq        double precision not null default 0,
  created_at timestamptz not null default now(),
  primary key (user_id, id),
  unique (user_id, date, habit_id)
);

create index if not exists habit_log_user_date_idx
  on public.habit_log (user_id, date);

-- ── deleting a habit must take its ticks with it ─────────────────────────────
-- habit_id points at habits.id, but habits' primary key is the pair
-- (user_id, id), so the foreign key has to be on the pair too.
alter table public.habit_log
  drop constraint if exists habit_log_habit_fk;
alter table public.habit_log
  add constraint habit_log_habit_fk
  foreign key (user_id, habit_id)
  references public.habits (user_id, id) on delete cascade;

-- ══ row-level security ═══════════════════════════════════════════════════════
-- Turning RLS on denies everything by default; the policies then re-open
-- exactly one thing: rows whose user_id is the logged-in user.
--
--   using       — which existing rows you may see, change or delete
--   with check  — which rows you are allowed to write
--
-- Both are needed. `using` alone would let you *update* one of your rows to
-- carry somebody else's user_id.
do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'daily_metrics', 'mark_logbook', 'focus_sessions',
    'tasks', 'topics', 'habits', 'habit_log'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);

    execute format('drop policy if exists "own rows: read" on public.%I', t);
    execute format('drop policy if exists "own rows: insert" on public.%I', t);
    execute format('drop policy if exists "own rows: update" on public.%I', t);
    execute format('drop policy if exists "own rows: delete" on public.%I', t);

    execute format(
      'create policy "own rows: read" on public.%I for select
         using (auth.uid() = user_id)', t);
    execute format(
      'create policy "own rows: insert" on public.%I for insert
         with check (auth.uid() = user_id)', t);
    execute format(
      'create policy "own rows: update" on public.%I for update
         using (auth.uid() = user_id) with check (auth.uid() = user_id)', t);
    execute format(
      'create policy "own rows: delete" on public.%I for delete
         using (auth.uid() = user_id)', t);
  end loop;
end $$;

-- ══ profiles.updated_at ══════════════════════════════════════════════════════
-- Stamped by the database rather than the client, so it is always the moment
-- the row really changed.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

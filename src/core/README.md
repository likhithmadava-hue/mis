# utils — the data layer

## db.ts — the app's "database"

Every screen reads and writes data **only** through the `ArborDatabase` class
in this file. Nothing else in the app touches storage directly. That's a
deliberate design choice: when you later swap localStorage for a real backend
(your Python engine + sqlite, or Supabase), **this is the only file you'll
need to rewrite** — the screens won't change at all.

### What it stores (in the browser's localStorage, key `arbor_db`)

| Data | Type name | Used by |
|------|-----------|---------|
| Your profile + settings (study target, water target, blocklist, focus state) | `UserConfig` | all tabs |
| One row per day: study hours, DPPs, habits, mood, water, posture | `DailyMetric` | Growth Tracker, Wellness |
| Test results with mistake classification | `MarkLogbookEntry` | Growth Tracker |
| Completed focus timer sessions | `FocusSession` | Focus Timer, Database tab |
| Pomodoro durations & rounds | `FocusSettings` | Focus Timer |
| To-do items (sample data for now) | `Task` | Database tab |
| Syllabus topics: taught / left to revise / left to solve | `TopicItem` | Growth Tracker |
| Your habit list, each with a High/Medium/Low priority | `Habit` | Daily Log |
| One row per habit ticked on a given day (no row = not done) | `HabitLogEntry` | Daily Log |
| The High/Medium/Low priority of each of the five tracks | `Priority` per `TrackId` | Daily Log |

### The main functions

- `getUserConfig()` / `saveUserConfig(user)` — read/write settings & blocklist
- `getTodayMetric()` — get today's row (creates a blank one if it's a new day)
- `updateTodayMetric(patch)` — update part of today's row; also re-checks
  whether free time should unlock (study + DPP goals both at 100%)
- `getMarkLogbook()` / `addMarkLogbookEntry(entry)` / `deleteMarkLogbookEntry(id)`
- `getDailyMetrics()`, `getFocusSessions()`, `getTasks()` — read-only lists
- `getTopics()` / `addTopic(name, type)` / `toggleTopicDone(id)` / `deleteTopic(id)`
  — the topic tracker (types: `taught`, `revise`, `solve`)
- `addFocusSession(session)` — records a finished Pomodoro round
- `addStudyMinutes(minutes)` — credits focus minutes to today's study hours
- `getFocusSettings()` / `saveFocusSettings(settings)` — Pomodoro durations
- `getHabits()` / `addHabit(name, priority)` / `setHabitPriority(id, priority)` /
  `deleteHabit(id)` — the Daily Log's habit list
- `getHabitsDoneOn(date?)` — which habit ids were ticked that day (defaults to today)
- `toggleHabitToday(id)` — tick/untick a habit for today; the two seeded habits
  also keep `reading_habit` / `revision_habit` in sync for the streak matrix
- `getTrackPriorities()` / `setTrackPriority(id, priority)` — how much each of
  the five Daily Log tracks counts (`high` 3×, `medium` 2×, `low` 1×)
- `resetToDefault()` — wipe everything back to the sample seed data

### First run

If no saved data exists yet, `db.ts` automatically fills in **seed data**
(7 days of sample metrics, 4 sample test entries, a starter blocklist) so the
app never looks empty. Press "Reset Seed" in the Database tab to get back to
this state anytime.

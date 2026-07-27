# components — the five screens

Each file here is one tab of the app. They all follow the same pattern:
read data from `../utils/db.ts`, show it, and save changes back.

## FocusTimer.tsx — "Focus Timer" tab (the default screen)

A Pomodoro timer with a Forest-style twist: a tree that grows 🌱→🌿→🪴→🌳
inside the progress ring as your focus session advances.

- **Three modes** — Focus (25 min), Short Break (5 min), Long Break (15 min);
  after every 4 focus rounds the long break comes up automatically.
- **Controls** — Start/Pause, Reset, and Skip. Optionally tag what you're
  working on before starting so the session is labelled in your history.
- **On finishing a focus round** — the session is saved, its minutes are added
  to **today's study hours** (so the streak matrix and the Wellness gatekeeper
  update on their own), confetti fires, and a chime plays.
- **Today's Focus** panel — session count, total minutes, and the list of
  what you worked on.
- **Timer Settings** — change any duration and the rounds-before-long-break;
  saved permanently.

Two implementation notes: the countdown targets a real end *timestamp* rather
than counting ticks, so it stays accurate if the window is minimized; and the
remaining time is mirrored into the window title while running.

## GrowTrack.tsx — "Growth Tracker" tab

Every section on this dashboard is collapsible — the chevron (˅) in each
section header folds it away.

- **7-Day Academic Streak Matrix** — one card per day showing study hours
  (green circle when ≥ 4h), DPP completion bar, and R/V badges for
  reading/revision habits. The **Week / Today** switch swaps this for
  **Today's Review**: stat tiles for today's study hours, DPPs, habits,
  mood, water, posture, and leisure (green when the goal is met).
- **Daily Log & Topics** — steppers to set how many DPPs were given and
  completed today (feeds the streak matrix and the Wellness gatekeeper),
  plus a topic tracker with three lists: **Topics Taught**, **Left to
  Revise**, and **Left to Solve**. Add a topic with the form; tick it green
  when revised/solved; hover to reveal delete.
- **Error Analysis Engine** — bar chart splitting your logged mistakes into
  Conceptual Errors / Silly Mistakes / Time Pressure, plus average score and
  total test count.
- **Mark Logbook** — the "Log Mistake" button opens a form to record a test:
  subject, grade, score, mistake type, and a note about how to fix it.
  Hover over an entry to reveal its delete button.

## DailyLog.tsx — "Daily Log" tab

The old spreadsheet version of this log filled in a whole week at a time. This
one only ever asks about **today**, and lets you say how much each thing
matters to you.

- **Five tracks** — Studies, DPPs/Records, Habits, Mood, Well-Spent. Each is
  scored **out of 10** from what you enter, and colour-coded red → green just
  like the spreadsheet was.
- **Priority (H / M / L)** — the little letter buttons on each card. Priority
  does two things: it **sorts** the cards (high ones rise to the top and get a
  cyan border), and it **weights** the score — High counts 3×, Medium 2×,
  Low 1×.
- **Today's score** — the big number at the top, all five tracks blended by
  their weights and reported out of 50 (the same target the sheet used).
- **Habits** get their own full-width card: tick them off, give each habit its
  own priority, add new ones, delete ones you've outgrown. A habit's priority
  changes how much it pulls the Habits score up.
- **Last 7 Days** — a read-only grid of the past week, one row per track. This
  is the *only* place the weekly view survives, and you can't type into it.

It writes into the same `daily_metrics` record the other tabs use, so setting
study hours or DPPs here also updates the Growth Tracker and the Wellness
gatekeeper. Ticking the "Read 20 pages" or "Revise yesterday" habits also flips
the R/V badges in the streak matrix.

## ProtectGuard.tsx — "App Guard" tab *(currently disabled)*

> This tab is commented out in `src/App.tsx` for now. The real blocking
> features will be built in the Python backend; this simulator screen can be
> re-enabled anytime by uncommenting the marked lines in `App.tsx`.

- **Perimeter Accessibility Controls** — add app names (e.g. "TikTok") to a
  blocklist; each shows as a card with a delete button.
- **Perimeter Blocker Simulator** — type an app/domain and press "Inject
  Request" to test the blocking rules:
  - blocked if it matches the list **and** focus mode is active, or
  - blocked if it matches **and** free time isn't unlocked yet
    (free time unlocks when daily study + DPP goals hit 100%).
- ⚠️ This is a **simulation** — the real blocking will come from the Python
  backend (process killing + firewall rules) later.

## BalanceWellness.tsx — "Wellness" tab

- **Free Time Mode Gatekeeper** — shows progress toward daily study hours and
  DPP goals; when both hit 100%, leisure apps are considered "unlocked".
- **Active Wellness Check-ins** — mood slider (1–10) and leisure-minutes slider.
- **Hydration & Posture buttons** — tap to count; hitting the water target
  fires confetti 🎉.
- **Sleep window form** — pick bedtime and wake time (currently just shows a
  confirmation nudge; doesn't store it yet).

## DatabaseExplorer.tsx — "Database" tab

- Shows the raw stored data as tables: `mark_logbook`, `focus_sessions`,
  `tasks`, and `users`.
- **Refresh** re-reads the data; **Reset Seed** wipes everything back to the
  original sample data (asks for confirmation first).
- Handy for understanding what the app actually saves, and for debugging.

# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Where you are

This is `D:\MIS(APK)\Dev` — **the working copy. Every change goes here.**

- `D:\MIS(APK)\RD` — the verified copy. **Never edit it directly.** It is refreshed from Dev only when vohrim says **"Recast"**, and only then.
- This folder **is** `github.com/likhithmadava-hue/mis`. Work happens on a feature branch, landed via `gh pr create` — never commit or push straight to `main`; vohrim merges, not Claude. `.gitignore` excludes `node_modules/`, `dist/`, `src-tauri/target/` and every `*.pem`. Nothing secret is in the tree — check before adding one.
- `D:\MIS(Dev)` — **the previous app**: React + a Python FastAPI host. It still runs. This repository is its replacement, not its successor branch; the two share no code.
- `D:\MIS(Dev)\dev_keys\mis_dev_private.pem` — the vault recovery **private** key. Never ships, never commits, back it up offline. The matching **public** key is compiled into `src-tauri/src/vault/recovery_key.rs` and is safe to publish.

> **Multiple Claude sessions have edited the old project at once and it caused real damage** — a folder built from a stale snapshot, a `tsc` run against another session's half-written file. Before a long edit, check mtimes. If a file's mtime moves while you are working, someone else is in it.

## What this project is

**MIS (Mistake Intelligence System)** — a Windows study app that turns the mistakes you make into a picture of how you are actually improving. It is one installed desktop application:

- **Tauri 2** shell — one process, one window, an NSIS/MSI installer.
- **Rust** backend (`src-tauri/`, ~5,600 lines, 82 tests) — owns the encrypted vault, the scoring, the day locks, the audit log and the screen-time tracker.
- **SolidJS + TypeScript + Tailwind** frontend (`src/`, ~9,300 lines) — draws what Rust computed.

There is **no HTTP server, no port, no token and no `fetch`**. The old app talked to a local Python host over loopback with a per-launch token spliced into `index.html`; that whole surface is gone. The frontend reaches Rust through Tauri's IPC bridge, which is a function call in the same process.

Still **not built**: the phase-2 blocking engine (process watching, firewall rules, hosts-file website blocking). No code for it exists here either.

The user (vohrim) is a beginner developer building a real, shippable app. Prefer the higher-quality approach over the easier one, and explain what you're doing.

## Commands

```
npm install           # needs network access to cdn.sheetjs.com (see below)
npm run dev           # Vite alone on :5173 — no Rust, no vault, so nothing loads
npm run app           # tauri dev — THE way to run MIS. Rust + the window + live reload
npm run app:build     # tauri build — produces the installers
npm run build         # vite build → dist/ only. tauri build runs this itself
npm run typecheck     # tsc --noEmit — the only type gate on the frontend
npm run icons         # regenerate the icon set from src-tauri/icons/source.png
cargo test --manifest-path src-tauri/Cargo.toml    # the 82 Rust tests
```

**`npm run dev` on its own cannot work.** Every screen is a view of the vault and the vault lives in Rust, so a browser tab gets the "MIS could not load your data" screen. Use `npm run app`.

**Vite does not typecheck.** It strips types without looking at them, so a type error builds and ships silently. Run `npm run typecheck` after editing the frontend, and `cargo test` after editing Rust.

`npm install` needs **cdn.sheetjs.com** — `xlsx` is pinned to a SheetJS tarball URL, not the stale npm package. Offline installs fail on that one dependency.

### Building the installers

`npm run app:build` writes to `src-tauri/target/release/bundle/`:

| File | What it is |
|---|---|
| `nsis/MIS_1.0.0_x64-setup.exe` | the installer to hand people — per-user, no admin prompt |
| `msi/MIS_1.0.0_x64_en-US.msi` | the same app for anyone who wants an MSI |

`webviewInstallMode` is `downloadBootstrapper`, so a PC without WebView2 fetches it during setup rather than shipping ~130 MB inside the installer. Bundles are **not** committed — `.gitignore` excludes them. They belong on a GitHub Release.

Building needs the Rust toolchain and the MSVC linker:

```
winget install --id Rustlang.Rustup -e
winget install --id Microsoft.VisualStudio.2022.BuildTools -e --override "--wait --quiet --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"
```

Open a new terminal afterwards so `cargo` is on `PATH`.

## Architecture

**Rust owns the data. Solid draws it.** That sentence decides almost every question in this repository.

```
src-tauri/src/
  main.rs            three lines — calls mis_lib::run()
  lib.rs             the Tauri builder: opens the vault, starts the tracker,
                     registers every command, flushes screen time on exit
  commands.rs        THE IPC surface. One #[tauri::command] per thing the UI can do
  state.rs           AppState: the in-memory database behind a lock, read()/mutate()
  error.rs           MisError → { code, message } as the frontend sees it
  dates.rs           local-calendar date strings — the only place one is made
  scoring.rs         the whole scoring engine, plus study_streak
  db/                types · seed · migrations · day_hash · dev_mirror · mod (the operations)
  vault/             crypto (AES-256-GCM) · dpapi · recovery_key · audit · mod
  screentime/        tracker · winapi · store · categories · summary

src/
  index.tsx          boot() the database, THEN mount. Failure renders BootFailure
  App.tsx            the shell: rail, mode switch, TABS, daily quote, tab rendering
  core/
    db/api.ts        the ONLY file allowed to call invoke(). One function per command
    db/store.ts      the reactive view of the database: db, revision, act(), reload()
    db/types.ts      TypeScript mirrors of src-tauri/src/db/types.rs
    scoring/meta.ts  labels, icons, Tailwind classes, targets — no arithmetic
    ui/              Card · Panel · Select · charts · mistakes · labels · icon · railTooltip · useFullscreen
    dates.ts         isoDaysAgo / todayIso
  modules/
    growth/  log/  database/  focus/  screentime/
```

`core/` is what the app knows, `modules/` is what the app shows. **Nothing in `core/` imports from `modules/`.** Every module is a folder with an `index.ts` barrel, so `App.tsx` imports `./modules/growth` and never a path inside it. Adding a screen = a module folder with a barrel + a `TABS` entry (with `modes`) + a render line in `App.tsx`. (`growth` is the one barrel with named rather than default exports, because it ships two tabs.)

**Inside a module the component is layout and a `create*` file is the logic** — `createDailyLog.ts`, `createFocusTimer.ts`, `growthData.ts`, `logbookFilters.ts`. Put writes and arithmetic there, not in the component. (`createDailyLog.ts` and `createFocusTimer.ts` are named that way rather than `dailyLog.ts` / `focusTimer.ts` because Windows filesystems are case-insensitive and TypeScript rejects `dailyLog.ts` alongside `DailyLog.tsx`.)

### The bridge

- **`src/core/db/api.ts` is the only file that may call `invoke`.** Everything above it goes through those ~45 typed functions, so the app's whole reachable surface is one readable list.
- **Arguments are camelCase in TypeScript, snake_case in Rust.** Tauri converts between them: `durationMinutes` here is `duration_minutes` in `commands.rs`.
- **Every mutating command has already written the vault by the time its promise resolves.** There is no save step and no debounce to wait out. If a call rejects, nothing was persisted — see `state.rs::mutate`.
- Errors arrive as `{ code, message }`. Branch on `code`, never on the English. `isDayLocked(e)` is the one branch the UI makes; everything else is shown with `errorMessage(e)`.

### The store

`core/db/store.ts` holds one `createStore<DbShape>` and every component reads it. Writes go through `act()`, which awaits the command and then reloads the whole database from Rust:

```ts
export async function act<T>(command: Promise<T>): Promise<T> {
  const out = await command;
  await reload();
  return out;
}
```

Reloading everything after every write sounds wasteful and is not: `reconcile({ key: 'id', merge: false })` diffs the incoming database against the one already in the store, so an unchanged row stays strictly identical and the components watching it never re-run. That is what lets the rule be absolute — **no component keeps its own copy of a record, ever.** There is no `triggerUpdate` counter any more; a habit ticked in the Daily Log is in the Growth Tracker's numbers before the click finishes.

Anything Rust *derives* rather than stores (a scored range, the streak, a tamper check) is not part of `DbShape`, so it cannot live in the store. Fetch those with `createResource` sourced on `revision()`, which bumps on every reload.

## The vault

`%LOCALAPPDATA%\MIS` — the same folder, the same file formats and the same recovery key as the old Python host, so an existing vault opens in this app untouched.

| File | What it is |
|---|---|
| `vault.mis` | the database, AES-256-GCM |
| `vault.key` | the data key, wrapped twice: Windows DPAPI for this user, **and** the RSA public key in `vault/recovery_key.rs` |
| `audit.log` | hash-chained, append-only |
| `screentime/*.st` | one DPAPI-sealed file per recorded day |

**The honest limits must stay honest.** Encryption protects against *other Windows users, other PCs, and tampering*. It cannot hide data from the logged-in user (the key is sealed to them) or from an administrator. Don't let the UI claim otherwise.

A **remote dev-pull** channel was asked for and deliberately **not built** — it re-adds the server and network surface that this rewrite removed. It's a separate decision, not something to bolt on.

A vault that cannot be *opened* never reaches the window: `lib.rs` catches it and shows a message box. A vault that opens but fails to *load* renders `BootFailure` in `index.tsx`, which says plainly that nothing was written.

## The two modes

The app runs in **Academic** or **Life**, chosen from the rail and persisted as `app_mode`. The mode is not a filter on one shared screen — it changes the whole app:

| | Academic | Life |
|---|---|---|
| Tabs | Home, Daily Log, Report, Database, Focus Timer | Home, Daily Log, Report, Screen Time |
| Tracks | studies, dpps | habits, mood, well_spent, wellness |
| Log also accepts | Topics, Log-a-Paper | — |
| Accent | cyan | green |

**Each mode scores its own day out of 50, from its own tracks only.** There is deliberately no combined number — a bad study day must not drag down the Life score. If you find yourself writing one, that is a design regression.

`TABS` in `App.tsx` carries a `modes` array per entry. `switchMode` checks whether the active tab still exists in the new mode and falls back to `'home'` if not — **without that, switching to Life from the Database renders a blank pane.**

**Mode theming is one CSS rule, not component logic.** Every accent resolves through `--primary`, so `:root[data-mode='life']` in `index.css` retints the rail, buttons, focus rings, glow, scrollbars and charts at once; `App.tsx` only sets `document.documentElement.dataset.mode`. Style with tokens (`text-primary`, `bg-primary`) and you get both modes free; hardcode a hex and you break Life mode. The mistake-type colours in `core/ui/mistakes.ts` are the deliberate exception — an error type means the same thing in both modes.

## Rules that are easy to break

- **A day with no log scores `null`, not zero.** `ScoredDay.scores` and `by_mode` are nullable and **charts draw a gap** — a day you never opened MIS and a day you wasted are different facts. `NO_DATA` in `core/scoring/meta.ts` is that styling and is deliberately not `heat(0)`.
- **Reading today must not create today.** `db::today_metric` is a pure read that returns a blank row when there is none; the row is only inserted by `db::update_today_metric`, i.e. by an actual edit. Making the read a `mutate` means every launch logs a zero day forever.
- **The study streak counts days that met the target**, not days with any hours at all, and it is counted over the **whole history** — a 40-day streak must not read as 7 because the 7-day view is on. Today not being logged doesn't break it; the count starts at yesterday and `today_done` is reported separately.
- **The day lock is enforced in Rust.** `refuse_if_locked` rejects the write; the greyed-out Daily Log is the *explanation* of that refusal, never the mechanism. In the old app the guard was in the browser and devtools could walk around it.
- **`fingerprint()` in `db/types.rs` and `norm()` in `sheetImport.ts` must agree.** Both lower-case, collapse `_ - .` to spaces and collapse runs of whitespace. If they drift, the importer silently writes duplicate rows — no error, just two of everything.
- **Screen Time must say when nothing was watching.** An empty chart and "you used nothing today" look identical and only one is ever true — hence `st_availability` and the `NotWatching` card. `availability()` deliberately does **not** report paused as unavailable: paused is a status, and hiding the tab would hide the Resume button and the history with it.
- **Migrations are mandatory.** `db/migrations.rs` patches saved vaults forward and runs against `serde_json::Value` *before* typing, which is what lets it add fields that `DbShape` now requires. Any new required field, table or renamed value needs a step there, or an existing vault fails to deserialize on load.
- **Habits have two representations.** New habits live in `habits` + `habit_log`, but `DailyMetric` still carries `reading_habit` / `revision_habit`. `Habit.legacy_key` bridges them in `toggle_habit_today`. If you touch habit storage, keep the bridge working.
- **`src/core/db/types.ts` is a mirror, not a source.** `src-tauri/src/db/types.rs` decides the shape. The arrow only points one way.
- **`db/dev_mirror.rs` writes a plaintext `mis-dev.db` next to the encrypted vault, debug builds only.** `refresh()` is `#[cfg(debug_assertions)]`, so a release build never creates it — the installer's "encrypted vault" claim stays true for everyone except the person building the app. It exists so a developer can inspect the vault in an ordinary SQLite viewer; nothing reads it back into MIS.

## Conventions and gotchas

- **Solid is not React.** No `useState` copies, no dependency arrays, no `.map()` in JSX. `class` not `className`; `<For>` / `<Show>` / `<Switch>` / `<Dynamic>`; **never destructure props** (it breaks reactivity); SVG attributes are kebab-case (`stroke-width`) and `stroke-dasharray` wants a string.
- **Browser dialogs and downloads do not work in a webview.** Use `@tauri-apps/plugin-dialog` (`confirm`, `message`, `save`) and `@tauri-apps/plugin-fs` (`writeFile`, `writeTextFile`) instead of `window.confirm`, `alert` and `<a download>`.
- **The fs capability is scoped.** `src-tauri/capabilities/default.json` allows `$DOWNLOAD`, `$DOCUMENT`, `$DESKTOP` and `$HOME` and explicitly **denies `$APPLOCALDATA`** — the app must not be able to reach its own vault through the file plugin.
- **No `windows` crate.** The nine Win32 functions MIS touches — DPAPI, foreground window, idle time — are declared by hand in `vault/dpapi.rs` and `screentime/winapi.rs`. That keeps a heavyweight dependency and its breaking releases out of the two places where a silently changed signature would mis-seal the vault key or mis-record what you were doing.
- **Sizing is one fluid clamp, not a zoom.** `html { font-size: clamp(...) }` in `index.css` is the single knob for the whole app's size; everything else is in rem. Move the first and last numbers to resize text, padding, icons and cards together.
- **Wide content scrolls inside its own box.** `overflow-x-auto` on the table or the grid — never let the page scroll sideways.
- **Never use a native `<select>`.** On Windows the webview draws a half-native popup that ignores `option { background-color }`, so it renders white on this dark theme. Use `core/ui/Select.tsx`.
- **Charts are hand-rolled** in `core/ui/charts.tsx` — no chart library. `TrendChart` stretches with `preserveAspectRatio="none"`, so strokes need `vector-effect="non-scaling-stroke"` and the dots are HTML positioned over the SVG to stay circular; it splits the series into runs of non-null points so gaps stay gaps.
- **Charts carry their own tooltip**, not a `title` attribute. `submitted_at` is the only clock time MIS stores, which is why it is the honest answer to "when was this?" — a day with a log but no submit says "not submitted yet" rather than inventing a time.
- **Timer completion is a three-step confirm.** A finished round starts a looping Web Audio alarm and opens the `DONE_PROMPTS` dialog; **the session is only written after the third "yes"**. The dialog lives inside the fullscreen container ref on purpose — a `fixed` element outside the fullscreened node would not paint. Audio is best-effort and must never break the timer.
- **The countdown is driven by a target timestamp**, not by counting ticks, so a throttled window comes back with the right time left.
- **Spreadsheet import never trusts the sheet.** `sheetImport.ts` guesses the column mapping, then `ImportSheet.tsx` shows the guess, allows every column to be overridden, previews the finished rows and reports what will be skipped — duplicates and unusable rows — before writing. Dates read **day-first** for ambiguous numeric text (this app is used in India), and `Date` cells are formatted by hand because `toISOString()` shifts the day backwards east of UTC.
- **Fonts ship inside the binary.** `src/fonts.css` is ~460 KB of data-URI `@font-face` rules: Inter for body, `font-space` (Space Grotesk) for headings, `font-mono` (JetBrains Mono) for numbers. There is no network font and the CSP forbids one.
- **`st_categories` is registered but nothing calls it.** The Screen Time tab reads each app's category off `st_day`. Left in place because the categories editor is the obvious next feature.

## Docs

**"Recast" is a command:** when vohrim says it, refresh `D:\MIS(APK)\RD` from this folder — source only, never `node_modules/`, `dist/` or `src-tauri/target/`. Nothing else in this repository changes.

**"Arise" is a command:** when vohrim says it, re-read the code and refresh **this file only**. Do not touch `README.md`, which is beginner-facing and updated separately on request.

## Maintaining this file

This file has a fixed shape. On "Arise," fit new facts into the matching section below — don't tack a new one onto the end:

1. **Where you are** — which copy this is, related copies, secrets/keys.
2. **What this project is** — the pitch, the stack, what's not built yet.
3. **Commands** — how to run/build/test it.
4. **Architecture** — the file tree and the rules that follow from it.
5. **Domain sections** (the vault, the two modes) — one per subsystem that has rules worth stating.
6. **Rules that are easy to break** / **Conventions and gotchas** — one bullet per trap, each earning its place by naming the concrete failure it prevents.
7. **Docs** — trigger words, and what not to touch.

What keeps it from rotting:

- **No dated status lines.** "Verified 3 Aug 2026" is true today and false in a month. A snapshot of current progress belongs in conversation or a commit message, not here — this file states standing rules, not status.
- **Prune on every Arise, don't just append.** Before adding a bullet to a gotchas section, check whether an existing one already describes the trap and merge into it; delete a bullet the moment its underlying code path stops existing.
- **~250-line budget.** If a refresh would push this past ~280 lines, split the overflow into a doc next to the code it describes (e.g. a `src/README.md`) and leave one pointer line here instead of inlining it.
- **Keep the RD copy honest.** `D:\MIS(APK)\RD\CLAUDE.md` is this file after the last "Recast" — it should only differ where the code differs (line counts, features not yet promoted). A structural gap (a section here missing there) is a sync bug, not a feature.

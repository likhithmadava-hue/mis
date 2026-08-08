# MIS — Mistake Intelligence System

A Windows study app that turns the mistakes you make into a picture of how you are
actually improving.

You log the day once. MIS scores it, keeps every paper you've gotten wrong, times
your focus sessions, records where your screen time went — and keeps all of it in
an encrypted vault on your own computer. Nothing is uploaded. There is no account,
no server, and no internet connection involved after you install it.

---

## Install it

1. Download `MIS_1.0.0_x64-setup.exe` from the [Releases](../../releases) page.
2. Run it. It installs for your user only, so Windows will not ask for an
   administrator password.
3. Open **MIS** from the Start menu.

That's the whole thing. Windows SmartScreen may warn you the first time, because
the installer isn't code-signed yet — click **More info → Run anyway**.

If your PC doesn't already have Microsoft's WebView2 runtime, the installer
downloads it during setup. Most Windows 11 machines already have it.

To uninstall: Settings → Apps → MIS → Uninstall. **Your data is not deleted** —
it stays in `%LOCALAPPDATA%\MIS` so a reinstall picks up exactly where you left
off. Delete that folder yourself if you want it gone.

---

## What's in it

**Two modes.** MIS runs as **Academic** (the work that moves your marks) or
**Life** (everything that keeps that work sustainable). The mode changes the whole
app — which tabs exist, what you can log, what gets charted, even the colour.
Each mode scores its own day out of 50. There is deliberately no combined number:
a rough study day shouldn't drag down the rest of your life, and vice versa.

| Tab | What it does |
|---|---|
| **Home** | Today's score, the week around it, and your study streak. One screen, no scrolling. |
| **Daily Log** | The only place you enter anything. Hours, papers, habits, mood, topics. Submit it when the day's done and it locks. |
| **Report** | Every chart. Trends, error analysis, subject performance, the heat grid. |
| **Database** | Every paper you've logged, searchable and filterable. Import the Excel sheet you already keep. |
| **Screen Time** | Where the hours actually went, by app and by category, with a timeline of the day. |
| **Focus Timer** | Pomodoro with a growing tree. Finished minutes count towards your study hours automatically. |

**Priorities decide what counts.** Every track and habit is High, Medium or Low.
High counts 3×, Medium 2×, Low 1× — so the app scores the day *you* care about,
not a default someone else picked.

**Submitting locks the day.** Once you submit, the log is read-only and
fingerprinted. You can reopen it to fix a real mistake, but the unlock is
recorded, and if the day's data ever changes outside the app, MIS tells you.

---

## Where your data lives

Everything is in `%LOCALAPPDATA%\MIS`:

| File | What it is |
|---|---|
| `vault.mis` | your database, encrypted with AES-256-GCM |
| `vault.key` | the key to it, sealed to your Windows account |
| `audit.log` | an append-only record of every change, chained so a deleted line shows |
| `screentime\` | one encrypted file per recorded day |

**What the encryption does and doesn't do.** It protects your data from *other
people who use this PC, from other PCs, and from tampering.* It does **not** hide
anything from you — the key is sealed to your own Windows account, so you are
always able to read it — and it does not hide anything from an administrator of
this machine. Any app that says otherwise is lying to you.

Nothing is ever sent anywhere. There's no telemetry, no crash reporting and no
update check.

---

## Build it yourself

You need [Node.js](https://nodejs.org) 20+, the Rust toolchain, and Microsoft's
C++ build tools:

```powershell
winget install --id OpenJS.NodeJS.LTS -e
winget install --id Rustlang.Rustup -e
winget install --id Microsoft.VisualStudio.2022.BuildTools -e --override "--wait --quiet --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"
```

Open a fresh terminal so `cargo` is on your `PATH`, then:

```powershell
npm install
npm run app          # run MIS with live reload
npm run app:build    # build the installers
```

The installers land in `src-tauri\target\release\bundle\`.

---

## How it's built

| | |
|---|---|
| Shell | [Tauri 2](https://tauri.app) — one process, one window, a real Windows installer |
| Backend | Rust — the vault, the scoring, the day locks, the audit log, the screen-time tracker |
| Frontend | [SolidJS](https://solidjs.com) + TypeScript + Tailwind |
| Charts | hand-rolled SVG, no chart library |

The frontend never stores anything of its own. It asks Rust for the database,
draws it, and calls a command to change it — and that command has written the
encrypted vault before it answers. There's no browser storage, no local server,
no port and no token anywhere in the app.

Fonts, icons and every asset ship inside the binary, so MIS works with the network
switched off.

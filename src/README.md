# src — the app's source code

Everything the app *does* is in this folder.

## Files here

| File | What it does |
|------|--------------|
| `main.tsx` | The entry point. It finds the empty `<div id="root">` in `index.html` and tells React to draw the app inside it. You'll rarely touch this. |
| `App.tsx` | The app shell: the header with the Arbor logo and the 4 tab buttons. It decides which screen is visible and holds the `triggerUpdate` counter (see below). |
| `index.css` | Global styles: the dark color theme (as CSS variables), fonts, and the glow effects. |

## Subfolders

| Folder | What's inside |
|--------|---------------|
| `components/` | The four screens (one file per tab) → see `components/README.md` |
| `utils/` | `db.ts` — the "database" layer that saves and loads all data → see `utils/README.md` |

## How the pieces talk to each other (worth understanding!)

Every screen receives two things from `App.tsx`:

1. **`triggerUpdate`** — a number that goes up by 1 whenever any screen changes
   data. Each screen watches this number and re-reads its data from `db.ts` when
   it changes. That's how adding a mark in one tab updates the stats in another.

2. **A callback like `onLogbookChange`** — the screen calls this after saving
   something, which is what makes `triggerUpdate` go up.

So the data flow is a loop:

```
screen saves data → calls onXxxChange() → App bumps triggerUpdate
→ every screen re-reads from db.ts → UI shows fresh data
```

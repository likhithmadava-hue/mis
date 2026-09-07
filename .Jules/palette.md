## 2025-09-07 - Icon-Only Controls Accessibility
**Learning:** Icon-only buttons (such as timer reset/skip, settings gear, fullscreen toggle, quote refresh) lacked `aria-label` attributes despite having `title` attributes, making them inaccessible to screen readers.
**Action:** Always complement hover `title` tooltips with explicit `aria-label`s on icon-only buttons.

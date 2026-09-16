## 2026-09-16 - Accessible Names on Collapsible Icon Sidebar Rails
**Learning:** Tailwind CSS classes like `sm:hidden` apply `display: none` at desktop viewport widths, which removes child label text from the screen reader accessibility tree when sidebar navigation collapses into icon-only mode.
**Action:** Always provide explicit `aria-label` and state attributes (`aria-current="page"`, `aria-pressed`) on parent `<button>` elements for responsive sidebar controls that visually hide label text in collapsed states.

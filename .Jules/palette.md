## 2026-03-30 - Focus Timer Accessible Controls
**Learning:** Icon-only buttons (reset, skip, settings, fullscreen) and inputs without visible `<label>` tags rely on `aria-label` attributes to be properly announced by screen readers and accessible via assistive devices.
**Action:** Always verify that icon-only buttons receive descriptive `aria-label` attributes matching or expanding on their `title` tooltips, and ensure input controls have associated `aria-label` attributes when layout design omits visual `<label>` elements.

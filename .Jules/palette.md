## 2026-08-25 - Icon-Only Action Buttons in Table Rows and List Cards
**Learning:** Table rows and card items that reveal edit/delete actions on hover risk excluding screen reader and keyboard navigation users if actions lack explicit ARIA labels or `focus-within` visibility triggers.
**Action:** Ensure all icon-only buttons in table rows/cards have explicit `aria-label` attributes (e.g., `aria-label="Edit entry"`) and parents use `focus-within:opacity-100` so focusable elements become visible when tabbed to.

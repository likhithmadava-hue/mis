## 2025-09-02 - Keyboard focus visibility for hover-revealed action buttons

**Learning:** Interactive icon buttons using `opacity-0 group-hover:opacity-100` become completely invisible when keyboard users tab to them, unless explicit `focus:opacity-100` or `focus-within:opacity-100` classes are provided along with focus rings (`focus-visible:ring-2`).
**Action:** Always ensure hover-revealed action buttons include `focus:opacity-100` or `focus-within:opacity-100`, `focus-visible:ring-2`, and context-specific `aria-label` attributes.

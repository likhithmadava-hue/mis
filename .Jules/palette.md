## 2025-08-28 - Icon Button ARIA Context
**Learning:** Icon-only buttons in table rows (`EntryRow`) and list items (`ProtectGuard`) must include contextual `aria-label`s specifying the target item name (e.g., `Edit mistake entry for Physics`) alongside `focus-visible:ring-2` to support screen readers and keyboard navigation.
**Action:** Always include item context in `aria-label` for list/table row action buttons and pair with `focus-visible` ring utilities.

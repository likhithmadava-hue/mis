## 2025-05-18 - Accessible Icon-Only Action Buttons in Perimeter & Timer Controls
**Learning:** Icon-only action buttons in compact list items (e.g., domain blocklist items in ProtectGuard) and toolbars (e.g., TimerToolbar) lacked explicit `aria-label` attributes and visible keyboard focus states, making them inaccessible to screen reader users and keyboard navigation.
**Action:** Always provide explicit `aria-label` (and `title` tooltip) along with `focus-visible:ring-2` styles on icon-only interactive controls.

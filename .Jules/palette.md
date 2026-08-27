## 2025-08-27 - Contextual ARIA Labels for Icon-Only Buttons in Lists and Rows

**Learning:** Generic `title` attributes on icon-only buttons (such as "Edit" or "Delete" in table rows or habit lists) fail to convey which item is being acted upon for screen reader users, especially when multiple identical icon buttons exist on the page.
**Action:** Always include dynamic, contextual `aria-label` attributes (e.g., `aria-label={'Edit ' + entry.subject}`) for list and table row action buttons so assistive technologies clearly announce the target item.

## 2026-09-06 - Direct ISO Date Comparison in Sort Callbacks

**Learning:** Parsing `YYYY-MM-DD` string dates with `new Date()` inside sort callbacks allocates `Date` objects and performs string parsing $O(N \log N)$ times during sorting. ISO 8601 strings (`YYYY-MM-DD`) preserve lexicographical chronological order, allowing direct string comparisons (`a.date < b.date ? -1 : a.date > b.date ? 1 : 0`).

**Action:** Whenever sorting arrays of ISO date strings or objects containing `YYYY-MM-DD` dates, use direct string comparison instead of `new Date()` parsing.

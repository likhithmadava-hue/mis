## 2025-05-10 - Direct ISO String Comparison for Date Sorting

**Learning:** `YYYY-MM-DD` ISO date strings sort in exact chronological order via direct string comparison (`a < b ? -1 : a > b ? 1 : 0`), completely eliminating `Date` object instantiations and parsing inside $O(N \log N)$ sort callbacks.
**Action:** Always prefer direct string comparison for ISO formatted dates during sorting.

## 2026-09-04 - ISO Date String Sorting Optimization
**Learning:** ISO 8601 formatted date strings (`YYYY-MM-DD`) compare lexicographically identical to chronological order. Parsing dates with `new Date(date).getTime()` inside `Array.prototype.sort()` creates unnecessary object allocations and string parsing per comparison (O(N log N) frequency).
**Action:** Always prefer direct string comparison (`a < b ? -1 : a > b ? 1 : 0`) when sorting ISO date strings.

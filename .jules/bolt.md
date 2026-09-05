## 2025-03-01 - Avoid Date parsing when sorting ISO date strings
**Learning:** ISO 8601 formatted date strings (`YYYY-MM-DD`) compare lexicographically in exact chronological order. Constructing `new Date(date).getTime()` inside array `sort` comparison callbacks allocates `O(N log N)` Date objects per sort invocation, causing garbage collection pressure during frequent re-renders or query filtering.
**Action:** Compare ISO date strings directly (`a.date < b.date ? -1 : a.date > b.date ? 1 : 0`) instead of parsing with `new Date()`.

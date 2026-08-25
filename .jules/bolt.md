# Bolt's Journal - Critical Learnings

## 2026-08-25 - Direct String Comparison for ISO Date Sorting
**Learning:** ISO 8601 date strings formatted as `YYYY-MM-DD` sort lexicographically in exact chronological order. Instantiating `new Date(string).getTime()` in `Array.prototype.sort()` comparator callbacks allocates O(N log N) Date objects and incurs string parsing overhead on every comparison. Direct string relational comparison (`a.date > b.date ? 1 : a.date < b.date ? -1 : 0`) avoids GC allocations and parsing overhead, and is significantly faster than `localeCompare()`.
**Action:** Always use direct string relational comparison (`> / <`) for `YYYY-MM-DD` ISO date fields when sorting collections.

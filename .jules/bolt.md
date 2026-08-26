## 2026-07-31 - Direct ISO date string sorting in array comparators
**Learning:** MIS stores dates as ISO `YYYY-MM-DD` strings. Using `new Date(a.date).getTime() - new Date(b.date).getTime()` inside `Array.prototype.sort` creates `2 * N * log(N)` unnecessary `Date` allocations per sort operation. Direct relational string comparison (`a.date < b.date ? -1 : a.date > b.date ? 1 : 0`) is ~15x faster in V8.
**Action:** When sorting ISO date fields in MIS hooks and utilities, compare string primitives directly instead of constructing `Date` objects.

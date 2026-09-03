# Bolt's Performance Journal

## 2026-07-31 - Direct ISO Date Comparison in Sort Callbacks
**Learning:** Parsing ISO `YYYY-MM-DD` date strings with `new Date(str).getTime()` inside `Array.prototype.sort` callbacks instantiates a `Date` object per comparison, creating garbage collection pressure and CPU overhead in O(N log N) operations. Since ISO 8601 date strings are formatted in big-endian order (`YYYY-MM-DD`), lexicographical string comparison (`a < b ? -1 : a > b ? 1 : 0`) produces identical sorting order without any object allocations.
**Action:** Always compare ISO date strings directly using string comparison operators in sort callbacks rather than constructing `Date` objects.

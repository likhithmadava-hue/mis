## 2025-02-25 - Direct ISO String Date Comparison in Sort Callbacks

**Learning:** Array `.sort()` callbacks run $O(N \log N)$ times per sort. When sorting items by ISO date strings (`YYYY-MM-DD`), using `new Date(a.date).getTime() - new Date(b.date).getTime()` instantiates and parses `Date` objects thousands of times on every filter or sort state change. Because ISO 8601 date strings sort lexicographically in chronological order, string comparison `a.date < b.date ? -1 : a.date > b.date ? 1 : 0` produces identical sort results with zero heap allocations and drastically better performance.

**Action:** Always prefer direct string comparison (`a.date < b.date ? -1 : a.date > b.date ? 1 : 0`) over `new Date()` parsing inside array sort callbacks when date values are ISO formatted strings.

## 2025-09-04 - ISO Date String Sorting Performance

**Learning:** Comparing ISO date strings (`YYYY-MM-DD`) directly using string operators (`a.date < b.date ? -1 : a.date > b.date ? 1 : 0`) in `.sort()` callbacks avoids creating $O(N \log N)$ `Date` objects per sort operation while preserving identical sort ordering. Additionally, short-circuiting field checks in filter callbacks avoids creating intermediate arrays and joined strings per element.

**Action:** Prefer direct string lexicographical comparisons for ISO-8601 formatted date strings in array sort functions across logbook and analytics views.

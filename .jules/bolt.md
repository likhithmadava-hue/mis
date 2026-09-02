## 2026-09-02 - ISO Date String Comparisons in Sort Comparators
**Learning:** In TypeScript/JavaScript, ISO 8601 formatted date strings (`YYYY-MM-DD`) maintain strict lexicographical ordering that mirrors chronological ordering. Sorting arrays by parsing `new Date(a.date).getTime()` inside sort comparators creates O(N log N) temporary `Date` objects. Direct string comparison (`a.date < b.date ? -1 : a.date > b.date ? 1 : 0`) is allocation-free and measurably faster.
**Action:** Always prefer direct string comparison for ISO date strings in sort callbacks instead of instantiating `new Date()`.

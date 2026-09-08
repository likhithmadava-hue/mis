# Bolt's Performance Journal

## 2025-05-18 - ISO Date String Sorting & Map Bucketing in Score Calculations
**Learning:** Date sorting on `YYYY-MM-DD` strings with `new Date(a.date).getTime()` creates redundant `Date` object allocations inside $O(N \log N)$ sort callbacks. Direct string comparison (`a.date < b.date ? -1 : a.date > b.date ? 1 : 0`) produces the exact same chronological order with zero GC overhead. Additionally, in range calculations over days, array `.find()` does an $O(N)$ scan per day; pre-bucketing daily metrics into a `Map<string, DailyMetric>` reduces lookup complexity to $O(1)$.
**Action:** Use string comparisons for sorting ISO date strings, and bucket array lookups by date into `Map` before performing multi-day iterations.

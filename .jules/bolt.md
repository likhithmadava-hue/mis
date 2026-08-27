## 2025-08-27 - ISO Date String Sorting Optimization
**Learning:** Dates across MIS are strictly stored as ISO `YYYY-MM-DD` strings. Using `new Date(a.date).getTime() - new Date(b.date).getTime()` in `Array.prototype.sort()` creates $O(N \log N)$ `Date` objects and date parsing overhead on every sort operation. Direct ASCII string comparison (`a.date > b.date ? 1 : a.date < b.date ? -1 : 0`) is significantly faster and allocates zero objects.
**Action:** Always prefer direct string comparison over instantiating `Date` objects when sorting ISO date strings in array callbacks.

## 2025-05-18 - ISO Date String Comparisons in Array Sorting
**Learning:** Parsing `new Date(a.date).getTime()` inside `Array.prototype.sort()` callbacks creates thousands of temporary `Date` instances during table sorting, causing significant GC pressure. Since dates across this codebase are standard `YYYY-MM-DD` ISO strings, direct string comparison (`a < b ? -1 : a > b ? 1 : 0`) is strictly equivalent, allocates zero objects, and runs substantially faster.
**Action:** Use direct string comparison for ISO date properties in sort functions instead of instantiating `Date` objects.

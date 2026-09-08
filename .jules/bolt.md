## 2025-03-08 - ISO Date String Comparison in JS Sort Callbacks

**Learning:** Comparing ISO date strings (`YYYY-MM-DD`) directly using string comparison (`a < b ? -1 : a > b ? 1 : 0`) is ~10x faster than parsing with `new Date(a).getTime() - new Date(b).getTime()` and avoids allocating thousands of temporary Date objects during array sorting routines.
**Action:** When sorting arrays by ISO date strings in React components or custom hooks, always compare strings directly rather than instantiating Date objects in sort callbacks.

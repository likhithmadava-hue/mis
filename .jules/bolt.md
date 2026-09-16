## 2025-05-18 - Optimize date lookup and formatting in scoreRange
**Learning:** Calling `Array.prototype.find()` and `toLocaleDateString()` inside range calculation loops creates significant performance overhead due to O(N) linear scans and repeated `Intl.DateTimeFormat` object instantiations.
**Action:** Index array items by ISO date into a Map (`metricsByDate`) for O(1) lookups and reuse module-scoped `Intl.DateTimeFormat` instances for formatting.

## 2025-02-23 - Indexing daily metrics and module-scoping Intl formatters in date range scoring

**Learning:** `scoreRange` repeatedly searched `metrics` with `Array.prototype.find()` on every day step (O(days * M)) and instantiated `Intl.DateTimeFormat` objects inside hot loops. Pre-indexing metrics into a Map (`metricsByDate`) and reusing module-scoped `Intl.DateTimeFormat` instances avoids $O(N)$ searches and expensive `Intl` object instantiations during range calculations.
**Action:** When computing range-based metrics or date labels over loops, pre-index lookup data in a `Map` and reuse module-scoped `Intl.DateTimeFormat` instances.

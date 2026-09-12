## 2025-05-18 - Indexing Daily Metrics in Score Range Computations
**Learning:** `ArborDatabase.getDailyMetrics()` returns unindexed array metrics. Iterating over date ranges in `scoreRange` with `metrics.find()` causes $O(N \times \text{days})$ operations.
**Action:** Pre-index array datasets into a `Map<string, DailyMetric>` keyed by `date` for $O(1)$ lookups whenever computing multi-day ranges.

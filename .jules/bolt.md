## 2026-09-01 - Indexing daily metrics before range scoring
**Learning:** `scoreRange` in `src/core/scoring/score.ts` previously performed linear `find()` searches over all daily metric records for each day in a range. Pre-indexing `metrics` into a `Map<string, DailyMetric>` keyed by ISO date string reduces lookup complexity from O(days * metrics) to O(metrics + days).
**Action:** Always check array lookup operations inside range rendering loops or chart scoring pipelines for map indexing opportunities.

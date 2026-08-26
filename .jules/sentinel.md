## 2026-08-26 - Spreadsheet Import Field Validation
**Vulnerability:** Spreadsheet rows imported via SheetJS (`sheetImport.ts`) coerced numbers with `toNumber()` but lacked range/boundary checks. An imported row could have negative scores, scores exceeding max_score, or negative time spent.
**Learning:** Parsing external files like Excel/CSV without strict numerical boundary checks can corrupt internal analytics/scoring calculations or state invariants.
**Prevention:** Always perform explicit range and bounds validation on numeric fields parsed from external user input files prior to creating database entries.

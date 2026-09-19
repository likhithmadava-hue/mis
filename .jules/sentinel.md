## 2026-03-22 - Spreadsheet Formula Injection Sanitization
**Vulnerability:** Incomplete formula trigger character list in `sanitizeFormula` during CSV/XLSX export.
**Learning:** `sanitizeFormula` was missing `-`, `%`, `|`, and `\n` in its regex `/^[=+@\t\r]/`, and checking `trimStart()` alone allowed un-trimmed whitespace strings to bypass sanitization.
**Prevention:** Include all formula trigger characters (`=`, `+`, `-`, `@`, `\t`, `\r`, `\n`, `%`, `|`) and test both raw and trimmed values when escaping CSV/spreadsheet cell exports.

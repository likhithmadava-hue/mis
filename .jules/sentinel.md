## 2026-08-31 - CSV / Spreadsheet Formula Injection Prevention
**Vulnerability:** User-controlled entry fields (such as notes or subject) starting with formula trigger characters (`=`, `+`, `-`, `@`, `\t`, `\r`) were exported directly to CSV and Excel files without sanitization, exposing users to formula execution / DDE injection when opened in spreadsheet software.
**Learning:** Export logic converts domain objects directly to row objects for `xlsx` without escaping special leading characters that external spreadsheet software interprets as commands or formulas.
**Prevention:** Always sanitize string values exported to CSV or Excel workbooks using `sanitizeFormula` to prefix trigger characters with a single quote (`'`).

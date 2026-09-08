## 2026-03-31 - CSV Formula Injection Omission
**Vulnerability:** `sanitizeFormula` in `sheetImport.ts` omitted `-` from the formula trigger character set regex (`/^[=+@\t\r]/`), allowing values starting with `-` to bypass formula escaping during CSV/Excel export.
**Learning:** When writing regex character classes for CSV formula sanitization (`=`, `+`, `-`, `@`, `\t`, `\r`), unescaped `-` inside a character class like `[=+-@]` can inadvertently define a character range or be omitted if missed.
**Prevention:** Always escape `-` as `\-` in formula trigger character sets (`/^[=+\-@\t\r]/`) and verify that all standard triggers (`=`, `+`, `-`, `@`, `\t`, `\r`) are matched.

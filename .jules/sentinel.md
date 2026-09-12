## 2025-03-02 - CSV Formula Injection Character Omission
**Vulnerability:** `sanitizeFormula` in `src/modules/database/sheetImport.ts` used a regex `/^[=+@\t\r]/` that omitted `-` (minus sign), `\n`, `%`, and `|` formula trigger characters.
**Learning:** In character class regexes `[...]`, omitting `-` or unescaped positioning can leave values starting with `-` (such as negative entries or `-CMD|' /C calc'!A1`) unsanitized during CSV/XLSX export.
**Prevention:** Include all standard spreadsheet trigger characters (`=`, `+`, `-`, `@`, `\t`, `\r`, `\n`, `%`, `|`) in formula sanitization regexes, ensuring `-` is properly escaped `\-`.

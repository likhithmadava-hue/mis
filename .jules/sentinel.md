# Sentinel Security Journal

## 2025-05-18 - Formula Injection Sanitization Regex Omission
**Vulnerability:** `sanitizeFormula` in `src/modules/database/sheetImport.ts` sanitized strings starting with `=`, `+`, `@`, `\t`, and `\r`, but omitted `-` (minus) from its character set regex (`/^[=+@\t\r]/`).
**Learning:** Formula injection defense must include all trigger characters (`=`, `+`, `-`, `@`, `\t`, `\r`). Omitting `-` allows malicious cell values beginning with `-` (e.g. `-1+1` or external command execution payloads) to bypass escaping during CSV/Excel exports.
**Prevention:** Always verify formula sanitization regex against the full set of spreadsheet formula trigger characters (`/^[=+\-@\t\r]/`).

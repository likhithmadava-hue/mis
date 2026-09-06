## 2025-05-18 - CSV Formula Injection Regex Omission
**Vulnerability:** `sanitizeFormula` in `sheetImport.ts` intended to neutralize spreadsheet formula injection (`=`, `+`, `-`, `@`, `\t`, `\r`) but omitted `-` from the regex `/^[=+@\t\r]/`.
**Learning:** Documented trigger characters in comments must match the regular expression character class (`/^[=+\-@\t\r]/`); otherwise negative formula payloads like `-1+2` or `-cmd|...` bypass sanitization during CSV/XLSX export.
**Prevention:** Always test regular expressions against every character mentioned in the security specification/docstring.

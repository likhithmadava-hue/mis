## 2026-03-28 - CSV and Spreadsheet Formula Injection Sanitization

**Vulnerability:** User notes or string inputs starting with `-` or containing leading newlines/tabs (`\n`, `\r`, `\t`) could trigger formula execution or unwanted code/DDE execution when exported and opened in spreadsheet software like Microsoft Excel or LibreOffice Calc.
**Learning:** `sanitizeFormula` originally checked for `=, +, @, \t, \r`, but omitted `-` (minus sign) and `\n` (newline character). In regex character classes, `-` must be escaped (`\-`) to avoid creating an unintended character range like `+` to `@`.
**Prevention:** Always include `=, +, -, @, \t, \r, \n` in CSV formula sanitization regexes and ensure `-` is properly escaped.

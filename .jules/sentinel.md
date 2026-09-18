## 2026-09-18 - CSV Formula Sanitization with Whitespace Trimming
**Vulnerability:** Sanitizing formula triggers after `.trimStart()` missed leading whitespace control characters like `\t` and `\n` because JS string `.trimStart()` removes them prior to regex evaluation.
**Learning:** `val.trimStart()` converts `"\tcalc"` to `"calc"`, causing `/^[=+\-@\t\r\n%|]/` to fail to detect leading control character triggers.
**Prevention:** Check both un-trimmed `val` and `val.trimStart()` in formula sanitization regexes.

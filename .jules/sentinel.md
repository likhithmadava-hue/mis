## 2026-08-01 - Prevent Password Hashing DoS in Supabase Auth
**Vulnerability:** Unbounded password input string length in password change forms could lead to CPU exhaustion DoS attacks on password hashing routines (e.g. Bcrypt 72-byte max string processing).
**Learning:** Always enforce maximum length limits (e.g., 72 chars for passwords) in frontend validation before sending credentials to auth APIs.
**Prevention:** Add input max length bounds on password input fields and change handlers.

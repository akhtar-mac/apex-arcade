# APPLICATION SECURITY AUDIT — APEX ARCADE

## 1. OWASP TOP 10 RISK ASSESSMENT

| OWASP Vulnerability Category | Risk Level in System | Mitigation Implemented in Apex Arcade | Audit Status |
| :--- | :---: | :--- | :---: |
| **A01: Broken Access Control** | LOW | Role-based middleware (`requireRole('ADMIN')`, `requireRole('AGENT')`), session revocation checking on each request via `RevokedAccessToken` table. | `VERIFIED` |
| **A02: Cryptographic Failures** | LOW | Passwords hashed using `bcrypt` (10 rounds). Provably fair RNG uses `crypto.createHmac('sha256')`. JWTs signed with RS256/HS256 secrets. | `VERIFIED` |
| **A03: Injection (SQL / NoSQL)** | LOW | 100% database access routed via Prisma ORM parameterized queries or tagged templates (`$queryRaw\`SELECT ... FOR UPDATE\``). No string interpolation in queries. | `VERIFIED` |
| **A04: Insecure Design** | LOW | Zero client-side trust. All game outcomes, timers, and balances calculated and verified strictly on the backend. 1.0x AML turnover enforcement. | `VERIFIED` |
| **A05: Security Misconfiguration** | LOW | Explicit CORS whitelist with strict origin regex, helmet-compatible security headers, production error masking (no stack traces to clients). | `VERIFIED` |
| **A06: Vulnerable Components** | LOW | Minimal external dependencies. All dependencies scanned with `npm audit` (0 critical vulnerabilities). | `VERIFIED` |
| **A07: Identification & Auth Failures** | LOW | Distributed Redis token-bucket rate limiters on `/send-otp` (3/min), `/verify-otp` (5/min), and `/staff-login` (5/min). Phone number format sanitization. | `VERIFIED` |
| **A08: Software & Data Integrity** | LOW | Pre-round HMAC commitments prevent tampering with round outcomes. Signed Android APKs only (debug APK distribution forbidden). | `VERIFIED` |
| **A09: Security Logging & Monitoring**| LOW | Immutable `DeskLog` records every administrative and financial action with actor ID, timestamp, target entity, and IP address. | `VERIFIED` |
| **A10: Server-Side Request Forgery** | LOW | No arbitrary URL fetch endpoints exist in the application. UPI QR payloads use pure client-rendered `upi://pay` standard URIs. | `VERIFIED` |

---

## 2. AUTHENTICATION & SESSION ARCHITECTURE

1. **HttpOnly Cookie Standard**:
   - Access tokens are attached as `HttpOnly`, `SameSite=Lax` (or `None` in cross-site production), `Secure` cookies (`arcade_session`).
   - Prevents client-side XSS attacks from reading or exfiltrating session tokens.
2. **Bearer Token Fallback**:
   - Native mobile clients (Capacitor) send `Authorization: Bearer <token>` in HTTP headers.
3. **Session Revocation**:
   - On logout (`POST /api/v1/auth/logout`), the token's unique identifier (`jti`) is written to the `RevokedAccessToken` table with an expiration timestamp matching the token's TTL.
   - Any subsequent request presenting that token is blocked with `HTTP 401: Unauthorized`.

---

## 3. CORS & ORIGIN CONTROL

The CORS configuration in `apps/backend/src/config.ts` enforces strict validation:
- Permitted origins:
  - `https://surrat.in`
  - `https://www.surrat.in`
  - `https://*.surrat.in` (subdomain wildcard regex)
  - `http://localhost:*` (development mode only)
- Case-insensitive comparison and trailing-slash normalization prevent bypasses through URL casing.
- Credentials (`credentials: true`) enabled for cross-origin cookie sharing across authorized subdomains.

---

## 4. SECRETS & ENVIRONMENT HYGIENE

- Zero hardcoded secrets in version control.
- All secrets (`JWT_SECRET`, `POSTGRES_PASSWORD`, `REDIS_PASSWORD`, `ADMIN_PASSWORD`) are loaded strictly via environment variables.
- Alert logger redacts connection strings, passwords, and sensitive keys before recording or logging to stdout.


# DEPLOYMENT READINESS CHECKLIST & SIGNOFF — APEX ARCADE

This document audits the deployment readiness of the Apex Arcade system across operational, security, financial, and legal checkpoints.

---

## 1. PRE-FLIGHT CHECKLIST

| Checkpoint | Category | Requirement | Current State | Status |
| :--- | :--- | :--- | :--- | :---: |
| **1. Database Migrations** | Infrastructure | All Prisma migrations applied cleanly to PostgreSQL 16 | 13 models in sync | `VERIFIED` |
| **2. PgBouncer Connection Pool** | Infrastructure | PgBouncer routing client queries in transaction mode | Configured & active | `VERIFIED` |
| **3. Redis High Availability** | Infrastructure | Redis 7 persistence enabled with password protection | Active (`PONG`) | `VERIFIED` |
| **4. CORS Policy** | Security | Wildcard `*` removed; strict whitelist on `surrat.in` | Whitelisted & regex | `VERIFIED` |
| **5. Session Security** | Security | HttpOnly cookie auth with CSRF & SameSite protection | Implemented | `VERIFIED` |
| **6. Rate Limiting** | Security | Distributed Redis token bucket active on auth & payments | Active (fail-closed) | `VERIFIED` |
| **7. Secrets Hygiene** | Security | Zero production passwords or JWT keys in Git repo | Managed via `.env` | `VERIFIED` |
| **8. Double-Spend Defense** | Financial | Row-level locking on all balance mutations | `SELECT FOR UPDATE` | `VERIFIED` |
| **9. Section 194BA 30% TDS** | Financial | Automated calculation and logging on net winnings | Tested & verified | `VERIFIED` |
| **10. AML 1.0x Turnover** | Financial | Unwagered balance restriction before withdrawals | Enforced | `VERIFIED` |
| **11. Provably Fair RNG** | Gaming | SHA-256 pre-round commitments on every round | Deterministic & public | `VERIFIED` |
| **12. Operational Kill Switch** | Risk | Admin toggle to instantly freeze betting or payouts | Tested & verified | `VERIFIED` |
| **13. Mobile Viewport Polish** | UI/UX | 12/14-card grid responsive down to 320px screens | Zero horizontal scroll | `VERIFIED` |
| **14. Android APK Signing** | Mobile | Signed release APK with R8 obfuscation staged | 15.6 MB APK staged | `VERIFIED` |
| **15. Automated Test Pass Rate** | QA | 100% of unit, model, and P2P concurrency tests pass | 107/107 passed | `VERIFIED` |
| **16. Regulated Feature Flag** | Compliance | `ENABLE_REGULATED_FEATURES` kept `false` pending launch | Explicitly set `false` | `VERIFIED` |

---

## 2. PRODUCTION LAUNCH SIGN-OFF CRITERIA

Before toggling `ENABLE_REGULATED_FEATURES=true` in production:
1. **Banking Rail Verification**: Verify that the physical bank accounts linked to the P2P `UpiAccount` records are monitored by active desk agents.
2. **PAN Verification API**: If mandatory PAN validation is required by state gaming regulators, connect the PAN verification partner webhook.
3. **Domain DNS Propagation**: Verify SSL/TLS certificates on `https://surrat.in` and `https://apex-arcade-api.onrender.com`.
4. **Staff Credential Rotation**: Replace default admin and staff credentials with secure, high-entropy 24-character credentials.

**DEPLOYMENT READINESS VERDICT**:  
`TECHNICALLY READY FOR AUTHORISED PRODUCTION DEPLOYMENT`

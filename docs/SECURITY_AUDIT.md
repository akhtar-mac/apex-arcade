# Security Audit

Date: 2026-10-21

## Scope and limits

This defensive review covered repository source, configuration, dependencies, authentication, authorization, sockets, manual payments, wallet/game state, Android settings, and deployment defaults. Testing was local and used simulated credits. It was not an external penetration test and does not establish that the application is completely secure.

## Remediated critical/high findings

### Fixed: universal OTP and weak registration binding

OTP values are now cryptographically generated, expire after ten minutes, and lock after five failed attempts. Redis is used across processes. Registration requires a short-lived token bound to the verified phone. A deterministic OTP exists only under `NODE_ENV=test`; public launch rejects it.

### Fixed: public demo-credit withdrawal

Demo mode has its own disabled-by-default flag. Demo identity is persisted, demo credits are unwagered, and deposits/withdrawals are rejected for demo users.

### Fixed: split financial commits

Bet debit, bet row, turnover consumption, and transaction history now commit in one PostgreSQL transaction. Deposit approval and turnover creation are transactional. Withdrawal/TDS writes are also transactional.

### Fixed: UTR amount substitution and duplicate credit

A UTR submission must reference an existing ten-minute deposit intent, match its amount, pass the 12-digit format, and satisfy database uniqueness. Duplicate approvals do not credit again.

### Fixed: fabricated payment success

Automatic payout, gateway webhook success, fake IMPS/UTR generation, and payment simulation implementations were removed. Retired endpoints return 410.

### Fixed: authorization/session drift

Authenticated requests check token revocation and current PostgreSQL user role/ban state. Admin and agent actions are role-protected. The OTP request no longer returns account-existence status.

### Fixed: socket abuse surface

Sockets accept known public game rooms only, reject private user-room joins, cap per-user/global connections, and throttle events.

### Fixed: public release defaults

Public deployment mode rejects demo OTP/login, test OTP, local secrets, weak admin passwords, missing SMS credentials, and missing HTTPS CORS origins. Regulated write operations are gated server-side and disabled in the Render staging configuration.

### Fixed: information and platform exposure

The filesystem-exposing DevTools endpoint was removed. Global 500 responses are generic. OTPs are not logged. Security headers were added. Android backup, cleartext traffic, mixed content, and WebView debugging are disabled.

## Dependency results

- Production dependency audit at high severity: no known findings after the toolchain updates.
- Full development audit: seven findings remain through Tailwind CSS 3 build-time glob/parser dependencies (five high, two moderate).
- Vite was upgraded to patched 7.x.
- Capacitor CLI was moved to development dependencies and pinned to the patched compatible 8.4.x line.

The remaining Tailwind advisories process repository-controlled build inputs and are not shipped in runtime bundles, but they remain supply-chain/build-host risk. Migrating four clients to Tailwind 4 needs dedicated visual and plugin regression testing.

## Residual findings and release blockers

### High: legal and operational authorization absent

No evidence establishes legal authorization for public wagering, payment-provider/banking approval, required age/geographic controls, privacy review, responsible-play review, or incident-response readiness. Keep `ENABLE_REGULATED_FEATURES=false`.

### High: unsigned Android release

Only a local debug compilation can be tested. A release must be signed with an organization-controlled keystore held outside Git and must pass independent mobile review. The debug APK was removed from the website.

### High: live integrations unverified

Real Fast2SMS/MSG91 delivery, production PostgreSQL/Redis, backups/restores, monitoring/alerting, and payment desk operations were not tested with live credentials.

### Medium: browser token storage

The SPAs retain bearer tokens in browser local storage. A successful same-origin script injection could steal them. Existing CSP/API headers and React escaping reduce but do not remove this risk. Before public review, add static-site security headers, minimize third-party scripts, and consider a hardened session architecture.

### Medium: rate-limit fallback

When Redis is unavailable, limits and OTP records fall back to one process. This is acceptable for local development, not a multi-instance public service. Public health/monitoring must treat Redis loss as degraded and prevent unsafe scaling assumptions.

### Medium: uploaded evidence storage

Screenshot evidence is size-limited but remains database content. Define retention, access audit, deletion, and malware/content handling policies before collecting production user evidence.

### Medium: CSP coverage

The API applies security headers, but deployed static sites require equivalent platform-level headers. This was not validated on Render.

### Medium: statistical assurance

The deterministic chi-square regression can detect gross implementation drift; it is not a certification of fairness. Independent review should verify commitment timing, seed custody, entropy, and complete historical auditability.

### Low: service fingerprinting

The health response exposes service version and dependency status. Restrict or reduce this detail if operational policy requires it.

## Threat-area conclusions

- Broken access control: role middleware and current-role lookup repaired; live adversarial testing still required.
- Authentication/session management: materially hardened; browser token storage remains.
- IDOR: reviewed routes use authenticated user IDs or privileged roles; integration coverage should be expanded per endpoint.
- Injection: Prisma parameterization and Zod schemas reduce SQL/input risks; no raw user-built SQL was approved.
- XSS: React escaping and API CSP help; static-site header deployment remains.
- CSRF: APIs use bearer headers rather than ambient cookies; strict CORS remains required.
- SSRF/file processing: no server-side URL fetch flow was identified; screenshot payloads are bounded data URLs.
- Secrets: tracked-file scan passed; Render secrets remain external.
- Replay/idempotency: UTR uniqueness and transactional status checks cover core deposit replay; broaden idempotency keys if new payment integrations are introduced.
- Logging/privacy: OTP values are removed; production log redaction and retention require operational validation.

## Required pre-release security gate

1. Independent legal/regulatory approval.
2. External application and mobile penetration test with high findings closed.
3. Production SMS and infrastructure validation.
4. Signed Android artifact provenance and update strategy.
5. Static-site security headers verified.
6. Backup restore and incident-response exercises.
7. Monitoring for auth abuse, ledger mismatches, privileged actions, Redis loss, and failed settlements.
8. Tailwind/toolchain remediation or formally accepted build-host risk.

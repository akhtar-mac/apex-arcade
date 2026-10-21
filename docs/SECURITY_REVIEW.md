# Security review

Date: 2026-10-21. This is an internal engineering review. It is not an external security assessment.

Completion pass: logout now revokes the presented token id in Postgres. A replay returned 401, and a second session stayed valid. Forged and expired tokens returned 401. Cookie-only profile update returned 200. OTP returned 503 when Redis was down, and 200 only when a non-public process set `ALLOW_MEMORY_RATE_LIMIT=true`. Two API processes shared one login limit. Tailwind 3.4.19 still pulls braces 3.0.3, micromatch 4.0.8, and postcss-selector-parser 6.1.4. Production audit remains 0 findings. No external test was performed.

## Secret inventory

Values are omitted on purpose.

| Variable                    | Purpose               | Required                 | Environment               | Owner       |
| --------------------------- | --------------------- | ------------------------ | ------------------------- | ----------- |
| `DATABASE_URL`              | Postgres connection   | yes                      | separate per environment  | unassigned  |
| `REDIS_URL`                 | Redis connection      | yes                      | separate per environment  | unassigned  |
| `JWT_SECRET`                | session signing       | yes                      | generated per environment | unassigned  |
| `ADMIN_PHONE`               | bootstrap admin       | yes on public boot       | private                   | unassigned  |
| `ADMIN_PASSWORD`            | bootstrap admin       | yes on public boot       | private                   | unassigned  |
| `AGENT_PHONE`               | bootstrap agent       | optional                 | private                   | unassigned  |
| `AGENT_PASSWORD`            | bootstrap agent       | optional                 | private                   | unassigned  |
| `SMS_PROVIDER`              | `FAST2SMS` or `MSG91` | public boot only         | private                   | unassigned  |
| `FAST2SMS_API_KEY`          | SMS credential        | with that provider       | private                   | unassigned  |
| `MSG91_AUTH_KEY`            | SMS credential        | with that provider       | private                   | unassigned  |
| `CORS_ORIGINS`              | browser origins       | yes                      | per environment           | unassigned  |
| `ENABLE_REGULATED_FEATURES` | server money gate     | must stay false publicly | server only               | unassigned  |
| `ALLOW_DEMO_OTP`            | local OTP bypass      | must stay false publicly | local/test                | engineering |
| `TEST_OTP`                  | six-digit test code   | test only                | CI and local test         | engineering |
| `ENABLE_DEMO_LOGIN`         | local demo button     | must stay false publicly | local                     | engineering |
| `SCREENSHOT_RETENTION_DAYS` | optional purge period | no                       | after owner approval      | unassigned  |
| Android keystore            | release signing       | no until release         | owner machine only        | unassigned  |

`.env` is gitignored. `.env.example` contains empty placeholders. `npm run scan:secrets` passed for 242 tracked files. `git log --all -S` found no commit adding `BEGIN PRIVATE KEY`, `ghp_`, or `AKIA`. That search does not certify the whole history.

## Controls checked in this pass

- Cookie sessions are HttpOnly. The three web clients no longer persist the access token in `localStorage`.
- Public sign-in limits fail closed when Redis is unavailable.
- Agent routes are allowlisted on the server.
- Deposit, UTR, withdrawal, and bet routes consult the server release flag.
- Android cleartext and backup are off. The debug APK was not copied into the website.
- CORS credentials are enabled for the cookie. Origins come from configuration.
- Logout clears the cookie. It does not revoke every bearer still inside its one-hour lifetime. That residual risk is open.

## Dependency findings

Production, `npm audit --omit=dev --audit-level=high`: 0 vulnerabilities.

Full tree, before and after this pass, because Tailwind was not upgraded:

| Package                 | Severity | Path                               | Reach                     |
| ----------------------- | -------- | ---------------------------------- | ------------------------- |
| braces                  | high     | Tailwind 3 → chokidar / micromatch | development file watching |
| chokidar                | high     | Tailwind 3                         | development               |
| micromatch              | high     | Tailwind 3 → fast-glob             | development               |
| fast-glob               | high     | Tailwind 3                         | development               |
| tailwindcss 3.x         | high     | direct development dependency      | build time                |
| postcss-selector-parser | moderate | Tailwind 3 → postcss-nested        | CSS build                 |
| postcss-nested          | moderate | Tailwind 3                         | CSS build                 |

`npm audit fix --force` would install Tailwind 4.3.3, which is a breaking CSS upgrade. It was not applied. The vulnerable code is in the development build toolchain, not in the production API dependency set. Residual risk is accepted for local and CI builds until a planned Tailwind 4 migration. Advisories were not deleted or suppressed.

## Not done

No external penetration test, mobile instrumentation test, live Redis-down multi-instance test, or authenticated IDOR sweep beyond the desk-flow permission check was run. High-severity release blockers that remain are the missing external test, the unrevoked bearer window, the unset retention owner, and the absence of legal and payment approval. Those block a production release. They do not by themselves mean the internal development checks failed.

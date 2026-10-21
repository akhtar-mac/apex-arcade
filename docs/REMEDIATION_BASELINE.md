# Remediation baseline

Inspection date: 2026-10-21. Branch: `main`. This file records the repository as found and the fix planned for each pending item. Results of the work that followed are in `docs/REMEDIATION_TRACKER.md` and `docs/TEST_REPORT.md`.

## Architecture

Node.js 22.14.0 and npm 10.9.2 monorepo.

- `apps/backend`: Express 4, Socket.IO 4, Prisma 5, PostgreSQL 16, Redis 7. Health at `/api/v1/health`.
- `apps/mobile-app`: React 18 and Vite player, wrapped for Android by Capacitor 8. It is not React Native.
- `apps/web-landing`, `apps/web-admin`, `apps/p2p-panel`: React and Vite.
- `packages/shared-types`, `packages/shared-utils`: payout, outcome, QR selection, retention, and rate-limit helpers.
- Tests: `node --test`, one loopback desk-flow script, and Playwright.
- Deploy description: `render.yaml`. Local data: Docker Compose Postgres and Redis.

The game has 14 pictures and a published 10× stake payout. Money movement is a published QR, a 12-digit UTR, and a human desk decision. New wallets start at ₹0. A first approved deposit also records a 50% bonus, so a ₹200 approval credits ₹300.

## What already worked

Authentication, roles, ledger writes, game rooms, admin and desk screens, and the public-deployment boot checks were already in the tree. `ENABLE_REGULATED_FEATURES` stays off unless that server variable is explicitly true, and a public deployment (`NODE_ENV=production` or `DEPLOY_ENV=staging`) refuses demo OTP, demo login, test OTP, the default admin phone, a short password, and a known local JWT secret.

## Defects found before this pass

- Login tokens were stored in browser `localStorage`.
- Auth and OTP rate limits could fall back to one process when Redis was down.
- Payment screenshot strings had no retention gate.
- QR choice did not share one tested selection rule for paused, disabled, and full accounts.
- Outcome mapping used an 8-hex modulo. The chi-square check is a regression, not a fairness certificate.
- Desk-flow, migration, Android compile, backup restore, and remote CI had not been executed in the earlier assessment.
- Seven Tailwind 3 development-dependency advisories remained. Production `npm audit --omit=dev` was clean.
- Render CLI and GitHub-hosted execution were unavailable.

## Commands run for the baseline

Earlier the same day: secret scan, lint, format check, type check, production builds, 23 unit tests after the shared-helper changes, and four client production builds. Docker Postgres 16 and Redis 7 were already running locally. Prisma reported six migrations applied to the disposable database `arcade_remediation`. The first desk-flow run approved a ₹200 deposit and then failed its assertion because the balance was ₹300 after the existing first-deposit bonus.

## Database and migration risk

Six migrations exist, ending at `20261021130000_demo_and_integrity`. `prisma migrate deploy` is additive. This pass used only `arcade_remediation` and `arcade_remediation_restore`. It did not reset `arcade_db` and did not connect to Render.

## Environment limits

No Render CLI, no `act`, no Android emulator session, no live SMS credentials, no production Android keystore, no alert destination, and no legal, privacy, or tax owner. The local Docker password is already present in `docker-compose.yml` and is a local development credential only.

## Mapping

| Item                      | Planned fix                                                          | Acceptance evidence                         |
| ------------------------- | -------------------------------------------------------------------- | ------------------------------------------- |
| 1 Migrations              | Apply all six on a new database                                      | `prisma migrate deploy` plus restore counts |
| 2 Desk flow               | Simulated UTR path with duplicate, malformed, and unauthorised cases | `tests/desk-flow.mjs`                       |
| 3 Debug APK               | Local Gradle debug build, not published                              | APK path and checksum                       |
| 4 Render                  | Static blueprint review; CLI if present                              | This file and `docs/DEPLOYMENT.md`          |
| 5 GitHub Actions          | Keep the clean-runner workflow; do not claim a remote pass           | Workflow inspection                         |
| 6 Secrets                 | Placeholders only, startup validation, secret scan                   | `.env.example`, `npm run scan:secrets`      |
| 7 Legal authorisation     | Do not implement or infer it                                         | Release gate                                |
| 8 Age and geography       | Leave server enforcement for the legal owner                         | Release gate                                |
| 9 Lawful payment account  | Keep live collection disconnected                                    | Release gate                                |
| 10 Live OTP               | Do not send                                                          | Release gate                                |
| 11 Separate operators     | Server allowlist only; do not hire or activate people                | Permission matrix                           |
| 12 Release signing        | Document handover, do not invent a key                               | `docs/DEPLOYMENT.md`                        |
| 13 Backup restore         | Dump and restore the disposable database                             | `scripts/backup-disposable.sh`              |
| 14 Alerts                 | Structured logs now; delivery only with a destination                | `docs/DEPLOYMENT.md`                        |
| 15 External security test | Internal checks only                                                 | `docs/SECURITY_REVIEW.md`                   |
| 16 Privacy and tax owners | Register, do not invent a period or filing                           | `docs/PRIVACY_AND_RETENTION.md`             |
| 17 Browser tokens         | HttpOnly cookie plus in-memory bearer                                | Auth regression test                        |
| 18 Redis failure          | Fail closed for public sign-in limits                                | Rate-limit regression test                  |
| 19 Screenshots            | Purge only after an owner sets a period                              | Retention helper test                       |
| 20 Tailwind findings      | Do not force Tailwind 4; record residual risk                        | `npm audit` before and after                |
| 21 Distribution check     | Rejection sampling; keep the chi-square label honest                 | Shared-utils test                           |
| 22 Player capacity        | Measure only an agreed isolated workload                             | `docs/TEST_REPORT.md`                       |

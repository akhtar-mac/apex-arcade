# Implementation Report

Date: 2026-10-21

## Outcome

The repository was changed from a mixed prototype into a restricted-stage application with PostgreSQL-authoritative ledger paths, explicit release controls, executable browser checks, and truthful product behavior. No public deployment or live data mutation was performed.

## Authentication and sessions

- Replaced universal OTP behavior with cryptographically generated six-digit codes.
- Store OTP state in Redis with a ten-minute expiry and five-attempt lockout; retain a local fallback for development.
- Added a short-lived, phone-bound registration token between OTP verification and account creation.
- Removed phone-registration status from the OTP request response and mask the returned phone number.
- Added IP, phone, and authenticated-user rate-limit dimensions.
- Verify token revocation and current database role/ban state on every authenticated request.
- Reduced access-token lifetime to one hour and stopped issuing an unused refresh token.
- Split local demo login from OTP behavior. Public deployments reject demo OTP, demo login, and test OTP.
- Mark demo users in PostgreSQL, keep their credits unwagered, and reject demo deposits and withdrawals.

## Ledger and game integrity

- Added `Ledger.placeBetAtomic` so wallet debit, turnover consumption, bet insertion, and transaction history commit in one PostgreSQL transaction.
- Removed the asynchronous debit-before-persistence betting queue. Settlement updates now operate on already committed rows.
- Bind every submitted UTR to a persisted, unexpired ten-minute deposit intent and require the submitted amount to match exactly.
- Credit an approved deposit and increase turnover in one database transaction.
- Persist withdrawal holds and TDS records transactionally.
- Read transaction, bet, game, admin queue, turnover, and tax history from PostgreSQL rather than bounded memory caches.
- Added pagination limits and query indexes for common history access paths.
- Removed automatic payment, fake IMPS/UTR, webhook-success, and force-card implementations.
- Commit to a SHA-256 server-seed hash before betting and reveal the seed and round inputs only after settlement.
- Kept new-user wallets at ₹0.

Migration: `apps/backend/prisma/migrations/20261021130000_demo_and_integrity/migration.sql`

## Server and socket hardening

- Added secure response headers, strict CORS matching, proxy awareness, generic unhandled error responses, and bounded request bodies.
- Removed the endpoint that exposed the working directory to browser DevTools.
- Added Socket.IO room allowlisting, private-room rejection, per-user connection caps, and event throttling.
- Added a server-side `ENABLE_REGULATED_FEATURES` gate. Public deployments default to rejecting bets, deposits, UTR submissions, and withdrawals.
- Added payout-halt enforcement to new withdrawal requests.

## User interfaces

- Wired admin and P2P approval/rejection controls to real APIs and update the UI only after success.
- Require a valid 12-digit payout UTR for withdrawal approval.
- Display submitted screenshots to authorized desk users.
- Removed prefilled staff credentials, fake player defaults, production-facing mock pages, and unsupported automatic-payment claims.
- Hide demo login unless the build explicitly enables it and identify demo credits as simulated and nonwithdrawable.
- Added a top-center close control and backdrop dismissal to the insufficient-funds wizard.
- Corrected mobile overflow and WCAG color-contrast failures across representative phone and desktop viewports.
- Removed unsupported market-leadership and capacity claims.
- Removed the publicly downloadable debug APK. The landing site accepts only an explicitly configured signed-app URL after release approval.

## Tooling and delivery

- Added ESLint, Prettier checks, secret scanning, Playwright, and Axe.
- Added browser checks for all four UIs, representative desktop/phone overflow, registration behavior, credential defaults, and serious/critical accessibility violations.
- Added regression tests for auth, release gating, ledger atomicity, UTR binding, payment removal, outcome commitments, Android hardening, and shared game utilities.
- Removed self-contained tests that simulated nonexistent gateways, 10,000 users, banking bots, and unrelated implementations.
- Added CI with disposable PostgreSQL and Redis, migrations, API integration flow, static gates, production dependency audit, build, browser tests, and failure artifacts.
- Updated Vite to a patched 7.x release and moved/downgraded Capacitor CLI to a version without its reported transitive advisory.

## Deployment and Android

- Changed Render startup from `prisma db push` to versioned `prisma migrate deploy`.
- Changed builds to reproducible `npm ci`.
- Removed public Redis access from the Blueprint and replaced wildcard CORS with exact origins.
- Disabled Render automatic deployments and regulated features.
- Required externally configured staff credentials and SMS provider credentials.
- Disabled Android backup, cleartext traffic, mixed content, and WebView debugging; enabled release code/resource shrinking.
- Reject non-HTTPS Capacitor server URLs except local development.

## Remaining external blockers

- Docker was unavailable locally, so migrations and the live API integration journey could not be executed on this workstation. CI is configured to execute both against disposable services.
- Render CLI was unavailable, so the Blueprint could not be schema-validated locally.
- A release APK/App Bundle was not signed because no organization-controlled keystore was provided; no key should be generated or committed by this task.
- Real SMS delivery, banking/payment approval, legal/regulatory authorization, geographic/age controls, privacy review, external penetration testing, production monitoring, backup restore, and incident response exercises remain release blockers.
- The full development dependency audit still reports Tailwind 3 build-time glob/parser advisories. Production dependencies report no known vulnerabilities at the configured high threshold. A Tailwind 4 migration requires a separate UI regression effort.

## Important decisions

- PostgreSQL is the financial source of truth; Redis is coordination/cache infrastructure.
- Payment remains manual QR plus human UTR verification.
- Demo money is isolated and nonwithdrawable.
- The winning card is sealed before betting and is not selected from liabilities or operator profit.
- Release restrictions are enforced by the API, not only hidden in the clients.
- Unsupported claims and fake test results were removed rather than preserved for appearance.

## Changed-file inventory

- Root/configuration: `.env.example`, `.gitignore`, `README.md`, `docker-compose.yml`, `package.json`, `package-lock.json`, `render.yaml`, `eslint.config.js`, `playwright.config.ts`, `.github/workflows/ci.yml`.
- Backend schema: `apps/backend/prisma/schema.prisma` and `apps/backend/prisma/migrations/20261021130000_demo_and_integrity/migration.sql`.
- Backend runtime: `apps/backend/src/config.ts`, `db.ts`, `server.ts`, `socket.ts`; auth/rate-limit/role, admin, game, and payment routes/middleware; admin-risk, auth, bet-queue, compliance, game-engine, ledger, payment, payout, Redis, SMS, TDS, and turnover services.
- Player/Android: `apps/mobile-app/package.json`, `capacitor.config.ts`, `src/App.tsx`, `src/vite-env.d.ts`, Android manifest, Gradle release config, and generated Capacitor settings.
- Other clients: each client package manifest plus `apps/web-admin/src/App.tsx`, `apps/p2p-panel/src/App.tsx`, `apps/web-landing/index.html`, `src/App.tsx`, and `src/index.css`.
- Shared packages: TypeScript and generated JavaScript/declaration outputs under `packages/shared-types/src` and `packages/shared-utils/src`.
- Scripts: `scripts/start-all.mjs`, `scripts/start-tunnels.mjs`, `scripts/build-android-debug.sh`, and new `scripts/scan-secrets.mjs`.
- Tests: updated `tests/desk-flow.mjs`; added Android, shared-utility, security, ledger-integrity, and Playwright UI suites.
- Documentation: all six files under `docs/`.
- Removed unsupported/dead artifacts: root legacy HTML/CSS/JS, `arcade_schema.sql`, local database and gateway services, public showcase pages, the public debug APK, profit-engine test, unsafe scale script, and simulated phase/concurrency/payment/mobile test files.

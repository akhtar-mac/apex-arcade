# Test Plan

Date: 2026-10-21

## Test environments

- Static and unit checks: local Node.js 22 workspace.
- Browser checks: Playwright Chromium against local Vite preview servers.
- API integration: localhost-only API with disposable PostgreSQL/Redis, `NODE_ENV=test`, and a test-only six-digit OTP.
- Android: local Capacitor sync and Gradle debug compilation. Debug output is never a distributable release.
- Production services and real funds are out of scope.

## Static gates

1. Install exactly from `package-lock.json` with `npm ci`.
2. Scan tracked files for common private-key and live-token patterns.
3. Run ESLint across applications, packages, scripts, and tests.
4. Check Prettier formatting for documentation, CI, and tool configuration.
5. Compile shared packages, backend, and all UIs.
6. Build every production bundle.
7. Audit production dependencies at high severity.
8. Record the full development audit separately without forcing breaking migrations.

Expected result: every blocking command exits zero; residual development-only findings are disclosed.

## Unit and source-level regression checks

- OTP has no universal fixed value.
- OTP requests do not disclose account existence.
- Demo/test modes fail closed on public deployments.
- Betting and money movement have a server-side release gate.
- Revocation, room allowlisting, socket limits, and removed filesystem exposure remain present.
- Bet debit, turnover, bet row, and ledger history share one transaction.
- UTR amount/expiry are bound to persisted intent data.
- Automatic payout and fake bank-success implementations remain absent.
- Round result reveals can be checked against a pre-round seed commitment.
- Shared payout math handles decimal boundaries.
- Shared outcome calculation is deterministic and client-verifiable.
- A deterministic 14,000-sample chi-square check detects gross distribution regressions.
- Android backup, cleartext traffic, mixed content, WebView debugging, and release shrinking remain hardened.

Expected result: all tests execute application code or guard concrete application source/configuration; no mock gateway or fake capacity test is counted.

## API integration journey

The test must refuse every non-loopback API host.

1. Confirm API/PostgreSQL health.
2. Confirm an unauthenticated caller cannot read the P2P queue.
3. Sign in the disposable admin.
4. Request and verify the CI-only OTP for a new phone.
5. Register the player with the issued registration token and confirm ₹0 balance.
6. Record compliance confirmation.
7. Publish a disposable UPI account.
8. Create a ₹200 deposit intent.
9. Submit the exact amount and a unique 12-digit UTR.
10. Reject a duplicate UTR.
11. Approve the deposit and confirm exactly ₹200 is credited.
12. Reject a second approval of the same transaction.
13. Confirm the ledger CSV contains the UTR.
14. Delete the test UPI account and confirm it is no longer published.

Expected result: all state changes persist in the disposable database and duplicate operations cannot credit twice.

## Browser and accessibility journeys

Run each applicable scenario in desktop Chromium and a Pixel 5 profile.

- Landing, player, admin, and P2P pages render.
- No page has horizontal overflow at representative mobile and desktop widths.
- Landing and player show no broken images.
- Player starts at authentication and exposes registration from that screen.
- Login/staff phone fields are not prefilled.
- Registration cannot advance without required consent and fields.
- All four UIs have no serious or critical Axe WCAG 2 A/AA findings.
- The player insufficient-funds wizard supports its close control and backdrop dismissal in component regression/manual review.

Manual checks supplement automation for touch targets, visual hierarchy, focus visibility, copy, and responsive layout.

## Database and migration checks

On a disposable PostgreSQL 16 instance:

1. Run every tracked migration with `prisma migrate deploy`.
2. Start the API and confirm bootstrap succeeds.
3. Execute the integration journey.
4. Confirm unique UTR and one-wallet-per-user constraints.
5. Confirm failed/duplicate actions roll back without wallet drift.
6. Confirm history queries return persisted records.

Expected result: migrations apply without `db push`, the API starts, and the integration journey passes.

## Security checks

- Attempt unauthenticated admin and desk access.
- Attempt invalid/expired OTPs beyond the attempt limit.
- Attempt a revoked, banned, or stale-role token.
- Attempt private or unknown Socket.IO room joins.
- Attempt oversized screenshot input.
- Attempt deposit amount substitution and expired-intent submission.
- Attempt duplicate UTR, duplicate approval, and repeated withdrawal actions.
- Verify public staging refuses to boot with demo/test OTP or weak/local secrets.
- Verify restricted release returns 503 for regulated write operations.
- Verify tracked files contain no detected credentials.

## Resilience and performance

- Verify rate limits remain effective with Redis connected and disclose the single-process fallback limitation.
- Exercise duplicate requests and transactional rollback in integration tests.
- Inspect browser bundles and repeated navigation for console/runtime errors.
- Do not claim concurrency capacity until a separately designed, representative distributed load test runs against an authorized staging environment with defined latency/error thresholds.

## Traceability

- Authentication/session requirements: auth routes/services, rate limiter, security regression suite, API integration.
- Ledger/payment requirements: ledger/payment/turnover/TDS services, integrity migration, ledger regression suite, API integration.
- Game-state requirements: game engine, socket allowlist, shared utility tests, commitment regression.
- Admin/P2P requirements: admin routes and both desk clients, API integration, browser checks.
- UI/accessibility requirements: four React clients, Playwright/Axe suite, manual viewport review.
- Database requirements: Prisma schema/migrations, CI PostgreSQL service, integration flow.
- Security requirements: config launch assertions, server middleware, role middleware, secret/dependency scans, security audit.
- Deployment requirements: Render Blueprint, CI workflow, environment example, deployment runbook.
- Android requirements: Capacitor config, manifest, Gradle config, Android regression checks and Gradle build.

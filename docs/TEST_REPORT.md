# Test report

Date: 2026-10-21. Commands were run in `/Users/ravan/Documents/Documents/betting app `. Failures that were fixed are included. Nothing here is a player-capacity certificate or a fairness certificate.

## Unit and regression

`npm test` → 23 passed, 0 failed, 0 skipped.

Coverage includes payout rounding, deterministic card seals, chi-square on 14,000 samples, QR eligibility, screenshot-retention gating, public fail-closed rate-limit mode, cookie session source checks, agent path allowlist, regulated-feature gates, and Android manifest expectations.

The chi-square subtest detects a badly skewed generator under its documented sample and tolerance. It does not prove fairness.

## Simulated desk flow

Disposable API on `127.0.0.1:4010`, database `arcade_remediation`, `NODE_ENV=test`, `ENABLE_REGULATED_FEATURES=true`, `TEST_OTP=654321`.

`npm run test:integration` result:

`PASS desk flow 9006019949 balance 300, duplicate and malformed UTR rejected, CSV contains UTR`

The ₹300 balance is ₹200 principal plus the existing ₹100 first-deposit bonus. The script also requires an unauthenticated approval to return 401, a second approval to do nothing, and deletion of the test QR to stop that QR from being the published account. An earlier run failed only its balance assertion; the expectation was corrected to the bonus behaviour and the rerun passed. No live payment was made.

## Migrations and restore

`npx prisma migrate deploy --schema apps/backend/prisma/schema.prisma` against `arcade_remediation`: all six migrations applied, schema up to date.

`./scripts/backup-disposable.sh`: `source_users=5 restore_users=5 restore_migrations=6`.

## Android

`./gradlew assembleDebug`: `BUILD SUCCESSFUL in 8s`. JDK reported by the same shell was 21.0.12.1+1. APK path and checksum are in `docs/DEPLOYMENT.md`. Lint, unit, and instrumentation Android test tasks were not run. The app was not launched on an emulator or device.

## Dependency and secret scans

`npm run audit:deps`: 0 vulnerabilities.

`npm run audit:deps:all`: 7 vulnerabilities (5 high, 2 moderate), unchanged, Tailwind 3 development tree. See `docs/SECURITY_REVIEW.md`.

`npm run scan:secrets`: passed, 242 tracked files.

## Browser UI

`npm run test:e2e` on 2026-10-21: 20 passed, 0 failed, in 4.6s. Projects were desktop Chromium and a Pixel 5 profile. The suite checks overflow, serious accessibility violations, registration requiring phone verification, and staff forms that do not publish desk phone numbers. It does not log in and does not move money.

## Local health smoke

100 requests to `http://127.0.0.1:4010/api/v1/health`, concurrency 10, 0 errors, elapsed 57 ms, p50 1.4 ms, p95 21 ms, p99 26 ms, max 26 ms. Tool: Node.js `fetch` in this workspace, Node 22.14.0. Environment: one local API process, local Docker Postgres and Redis. This was not a login, game, or dashboard workload, and no pass target had been agreed. It must not be quoted as a supported player count.

## Completion pass, same day

`npm test`: 26 passed, 0 failed. New checks cover token revocation in source, fail-closed limits unless `ALLOW_MEMORY_RATE_LIMIT=true`, all 14 cards in the 14,000-sample regression, and rejection of a one-card generator by the same chi-square threshold.

`npm run lint` passed. `npm run scan:secrets` passed for 242 files. `npm run audit:deps` found 0 production vulnerabilities.

Fresh database `arcade_verify_20261021`: 7 migrations applied, schema up to date.

`npm run test:integration` against `127.0.0.1:4010`: `PASS desk flow 9006916824 bonus once, sessions revoked, agent desk only`.

The ₹300 balance is the documented rule in `approveDeposit`: the first successful deposit receives `Math.round(amount * 50) / 100`. For ₹200 that is ₹100, so the wallet becomes ₹300. The next ₹200 approval on the same player returned bonus ₹0 and balance ₹500. The bonus is not hidden state.

Two API processes sharing Redis: after login attempts on port 4010 reached 429, the next login attempt on port 4012 was also 429.

Redis port closed: OTP returned 503. The same request with `ALLOW_MEMORY_RATE_LIMIT=true` returned 200.

Restored database `arcade_verify_20261021_restore`: 3 users, 7 migration rows, 2 revoked-token rows. Health on that database returned `postgres: true`.

`./gradlew assembleDebug`: `BUILD SUCCESSFUL`. No emulator binary is installed.

`gh run list --limit 5` returned no hosted runs. Playwright was not repeated; the client screens were not changed in this pass. The earlier result remains 20 passed.

## Redis recovery and restart, 21 Oct 2026

`npm test`: 27 passed, 0 failed. `npm run test:e2e`: 20 passed. `npm run lint` and `npm run scan:secrets` passed. Production audit: 0 findings.

New database `arcade_verify_final`: 7 migrations applied. Desk flow `PASS desk flow 9008371477 bonus once, sessions revoked, agent desk only`, including one parallel approval and an agent QR create rejected with 403.

Redis was stopped at 10:26:16 UTC. The next OTP returned 503. Redis was started at 10:26:17 UTC. The following OTP returned 200. The API process was not restarted. Logs contained `redis_unavailable` and `redis_recovered`.

After a later API restart, the previously revoked bearer returned 401 and staff login returned 200. The restored database `arcade_verify_final_restore` matched 3 users, 7 migrations, and 2 revoked tokens. Health on that database returned Postgres and Redis true, and staff login returned 200.

Render CLI 2.30.0 `blueprints validate render.yaml` exited 1 because no workspace is logged in. `render whoami` also exited 1 with `run render login to authenticate`.

Provisional local measurements, not a player-capacity result: 8 seconds of `/api/v1/game/cards` at concurrency 15 produced 169,260 requests, 0 errors, p95 0.9 ms. That route does not query Postgres. 5 seconds of `/api/v1/health` at concurrency 10 on an Apple M6, 12 cores, one API process, local Postgres 16 and Redis 7 produced 55,950 requests, 0 errors, p50 0.7 ms, p95 1.1 ms, p99 1.7 ms.

## Alert receiver and repeat, 21 Oct 2026 10:41 UTC

`npm test`: 28 passed, 0 failed. `npm run test:e2e`: 20 passed. `npm run lint` passed. Secret scan passed across 272 tracked and untracked files. History search for six secret patterns found 0 commits. Production audit: 0 findings. Full audit: 7 findings, all through Tailwind 3.4.19. The only offered fix is Tailwind 4, which was not applied.

Desk flow `PASS desk flow 9009296428 bonus once, sessions revoked, agent desk only`. Redis stopped at 10:41:36 UTC and OTP returned 503. Redis started at 10:41:37 UTC. The next retry returned 503 and the following retry returned 200. The API was not restarted.

A process on 127.0.0.1:4099 received three JSON posts: `authorisation_denied`, `redis_unavailable`, and `redis_recovered`. Those posts did not contain the test password or database URL. This receiver is a local test double, not an external notification.

`assembleDebug` was up to date in 708 ms. `adb` has no device and `$HOME/Library/Android/sdk/emulator/emulator` is absent, so the APK was not installed.

Backup of `arcade_verify_final` restored 4 users and 7 migrations into `arcade_verify_final_restore`.

## Closure pass, 21 Oct 2026

`npm test`: 29 passed, 0 failed. `npm run lint`, `npm run typecheck`, `npm run format:check`, and `npm run test:e2e` (20 passed) completed. Production audit: 0 findings. Full audit: 7 findings. Secret scan passed 251 tracked files. `render whoami` exited 1. `adb devices` listed nothing.

A staging-simulated process (`DEPLOY_ENV=staging`, `ENABLE_REGULATED_FEATURES=false`) served Postgres-backed game reads. An authenticated `POST /api/v1/game/bet` returned 503. Five-second loopback workloads at concurrency 10 on an Apple M6: history 31,900 requests, 0 errors, p95 2.1 ms; events 25,590 requests, 0 errors, p95 2.2 ms; my-bets 13,850 requests, 0 errors, p95 4.2 ms. The temporary completed round used for the history sample was restored to `BETTING`.

## Not run

GitHub-hosted CI of this working tree, a logged-in Render workspace validation, Android installation, live SMS, an agreed capacity workload, and an external security test.

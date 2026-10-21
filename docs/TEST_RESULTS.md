# Test Results

Execution date: 2026-10-21

## Baseline

- Node.js: `v22.14.0`
- npm: `10.9.2`
- Initial `npm test`: 29 reported passes, but inspection showed many tests reimplemented fake gateways, in-memory concurrency, automatic payouts, or nonexistent mobile behavior. Those tests were removed and are not counted as evidence.
- Initial `npm run build`: passed.
- Initial `docker compose config --quiet`: passed.
- Initial disposable service startup: blocked because the Docker daemon was unavailable.

## Final passing gates

### Tracked-file secret scan

Command: `npm run scan:secrets`

Result: pass. No configured private-key or common live-token pattern was found across 242 tracked files.

### Lint and formatting

Commands:

```bash
npm run lint
npm run format:check
git diff --check
```

Result: pass. ESLint reported no errors, all configured files matched Prettier, and the patch had no whitespace errors.

### Type checking and production builds

Commands:

```bash
npm run typecheck
npm run build
```

Result: pass for:

- shared types
- shared utilities
- Express backend
- Capacitor player web bundle
- P2P panel
- admin panel
- landing site

Final frontend builds used Vite 7.3.7.

### Unit and regression tests

Command: `npm test`

Result: 17 passed, 0 failed, 0 skipped.

Coverage exercised:

- Android security configuration
- transactional bet/ledger source regression
- persisted intent/UTR binding
- removal of automatic/fake payment implementations
- round commitment/reveal behavior
- OTP, demo, release-gate, socket, and filesystem hardening
- real shared payout and outcome utilities
- deterministic chi-square distribution regression

The source regression tests prevent specific repaired code paths from reverting; they do not replace a live database integration test.

### Browser and accessibility

Command: `npm run test:e2e`

Result: 20 passed, 0 failed across desktop Chromium and Pixel 5 emulation.

Verified:

- four UI applications render
- representative phone/desktop layouts have no horizontal overflow
- landing/player images load
- player starts at authentication
- registration validation is present
- staff/player phone fields are not prefilled
- no serious or critical Axe WCAG 2 A/AA finding on the four applications

The first browser run found four contrast failures. After remediation, an intermediate run passed 19 and found one transient landing-heading contrast issue caused by opacity animation. Removing opacity from that animation produced the final 20/20 result.

### Dependency audits

Command: `npm run audit:deps`

Result: pass; zero known production dependency vulnerabilities.

Command: `npm run audit:deps:all`

Result: nonzero; seven development dependency findings remain (five high, two moderate), all through Tailwind CSS 3 build-time glob/parser dependencies. npm's available fix is a breaking Tailwind 4 migration. This is recorded as residual build-host risk, not reported as a clean full audit.

### Configuration checks

Command: `docker compose config --quiet`

Result: pass.

Command: `render blueprints validate`

Result: not run; the Render CLI is not installed on this workstation.

## Partially completed checks

### Android

Commands:

```bash
npm --workspace=apps/mobile-app run build
npx cap sync android
cd apps/mobile-app/android
./gradlew assembleDebug
```

Results:

- player production web bundle: pass
- Capacitor Android asset/plugin sync: pass
- Gradle compilation: blocked before compilation because no Java runtime is installed

No release signing was attempted. The 15.9 MB public debug APK was removed.

### Database migration and API integration

Planned commands:

```bash
npx prisma migrate deploy --schema apps/backend/prisma/schema.prisma
npm run test:integration
```

Result: not executed locally. `docker info` confirmed that the Docker client is installed but the daemon is not running, so disposable PostgreSQL and Redis could not be started. The integration script was updated for the hardened OTP/registration flow, requires explicit test credentials, and refuses non-loopback hosts.

The CI workflow provisions PostgreSQL 16 and Redis 7, applies migrations, starts the API, and executes this integration flow. CI has not been executed by this local task.

## Unverified external behavior

- real SMS delivery through Fast2SMS or MSG91
- live Render Blueprint creation/update
- backup and restore
- production monitoring and alerts
- signed Android release artifact
- production browser/device matrix
- representative distributed load/capacity
- legal, banking/payment, privacy, and responsible-play approvals

No result above should be interpreted as complete security, statistical certification, production capacity, or release authorization.

# Deployment Runbook

Date: 2026-10-21

## Release status

The supported target is restricted staging. Do not enable real-money operation, publish a signed app, or set `ENABLE_REGULATED_FEATURES=true` until the legal, security, payment, privacy, age/geographic, responsible-play, and operational gates are independently approved.

The checked-in Render Blueprint has automatic deployment disabled. Changing files does not authorize or perform a deployment.

## Required services

- Node.js 22
- PostgreSQL 16
- Redis 7
- One API process or a carefully validated multi-instance API deployment
- Four static clients: landing, player, admin, and P2P desk

Servers must bind to `0.0.0.0:$PORT`. Runtime filesystem writes are not durable on Render; financial and application state belongs in PostgreSQL/Redis or approved object storage.

## Environment configuration

Copy `.env.example` only for local development. Never commit real values.

Required API values:

- `DATABASE_URL`
- `REDIS_URL`
- `JWT_SECRET`: a generated long random value
- `ADMIN_PHONE` and an admin password of at least 12 characters
- `CORS_ORIGINS`: exact HTTPS client origins
- `SMS_PROVIDER`: `FAST2SMS` or `MSG91`
- Matching `FAST2SMS_API_KEY` or `MSG91_AUTH_KEY`

Restricted public values:

```text
NODE_ENV=production
DEPLOY_ENV=staging
ALLOW_DEMO_OTP=false
ENABLE_DEMO_LOGIN=false
ENABLE_REGULATED_FEATURES=false
```

Never set `TEST_OTP` publicly. The API refuses to boot if public deployment checks fail.

Client builds use:

- `VITE_API_URL`
- `VITE_PLAYER_URL` on the landing site
- `VITE_ENABLE_DEMO_LOGIN=false`
- `VITE_APP_DOWNLOAD_URL` only after a signed artifact is approved

Do not use `CAPACITOR_SERVER_URL` for a release build. Release apps should load bundled assets. Local development URLs must be loopback HTTP; every other configured URL must use HTTPS.

## Clean build

```bash
npm ci
npm run scan:secrets
npm run lint
npm run format:check
npm run typecheck
npm test
npm run audit:deps
npm run build
```

Run Playwright after the four client builds:

```bash
npx playwright install chromium
npm run test:e2e
```

Do not continue if a blocking command fails.

## Database migration

### Before migration

1. Confirm the target is staging or an approved maintenance window.
2. Record the application commit and current migration status.
3. Take and verify a provider snapshot/backup.
4. Confirm no unexpected migration drift.
5. Inspect the SQL in every unapplied migration.

### Apply

```bash
npx prisma migrate status --schema apps/backend/prisma/schema.prisma
npx prisma migrate deploy --schema apps/backend/prisma/schema.prisma
```

Never use `prisma db push` against staging or production.

The 2026-10-21 integrity migration adds a non-null boolean with a default and four indexes. Validate index build impact against production-sized data before an authorized production rollout.

### Rollback

Prisma does not generate automatic down migrations. For an application regression:

1. Keep the additive schema in place.
2. Roll the application back to the previously verified commit.
3. Verify API health and ledger invariants.

For a schema/data regression:

1. Stop regulated writes with the server-side feature flag and payout/betting kill switches.
2. Capture logs and preserve the failed database.
3. Restore the verified pre-migration backup into a new database.
4. point staging at the restored database only after integrity checks.
5. Reconcile every transaction created after the backup before any resumption.

Do not drop columns or indexes during an incident without a reviewed forward migration.

## Render staging

The Blueprint defines PostgreSQL, private Render Key Value access, one API service, and four static sites. It uses `npm ci`, `prisma migrate deploy`, exact CORS origins, generated JWT secrets, external staff/SMS secrets, and disabled automatic deploys.

Before manually triggering a staging deployment:

1. Validate `render.yaml` with Render CLI 2.7 or newer:

   ```bash
   render blueprints validate
   ```

2. Configure all `sync: false` values in the Render dashboard.
3. Confirm `ENABLE_REGULATED_FEATURES=false`.
4. Confirm no debug APK exists under the landing site's public directory.
5. Confirm database and Redis are staging resources.
6. Run CI and require all checks.
7. Deploy the API, confirm migrations and health, then deploy static clients.

The free Render plan can spin down after inactivity, and free PostgreSQL has lifecycle limits. These characteristics are not appropriate evidence of production readiness.

## Post-deploy restricted-stage verification

1. Check `/api/v1/health` over HTTPS.
2. Verify CORS rejects an unlisted origin.
3. Verify demo and test OTP paths are unavailable.
4. Verify a bet, deposit intent, UTR submission, and withdrawal return the restricted-release response.
5. Verify admin and P2P pages require valid staff authentication.
6. Inspect API logs for secrets, OTPs, stack traces, or personal data.
7. Check browser consoles and network failures on all four clients.
8. Confirm the Android download is unavailable.

## Android release procedure

Local technical verification:

```bash
npm --workspace=apps/mobile-app run build
cd apps/mobile-app
npx cap sync android
cd android
./gradlew assembleDebug
```

A debug APK proves only that the project compiles. It must not be published.

For an authorized release:

1. Obtain an organization-owned keystore through the approved secrets process.
2. Configure signing through local/CI secret variables, never tracked Gradle files.
3. Increment `versionCode` and `versionName`.
4. Build a signed App Bundle or APK in controlled CI.
5. Verify the certificate fingerprint, package ID, API URL, disabled debugging, bundled assets, and release feature flags.
6. Run mobile security and device compatibility checks.
7. Generate and publish a checksum and provenance record.
8. Set `VITE_APP_DOWNLOAD_URL` only to the approved HTTPS artifact.

## Monitoring and recovery requirements

Before production review, add and test:

- API, PostgreSQL, Redis, and Socket.IO availability alerts.
- Authentication/rate-limit abuse alerts.
- Ledger debit/credit imbalance and stuck-settlement alerts.
- Privileged action and UTR approval audit alerts.
- Backup success and scheduled restore tests.
- Incident ownership, communication, containment, reconciliation, and recovery procedures.
- Key/credential rotation and signed-app revocation/update procedures.

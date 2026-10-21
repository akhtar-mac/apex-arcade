# Apex Arcade

A restricted-stage 14-picture wagering application. It contains a React/Vite player UI wrapped with Capacitor for Android, a landing site, admin and P2P desk panels, and an Express/Socket.IO API backed by PostgreSQL and Redis.

This repository is not approved for public real-money operation. Public deployments default to disabled betting, deposits, UTR submission, withdrawals, demo OTP, and demo login. See `docs/DEPLOYMENT_RUNBOOK.md` and `docs/SECURITY_AUDIT.md` before any release decision.

## Applications

- `apps/backend` — Express, Socket.IO, Prisma, PostgreSQL, Redis, and BullMQ.
- `apps/mobile-app` — React/Vite player UI and Capacitor Android project. It is not React Native.
- `apps/web-landing` — React/Vite restricted-stage website.
- `apps/web-admin` — React/Vite admin console.
- `apps/p2p-panel` — React/Vite manual UPI/UTR review desk.
- `packages/shared-types` — shared Zod schemas and TypeScript types.
- `packages/shared-utils` — shared game and money helpers.

Deposits use manual QR payment and human verification of a 12-digit UTR. No automatic payment gateway or banking bot is implemented. New accounts start at ₹0. Demo credits, when explicitly enabled for local demonstrations, cannot be deposited or withdrawn.

## Local setup

Requirements:

- Node.js 22
- npm 10
- PostgreSQL 16
- Redis 7

```bash
cp .env.example .env
npm ci
npm run prisma:generate
npx prisma migrate deploy --schema apps/backend/prisma/schema.prisma
npm start
```

The local ports are:

- Landing: `http://localhost:5173`
- Player: `http://localhost:5174`
- Admin: `http://localhost:5175`
- P2P desk: `http://localhost:5176`
- API: `http://localhost:4000`

`docker compose up -d` can start the repository services when a Docker daemon is available. Apply migrations before exercising API flows.

## Quality gates

```bash
npm run scan:secrets
npm run lint
npm run format:check
npm run typecheck
npm test
npm run audit:deps
npm run build
npm run test:e2e
```

The mutating integration flow is intentionally restricted to a local disposable API:

```bash
NODE_ENV=test TEST_OTP=654321 ADMIN_PASSWORD=your-test-admin-password npm run test:integration
```

The API must be running with the same `TEST_OTP`, a disposable migrated database, and a local Redis instance. The script refuses non-loopback hosts.

## Android

The Android project lives under `apps/mobile-app/android`.

```bash
npm --workspace=apps/mobile-app run build
npx cap sync android --cwd apps/mobile-app
cd apps/mobile-app/android
./gradlew assembleDebug
```

Debug APKs are test artifacts and must not be published. A release APK or App Bundle must be signed outside the repository with an organization-controlled key after the release gate is cleared. No signing key or password belongs in Git.

## Release controls

- `DEPLOY_ENV=staging` or `NODE_ENV=production` activates strict public-deployment checks.
- `ENABLE_REGULATED_FEATURES=false` keeps betting and money movement unavailable.
- `ALLOW_DEMO_OTP=false` and `ENABLE_DEMO_LOGIN=false` are required publicly.
- Public CORS origins must be explicit HTTPS origins.
- `TEST_OTP` is accepted only when `NODE_ENV=test` and is rejected on a public deployment.
- The Render Blueprint has automatic deployment disabled and uses `prisma migrate deploy`.

See the documents in `docs/` for the audit, test evidence, security findings, and deployment/rollback procedures.

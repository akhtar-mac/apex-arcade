# Deployment

No deploy was performed. Production and public staging remain unauthorised for real-money play.

## Render blueprint

`render.yaml` declares one free Postgres database, one private Redis instance (`ipAllowList: []`), the API, and four static sites. `autoDeployTrigger` is `off` on every service. `ENABLE_REGULATED_FEATURES`, `ALLOW_DEMO_OTP`, and `ENABLE_DEMO_LOGIN` are false on the API. SMS keys, admin phone, and admin password are `sync: false`. `JWT_SECRET` uses `generateValue: true`. No secret value is written in the file.

The API health check is `/api/v1/health`. Migrations are `preDeployCommand`, not part of the process start command. A failed migration should fail the deploy before the new process becomes healthy. This was not executed on Render.

Official validation was not run. `render` is not installed, so `render blueprints validate` has no result. Static inspection is the only check.

## Boot behaviour

A public deployment refuses to start when demo OTP, demo login, test OTP, the default admin phone `9999999999`, a short admin password, a known local JWT secret, a missing HTTPS CORS origin, or a missing Fast2SMS/MSG91 configuration is present. Because those SMS values are intentionally absent, the API blueprint would fail closed on Render today. That is expected. Do not add a live SMS key to make it boot.

## Local reproduction

Postgres and Redis come from `docker compose up -d postgres redis`. Use a disposable database name. Do not point `DATABASE_URL` at a hosted database for these checks.

## Android

Debug build, JDK 21.0.12.1+1, Android SDK at `~/Library/Android/sdk`:

```
export JAVA_HOME="$HOME/.local/jdk/jdk-21.0.12.1+1/Contents/Home"
export ANDROID_HOME="$HOME/Library/Android/sdk"
cd apps/mobile-app && npx cap sync android && cd android && ./gradlew assembleDebug
```

Result on 2026-10-21: `BUILD SUCCESSFUL in 8s`.

APK: `apps/mobile-app/android/app/build/outputs/apk/debug/app-debug.apk` (15 MB). SHA-256: `a67bb34af5061a0c4b32f2589e93cdbf675fe733591e7432c631a40c03539b9f`. The file starts with the ZIP magic bytes. The `app/build` directory is a build output and is not published from the landing site.

`assembleDebug` uses the machine debug keystore. `build.gradle` does not contain a release `signingConfig` or a keystore password. Version code is 1 and version name is `1.0`. Instrumentation tests and an emulator launch were not run.

Release handover, when an owner is ready:

1. Create the keystore on a machine the owner controls. Do not commit it.
2. Provide the path and passwords through the build environment, not Git.
3. Add a release `signingConfig` that reads those environment values.
4. Build with `bundleRelease` only after legal and store approval.
5. Record the version code increase in the same change.

## Alerts

Structured logs exist for startup retention skips and Redis fail-closed responses, and each API response carries `X-Request-Id`. There is no paging provider, webhook, or tested inbox. The following alerts are specified and undelivered:

| Signal              | Severity | Trigger                                          | Owner      | Response                                                             |
| ------------------- | -------- | ------------------------------------------------ | ---------- | -------------------------------------------------------------------- |
| API health          | critical | `/api/v1/health` fails for 3 checks              | unassigned | Stop traffic and read the boot log                                   |
| Redis loss          | high     | public sign-in returns 503 because Redis is down | unassigned | Restore Redis; do not switch those routes to a process-local counter |
| Database saturation | high     | connection errors or pool exhaustion             | unassigned | Reduce instances and inspect Prisma logs                             |
| Desk mismatch       | high     | approval result does not match the ledger row    | unassigned | Freeze the synthetic desk and reconcile                              |
| Privileged action   | medium   | role, QR, or retention setting changes           | unassigned | Confirm the operator and revert if unknown                           |
| Backup failure      | high     | restore user count differs from source           | unassigned | Keep the source database and investigate the dump                    |

No row in that table has a successful delivery test.

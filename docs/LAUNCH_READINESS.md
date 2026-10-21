# Launch Readiness

Assessment date: 2026-10-21

## Decision

Apex Arcade is **not ready for a public real-money launch**.

Later the same day, disposable migrations, the simulated desk flow, a local debug APK compile, and a disposable backup restore were executed. Render CLI validation and GitHub-hosted CI remain unverified. The current classification is **PARTIALLY VERIFIED** in `docs/RELEASE_READINESS.md`. `ENABLE_REGULATED_FEATURES` must remain `false` on any public host until independent legal, payment, privacy, age/geographic, security, and operational approvals exist. This document does not grant those approvals.

## Product as implemented

- API: Express, Socket.IO, Prisma, PostgreSQL, Redis.
- Clients: React/Vite player, landing site, admin console, and P2P desk.
- Android: Capacitor shell around the player web build. It is not React Native.
- Game: 14 pictures, 10× stake payout, card sealed before bets.
- Money: published QR, player-submitted 12-digit UTR, human approval. New wallets start at ₹0.
- Demo: local-only, explicitly marked, and nonwithdrawable.
- Public deployment: demo OTP, demo login, test OTP, and regulated writes are rejected unless an explicit server-side release flag is enabled.

## Evidence used

Passed locally on 2026-10-21:

- Secret scan, lint, formatting, type check, and production builds.
- 23 unit and regression tests.
- Prisma `migrate deploy` on disposable database `arcade_remediation` (6 migrations).
- Simulated desk flow on loopback, ending at balance ₹300 for a ₹200 approval plus the first-deposit bonus.
- `./gradlew assembleDebug` with JDK 21. The APK stayed in the Android build output directory.
- Disposable backup restore: 5 users and 6 migration rows matched.
- Production dependency audit: 0 known high-severity findings.

Still not executed:

- `render blueprints validate`. The Render CLI is not installed.
- GitHub Actions on a hosted runner.
- Android instrumentation tests and an emulator or device launch.
- Real SMS, signed Android release, alert delivery, and external penetration testing.

## Pending before restricted staging can be trusted

1. Install Render CLI 2.7 or newer and run `render blueprints validate`. Static inspection passed; official validation did not run.
2. Run the GitHub workflow on a hosted runner and require every job to pass. Remote execution is unverified.
3. Launch the debug APK on an emulator or device. The compile succeeded; installation and navigation did not.
4. Configure staging SMS, admin phone, admin password, and `JWT_SECRET` outside Git only when a public boot is actually intended. Leave regulated features, demo OTP, and demo login disabled. Do not add SMS credentials merely to make Render start.

## Pending before a real-money decision

### External

1. Independent legal review for the jurisdictions where play would be offered.
2. Server-side age and geographic controls matching that review. A client checkbox is not sufficient.
3. Payment-account and banking approval for the QR that receives money.
4. A funded Fast2SMS or MSG91 account, with one successful live OTP delivery.
5. Separate trained admin and agent operators. Do not share one desk password.
6. An organization-controlled Android signing key held outside Git, plus a signed artifact and update plan.
7. A tested database backup and restore, including balance reconciliation.
8. Alerts for API, PostgreSQL, Redis, authentication abuse, settlement failure, and privileged actions.
9. An external application and mobile security test, with high findings closed.
10. Privacy retention and TDS filing ownership.

### Still in the code

1. Browser access tokens are no longer written to `localStorage`. Same-site restore uses an HttpOnly cookie. A bearer still lives in tab memory until it expires, and logout does not revoke every outstanding bearer.
2. Public sign-in limits fail closed when Redis is down. Local and test processes still keep a process-local fallback, which is not distributed protection.
3. Define screenshot retention, access audit, and deletion.
4. Accept or remediate the seven Tailwind 3 development-dependency findings. Production dependencies are currently clean.
5. Treat the chi-square test as a regression check, not a fairness certificate.
6. Do not publish a concurrent-user capacity until a representative staging load test is measured.

## Superseded assessment

The 14 Oct 2026 readiness view is withdrawn. It reported an engineering score of 91, a 500-socket measurement, and a published debug APK. Those statements are not supported by the current evidence.

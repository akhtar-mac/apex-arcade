# Sorat / Apex Arcade Project Audit

Audit date: 2026-10-21

## Scope and baseline

The repository is an npm-workspaces monorepo running on Node.js 22. The Git worktree was clean before this audit. No live Render data was changed. All planned database and end-to-end verification uses disposable local data and simulated credits.

Baseline commands:

- `node --version`: `v22.14.0`
- `npm --version`: `10.9.2`
- `npm test`: 29 reported passes, 0 failures. Two files are retired stubs and most phase tests reimplement logic rather than exercising the application.
- `npm run build`: passed for shared packages, backend, player, P2P, admin, and landing.
- `docker compose config --quiet`: passed.
- Disposable migration/startup baseline: blocked because the local Docker daemon was not running.
- Production dependency audit: 3 moderate findings through Capacitor CLI's `xcode -> uuid` dependency; the suggested automatic fix is a breaking downgrade and was not applied.
- Tracked-file credential pattern scan: no matching private keys or common live-token formats.

## Actual architecture

- Backend: Express 4, Socket.io 4, TypeScript, Prisma 5, PostgreSQL 16, Redis 7.
- Player: React 18 and Vite 5 wrapped by Capacitor 8 for Android. It is not React Native.
- Other clients: React/Vite landing page, admin console, and P2P agent console.
- Shared packages: Zod/API contracts and HMAC-based 14-card outcome helpers.
- Deployment: Render API plus four static sites, Render Postgres, and Render Key Value. Docker Compose provides local Postgres, Redis, PgBouncer, and nginx; the normal Compose profile does not start the API.
- Navigation: state-driven single-page tabs rather than a routing library.

## Runtime data flow

1. OTP or staff-password authentication returns JWTs.
2. The player joins a public game room over Socket.io.
3. A round outcome is selected and sealed at round creation.
4. A bet currently debits the PostgreSQL wallet, then places the bet in an in-process batch queue.
5. Deposits require a published UPI account, a deposit intent, a 12-digit UTR, and a staff approval.
6. Withdrawals create a wallet hold and remain pending until staff records the actual payout UTR.
7. PostgreSQL is intended to be authoritative, but multiple screens and services still prefer bounded in-memory caches.

## Feature and route inventory

### Player

- Authentication: OTP login, registration, session restore, demo login.
- Tabs: lobby, arena, activity, profile.
- Money: QR/UPI deposit intent, UTR submission, transaction history, withdrawal, turnover status.
- Game: room/event list, live round sync, card betting, result/wallet updates.
- Compliance: age confirmation, deposit cap, PAN/legal name, self-exclusion.
- Modals: first-deposit offer, insufficient-funds wizard, deposit, withdrawal, support, rules, responsible play.

### Backend

- `/api/v1/auth`: OTP, registration/login, staff login, demo login, profile/session, compliance.
- `/api/v1/payments`: manual deposit/UTR/withdrawal/history and UPI-account administration. Gateway and simulation routes return 410.
- `/api/v1/game`: rooms, events, cards, HTTP betting, history, user bets.
- `/api/v1/admin`: statistics, queues, users/bans, desk log, risk controls, events, branding, and CSV ledger export.
- `/socket.io`: round sync, public room updates, betting, and private wallet updates.

### Roles

- `USER`: play, deposit, withdraw, and manage compliance preferences.
- `AGENT`: operate deposit/withdrawal queues and selected desk functions.
- `ADMIN`: full desk, user, event, brand, export, and emergency controls.

### Database

`User`, `Wallet`, `GameRoom`, `GameRound`, `Bet`, `Transaction`, `UpiAccount`, `DeskLog`, `GameEvent`, `EventCard`, `BrandSetting`, and `TdsRecord`.

Five tracked migrations create the ledger, compliance fields, desk log/ban fields, events, and branding/game flags.

## Initial feature classification

- Build and TypeScript compilation: implemented and baseline-verified.
- Manual P2P deposit approval: implemented, but UTR amount binding and admin UI actions require repair.
- Manual withdrawal hold/approval: implemented; dead automatic payout/simulator code contradicts the product.
- Wallet row locking and UTR uniqueness: implemented and positive controls.
- Game result sealing: implemented; user-verifiable commitment/reveal evidence is incomplete.
- Bet persistence: partially implemented and unsafe on queue/database failure.
- OTP/session revocation: partially implemented and not safe across processes.
- Demo account: implemented but unsafe because credits can become withdrawable.
- Browser E2E, accessibility, lint, formatting, CI, and coverage gates: missing.
- Android distribution: debug APK only; release signing is externally blocked by the absent keystore.
- Production/legal release: blocked by independent authorization, production SMS, payment/banking approval, signed app, and operational readiness.

## Prioritized confirmed findings

### Critical

1. Public Render staging enables fixed demo OTP and demo login.
2. Demo login can create withdrawable simulated funds.
3. Bet debit and bet persistence are not one transaction; a crash or insert failure can retain the debit while losing the bet.
4. Submitted UTR amount is not immutably tied to its original intent.
5. Admin payment approve/reject controls can update UI without executing the ledger API.
6. Dead payout code can fabricate a successful IMPS UTR after a gateway failure.

### High

1. OTP verification and quick registration lack adequate IP/account attempt limits; OTPs are process-local.
2. Session revocation is process-local on verification despite writing a Redis marker.
3. Socket room names are not allowlisted and socket event/connection limits are absent.
4. Turnover and TDS persistence errors are swallowed.
5. Transaction/history/admin views read bounded caches rather than paginated PostgreSQL.
6. Render starts with `prisma db push` rather than controlled migrations.
7. Internal force-card mutation remains callable in code even though its HTTP route is disabled.
8. Server exposes its working directory through a DevTools well-known endpoint.

### Medium

1. README describes 12 cards, NestJS, React Native, automatic payouts, and Docker behavior that do not match the code.
2. Legacy mock applications, simulated tests, and generated source artifacts obscure the supported product.
3. Access tokens are stored in browser local storage and refresh tokens are issued without a refresh flow.
4. Uploaded screenshot data lacks a strict schema size bound.
5. Error responses and logs can expose operational details or personal data.

## Security and release boundary

This audit does not establish legal authorization, complete security, statistical fairness, or 10,000-user capacity. Real-money features must remain behind server-side release flags until independent legal, age/geographic, privacy, responsible-play, banking/payment, security, and operational approvals are complete.

## Implementation order

1. Authentication, demo-mode, session, socket, and server hardening.
2. Atomic ledger/bet/turnover/payment fixes.
3. UI wiring and truthful product behavior.
4. Executable integration/E2E/accessibility/CI gates.
5. Migration, staging, Android, and release-runbook hardening.
6. Full regression and evidence-based handover.

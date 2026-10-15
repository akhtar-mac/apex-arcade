# Apex Arcade — full launch plan

This file replaces the old checklist that marked the product 100% production ready. That checklist does not match the code. This plan is the work that remains, in the order it has to be done.

Current score: about **40/100** before this work started.
Target after Phases 1–6: **90** on every area that code can finish.
Target after Phases 7–8: the rest of a real public launch, including the server you rent and the permission your state requires.

Status:

- Phase 1 is done. Postgres is the ledger. A restart kept a balance, a pending payout, and a paused QR. Approving the same deposit twice did not credit twice. A repeated UTR is rejected. New players start at ₹0.
- Phase 2 is done. Admin and P2P show a login wall. Approve, reject, ban, kill switches, and QR upload return 401 with no token. OTP `1234` works only while `ALLOW_DEMO_OTP=true` and the server is not in production. The API does not return the OTP. Production refuses to boot if `JWT_SECRET`, `DATABASE_URL`, or `REDIS_URL` is missing.
- Phase 3 is done. Invented players, concurrent-user counts, welcome credit, and the profit-lock picker are gone. Terms, Privacy, and 18+ pages are real.
- Phase 4 is done for the image and the single-server shape. Node 22, one API behind nginx, Postgres health, a backup script, git, and `.env.example`. A domain and VPS are still yours.
- Phase 5 is done as a proof on this laptop. `node tests/desk-flow.mjs` passed. 50 real sockets connected with p95 14 ms. A signed APK still needs your keystore. Set `CAPACITOR_SERVER_URL` to the public origin.
- Phase 6 is done in software. Daily deposit cap, self-exclusion, PAN and legal name before a withdrawal of ₹10,000, and a CSV at `/api/v1/admin/ledger.csv`. A state license is still yours.
- Phase 7 is not launch morning. One API process is the launch shape.
- Phase 8 is outside the repo: license, funded SMS, domain, your real QR, and a person on the desk.

Nothing in this plan is optional if the goal is a launch. Phases run in order. Do not publish the server in Phase 4 before Phases 1 and 2 are finished, or anyone on the internet can approve payouts.

## Rules that stay fixed

- Players pay a QR code and a UPI ID that an admin or a P2P agent uploaded. There is no Cashfree, Razorpay, or other payment gateway.
- A deposit credits the wallet only after a person matches the 12-digit UTR.
- A withdrawal holds the balance immediately. An agent pays the player from their own UPI, then types that real 12-digit UTR. The app does not invent an IMPS id.
- The winning card is sealed when the round starts, from the round seed, before any bet. A 10x payout on 14 pictures already keeps about 29% for the house on average. The function `calculateWinningCardWithProfitLock` in `apps/backend/src/services/game-engine.service.ts` is deleted. It is not tuned.
- PostgreSQL is the only ledger. The in-memory `Map` in `apps/backend/src/db.ts` and the SQLite file are not allowed to be the source of truth.

## Money flow

1. Admin or P2P publishes a UPI ID, account name, daily cap, and QR image.
2. The player pays that QR in PhonePe, GPay, or Paytm.
3. The player submits the 12-digit UTR and an optional screenshot.
4. The agent approves only after the UTR matches the bank. The wallet is credited once.
5. The player requests a withdrawal. The amount is held.
6. The agent sends that money to the player's UPI.
7. The agent pastes the UTR from that payment and marks it paid. Reject returns the hold.

---

## Phase 1 — One ledger that survives a restart

About 2 days. This is the foundation. Every later phase writes into this ledger.

Done when:

- Restarting the API does not drop a pending UTR, a wallet balance, or a published QR.
- Approving the same UTR twice credits the wallet once.
- A new empty database does not contain a ₹100,000 admin wallet or a ₹5,000 demo wallet.

Work:

- Add real Prisma migrations under `apps/backend/prisma`. The folder today has only `schema.prisma`.
- Stop `prisma db push` in `apps/backend/Dockerfile`. Migrations run against Postgres, not through PgBouncer.
- Persist users, wallets, bets, rounds, transactions, and UPI accounts in Postgres. The `Map` in `apps/backend/src/db.ts` and `apps/backend/data/upi-accounts.json` may cache. They may not be the write that counts.
- On each deposit and withdrawal, store the screenshot, the serving UPI account id, the approver id, and the timestamps.
- Reject a second claim of the same 12-digit UTR across all users.
- Add pause and delete for a published QR. The player app already says "No QR is published yet" when the list is empty. Keep that.
- On first boot, create one admin from env vars (`ADMIN_PHONE`, `ADMIN_PASSWORD`) with balance 0. Remove the seeded users in `apps/backend/src/db.ts`.

Files: `apps/backend/prisma/schema.prisma`, `apps/backend/src/db.ts`, `apps/backend/src/services/payment.service.ts`, `apps/backend/src/services/wallet.service.ts`, `apps/backend/src/local-db.ts`.

---

## Phase 2 — Nobody moves money without a login

About 2 days. Do this before any public URL exists.

Done when:

- Deposit, withdraw, approve, reject, ban, kill switches, and QR upload return 401 with no token.
- An agent can approve the queue and publish a QR. Only an admin can ban, flip kill switches, or export the ledger.
- Production refuses OTP `1234` and `123456`.
- The API response never includes the OTP.

Work:

- Login screens on `apps/web-admin/src/App.tsx` and `apps/p2p-panel/src/App.tsx`. Roles already exist: `ADMIN` and `AGENT`.
- One middleware on `apps/backend/src/routes/admin.routes.ts` and on the UPI write routes in `apps/backend/src/routes/payment.routes.ts`.
- In `apps/backend/src/services/auth.service.ts`, a fixed OTP is accepted only when `ALLOW_DEMO_OTP=true`. Production leaves that unset. Remove the auto-register path that passes `'123456'`.
- SMS in `apps/backend/src/services/sms.service.ts`: if `FAST2SMS_API_KEY` or `MSG91_AUTH_KEY` is set, send the real code. If neither is set, login works only in development. Buying the SMS account is your step. The code only reads the key.
- CORS allowlist of the four app origins. Remove `unsafe-eval` from the headers in `apps/backend/src/server.ts`.
- Delete default JWT and database passwords from `apps/backend/src/config.ts` and `docker-compose.yml`. Production must refuse to boot when `JWT_SECRET`, `DATABASE_URL`, and `REDIS_URL` are missing.
- Apply the existing rate limiter to OTP, login, deposit, and withdraw.

You bring in this phase: a Fast2SMS or MSG91 account, and the API key in `.env`. Until that key exists, production login cannot be finished.

---

## Phase 3 — Screens that show only real data

About 2 days.

Done when a person can open every player, admin, P2P, and landing tab and never see an invented player, an invented concurrent-user count, or an invented round.

Work:

- Replace `users.length * 42 + 18` in `apps/backend/src/routes/admin.routes.ts` with the live socket count and the real wallet totals.
- Delete `seedHistoricalLogs` and `calculateWinningCardWithProfitLock`. The admin "30% Profit Engine" screen becomes a report of settled rounds: pool, payout, actual margin. It cannot choose the next card.
- The admin settlement tab uses the same queue as the P2P console.
- Player activity in `apps/mobile-app/src/App.tsx` loads `GET /api/v1/payments/history` instead of the hardcoded `TX-101` list.
- Landing copy in `apps/web-landing/src/App.tsx` matches the desk: pay the QR, submit the UTR, an agent confirms. Remove "auto-dispatched in 90 seconds".
- Three real pages, not `href="#"`: Terms, Privacy, and an 18+ gate stored on the user row.
- Do not rewrite the 2,900-line player file during launch. Remove the false data and wire the live APIs. A component split can wait until after the first public week.

---

## Phase 4 — A server image that stays up

About 2 days, after you have a domain and a VPS.

Done when `docker compose up -d` on a Linux VPS serves HTTPS for the site, the player app, admin, and P2P, and the API is still up after a reboot.

Work:

- Change `apps/backend/Dockerfile` from `node:20-alpine` to `node:22-alpine`. The current image crashes because `local-db.ts` imports `node:sqlite`, which Node 20 does not have. After Phase 1, SQLite is no longer the ledger. Node 22 is still the base image.
- Run migrations against Postgres directly. PgBouncer in transaction mode breaks Prisma. One API container talks to Postgres with a small pool until a measured test says the pooler is safe.
- Attach the Redis socket adapter before `listen`, or do not claim a cluster. Launch day is one API process.
- `nginx.conf` serves the built frontends and proxies `/api` and `/socket.io` to that API. Today port 80 listens and does not answer, because the Docker API workers are stopped.
- Build the four Vite apps with `VITE_API_URL` set to the public origin. Remove remaining `http://localhost:4000` calls. The Vite proxies in each `vite.config.ts` stay for local dev only.
- Daily `pg_dump` onto a second disk. Health check fails if Postgres or Redis is down.
- Start a git repo. Add `.env.example`. Keep `.env` untracked.

You bring before this phase: a domain, and one VPS with 2 vCPU and 4 GB RAM. That is enough for the first public week. It is not a 10,000-user cluster.

---

## Phase 5 — Proof, then the phone build

About 2 days.

Done when the scripted desk flow passes against the running server, and a release APK opens that server rather than localhost.

Work:

- Rewrite `tests/e2e-all-flows-audit.test.js`. It still expects instant credit and demo OTP. The new script is: agent publishes a QR, player logs in, submits a UTR, agent approves, balance changes once, player withdraws, agent marks paid with a 12-digit UTR, a second approve fails.
- Replace `tests/load-test-10000-ccu.test.js`. That file updates a JavaScript `Map` and finishes in about 9 ms. It is not a load test. Run 200 concurrent sockets against the VPS, require zero negative balances, and record p95. Publish those numbers.
- In `apps/mobile-app/capacitor.config.ts`, set the server URL to the public origin and produce a signed release APK. The landing page links to that APK. A Play Store listing is a later week, not a blocker for the first download.

---

## Phase 6 — The file you can hand an accountant

About 1 day. This is the last software phase.

Done when an admin can export a date range and a player can freeze their own account.

Work:

- Store age confirmation, the terms version the player accepted, and a daily deposit cap the player sets.
- CSV export of deposits, withdrawals, TDS withheld, and UTR.
- Collect PAN and legal name. Show them to the agent before a withdrawal above ₹10,000. Checking that PAN with a KYC vendor stays manual until you pick a vendor.
- Self-exclusion: a player can freeze the account. Login then fails until the freeze ends.
- The 30% TDS math in `apps/backend/src/services/tds.service.ts` stays, and the CSV is the record. Filing the tax is your accountant's job, not a button in the app.

---

## Phase 7 — The second node, only after the first week is stable

This is how scale moves from a proven single server toward the old 10,000-user claim. It is not launch morning.

Done when two API containers behind nginx share one round clock and one wallet, and a load run shows the socket count you actually reached.

Work:

- Redis adapter attached before listen, verified by a client on node A receiving a tick published by node B.
- One clock leader. The key `game:engine:clock:leader` already exists. Prove the standby does not settle the same round.
- PgBouncer only after prepared statements are disabled or the pool mode is session. Measure, then switch.
- Load rig on a separate machine. Record connections, bet latency, and wallet drift. Write the number down. Do not reuse the old "1,072,056 bets per second" figure.

---

## Phase 8 — What you do outside the repo

Started. Production now refuses to boot without a funded SMS key, an https public origin, a new desk password, and new JWT secrets. Demo code 1234 cannot be turned on in production. A socket or game bet without a verified login can no longer use another player's wallet.

Code cannot check these boxes. The launch is not lawful or reachable without them.

- State permission for real-money play, for the states you accept.
- SMS provider funded, sender id approved, and the key in production env.
- Domain, TLS certificate, and the VPS from Phase 4.
- The real UPI ID and QR, uploaded by you in admin. The repo must not ship a placeholder VPA.
- A person on the P2P desk during the hours you promise payouts.
- Accountant setup for the TDS CSV from Phase 6.
- Play Store account, if you want the store and not only the APK link.

---

## Order

| Phase | What | Days | Blocked by |
| --- | --- | --- | --- |
| 1 | Postgres ledger | 2 | nothing |
| 2 | Login and OTP | 2 | Phase 1, and your SMS key for production |
| 3 | Honest screens | 2 | Phase 1 |
| 4 | HTTPS server | 2 | Phases 1–2, plus your domain and VPS |
| 5 | Tests and APK | 2 | Phase 4 |
| 6 | Compliance export | 1 | Phase 1 |
| 7 | Second node and a real load number | after week 1 | Phase 4 stable |
| 8 | License, SMS, domain, live QR, desk staff | your calendar | nothing in git |

Phases 3 and 6 can run beside Phase 2 once Phase 1 is merged. Phase 4 waits for Phase 2.

## What 100 means

After Phases 1–6, payments, the ledger, security, the player app, admin, P2P, the landing site, the game, and the release path can sit at 90 or above.

100, for a public launch, also needs Phase 7 only if you promise 10,000 concurrent users, and Phase 8 in every case. Shipping Phases 1–6 onto a laptop with OTP `1234` is not that launch.

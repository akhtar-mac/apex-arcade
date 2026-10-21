# Architecture

Apex Arcade is a Node and React monorepo for a 14-picture game and a manual payment desk. This describes the code that is present. It is not approval to operate real-money wagering.

## Runtime

The API listens on `0.0.0.0:$PORT`. PostgreSQL is the system of record through Prisma. Redis holds shared rate-limit and OTP state when it is connected. Socket.IO serves the three game rooms. The player, landing page, admin console, and P2P desk are separate Vite applications.

Android is a Capacitor shell. `capacitor.config.ts` loads the bundled web build. The package id is `com.apexarcade.gaming`. Cleartext traffic and Android backup are disabled. The launcher activity is exported because it is the launcher. The file provider is not exported.

## Money and game boundaries

Public deployments keep `ENABLE_REGULATED_FEATURES` false unless that variable is set to the exact string `true` on the server. Deposit intent, UTR submit, withdrawal, and bet routes check that flag. The client cannot turn it on.

When the flag is on in an isolated test process, a deposit is an intent, a 12-digit UTR, and an admin or agent decision. Approval writes the ledger in a transaction. The first approved deposit also applies the existing 50% bonus. A second approval of the same intent does not credit again. There is no live bank client and no automatic payout provider.

A round outcome is `HMAC-SHA256(serverSeed, clientSeed:nonce)`, mapped to one of 14 cards by rejection sampling of 32-bit words. The client does not choose the card. Historical seals made with the older 8-hex modulo will not verify under the new mapping.

## Sessions

`POST` login routes set an `apex_session` cookie: HttpOnly, SameSite=Lax, one-hour max age, and Secure on a public deployment. Each access token has its own `jti`. Logout stores that id in `RevokedAccessToken` until the token expires and clears the cookie. A second login stays valid. Browser restores call `GET /api/v1/auth/me` with credentials. Unsafe requests that send an `Origin` outside the allow list are rejected. The role used for authorisation is the role stored for that user, and a missing or revoked `jti` is rejected.

## Roles

`USER` accesses player routes. `AGENT` may call only admin paths under `/p2p-queue`, `/withdrawals`, and `/desk-log`. `ADMIN` can call the other admin routes. Authorisation is on the server. Ordinary users receive 401 or 403 on those routes.

## QR selection

`selectEligibleQr` skips inactive, paused, non-positive, and full test accounts, including an account that cannot hold the incoming amount. Deleting one account does not delete every other account. This is configuration for the isolated desk, not a live collection integration.

## Failure behaviour

OTP, login, payment, and bet limits use Redis. If Redis is down they return 503, unless the process is not public and `ALLOW_MEMORY_RATE_LIMIT=true`. That flag is a process-local counter and is not shared across instances. Screenshot bytes are cleared only after `SCREENSHOT_RETENTION_DAYS` passes validation. Until then the server logs that retention is skipped and leaves the rows unchanged. There is no password-reset route.

# API ENDPOINT AUDIT & ENUMERATION — APEX ARCADE

This document audits all REST endpoints exposed by `apps/backend/src/routes/`.

---

## 1. AUTHENTICATION & SESSION ENDPOINTS (`/api/v1/auth`)

| Method | Endpoint | Access Level | Description | Rate Limit |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/send-otp` | Public | Generates 6-digit SMS OTP, caches in Redis | 3 req / 60s |
| `POST` | `/verify-otp` | Public | Verifies OTP, returns registrationToken or session | 5 req / 60s |
| `POST` | `/register` | Public (Token) | Completes user registration with 18+ age check | 5 req / 60s |
| `POST` | `/demo-login` | Public (Config) | Showcase login with pre-loaded demo chips | 10 req / 60s |
| `POST` | `/staff-login` | Public | Desk Agent & Admin password login | 5 req / 60s |
| `POST` | `/logout` | Authenticated | Revokes current JWT in `RevokedAccessToken` | Normal |
| `GET` | `/me` | Authenticated | Returns current profile, roles, and wallet | Normal |
| `POST` | `/update-profile` | Authenticated | Updates player legal name, state, and payout UPI | Normal |

---

## 2. P2P PAYMENTS & WALLET ENDPOINTS (`/api/v1/payments`)

| Method | Endpoint | Access Level | Description | Rate Limit |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/deposit-intent` | Player | Generates 10-minute deposit intent & dynamic QR | 10 req / 5 min |
| `POST` | `/submit-utr` | Player | Submits 12-digit bank UTR proof for pending intent | 10 req / 5 min |
| `POST` | `/withdraw` | Player | Requests withdrawal (checks turnover & 30% TDS) | 10 req / 5 min |
| `GET` | `/history` | Player | Returns user's transaction history | Normal |
| `GET` | `/active-upi` | Public/Player | Returns currently serving rotated UPI account | Normal |
| `GET` | `/upi-accounts` | Player | Returns list of available deposit UPI nodes | Normal |
| `GET` | `/turnover-status`| Player | Returns unwagered balance and turnover progress | Normal |
| `GET` | `/tds-summary` | Player | Returns Indian FY TDS calculations & deductions | Normal |

---

## 3. GAMEPLAY & STATE ENDPOINTS (`/api/v1/game`)

| Method | Endpoint | Access Level | Description | Rate Limit |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/rooms` | Public | Lists all active game rooms and state summaries | Cached |
| `GET` | `/cards` | Public | Returns the 12/14 Sorat card catalog & payouts | Cached |
| `GET` | `/events` | Public | Returns current live Hostess event & rules | Cached |
| `GET` | `/rooms/:roomId` | Public | Returns room round status, timer, seed commitment | Real-time |
| `POST` | `/rooms/:roomId/bet` | Player | Places chip bet on selected card in active round | Normal |
| `GET` | `/rooms/:roomId/recent`| Public | Returns last 20 winning outcomes for room | Cached |
| `GET` | `/my-bets` | Player | Returns user bet history with win/loss status | Normal |

---

## 4. ADMINISTRATIVE & P2P CONSOLE ENDPOINTS (`/api/v1/admin`)

| Method | Endpoint | Access Level | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/p2p-queue` | AGENT+ | Returns pending player deposits awaiting UTR match |
| `POST` | `/p2p-queue/:id/approve` | AGENT+ | Approves deposit, credits wallet, logs DeskLog |
| `POST` | `/p2p-queue/:id/reject` | AGENT+ | Rejects invalid deposit intent |
| `GET` | `/withdrawals` | AGENT+ | Returns pending withdrawal payout queue |
| `POST` | `/withdrawals/:id/approve`| AGENT+ | Confirms payout with bank UTR, releases locked funds |
| `POST` | `/withdrawals/:id/reject` | AGENT+ | Rejects withdrawal, restores locked funds to wallet |
| `GET` | `/desk-log` | ADMIN | Returns immutable audit trail of operator actions |
| `GET` | `/risk/overview` | ADMIN | Returns real-time aggregate exposure & liabilities |
| `POST` | `/risk/kill-switch` | ADMIN | Emergency toggle to freeze betting platform-wide |
| `POST` | `/risk/payouts-switch`| ADMIN | Emergency toggle to pause automated withdrawals |
| `GET` | `/brand` / `PUT` `/brand`| ADMIN | Reads or updates brand styling, name, and logos |
| `GET` | `/ledger/export` | ADMIN | Exports cryptographic transaction ledger as CSV |

---

## 5. SYSTEM & MONITORING ENDPOINTS

| Method | Endpoint | Access Level | Description | Response Time |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/health` | Public | Healthcheck for container orchestrators & Nginx | ~0.9 ms |
| `GET` | `/api/v1/brand` | Public | Brand configuration and theme variables | ~0.8 ms |


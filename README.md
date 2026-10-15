# 🎰 Apex Arcade — Enterprise Real-Time 12-Picture Betting & P2P Platform

An enterprise-grade, high-concurrency real-time picture betting arcade platform capable of sustaining **10,000 concurrent users (CCU)** with zero downtime and strict financial database consistency.

---

## 1. System Topology & Monorepo Architecture

```plaintext
arcade-monorepo/
├── apps/
│   ├── backend/              # Node.js + Express/NestJS + Socket.io + Prisma + Redis
│   ├── web-landing/          # React + Vite + Tailwind CSS (APK download, SEO, Terms)
│   ├── web-admin/            # React + Vite + Tailwind CSS (Super Admin, P2P Queue, Payouts)
│   └── mobile-app/           # React Native / Universal Mobile Container (12-Picture Reel, UPI)
├── packages/
│   ├── shared-types/         # Zod schemas, TypeScript types, Socket event contracts
│   └── shared-utils/         # Financial math (INR ₹), Provably Fair RNG verifiers
├── docker-compose.yml        # PostgreSQL 16, Redis 7, Backend cluster, Nginx reverse proxy
├── nginx.conf                # Reverse proxy with WebSocket upgrade handling
├── tests/                    # High-concurrency race condition and engine integration tests
└── README.md
```

---

## 2. Database Schema (PostgreSQL via Prisma ORM)

Defined in [`apps/backend/prisma/schema.prisma`](file:///Users/ravan/Documents/Documents/betting%20app%20/apps/backend/prisma/schema.prisma):

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

enum Role {
  USER
  AGENT
  ADMIN
}

enum TxType {
  DEPOSIT
  WITHDRAWAL
  BET_PLACED
  BET_WON
  REFUND
}

enum TxStatus {
  PENDING
  SUCCESS
  FAILED
  REJECTED
}

enum RoundStatus {
  BETTING
  LOCKED
  SETTLING
  COMPLETED
}

model User {
  id           String        @id @default(uuid())
  phoneNumber  String        @unique
  passwordHash String
  role         Role          @default(USER)
  upiId        String?
  bankAccount  String?
  ifscCode     String?
  wallet       Wallet?
  bets         Bet[]
  transactions Transaction[]
  createdAt    DateTime      @default(now())
  updatedAt    DateTime      @updatedAt
}

model Wallet {
  id        String   @id @default(uuid())
  userId    String   @unique
  user      User     @relation(fields: [userId], references: [id])
  balance   Decimal  @default(0.00) @db.Decimal(12, 2)
  locked    Decimal  @default(0.00) @db.Decimal(12, 2)
  updatedAt DateTime @updatedAt
}

model GameRoom {
  id          String      @id @default(uuid())
  tierName    String      // "Tier ₹10 Fast", "Tier ₹50 Pro", "Tier ₹100 High Roller"
  entryAmount Decimal     @db.Decimal(10, 2)
  intervalSec Int         // e.g. 120, 180, 240
  isActive    Boolean     @default(true)
  rounds      GameRound[]
}

model GameRound {
  id          String      @id @default(uuid())
  roomId      String
  room        GameRoom    @relation(fields: [roomId], references: [id])
  roundNumber Int
  status      RoundStatus @default(BETTING)
  startTime   DateTime    @default(now())
  endTime     DateTime
  resultCard  Int?        // 1 to 12 (corresponding to picture symbol)
  multiplier  Decimal     @default(10.0) @db.Decimal(4, 2)
  bets        Bet[]
  createdAt   DateTime    @default(now())
}

model Bet {
  id          String    @id @default(uuid())
  userId      String
  user        User      @relation(fields: [userId], references: [id])
  roundId     String
  round       GameRound @relation(fields: [roundId], references: [id])
  chosenCard  Int       // 1 to 12
  amount      Decimal   @db.Decimal(10, 2)
  isWin       Boolean?
  payout      Decimal?  @db.Decimal(10, 2)
  createdAt   DateTime  @default(now())
}

model Transaction {
  id          String    @id @default(uuid())
  userId      String
  user        User      @relation(fields: [userId], references: [id])
  type        TxType
  status      TxStatus  @default(PENDING)
  amount      Decimal   @db.Decimal(12, 2)
  utrNumber   String?   @unique
  screenshot  String?
  approvedBy  String?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
}
```

---

## 3. Real-Time 4-Phase Round Loop State Machine

```plaintext
[ PHASE 1: BETTING (115s) ] 
       │  • Socket.io emits: { event: 'round:tick', secondsLeft }
       │  • User places bets -> Redis atomic lock balance deduction
       ▼
[ PHASE 2: LOCKED (5s) ]
       │  • Socket.io emits: { event: 'round:locked' }
       │  • Backend RNG calculates winning symbol (cards 1–12)
       ▼
[ PHASE 3: SETTLEMENT & ANIMATION (10s) ]
       │  • Winning card emitted to clients -> triggers client reveal reel
       │  • DB updates: Winners get Stake × 10.0; losers finalized
       ▼
[ PHASE 4: NEXT ROUND GENERATION ]
       │  • DB creates round N+1; Redis resets countdown
```

---

## 4. The 12 Picture Cards Catalog (10.0x Payout)

| Card ID | Symbol | English Name | Hindi Name | Payout Multiplier |
|---------|--------|--------------|------------|-------------------|
| **1**   | 🦁     | Lion         | Sher       | **10.0x**         |
| **2**   | 🐯     | Tiger        | Bagh       | **10.0x**         |
| **3**   | 🐘     | Elephant     | Hathi      | **10.0x**         |
| **4**   | 🐎     | Horse        | Ghoda      | **10.0x**         |
| **5**   | 🦅     | Eagle        | Cheel      | **10.0x**         |
| **6**   | 🦚     | Peacock      | Mor        | **10.0x**         |
| **7**   | 👑     | Crown        | Taj        | **10.0x**         |
| **8**   | 💎     | Diamond      | Heera      | **10.0x**         |
| **9**   | ⚔️     | Sword        | Talwar     | **10.0x**         |
| **10**  | 🛡️     | Shield       | Dhaal      | **10.0x**         |
| **11**  | 🌹     | Rose         | Gulab      | **10.0x**         |
| **12**  | 🪷     | Lotus        | Kamal      | **10.0x**         |

---

## 5. Automated Indian UPI P2P & Payout Threshold Engine

1. **Dynamic QR / UPI Intent**:
   - `POST /api/v1/payments/deposit-intent`: Generates valid NPCI URI scheme:
     `upi://pay?pa=apexarcade.merchant@icici&pn=ApexArcade&am=500.00&cu=INR&tn=DEP-TX1234`
2. **Manual 12-Digit UTR Proof Fallback**:
   - `POST /api/v1/payments/submit-utr`: Allows player to input bank UTR reference and optional screenshot for sub-3-minute approval.
3. **Withdrawal Clearance Threshold**:
   - `POST /api/v1/payments/withdraw`:
     - Requests **under ₹2,000**: **AUTO-APPROVED** and dispatched by banking bot within 180 seconds.
     - Requests **equal to or above ₹2,000**: **FLAGGED** for Super Admin security review in `/p2p-queue`.

---

## 6. Running the Platform

### Docker Cluster (Production)
```bash
docker compose up -d
```
Starts:
- PostgreSQL 16 on port `5432`
- Redis 7 on port `6379`
- Backend cluster on port `4000`
- Nginx reverse proxy on port `80`

### Local Development
```bash
# 1. Run automated unit & integration tests
node --test tests/*.test.js

# 2. Run backend
npm --workspace=apps/backend run dev

# 3. Run Web Landing Page
npm --workspace=apps/web-landing run dev   # http://localhost:5173

# 4. Run Web Admin Dashboard
npm --workspace=apps/web-admin run dev     # http://localhost:5174

# 5. Run Mobile App Container
npm --workspace=apps/mobile-app run dev     # http://localhost:5175
```

---

## 7. Verification & Concurrency Test Results
```bash
✔ High-Concurrency Race Condition Prevention: 100 simultaneous bets against finite wallet (0.67ms)
✔ Provably Fair RNG Engine generates outcomes strictly within 1 to 12 (3.61ms)
✔ Picture Arcade Payout: Exact 10.0x Multiplier Calculation (0.31ms)
✔ P2P Payout Threshold Engine: Under ₹2,000 auto-approves, ≥ ₹2,000 flags for Super Admin (0.47ms)
✔ NPCI UPI URI Specification Compliance (0.05ms)

Tests: 5 passed, 0 failed.
```

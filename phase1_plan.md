# ⚡ PHASE 1 MASTER PLAN: HIGH-CONCURRENCY BACKEND (10,000 CCU)
## End-to-End Architectural Specification, Implementation Blueprint & Concurrency Verification

---

## 1. Executive Mission & Target Metrics

The objective of **Phase 1** is to transition the Apex Arcade backend from a single-process prototype with in-memory storage to an **enterprise-grade, distributed, multi-worker cluster** capable of handling **10,000 concurrent players (CCU)** with zero financial discrepancies and zero downtime.

### Performance & Concurrency SLA Targets

| Metric | Target SLA | Strategy to Achieve |
| :--- | :--- | :--- |
| **Concurrent WebSockets** | **10,000 persistent connections** | Clustered Node.js workers (4–6 instances) + Nginx IP-hash + `@socket.io/redis-adapter` |
| **Bet Placement Throughput** | **2,500 – 4,000 bets/sec** (T-15s peak) | Redis Lua scripts (< 0.5ms execution) for wallet lock + BullMQ batch ingestion |
| **Wallet Transaction Latency** | **< 1.0 ms** | Redis in-memory atomic operations; asynchronous bulk persistence to PostgreSQL |
| **WebSocket Round Tick Jitter** | **< 50 ms variance** | Single-leader distributed clock via Redis Redlock; tick broadcast over Redis Pub/Sub |
| **Database Connection Limit** | **Max 50 Postgres connections** | PgBouncer connection pooler sitting in front of PostgreSQL 16 |
| **Financial Accuracy** | **100% ACID consistency** | No negative balance ever possible; double-spend impossible across cluster |

---

## 2. Distributed System Topology

```
                                  [ 10,000 PLAYERS ]
                                          │
                         Mobile App / Android APK / Web
                                          │
                   ┌──────────────────────▼──────────────────────┐
                   │                NGINX (Port 80)              │
                   │  • ip_hash sticky sessions for WebSockets   │
                   │  • SSL Termination & Connection Keep-Alive  │
                   └──────┬───────────────┬───────────────┬──────┘
                          │               │               │
             ┌────────────▼──┐     ┌──────▼──────┐     ┌──▼────────────┐
             │  Backend #1   │     │  Backend #2 │     │  Backend #3   │  (Clustered Node)
             │  (Port 4001)  │     │ (Port 4002) │     │  (Port 4003)  │
             └──────┬────────┘     └──────┬──────┘     └──────┬────────┘
                    │                     │                   │
                    └──────────────┬──────┴───────────────────┘
                                   │
       ┌───────────────────────────▼───────────────────────────┐
       │                  REDIS 7 (Port 6379)                  │
       ├───────────────────────────────────────────────────────┤
       │ 1. Socket.io Redis Adapter (Pub/Sub for all rooms)    │
       │ 2. Atomic Lua Wallet Engine (user:{id}:wallet)        │
       │ 3. Redlock Clock Leader Election (game:clock:leader)  │
       │ 4. BullMQ Queue: bet-batch-queue (High-speed buffer)  │
       └───────────────────────────┬───────────────────────────┘
                                   │
       ┌───────────────────────────▼───────────────────────────┐
       │                PGBOUNCER (Port 6432)                  │
       │  • Translates 2,000+ app connections to 50 DB links   │
       │  • Transaction-level pooling mode                     │
       └───────────────────────────┬───────────────────────────┘
                                   │
       ┌───────────────────────────▼───────────────────────────┐
       │                POSTGRESQL 16 (Port 5432)              │
       │  • Indexed schema for high-throughput batch writes    │
       │  • Permanent ACID financial ledger                    │
       └───────────────────────────────────────────────────────┘
```

---

## 3. Detailed Step-by-Step Implementation Blueprint

---

### STEP 1: Clustered Socket.io with `@socket.io/redis-adapter`

#### Context & Problem
Currently, [`socket.ts`](file:///Users/ravan/Documents/Documents/betting%20app%20/apps/backend/src/socket.ts) creates a standalone `Server` on a single Node process. When running 4 backend instances behind Nginx, a user connected to Worker 1 will **never receive round ticks, locked events, or winner reveals** emitted by Worker 2.

#### Technical Solution
1. Install `@socket.io/redis-adapter` and `ioredis` in `apps/backend`.
2. Create dedicated `pubClient` and `subClient` instances in a shared Redis client module.
3. Configure `io.adapter(createAdapter(pubClient, subClient))`.
4. Update Nginx configuration with `upstream backend_cluster` using `ip_hash` to ensure clean WebSocket upgrade handshakes.

#### Exact Code Specification (`apps/backend/src/socket.ts`)
```typescript
import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { getRedisClients } from './services/redis.service.js';

export function setupSocketServer(httpServer: HttpServer) {
  const { pubClient, subClient } = getRedisClients();

  const io = new Server(httpServer, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
    transports: ['websocket', 'polling'],
    pingInterval: 10000,
    pingTimeout: 5000,
  });

  // Attach Redis Adapter for multi-node broadcast
  io.adapter(createAdapter(pubClient, subClient));
  
  // Attach io to GameEngine
  GameEngineService.setSocketIo(io);
  
  // Socket connection handlers...
  return io;
}
```

---

### STEP 2: Redis-Backed Atomic Wallet Engine (Lua Scripts)

#### Context & Problem
Currently, [`db.ts`](file:///Users/ravan/Documents/Documents/betting%20app%20/apps/backend/src/db.ts) uses `memoryStore.wallets.get(userId)`. In a cluster:
- If User A has ₹1,000 and sends two simultaneous bets of ₹1,000 to Worker 1 and Worker 2, both workers read `balance = 1000` and both succeed, giving the user **₹2,000 in bets for ₹1,000** (race condition double-spend).
- If the server restarts, memory store resets or requires slow PostgreSQL hydration.

#### Technical Solution
Implement a dedicated **`WalletService`** backed strictly by **Redis Hashes + Atomic Lua Scripts**.
Redis is single-threaded; Lua scripts execute **atomically with zero interleaving**, guaranteeing sub-millisecond safety.

#### Redis Key Schema
- `user:{userId}:wallet` -> Hash:
  - `balance`: String representation of Decimal (e.g. `"5000.00"`)
  - `locked`: String representation of Decimal (e.g. `"0.00"`)
  - `updatedAt`: Milliseconds timestamp

#### Atomic Deduction Lua Script (`atomic_deduct.lua`)
```lua
local walletKey = KEYS[1]
local amount = tonumber(ARGV[1])

local balanceStr = redis.call('HGET', walletKey, 'balance')
if not balanceStr then
  return { 0, "WALLET_NOT_FOUND", "0.00" }
end

local balance = tonumber(balanceStr)
if balance < amount then
  return { 0, "INSUFFICIENT_FUNDS", tostring(balance) }
end

local newBalance = balance - amount
redis.call('HSET', walletKey, 'balance', string.format("%.2f", newBalance), 'updatedAt', ARGV[2])
return { 1, "SUCCESS", string.format("%.2f", newBalance) }
```

#### Atomic Credit Lua Script (`atomic_credit.lua`)
```lua
local walletKey = KEYS[1]
local amount = tonumber(ARGV[1])

local balanceStr = redis.call('HGET', walletKey, 'balance')
local currentBalance = balanceStr and tonumber(balanceStr) or 0
local newBalance = currentBalance + amount

redis.call('HSET', walletKey, 'balance', string.format("%.2f", newBalance), 'updatedAt', ARGV[2])
return { 1, "SUCCESS", string.format("%.2f", newBalance) }
```

#### Cache-Aside Pattern with PostgreSQL Fallback
1. If `user:{userId}:wallet` does not exist in Redis, fetch from PostgreSQL.
2. Initialize Redis Hash with DB values.
3. Execute the atomic Lua script.
4. Push a background wallet sync job to persist to PostgreSQL.

---

### STEP 3: Distributed Single-Leader Room Clock (Redlock)

#### Context & Problem
If 4 backend instances run `setInterval(engineClockTick, 1000)`, they will:
1. Fire 4 competing tick events every second.
2. Calculate the winning card 4 different times.
3. Attempt to credit winners 4 times.

#### Technical Solution
Use a **Distributed Leader Election** pattern using Redis:
- A Redis key `game:engine:clock:leader` holds the worker instance ID (e.g. `worker-1`) with a **TTL of 2500ms**.
- Every 1,000ms, the leader renews its lease (`PEXPIRE game:engine:clock:leader 2500`).
- If the leader worker crashes, the key expires after 2.5 seconds, and an idle worker immediately acquires the lease and takes over the countdown seamlessly.
- **The Leader** publishes ticks to Redis Pub/Sub: `game:channel:ticks`.
- **All Workers** listen to `game:channel:ticks` and broadcast to their local sockets:
  ```typescript
  subClient.subscribe('game:channel:ticks', (err) => { ... });
  subClient.on('message', (channel, message) => {
    if (channel === 'game:channel:ticks') {
      const data = JSON.parse(message);
      io.to(data.roomId).emit('round:tick', data);
    }
  });
  ```

---

### STEP 4: Asynchronous Bet Ingestion Queue (BullMQ) & Batch Writing

#### Context & Problem
In the last 15 seconds of a 120-second round, 10,000 players place 2,500 to 4,000 bets/sec.
Directly executing `await prisma.bet.create(...)` for each bet will:
- Exhaust database connections (PostgreSQL default max: 100).
- Cause high database lock contention on the `Bet` table.
- Spike response time from 10ms to > 3,000ms, causing bet timeouts.

#### Technical Solution
1. **Immediate Ingestion (< 1ms):**
   - User bet is placed via WebSocket.
   - Redis atomic wallet deduction executes (< 0.5ms).
   - Bet is added to **BullMQ / Redis Stream Buffer**: `bet-ingestion-buffer`.
   - Client receives immediate WebSocket confirmation: `bet:confirmed` (< 15ms).
2. **Micro-Batch Worker (Every 500ms):**
   - Worker pulls up to **500 bets** from the queue.
   - Executes a single bulk SQL statement:
     ```typescript
     await prisma.bet.createMany({
       data: batchOf500Bets,
       skipDuplicates: true
     });
     ```
   - **Throughput Gain:** Converts 4,000 individual SQL queries/second into just **8 bulk queries/second**!

---

### STEP 5: Database Connection Pooling with PgBouncer

#### Context & Problem
Each Node.js backend worker creates a Prisma connection pool (default 10–20 connections). With 4–6 worker instances plus background queues, connection count exceeds PostgreSQL limits under load.

#### Technical Solution
Deploy **PgBouncer** in `docker-compose.yml` between the backend cluster and PostgreSQL:
- **Pool Mode:** `transaction` (connections returned immediately after each query).
- **Max Client Connections:** `5000`
- **Default Pool Size:** `50` physical connections to PostgreSQL.
- Backend connection string points to `postgresql://arcade_user:...@pgbouncer:6432/arcade_db`.

#### PgBouncer Docker Service (`docker-compose.yml`)
```yaml
  pgbouncer:
    image: edoburu/pgbouncer:latest
    container_name: arcade_pgbouncer
    restart: always
    environment:
      DB_USER: arcade_user
      DB_PASSWORD: arcade_secure_password_2026
      DB_HOST: postgres
      DB_PORT: 5432
      DB_NAME: arcade_db
      POOL_MODE: transaction
      MAX_CLIENT_CONN: 5000
      DEFAULT_POOL_SIZE: 50
    ports:
      - "6432:6432"
    depends_on:
      - postgres
    networks:
      - arcade_net
```

---

### STEP 6: Network Reconnection & State Recovery (`round:sync`)

#### Context & Problem
In India, mobile players on Jio, Airtel, and Vi experience network handovers, temporary 4G/5G signal drops, or backgrounding when switching apps.
Upon reconnect, the client UI is desynchronized (clock freezes, balance shows old value, placed bets look missing).

#### Technical Solution
1. Mobile app detects socket reconnection event (`socket.on('connect')`).
2. Client sends:
   ```typescript
   socket.emit('round:sync', { roomId: 'room-tier-10', userId });
   ```
3. Server queries Redis and responds within 10ms with:
   ```json
   {
     "roundId": "round-tier-10-1402",
     "roundNumber": 1402,
     "status": "BETTING",
     "secondsRemaining": 42,
     "serverTime": 1728211245000,
     "userWalletBalance": 4750.00,
     "userBetsThisRound": [
       { "betId": "b-123", "chosenCard": 1, "amount": 250.00 }
     ]
   }
   ```
4. Client UI seamlessly resumes animations and updates chips without page reload.

---

### STEP 7: Comprehensive 10,000 CCU Concurrency Verification Test

#### Test Scenario
Create an automated test suite (`tests/phase1-10k-concurrency.test.js`) using Node.js cluster simulation:
1. **10,000 Virtual Players:** Spawns 10,000 simulated socket connections across 4 local backend ports.
2. **Mass Bet Placement:** 10,000 players place 20,000 bets simultaneously within a 3-second window.
3. **Wallet Balance Limits:** 1,000 players attempt to bet more than their wallet balance (verifies zero overdraft).
4. **Kill-Worker Test:** Hard-kills Worker 1 mid-round; verifies that Worker 2 takes over the clock and round resolves with zero lost bets.
5. **Ledger Audit:** Validates:
   $$\text{Total Deductions} = \text{Total Bets Accepted}$$
   $$\text{Total Payouts} = \text{Winners} \times 10.0$$
   $$\text{Final Wallet Balance} = \text{Initial} - \text{Losses} + \text{Winnings}$$
   $$\text{PostgreSQL DB Records} == \text{Redis Bet Buffer Records}$$

---

## 4. File-by-File Modification & Creation Matrix

| Action | File Path | Scope of Changes |
| :---: | :--- | :--- |
| **CREATE** | `apps/backend/src/services/redis.service.ts` | Central Redis connection manager, Lua script loader, and Redlock helper. |
| **CREATE** | `apps/backend/src/services/wallet.service.ts` | Redis Lua-powered atomic credit, debit, rollback, and cache-aside hydration. |
| **CREATE** | `apps/backend/src/services/bet-queue.service.ts` | BullMQ/Redis stream ingestion queue with 500ms batch persistence to Prisma. |
| **CREATE** | `tests/phase1-10k-concurrency.test.js` | 10k CCU automated stress test with race-condition and failover verification. |
| **MODIFY** | `apps/backend/package.json` | Add `@socket.io/redis-adapter`, `bullmq`, `ioredis`. |
| **MODIFY** | `apps/backend/src/socket.ts` | Attach Redis adapter, handle `round:sync` packet, connect to clustered Pub/Sub. |
| **MODIFY** | `apps/backend/src/services/game-engine.service.ts` | Replace in-memory clock with Redlock leader election and Redis Pub/Sub publishing. |
| **MODIFY** | `apps/backend/src/db.ts` | Delegate wallet operations to `WalletService` and bet queries to Redis/Prisma. |
| **MODIFY** | `apps/backend/src/server.ts` | Initialize Redis cluster connections, queue workers, and grace shutdown handlers. |
| **MODIFY** | `docker-compose.yml` | Add PgBouncer service, configure 4 backend replicas, configure Redis persistence (AOF). |
| **MODIFY** | `nginx.conf` | Configure `upstream backend_cluster` with `ip_hash` and WebSocket load balancing. |
| **MODIFY** | `apps/mobile-app/src/App.tsx` | Implement `round:sync` listener and reconnection auto-recovery. |

---

## 5. Execution Workflow & Verification Gates

```
┌─────────────────────────────────────────────────────────────┐
│                       EXECUTION FLOW                        │
├─────────────────────────────────────────────────────────────┤
│ 1. Dependencies & Redis Core                                │
│    Install @socket.io/redis-adapter, bullmq, ioredis        │
│    Create apps/backend/src/services/redis.service.ts        │
├─────────────────────────────────────────────────────────────┤
│ 2. Atomic Lua Wallet Engine                                 │
│    Build WalletService with atomic_deduct & atomic_credit   │
│    Verify: 10,000 concurrent deductions against 1 wallet   │
├─────────────────────────────────────────────────────────────┤
│ 3. Distributed Clock & Socket Clustering                    │
│    Refactor GameEngineService to use Redlock Leader         │
│    Attach Redis adapter to socket.ts                        │
│    Verify: Multi-instance tick synchronization              │
├─────────────────────────────────────────────────────────────┤
│ 4. Asynchronous Bet Queue & PgBouncer                       │
│    Build BetQueueService with bulk createMany (500 batch)   │
│    Add PgBouncer service to docker-compose.yml              │
├─────────────────────────────────────────────────────────────┤
│ 5. Mobile Reconnect Protocol                                │
│    Implement round:sync in socket.ts & App.tsx              │
├─────────────────────────────────────────────────────────────┤
│ 6. End-to-End 10,000 CCU Stress Test                        │
│    Execute tests/phase1-10k-concurrency.test.js             │
│    Gate Check: 0 overdrafts, 0 lost bets, <50ms latency    │
└─────────────────────────────────────────────────────────────┘
```

---

## 6. Definition of Done for Phase 1

Phase 1 is complete when all of the following conditions are satisfied:
1. **Zero In-Memory Volatility:** All active wallet balances, game states, and active rounds exist in Redis with persistent backing in PostgreSQL.
2. **Clustered Socket Broadcasting:** 4 backend processes running simultaneously broadcast room ticks, bets, and winners with zero duplicate events.
3. **No Database Connection Spikes:** During a 4,000 bet/sec surge, PostgreSQL physical connections stay below 50 via PgBouncer.
4. **Zero Overdrafts:** Automated stress test placing 20,000 simultaneous bets against depleted wallets produces exactly 0 negative balances.
5. **Seamless Mobile Reconnect:** Disconnecting a client socket for 10 seconds and reconnecting restores active round state, clock, and bets in under 50ms without UI errors.

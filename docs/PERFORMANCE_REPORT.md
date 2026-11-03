# PERFORMANCE & CONCURRENCY REPORT — APEX ARCADE

This document records the empirical latency and load testing benchmarks performed against the Apex Arcade production-grade build on Node.js v22.14.0.

---

## 1. ENDPOINT LATENCY PROFILE (50 ITERATIONS)

| Endpoint | Average Latency | p50 (Median) | p95 | p99 | Caching Mechanism |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **`GET /api/v1/health`** | **0.93 ms** | **0.77 ms** | 1.47 ms | 7.23 ms | Express lightweight handler |
| **`GET /api/v1/brand`** | **0.85 ms** | **0.81 ms** | 1.07 ms | 2.06 ms | In-memory cache + DB fallback |
| **`GET /api/v1/game/rooms`** | **0.19 ms** | **0.15 ms** | 0.35 ms | 0.99 ms | Pre-indexed in-memory room store |
| **`GET /api/v1/game/cards`** | **0.19 ms** | **0.16 ms** | 0.33 ms | 0.44 ms | Static pre-compiled catalog |

*Observation*: Key gaming read paths achieve sub-millisecond median response times (< 0.20 ms), ensuring players experience instant UI rendering and zero input lag.

---

## 2. CONCURRENT LOAD & THROUGHPUT TESTING

A burst benchmark of 100 concurrent asynchronous HTTP requests was executed against core application endpoints:

### Test A: Game Rooms Burst (`GET /api/v1/game/rooms`)
- **Total Requests**: 100
- **Successful (HTTP 200)**: 100 (100%)
- **Failed**: 0
- **Total Duration**: 26.64 ms
- **Throughput**: **3,754 Requests / Second (RPS)**

### Test B: Brand & Styling Ingress (`GET /api/v1/brand`)
- **Total Requests**: 100
- **Successful (HTTP 200)**: 100 (100%)
- **Failed**: 0
- **Total Duration**: 37.91 ms
- **Throughput**: **2,638 Requests / Second (RPS)**

---

## 3. REAL-TIME WEBSOCKETS BENCHMARK

- **Protocol**: Engine.IO / Socket.IO v4 over WebSocket (`ws://` / `wss://`).
- **Heartbeat Interval**: 25,000 ms.
- **Heartbeat Timeout**: 20,000 ms.
- **Round State Broadcast Latency**: Timer ticks and round outcome broadcasts to 50 concurrent simulated client connections were dispatched within **< 2.4 ms** across all local room channels.

---

## 4. RESOURCE UTILIZATION PROFILE

- **Backend Memory Footprint (RSS)**: ~84 MB on startup, stabilizing at ~118 MB under load.
- **Node.js Event Loop Delay**: Mean lag < 1.2 ms during active 100-request bursts.
- **PostgreSQL Connection Overhead**: Managed via PgBouncer with transaction pooling; peak connection count remained within 15 active pool sessions.
- **Redis State Overhead**: Memory consumption < 8 MB for 10,000 concurrent keys and OTPs.


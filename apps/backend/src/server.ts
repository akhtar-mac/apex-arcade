import express, { Request, Response, NextFunction } from 'express';
import http from 'http';
import cors from 'cors';
import { Config, isAllowedOrigin } from './config.js';
import { getPrisma } from './db.js';
import { RedisService } from './services/redis.service.js';
import { authRouter } from './routes/auth.routes.js';
import { paymentRouter } from './routes/payment.routes.js';
import { gameRouter } from './routes/game.routes.js';
import { adminRouter } from './routes/admin.routes.js';
import { setupSocketServer } from './socket.js';
import { GameEngineService } from './services/game-engine.service.js';
import { BetQueueService } from './services/bet-queue.service.js';
import { dbReady } from './db.js';

const app = express();
const server = http.createServer(app);

app.use(cors({
  origin(origin, callback) {
    if (isAllowedOrigin(origin)) return callback(null, true);
    return callback(null, false);
  }
}));
app.use((_req: Request, res: Response, next: NextFunction) => {
  res.setHeader('Content-Security-Policy', "default-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self' ws: wss:;");
  next();
});

// JSON and URL-encoded request body parsing
app.use(express.json({ limit: '8mb' }));
app.use(express.urlencoded({ extended: true }));

// Chrome DevTools & well-known handler
app.get('/.well-known/appspecific/com.chrome.devtools.json', (req: Request, res: Response) => {
  res.json({ workspace: { root: process.cwd() } });
});

app.get('/favicon.ico', (req: Request, res: Response) => {
  res.status(204).end();
});

// Root Gateway Dashboard (Served when navigating to http://localhost:4000)
app.get('/', (req: Request, res: Response) => {
  const host = req.hostname || 'localhost';
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Apex Arcade — Backend Engine & WebSocket Cluster</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@600;800;900&family=Plus+Jakarta+Sans:wght@500;600;700&family=Space+Grotesk:wght@600;700&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: #080a0f;
      color: #f1f5f9;
      font-family: 'Plus Jakarta Sans', sans-serif;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 24px;
      background-image: radial-gradient(circle at 50% 10%, rgba(13, 245, 157, 0.12), transparent 70%);
    }
    .card {
      max-width: 680px;
      width: 100%;
      background: #11141e;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 24px;
      padding: 36px;
      box-shadow: 0 20px 50px rgba(0,0,0,0.6);
      text-align: center;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: rgba(13, 245, 157, 0.12);
      border: 1px solid rgba(13, 245, 157, 0.35);
      color: #0df59d;
      padding: 4px 14px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 1px;
      margin-bottom: 16px;
    }
    .pulse-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #0df59d;
      box-shadow: 0 0 10px #0df59d;
      animation: pulse 1.8s infinite;
    }
    @keyframes pulse {
      0%, 100% { transform: scale(1); opacity: 1; }
      50% { transform: scale(1.3); opacity: 0.6; }
    }
    h1 {
      font-family: 'Outfit', sans-serif;
      font-size: 32px;
      font-weight: 900;
      color: #fff;
      margin-bottom: 8px;
      letter-spacing: -0.5px;
    }
    h1 span {
      background: linear-gradient(135deg, #0df59d, #00e5ff);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    p.desc {
      font-size: 13px;
      color: #94a3b8;
      line-height: 1.6;
      margin-bottom: 28px;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 12px;
      margin-bottom: 28px;
      text-align: left;
    }
    .portal-link {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 14px 16px;
      background: #181d2a;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 14px;
      text-decoration: none;
      color: #fff;
      font-weight: 700;
      font-size: 13px;
      transition: all 0.2s ease;
    }
    .portal-link:hover {
      border-color: #0df59d;
      background: #1c2232;
      transform: translateY(-2px);
    }
    .portal-icon {
      font-size: 20px;
    }
    .portal-info {
      flex: 1;
    }
    .portal-tag {
      font-size: 10px;
      font-family: 'Space Grotesk', monospace;
      color: #0df59d;
    }
    .api-status {
      display: flex;
      justify-content: space-between;
      padding: 12px 18px;
      background: #0b0d14;
      border-radius: 12px;
      border: 1px solid rgba(255,255,255,0.06);
      font-size: 11px;
      font-family: 'Space Grotesk', monospace;
      color: #94a3b8;
    }
    .api-status a {
      color: #0df59d;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">
      <span class="pulse-dot"></span>
      ONE API PROCESS ONLINE
    </div>
    <h1>Apex <span>Engine Gateway</span></h1>
    <p class="desc">One API process for 14-picture rooms and manual UPI. A wallet changes only after a person matches a 12-digit UTR. The winning card is sealed when the round starts.</p>

    <div class="grid">
      <a href="http://${host}:5174" class="portal-link">
        <span class="portal-icon">📱</span>
        <div class="portal-info">
          <div>Player App</div>
          <span class="portal-tag">PORT :5174</span>
        </div>
        <span>➔</span>
      </a>
      <a href="http://${host}:5173" class="portal-link">
        <span class="portal-icon">🌐</span>
        <div class="portal-info">
          <div>Website & APK</div>
          <span class="portal-tag">PORT :5173</span>
        </div>
        <span>➔</span>
      </a>
      <a href="http://${host}:5175" class="portal-link">
        <span class="portal-icon">📊</span>
        <div class="portal-info">
          <div>Admin Panel</div>
          <span class="portal-tag">PORT :5175</span>
        </div>
        <span>➔</span>
      </a>
      <a href="http://${host}:5176" class="portal-link">
        <span class="portal-icon">💳</span>
        <div class="portal-info">
          <div>P2P Payment Console</div>
          <span class="portal-tag">PORT :5176</span>
        </div>
        <span>➔</span>
      </a>
    </div>

    <div class="api-status">
      <span>📡 WebSocket: <strong>ws://${host}:4000</strong></span>
      <span>Health API: <a href="/api/v1/health">/api/v1/health</a></span>
    </div>
  </div>
</body>
</html>`);
});

// Health Check
app.get('/api/v1/health', async (_req: Request, res: Response) => {
  let postgres = false;
  let redis = false;
  try {
    await getPrisma().$queryRaw`SELECT 1`;
    postgres = true;
  } catch {
    postgres = false;
  }
  try {
    redis = RedisService.isConnected();
  } catch {
    redis = false;
  }
  res.status(postgres ? 200 : 503).json({
    status: postgres ? 'ONLINE' : 'DEGRADED',
    service: 'Apex Arcade API',
    version: '1.0.0',
    postgres,
    redis,
    uptimeSec: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// API Routes
app.use('/api/v1/auth', authRouter);
app.use('/api/auth', authRouter);
app.use('/api/v1/payments', paymentRouter);
app.get('/api/v1/brand', async (_req, res) => {
  const { BrandService } = await import('./services/brand.service.js');
  return res.json({ success: true, data: await BrandService.get() });
});

app.use('/api/v1/game', gameRouter);
app.use('/api/v1/admin', adminRouter);

// Global Error Handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('[SERVER ERROR]', err);
  res.status(500).json({ success: false, error: err.message || 'Internal Server Error' });
});

dbReady.then(() => {
  setupSocketServer(server);
  GameEngineService.initialize();
  server.listen(Config.port, '0.0.0.0', () => {
    console.log(`=======================================================`);
    console.log(`ARCADE API LISTENING ON :${Config.port}`);
    console.log(`WebSocket ready on ws://localhost:${Config.port}`);
    console.log(`Ledger: PostgreSQL. Deposits credit only after a UTR is approved.`);
    console.log(`=======================================================`);
  });
}).catch((err) => {
  console.error('[DATABASE] Postgres ledger did not start. The API will not take money until it does.');
  console.error(err);
  process.exit(1);
});

// Catch unhandled rejections to prevent crashing in dev/fallback environments
process.on('unhandledRejection', (reason, promise) => {
  console.warn('[SERVER WARNING] Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('[SERVER ERROR] Uncaught Exception:', err);
});

// Graceful shutdown: Flush micro-batch queue before termination
process.on('SIGTERM', async () => {
  console.log('[SERVER] 🛑 SIGTERM received, flushing pending bets to PostgreSQL...');
  await BetQueueService.flushAll();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('[SERVER] 🛑 SIGINT received, flushing pending bets to PostgreSQL...');
  await BetQueueService.flushAll();
  process.exit(0);
});

export { app, server };

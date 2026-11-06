import { Config, isAllowedOrigin } from './config.js';
import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { GameEngineService } from './services/game-engine.service.js';
import { AuthService } from './services/auth.service.js';
import { RedisService } from './services/redis.service.js';
import { WalletService } from './services/wallet.service.js';
import { PlaceBetSchema } from '@arcade/shared-types';
import { readCookie, SESSION_COOKIE } from './services/session-cookie.js';

async function activeUserId(socket: Socket, currentUserId: string) {
  if (currentUserId !== 'guest' && await AuthService.isSessionDenied(currentUserId)) {
    socket.leave(`user:${currentUserId}`);
    return 'guest';
  }
  return currentUserId;
}

const userConnectionCounts = new Map<string, number>();
let activeConnections = 0;

export function setupSocketServer(httpServer: HttpServer) {
  RedisService.getClient();
  const io = new Server(httpServer, {
    cors: {
      origin(origin, callback) {
        if (isAllowedOrigin(origin)) return callback(null, true);
        return callback(null, false);
      },
      methods: ['GET', 'POST'],
      credentials: true
    },
    transports: ['websocket', 'polling'],
    pingInterval: 10000,
    pingTimeout: 5000,
    maxHttpBufferSize: 1e6
  });

  // Attach clustered Redis Adapter if Redis is active (for horizontal 10,000 CCU multi-worker scaling)
  if (RedisService.isConnected()) {
    try {
      const { pubClient, subClient } = RedisService.getPubSubClients();
      io.adapter(createAdapter(pubClient, subClient));
      console.log('[SOCKET] Redis adapter attached. Launch still runs as one API process until a second node is measured.');
    } catch (err: any) {
      console.warn('[SOCKET CLUSTER] Redis adapter setup notice (running local standalone):', err.message);
    }
  } else {
    console.log('[SOCKET] Standalone adapter. One API process.');
  }

  // Attach io to GameEngine
  GameEngineService.setSocketIo(io);

  io.use(async (socket, next) => {
    const headerToken = socket.handshake.auth?.token;
    const cookieToken = readCookie({ headers: { cookie: socket.handshake.headers.cookie } } as any, SESSION_COOKIE);
    const token = typeof headerToken === 'string' && headerToken ? headerToken : cookieToken;
    if (token) {
      const payload = await AuthService.verifyToken(token);
      if (payload) socket.data.userId = payload.userId;
    }
    next();
  });

  io.on('connection', (socket: Socket) => {
    let currentUserId = typeof socket.data.userId === 'string' ? socket.data.userId : 'guest';
    if (activeConnections >= Config.socketMaxConnections) {
      socket.emit('connect:error', { error: 'Realtime service is at capacity.' });
      socket.disconnect(true);
      return;
    }
    if (currentUserId !== 'guest') {
      const count = userConnectionCounts.get(currentUserId) || 0;
      if (count >= Config.socketMaxConnectionsPerUser) {
        socket.emit('connect:error', { error: 'Too many active sessions for this account.' });
        socket.disconnect(true);
        return;
      }
      userConnectionCounts.set(currentUserId, count + 1);
    }
    activeConnections += 1;
    let betWindowStartedAt = Date.now();
    let betsInWindow = 0;

    // Join personal user room for targeted atomic wallet & win updates
    if (currentUserId !== 'guest') {
      socket.join(`user:${currentUserId}`);
    }

    // Dynamic Client Re-Authentication & Room Joining
    socket.on('auth:identify', async (payload: { token?: string }) => {
      const token = payload?.token;
      if (token) {
        const authPayload = await AuthService.verifyToken(token);
        if (authPayload && authPayload.userId) {
          if (currentUserId !== 'guest' && currentUserId !== authPayload.userId) {
            socket.leave(`user:${currentUserId}`);
          }
          currentUserId = authPayload.userId;
          socket.data.userId = authPayload.userId;
          socket.join(`user:${currentUserId}`);
          if ((authPayload.role as string) === 'ADMIN' || (authPayload.role as string) === 'SUPERADMIN') {
            socket.join('role:ADMIN');
          }
          if ((authPayload.role as string) === 'AGENT' || (authPayload.role as string) === 'ADMIN') {
            socket.join('role:AGENT');
          }
          socket.emit('auth:identified', { userId: currentUserId, success: true });
        }
      }
    });

    // Join game room (e.g. 'room-tier-10')
    socket.on('join:room', (roomId: string) => {
      if (typeof roomId !== 'string' || roomId.startsWith('user:')) return;
      const state = GameEngineService.getRoomState(roomId);
      if (state) {
        socket.join(roomId);
        socket.emit('round:tick', {
          roomId: state.roomId,
          roundId: state.currentRoundId,
          roundNumber: state.roundNumber,
          status: state.status,
          secondsRemaining: state.secondsRemaining
        });
      }
    });

    socket.on('leave:room', (roomId: string) => {
      socket.leave(roomId);
    });

    // Reconnection State Recovery Protocol (Critical for Indian 4G/3G mobile networks)
    socket.on('round:sync', async (payload: { roomId?: string }, callback?: (response: unknown) => void) => {
      try {
        currentUserId = await activeUserId(socket, currentUserId);
        const roomId = payload?.roomId || 'room-tier-10';
        const state = GameEngineService.getRoomState(roomId);
        const wallet = currentUserId === 'guest'
          ? { balance: 0, locked: 0 }
          : await WalletService.getBalance(currentUserId);
        
        const userBets = state 
          ? Array.from(state.bets.values()).filter(b => b.userId === currentUserId)
          : [];

        const syncData = {
          success: true,
          roomId,
          roundId: state?.currentRoundId || '',
          roundNumber: state?.roundNumber || 0,
          status: state?.status || 'BETTING',
          secondsRemaining: state?.secondsRemaining ?? 0,
          seedCommitment: state?.seedCommitment || '',
          clientSeed: state?.clientSeed || '',
          nonce: state?.nonce ?? 0,
          walletBalance: wallet.balance,
          walletLocked: wallet.locked,
          userBets: userBets.map(b => ({
            betId: b.id,
            card: b.chosenCard,
            amount: b.amount
          })),
          serverTime: Date.now()
        };

        if (typeof callback === 'function') {
          callback(syncData);
        } else {
          socket.emit('round:sync:response', syncData);
        }
      } catch (err: any) {
        if (typeof callback === 'function') {
          callback({ success: false, error: err.message });
        }
      }
    });

    // Real-time Bet placement via Socket (Sub-millisecond Redis atomic deduction)
    socket.on('place:bet', async (payload: any, callback?: (response: unknown) => void) => {
      try {
        currentUserId = await activeUserId(socket, currentUserId);
        if (currentUserId === 'guest') {
          return callback?.({ success: false, error: 'Login required.' });
        }
        const now = Date.now();
        if (now - betWindowStartedAt >= 1000) {
          betWindowStartedAt = now;
          betsInWindow = 0;
        }
        betsInWindow += 1;
        if (betsInWindow > 15) {
          return callback?.({ success: false, error: 'Betting speed limit exceeded.' });
        }
        const parsed = PlaceBetSchema.safeParse(payload);
        if (!parsed.success) {
          return callback?.({ success: false, error: parsed.error.issues[0].message });
        }
        const result = await GameEngineService.placeBet(
          currentUserId,
          parsed.data.roomId,
          parsed.data.roundId,
          parsed.data.chosenCard,
          parsed.data.amount
        );

        // Confirm to user socket
        socket.emit('bet:confirmed', {
          betId: result.betId,
          roundId: result.roundId,
          amount: result.amount,
          card: result.chosenCard
        });

        // Broadcast balance update to all devices/tabs for this user
        io.to(`user:${currentUserId}`).emit('wallet:update', {
          userId: currentUserId,
          balance: result.newBalance,
          locked: 0,
          delta: -result.amount,
          reason: 'Bet Placed'
        });

        // Broadcast public bet notification to room for live player feed (User ID, card, amount)
        const anonUserId = `UID_${currentUserId.replace(/[^a-zA-Z0-9]/g, '').slice(-4).toUpperCase() || '7821'}`;
        io.to(parsed.data.roomId).emit('bet:broadcast', {
          userId: anonUserId,
          cardId: result.chosenCard,
          amount: result.amount,
          timestamp: 'Just now'
        });

        if (typeof callback === 'function') {
          callback({ success: true, betId: result.betId, newBalance: result.newBalance });
        }
      } catch (err: any) {
        if (typeof callback === 'function') {
          callback({ success: false, error: err.message });
        }
      }
    });

    socket.on('disconnect', () => {
      activeConnections = Math.max(0, activeConnections - 1);
      if (currentUserId !== 'guest') {
        const count = Math.max(0, (userConnectionCounts.get(currentUserId) || 1) - 1);
        if (count === 0) userConnectionCounts.delete(currentUserId);
        else userConnectionCounts.set(currentUserId, count);
      }
    });
  });

  return io;
}

import { Router, Request, Response, NextFunction } from 'express';
import { GameEngineService } from '../services/game-engine.service.js';
import { EventService } from '../services/event.service.js';
import { AuthService } from '../services/auth.service.js';
import { PlaceBetSchema, PICTURE_CARDS } from '@arcade/shared-types';
import { DB } from '../db.js';
import { betRateLimiter } from '../middlewares/rate-limiter.middleware.js';
import { Config } from '../config.js';
import { readAccessToken } from '../services/session-cookie.js';

export const gameRouter = Router();

async function optionalUser(req: Request, _res: Response, next: NextFunction) {
  const token = readAccessToken(req);
  const payload = token ? await AuthService.verifyToken(token) : null;
  if (payload) (req as Request & { user?: { userId: string } }).user = payload;
  next();
}

function requirePlayer(req: Request, res: Response, next: NextFunction) {
  const user = (req as Request & { user?: { userId: string } }).user;
  if (!user?.userId) {
    return res.status(401).json({ success: false, error: 'Login required.' });
  }
  return next();
}

function requireRegulatedRelease(_req: Request, res: Response, next: NextFunction) {
  if (!Config.regulatedFeaturesEnabled) {
    return res.status(503).json({ success: false, error: 'Game transactions are disabled in this restricted release.' });
  }
  return next();
}

gameRouter.use(optionalUser);

gameRouter.get('/rooms', (req: Request, res: Response) => {
  const summary = GameEngineService.getRoomsSummary();
  return res.json({ success: true, data: summary });
});

gameRouter.get('/events', async (_req: Request, res: Response) => {
  const events = await EventService.listLive();
  return res.json({ success: true, data: events });
});

gameRouter.get('/cards', (req: Request, res: Response) => {
  return res.json({ success: true, data: PICTURE_CARDS });
});

gameRouter.post('/bet', requirePlayer, requireRegulatedRelease, betRateLimiter, async (req: Request, res: Response) => {
  try {
    const parsed = PlaceBetSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: parsed.error.issues[0].message });
    }
    const userId = (req as any).user.userId;
    const result = await GameEngineService.placeBet(
      userId,
      parsed.data.roomId,
      parsed.data.roundId,
      parsed.data.chosenCard,
      parsed.data.amount
    );
    return res.json({ success: true, data: result });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

gameRouter.get('/history/:roomId', async (req: Request, res: Response) => {
  const { roomId } = req.params;
  const rows = await DB.getPrisma().gameRound.findMany({
    where: { roomId, status: 'COMPLETED', resultCard: { not: null } },
    orderBy: { createdAt: 'desc' },
    take: 15
  });
  const history = rows.map(r => ({
      roundNumber: r.roundNumber,
      resultCard: r.resultCard,
      symbol: PICTURE_CARDS.find(p => p.id === r.resultCard),
      createdAt: r.createdAt
    }));
  return res.json({ success: true, data: history });
});

gameRouter.get('/my-bets', requirePlayer, async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  const userBets = await DB.getPrisma().bet.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 30
  });
  return res.json({ success: true, data: userBets });
});

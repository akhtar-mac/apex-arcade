import { Router, Request, Response } from 'express';
import { GameEngineService } from '../services/game-engine.service.js';
import { EventService } from '../services/event.service.js';
import { AuthService } from '../services/auth.service.js';
import { PlaceBetSchema, PICTURE_CARDS } from '@arcade/shared-types';
import { DB } from '../db.js';

export const gameRouter = Router();

function optionalUser(req: Request, _res: Response, next: Function) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  const payload = token ? AuthService.verifyToken(token) : null;
  if (payload) (req as Request & { user?: { userId: string } }).user = payload;
  next();
}

function requirePlayer(req: Request, res: Response, next: Function) {
  const user = (req as Request & { user?: { userId: string } }).user;
  if (!user?.userId) {
    return res.status(401).json({ success: false, error: 'Login required.' });
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

gameRouter.post('/bet', requirePlayer, async (req: Request, res: Response) => {
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

gameRouter.get('/history/:roomId', (req: Request, res: Response) => {
  const { roomId } = req.params;
  const history = Array.from(DB.memory.gameRounds.values())
    .filter(r => r.roomId === roomId && r.resultCard !== null)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 15)
    .map(r => ({
      roundNumber: r.roundNumber,
      resultCard: r.resultCard,
      symbol: PICTURE_CARDS.find(p => p.id === r.resultCard),
      createdAt: r.createdAt
    }));
  return res.json({ success: true, data: history });
});

gameRouter.get('/my-bets', requirePlayer, (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  const userBets = Array.from(DB.memory.bets.values())
    .filter(b => b.userId === userId)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 30);
  return res.json({ success: true, data: userBets });
});

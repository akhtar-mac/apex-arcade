import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { Router, Request, Response } from 'express';
import { PaymentService } from '../services/payment.service.js';
import { GameEngineService } from '../services/game-engine.service.js';
import { DB, getPrisma } from '../db.js';
import { TxType, TxStatus } from '@arcade/shared-types';
import { AdminRiskService } from '../services/admin-risk.service.js';
import { requireRole } from '../middlewares/require-role.middleware.js';
import { ComplianceService } from '../services/compliance.service.js';
import { Ledger } from '../services/ledger.service.js';
import { AuthService } from '../services/auth.service.js';
import { EventService } from '../services/event.service.js';
import { BrandService } from '../services/brand.service.js';

export const adminRouter = Router();

adminRouter.use(requireRole('ADMIN', 'AGENT'));
adminRouter.use((req: Request, res: Response, next) => {
  const role = (req as any).user?.role;
  const agentPaths = req.path.startsWith('/p2p-queue') || req.path.startsWith('/withdrawals') || req.path.startsWith('/desk-log');
  if (role === 'AGENT' && !agentPaths) {
    return res.status(403).json({ success: false, error: 'Only an admin can do that.' });
  }
  return next();
});

adminRouter.get('/profit-engine', (req: Request, res: Response) => {
  const rounds = Array.from(DB.memory.gameRounds.values())
    .filter((round) => round.status === 'COMPLETED' && round.resultCard != null)
    .slice(0, 50)
    .map((round) => ({
      id: round.id,
      roomId: round.roomId,
      roundNumber: round.roundNumber,
      resultCard: round.resultCard,
      totalPool: Number(round.totalPool || 0),
      endTime: round.endTime
    }));
  return res.json({
    success: true,
    data: {
      note: 'The winning card is sealed when the round starts. This screen is a report of settled rounds. It cannot choose the next card.',
      rounds
    }
  });
});

adminRouter.post('/profit-engine', (_req: Request, res: Response) => {
  return res.status(410).json({
    success: false,
    error: 'The card is sealed before bets. This screen cannot change it.'
  });
});

adminRouter.get('/game-logs', (req: Request, res: Response) => {
  return res.json({
    success: true,
    data: GameEngineService.roundLogs
  });
});

adminRouter.get('/scale-proof', (_req: Request, res: Response) => {
  const file = join(process.cwd(), 'data', 'scale-proof.json');
  if (!existsSync(file)) {
    return res.json({
      success: true,
      data: null,
      note: 'No measurement file yet. Run node tests/measure-scale.mjs on this machine.'
    });
  }
  const data = JSON.parse(readFileSync(file, 'utf8'));
  return res.json({ success: true, data });
});

adminRouter.get('/stats', (req: Request, res: Response) => {
  const users = Array.from(DB.memory.users.values());
  const wallets = Array.from(DB.memory.wallets.values());
  const txs = Array.from(DB.memory.transactions.values());
  const bets = Array.from(DB.memory.bets.values());

  const totalUserBalance = wallets.reduce((acc, w) => acc + (w.balance || 0), 0);
  const totalDeposits = txs
    .filter(t => t.type === TxType.DEPOSIT && t.status === TxStatus.SUCCESS)
    .reduce((acc, t) => acc + t.amount, 0);
  const totalWithdrawals = txs
    .filter(t => t.type === TxType.WITHDRAWAL && t.status === TxStatus.SUCCESS)
    .reduce((acc, t) => acc + t.amount, 0);
  const totalBetVolume = bets.reduce((acc, b) => acc + b.amount, 0);
  const totalPayouts = bets.filter(b => b.isWin).reduce((acc, b) => acc + (b.payout || 0), 0);

  const pendingP2PCount = txs.filter(t => t.type === TxType.DEPOSIT && t.status === TxStatus.PENDING).length;
  const pendingWithdrawalCount = txs.filter(t => t.type === TxType.WITHDRAWAL && t.status === TxStatus.PENDING).length;

  const io = GameEngineService.getIo();
  const activePlayersCount = io?.engine?.clientsCount ?? io?.sockets?.sockets?.size ?? 0;

  return res.json({
    success: true,
    data: {
      activePlayersCount,
      totalRegisteredUsers: users.length,
      totalUserEscrowBalance: totalUserBalance,
      totalDeposits,
      totalWithdrawals,
      totalBetVolume,
      totalPayouts,
      pendingP2PDeposits: pendingP2PCount,
      flaggedWithdrawals: pendingWithdrawalCount,
      systemHealth: 'ONLINE'
    }
  });
});

adminRouter.get('/p2p-queue', (req: Request, res: Response) => {
  const pendingDeposits = Array.from(DB.memory.transactions.values())
    .filter(t => t.type === TxType.DEPOSIT && t.status === TxStatus.PENDING)
    .map(t => {
      const user = DB.memory.users.get(t.userId);
      return {
        ...t,
        userPhone: user ? user.phoneNumber : 'Unknown',
        userName: user ? (user.fullName || user.legalName || `User #${user.phoneNumber.slice(-4)}`) : 'Player',
        legalName: user?.legalName || user?.fullName || null,
        panNumber: user?.panNumber || null
      };
    });
  return res.json({ success: true, data: pendingDeposits });
});

adminRouter.post('/p2p-queue/:id/approve', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const adminId = (req as any).user.userId;
    const result = await PaymentService.approveDeposit(id, adminId);
    await Ledger.recordDeskAction(adminId, 'deposit.approve', id, `Credited deposit ${id}`);
    return res.json({ success: true, message: 'Deposit approved and credited to player wallet', data: result });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

adminRouter.post('/p2p-queue/:id/reject', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const adminId = (req as any).user.userId;
    const result = await PaymentService.rejectDeposit(id, adminId, reason);
    await Ledger.recordDeskAction(adminId, 'deposit.reject', id, reason || 'Deposit rejected');
    return res.json({ success: true, message: 'Deposit rejected', data: result });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

adminRouter.get('/withdrawals', (req: Request, res: Response) => {
  const pendingWithdrawals = Array.from(DB.memory.transactions.values())
    .filter(t => t.type === TxType.WITHDRAWAL && t.status === TxStatus.PENDING)
    .map(t => {
      const user = DB.memory.users.get(t.userId);
      return {
        ...t,
        userPhone: user ? user.phoneNumber : 'Unknown',
        payoutDetails: t.payoutDetails || { upiId: t.payoutUpi || user?.upiId || '' },
        legalName: user?.legalName || user?.fullName || null,
        panNumber: user?.panNumber || null
      };
    });
  return res.json({ success: true, data: pendingWithdrawals });
});

adminRouter.post('/withdrawals/:id/approve', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { payoutUtr } = req.body;
    const adminId = (req as any).user.userId;
    const result = await PaymentService.approveWithdrawal(id, adminId, payoutUtr);
    await Ledger.recordDeskAction(adminId, 'withdrawal.approve', id, `Paid with UTR ${payoutUtr}`);
    return res.json({ success: true, message: 'Withdrawal approved and funds released', data: result });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

adminRouter.post('/withdrawals/:id/reject', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const adminId = (req as any).user.userId;
    const result = await PaymentService.rejectWithdrawal(id, adminId, reason);
    await Ledger.recordDeskAction(adminId, 'withdrawal.reject', id, reason || 'Withdrawal rejected');
    return res.json({ success: true, message: 'Withdrawal rejected and balance refunded to user', data: result });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

adminRouter.get('/users', (req: Request, res: Response) => {
  const users = Array.from(DB.memory.users.values()).map(u => {
    const wallet = DB.memory.wallets.get(u.id) || { balance: 0, locked: 0 };
    const userBetsCount = Array.from(DB.memory.bets.values()).filter(b => b.userId === u.id).length;
    return {
      id: u.id,
      phoneNumber: u.phoneNumber,
      role: u.role,
      balance: wallet.balance,
      isBanned: Boolean(u.isBanned),
      totalBets: userBetsCount,
      createdAt: u.createdAt
    };
  });
  return res.json({ success: true, data: users });
});

adminRouter.post('/users/:id/ban', async (req: Request, res: Response) => {
  const { id } = req.params;
  const actorId = (req as Request & { user?: { userId: string } }).user?.userId || '';
  const prisma = getPrisma();
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    return res.status(404).json({ success: false, error: 'User not found' });
  }
  if (user.role !== 'USER') {
    return res.status(400).json({ success: false, error: 'Only a player account can be banned.' });
  }
  const isBanned = !user.isBanned;
  await prisma.user.update({ where: { id }, data: { isBanned } });
  const cached = DB.memory.users.get(id);
  if (cached) cached.isBanned = isBanned;
  if (isBanned) AuthService.denySession(id);
  else AuthService.restoreSession(id);
  await Ledger.recordDeskAction(actorId, isBanned ? 'user.ban' : 'user.unban', id, user.phoneNumber);
  return res.json({
    success: true,
    message: isBanned ? 'This player cannot log in or bet.' : 'This player can log in again.',
    isBanned
  });
});

adminRouter.get('/desk-log', async (_req: Request, res: Response) => {
  const rows = await getPrisma().deskLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50
  });
  return res.json({ success: true, data: rows });
});

// ── 7. Real-Time Risk & Liability Metrics ──
adminRouter.get('/risk-metrics', (req: Request, res: Response) => {
  const roomId = (req.query.roomId as string) || 'room-tier-10';
  const metrics = AdminRiskService.getLiveRiskMetrics(roomId);
  return res.json({ success: true, data: metrics });
});

// ── 8. Emergency Kill Switch: Freeze Betting ──
adminRouter.post('/kill-switches/freeze-betting', (req: Request, res: Response) => {
  const isFrozen = AdminRiskService.toggleFreezeBetting(req.body?.freeze);
  return res.json({
    success: true,
    message: isFrozen ? 'Betting has been FROZEN across all rooms' : 'Betting has been UNBLOCKED and resumed',
    isBettingFrozen: isFrozen
  });
});

// ── 9. Emergency Kill Switch: Halt Payouts ──
adminRouter.post('/kill-switches/halt-payouts', (req: Request, res: Response) => {
  const areHalted = AdminRiskService.toggleHaltPayouts(req.body?.halt);
  return res.json({
    success: true,
    message: areHalted ? 'Automated IMPS payouts HALTED. All withdrawals queued for manual review.' : 'Automated payouts RESUMED.',
    arePayoutsHalted: areHalted
  });
});

// ── 10. Emergency Kill Switch: Force Round Refund ──
adminRouter.post('/kill-switches/force-refund-round', async (req: Request, res: Response) => {
  try {
    const roomId = req.body?.roomId || 'room-tier-10';
    const result = await AdminRiskService.forceRefundRound(roomId);
    return res.json({ success: true, data: result });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

// ── 11. Kill Switch: Force Settle Card (Admin Override) ──
adminRouter.post('/kill-switches/force-settle-card', (_req: Request, res: Response) => {
  return res.status(410).json({
    success: false,
    error: 'The winning card is sealed when the round starts. The desk cannot choose it.'
  });
});

adminRouter.get('/brand', async (_req: Request, res: Response) => {
  return res.json({ success: true, data: await BrandService.get() });
});

adminRouter.patch('/brand', async (req: Request, res: Response) => {
  try {
    const saved = await BrandService.update(req.body || {});
    return res.json({ success: true, data: saved });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

adminRouter.get('/events', async (_req: Request, res: Response) => {
  const events = await EventService.listAll();
  return res.json({ success: true, data: events });
});

adminRouter.post('/events', async (req: Request, res: Response) => {
  try {
    const created = await EventService.create(req.body || {});
    return res.status(201).json({ success: true, data: created });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

adminRouter.patch('/events/:id', async (req: Request, res: Response) => {
  try {
    const updated = await EventService.update(req.params.id, req.body || {});
    return res.json({ success: true, data: updated });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

adminRouter.post('/events/:id/live', async (req: Request, res: Response) => {
  try {
    const updated = await EventService.setLive(req.params.id, req.body?.live === true);
    return res.json({
      success: true,
      message: updated.isLive ? 'This event is live.' : 'This event goes offline after the current round.',
      data: updated
    });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

adminRouter.delete('/events/:id', async (req: Request, res: Response) => {
  try {
    await EventService.remove(req.params.id);
    return res.json({ success: true, message: 'Event deleted.' });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

adminRouter.get('/ledger.csv', async (req: Request, res: Response) => {
  try {
    const from = req.query.from ? new Date(String(req.query.from)) : new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
    const to = req.query.to ? new Date(String(req.query.to)) : new Date();
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      return res.status(400).json({ success: false, error: 'from and to must be dates.' });
    }
    const csv = await ComplianceService.exportCsv(from, to);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="apex-ledger.csv"');
    return res.send(csv);
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

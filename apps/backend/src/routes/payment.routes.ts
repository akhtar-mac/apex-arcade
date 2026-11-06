import { Router, Request, Response, NextFunction } from 'express';
import { PaymentService } from '../services/payment.service.js';
import { TurnoverService } from '../services/turnover.service.js';
import { TdsService } from '../services/tds.service.js';
import { AuthService } from '../services/auth.service.js';
import { DepositIntentSchema, SubmitUtrSchema, WithdrawRequestSchema } from '@arcade/shared-types';
import { DB } from '../db.js';
import { paymentRateLimiter } from '../middlewares/rate-limiter.middleware.js';
import { Config } from '../config.js';
import { readAccessToken } from '../services/session-cookie.js';

export const paymentRouter = Router();

// No payment gateway. Wallets are credited only when a P2P agent or admin matches a UTR.
paymentRouter.post('/webhook', (_req: Request, res: Response) => {
  return res.status(410).json({
    success: false,
    error: 'Gateway webhooks are off. Publish a QR, then approve the player UTR from the P2P console.'
  });
});

paymentRouter.post('/bank-statement-webhook', (_req: Request, res: Response) => {
  return res.status(410).json({
    success: false,
    error: 'Automatic bank reconciliation is off. Approve deposits from the P2P queue.'
  });
});

async function requireUser(req: Request, res: Response, next: NextFunction) {
  const token = readAccessToken(req);
  const payload = token ? await AuthService.verifyToken(token) : null;
  if (payload) (req as any).user = payload;

  if (req.method === 'GET' && req.path === '/active-upi') return next();

  const deskPath = req.path.startsWith('/upi-accounts') || req.path === '/reset-all-limits';
  if (deskPath) {
    if (!payload) return res.status(401).json({ success: false, error: 'Login required.' });
    if (payload.role !== 'ADMIN' && payload.role !== 'AGENT') {
      return res.status(403).json({ success: false, error: 'Only the desk can change a QR.' });
    }
    if (req.method !== 'GET' && req.method !== 'HEAD' && payload.role !== 'ADMIN') {
      return res.status(403).json({ success: false, error: 'Only an admin can change a QR.' });
    }
    return next();
  }

  if (!payload) return res.status(401).json({ success: false, error: 'Login required before moving money.' });
  return next();
}

paymentRouter.use(requireUser);

function requireRegulatedRelease(_req: Request, res: Response, next: NextFunction) {
  if (!Config.regulatedFeaturesEnabled) {
    return res.status(503).json({ success: false, error: 'Money movement is disabled in this restricted release.' });
  }
  return next();
}

// ── 1C. User 1.0x Turnover & Wagering Status ──
paymentRouter.get('/turnover-status', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const status = await TurnoverService.getTurnoverStatus(userId);
    return res.json({ success: true, data: status });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ── 1D. User Indian Section 194BA 30% TDS Tax Ledger & Certificates ──
paymentRouter.get('/tds-summary', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const summary = await TdsService.getUserTdsSummary(userId);
    return res.json({ success: true, data: summary });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

paymentRouter.post('/auto-order', (_req: Request, res: Response) => {
  return res.status(410).json({
    success: false,
    error: 'Automatic payment orders are disabled. Use the published QR and submit the 12-digit UTR.'
  });
});

// ── 3. Sandbox / Instant Simulated Payment Trigger ──
paymentRouter.post('/simulate-auto-pay', (_req: Request, res: Response) => {
  return res.status(410).json({
    success: false,
    error: 'Instant credit is off. Pay the published QR, submit the 12-digit UTR, and wait for P2P approval.'
  });
});

// ── 4. Manual P2P QR Intent (Fallback) ──
paymentRouter.post('/deposit-intent', requireRegulatedRelease, paymentRateLimiter, async (req: Request, res: Response) => {
  try {
    const parsed = DepositIntentSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: parsed.error.issues[0].message });
    }
    const userId = (req as any).user.userId;
    const intent = await PaymentService.generateDepositIntent(userId, parsed.data.amount);
    return res.json({ success: true, data: intent });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ── 5. Submit Manual 12-digit UTR Proof for P2P Verification ──
paymentRouter.post('/submit-utr', requireRegulatedRelease, paymentRateLimiter, async (req: Request, res: Response) => {
  try {
    const parsed = SubmitUtrSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: parsed.error.issues[0].message });
    }
    const userId = (req as any).user.userId;
    const tx = await PaymentService.submitUtrProof(
      userId,
      parsed.data.utrNumber,
      parsed.data.amount,
      parsed.data.screenshotBase64,
      parsed.data.transactionId
    );
    return res.json({
      success: true,
      message: 'Payment proof submitted. The wallet changes after an agent matches this UTR.',
      data: tx
    });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

// ── 6. Request Withdrawal (Auto-approves < ₹2,000, Queues >= ₹2,000) ──
paymentRouter.post('/withdraw', requireRegulatedRelease, paymentRateLimiter, async (req: Request, res: Response) => {
  try {
    const parsed = WithdrawRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: parsed.error.issues[0].message });
    }
    const userId = (req as any).user.userId;
    const result = await PaymentService.requestWithdrawal(userId, parsed.data.amount, {
      upiId: parsed.data.upiId || undefined,
      qrCode: parsed.data.qrCode || undefined,
      bankAccount: parsed.data.bankAccount || undefined,
      ifscCode: parsed.data.ifscCode || undefined
    });
    return res.json({ success: true, data: result });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

// ── 7. Get User's Transaction History ──
paymentRouter.get('/history', async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
  const before = req.query.before ? new Date(String(req.query.before)) : undefined;
  if (before && Number.isNaN(before.getTime())) {
    return res.status(400).json({ success: false, error: 'Invalid history cursor.' });
  }
  const history = await DB.getPrisma().transaction.findMany({
    where: { userId, ...(before ? { createdAt: { lt: before } } : {}) },
    orderBy: { createdAt: 'desc' },
    take: limit
  });
  return res.json({ success: true, data: history });
});

// ── 7B. P2P Payment Orchestration & Client Gateway Suite Endpoints ──

// Cancel unpaid deposit intent
paymentRouter.post('/cancel-order', requireRegulatedRelease, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { transactionId } = req.body;
    if (!transactionId) return res.status(400).json({ success: false, error: 'Transaction ID is required.' });
    const result = await PaymentService.cancelDepositIntent(userId, transactionId);
    return res.json({ success: true, message: 'Order cancelled.', data: result });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

// File dispute / appeal for delayed or mismatched UTR
paymentRouter.post('/dispute', requireRegulatedRelease, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { transactionId, reason, evidence } = req.body;
    if (!transactionId) return res.status(400).json({ success: false, error: 'Transaction ID is required.' });
    const result = await PaymentService.disputeTransaction(userId, transactionId, reason, evidence);
    return res.json({ success: true, message: 'Dispute submitted to arbitration desk.', data: result });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

// P2P Dashboard Analytics & Health Stats
paymentRouter.get('/p2p-stats', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const stats = await PaymentService.getP2pStats(userId);
    return res.json({ success: true, data: stats });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Verifiable Cryptographic Receipt
paymentRouter.get('/receipt/:id', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const receipt = await PaymentService.getTransactionReceipt(userId, req.params.id);
    return res.json({ success: true, data: receipt });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

// Single Order Status Tracker
paymentRouter.get('/order/:id', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const receipt = await PaymentService.getTransactionReceipt(userId, req.params.id);
    return res.json({ success: true, data: receipt });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

// ── 8. Multi-UPI & QR Dynamic Rotation Endpoints ──
paymentRouter.get('/active-upi', (req: Request, res: Response) => {
  try {
    const active = PaymentService.getActiveUpiAccount();
    if (!active) {
      return res.status(404).json({ success: false, error: 'No UPI QR is published yet.' });
    }
    return res.json({ success: true, data: active });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

paymentRouter.get('/upi-accounts', (req: Request, res: Response) => {
  try {
    const list = PaymentService.getUpiAccounts();
    return res.json({
      success: true,
      data: list,
      nextResetInSec: PaymentService.getNextResetInSec(),
      resetIntervalHours: 24
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

paymentRouter.post('/upi-accounts', async (req: Request, res: Response) => {
  try {
    const { upiId, holderName, bankName, dailyLimit, qrImageUrl } = req.body;
    if (!upiId || !holderName || !dailyLimit) {
      return res.status(400).json({ success: false, error: 'upiId, holderName, and dailyLimit are required' });
    }
    const created = await PaymentService.addUpiAccount({
      upiId,
      holderName,
      bankName: bankName || 'Bank',
      dailyLimit: Number(dailyLimit),
      qrImageUrl
    });
    return res.json({ success: true, data: created });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

paymentRouter.post('/reset-all-limits', async (req: Request, res: Response) => {
  try {
    await PaymentService.resetAllLimits('ADMIN_MANUAL_TRIGGER');
    return res.json({
      success: true,
      message: 'All daily QR limits reset to ₹0 (24h timer refreshed)',
      data: PaymentService.getUpiAccounts()
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

paymentRouter.post('/upi-accounts/:id/reset', async (req: Request, res: Response) => {
  try {
    const reset = await PaymentService.resetUpiVolume(req.params.id);
    return res.json({ success: true, data: reset });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

paymentRouter.put('/upi-accounts/:id/toggle', async (req: Request, res: Response) => {
  try {
    const toggled = await PaymentService.toggleUpiAccount(req.params.id);
    return res.json({ success: true, data: toggled });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

paymentRouter.put('/upi-accounts/:id/pause', async (req: Request, res: Response) => {
  try {
    const paused = req.body?.paused !== false;
    const account = await PaymentService.pauseUpiAccount(req.params.id, paused);
    return res.json({ success: true, data: account });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

paymentRouter.delete('/upi-accounts/:id', async (req: Request, res: Response) => {
  try {
    const removed = await PaymentService.deleteUpiAccount(req.params.id);
    return res.json({ success: true, data: removed });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: err.message });
  }
});



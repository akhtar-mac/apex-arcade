import { Router, Request, Response } from 'express';
import { AuthService } from '../services/auth.service.js';
import { otpRateLimiter, authRateLimiter } from '../middlewares/rate-limiter.middleware.js';
import { Ledger } from '../services/ledger.service.js';
import { ComplianceService } from '../services/compliance.service.js';
import bcrypt from 'bcryptjs';

export const authRouter = Router();

function publicUser(user: any) {
  return {
    id: user.id,
    phoneNumber: user.phoneNumber,
    fullName: user.fullName || 'Apex Player',
    email: user.email || null,
    state: user.state || null,
    role: user.role,
    upiId: user.upiId || null
  };
}

authRouter.post('/send-otp', otpRateLimiter, async (req: Request, res: Response) => {
  try {
    const cleanPhone = (req.body.phoneNumber || '').toString().replace(/\D/g, '').slice(-10);
    if (cleanPhone.length !== 10) {
      return res.status(400).json({ success: false, error: 'Please enter a valid 10-digit Indian mobile number.' });
    }
    await AuthService.generateOtp(cleanPhone);
    const existingUser = await Ledger.findUserByPhone(cleanPhone);
    return res.json({
      success: true,
      message: `Verification code sent to +91 ${cleanPhone}`,
      isExistingUser: !!existingUser
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

authRouter.post('/verify-otp', async (req: Request, res: Response) => {
  try {
    const cleanPhone = (req.body.phoneNumber || '').toString().replace(/\D/g, '').slice(-10);
    const otp = (req.body.otp || '').toString().trim();
    if (cleanPhone.length !== 10) {
      return res.status(400).json({ success: false, error: 'Valid 10-digit phone number is required.' });
    }
    if (!AuthService.verifyOtp(cleanPhone, otp)) {
      return res.status(400).json({ success: false, error: 'Invalid or expired verification code.' });
    }

    const user = await Ledger.findUserByPhone(cleanPhone);
    if (user) {
      try {
        await ComplianceService.assertCanUseAccount(user.id);
      } catch (block: any) {
        return res.status(403).json({ success: false, error: block.message });
      }
      const wallet = Ledger.walletOf(user.id);
      const tokens = AuthService.generateTokenPair(user.id, user.phoneNumber, user.role);
      return res.json({
        success: true,
        isNewUser: false,
        message: 'Login successful.',
        data: { user: publicUser(user), wallet, ...tokens }
      });
    }

    return res.json({
      success: true,
      isNewUser: true,
      message: 'OTP verified. Complete registration. New wallets start at ₹0.',
      phoneNumber: cleanPhone
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

authRouter.post('/register', async (req: Request, res: Response) => {
  try {
    const { fullName, phoneNumber, state, email, payoutUpi, ageConfirmed, otp, password } = req.body;
    const cleanPhone = (phoneNumber || '').toString().replace(/\D/g, '').slice(-10);
    if (cleanPhone.length !== 10) {
      return res.status(400).json({ success: false, error: 'Valid 10-digit Indian phone number required.' });
    }
    if (!fullName || fullName.trim().length < 2) {
      return res.status(400).json({ success: false, error: 'Full legal name is required.' });
    }
    if (ageConfirmed !== true) {
      return res.status(400).json({ success: false, error: 'Confirm you are 18 or older before creating an account.' });
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())) {
      return res.status(400).json({ success: false, error: 'Enter a valid email address, or leave it blank.' });
    }
    if (!AuthService.verifyOtp(cleanPhone, (otp || '').toString().trim())) {
      return res.status(400).json({ success: false, error: 'Invalid or expired OTP code.' });
    }
    if (await Ledger.findUserByPhone(cleanPhone)) {
      return res.status(400).json({ success: false, error: 'Phone number already registered. Please sign in.' });
    }

    const passwordHash = await bcrypt.hash(password || cryptoRandom(), 10);
    const created = await Ledger.createUser({
      phoneNumber: cleanPhone,
      passwordHash,
      role: 'USER',
      fullName: fullName.trim(),
      email: email ? email.trim() : null,
      state: state ? state.trim() : null,
      upiId: payoutUpi ? payoutUpi.trim() : null,
      ageConfirmed: !!ageConfirmed
    });

    const tokens = AuthService.generateTokenPair(created.user.id, cleanPhone, 'USER' as any);
    return res.status(201).json({
      success: true,
      message: `Welcome, ${fullName}. Your wallet starts at ₹0. Add money by paying the published QR.`,
      data: { user: publicUser(created.user), wallet: created.wallet, ...tokens }
    });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

const SHOWCASE_PHONE = '9000000100';

authRouter.post('/demo-login', authRateLimiter, async (_req: Request, res: Response) => {
  try {
    const { Config } = await import('../config.js');
    if (!Config.allowDemoOtp) {
      return res.status(404).json({ success: false, error: 'Demo login is not available.' });
    }

    let user = await Ledger.findUserByPhone(SHOWCASE_PHONE);
    if (!user) {
      const passwordHash = await bcrypt.hash(cryptoRandom(), 10);
      const created = await Ledger.createUser({
        phoneNumber: SHOWCASE_PHONE,
        passwordHash,
        role: 'USER',
        fullName: 'Demo Player',
        state: 'Maharashtra',
        ageConfirmed: true
      });
      user = created.user;
    }
    if (!user) {
      return res.status(500).json({ success: false, error: 'Demo account could not be opened.' });
    }
    await ComplianceService.assertCanUseAccount(user.id);
    const wallet = await Ledger.ensureShowcaseFunds(user.id, 100000);
    const tokens = AuthService.generateTokenPair(user.id, user.phoneNumber, user.role);
    return res.json({
      success: true,
      message: 'Demo account ready.',
      data: { user: publicUser(user), wallet, ...tokens }
    });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

authRouter.post('/quick-login', async (req: Request, res: Response) => {
  try {
    const cleanPhone = (req.body.phoneNumber || '').toString().replace(/\D/g, '').slice(-10);
    const otp = (req.body.otp || '').toString().trim();
    if (cleanPhone.length !== 10) {
      return res.status(400).json({ success: false, error: 'Valid 10-digit phone number is required.' });
    }
    if (!AuthService.verifyOtp(cleanPhone, otp)) {
      return res.status(400).json({ success: false, error: 'Invalid or expired verification code.' });
    }

    let user = await Ledger.findUserByPhone(cleanPhone);
    if (user) {
      await ComplianceService.assertCanUseAccount(user.id);
    }
    let wallet = user ? Ledger.walletOf(user.id) : null;
    if (!user) {
      const passwordHash = await bcrypt.hash(cryptoRandom(), 10);
      const created = await Ledger.createUser({
        phoneNumber: cleanPhone,
        passwordHash,
        role: 'USER',
        fullName: `Player ${cleanPhone.slice(-4)}`,
        ageConfirmed: false
      });
      user = created.user;
      wallet = created.wallet;
    }

    const tokens = AuthService.generateTokenPair(user.id, user.phoneNumber, user.role);
    return res.json({
      success: true,
      message: 'Login successful.',
      data: { user: publicUser(user), wallet, ...tokens }
    });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

authRouter.post('/staff-login', authRateLimiter, async (req: Request, res: Response) => {
  try {
    const cleanPhone = (req.body.phoneNumber || '').toString().replace(/\D/g, '').slice(-10);
    const password = req.body.password || '';
    if (cleanPhone.length !== 10 || !password) {
      return res.status(400).json({ success: false, error: 'Phone and password are required.' });
    }
    const user = await Ledger.findUserByPhone(cleanPhone);
    if (!user || (user.role !== 'ADMIN' && user.role !== 'AGENT')) {
      return res.status(401).json({ success: false, error: 'This phone is not a desk login.' });
    }
    if (!(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ success: false, error: 'Invalid phone number or password.' });
    }
    const tokens = AuthService.generateTokenPair(user.id, user.phoneNumber, user.role);
    return res.json({
      success: true,
      data: { user: publicUser(user), ...tokens }
    });
  } catch (err: any) {
    return res.status(401).json({ success: false, error: err.message });
  }
});

authRouter.post('/login', authRateLimiter, async (req: Request, res: Response) => {
  try {
    const cleanPhone = (req.body.phoneNumber || '').toString().replace(/\D/g, '').slice(-10);
    const password = req.body.password;
    if (!cleanPhone || !password) {
      return res.status(400).json({ success: false, error: 'Phone number and password required.' });
    }
    const user = await Ledger.findUserByPhone(cleanPhone);
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ success: false, error: 'Invalid phone number or password.' });
    }
    await ComplianceService.assertCanUseAccount(user.id);
    const tokens = AuthService.generateTokenPair(user.id, user.phoneNumber, user.role);
    return res.json({
      success: true,
      data: { user: publicUser(user), wallet: Ledger.walletOf(user.id), ...tokens }
    });
  } catch (err: any) {
    return res.status(401).json({ success: false, error: err.message });
  }
});

authRouter.get('/me', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Missing authorization token' });
  }
  const payload = AuthService.verifyToken(authHeader.split(' ')[1]);
  if (!payload) {
    return res.status(401).json({ success: false, error: 'Invalid or expired token' });
  }
  const user = await Ledger.findUserById(payload.userId);
  if (!user) {
    return res.status(401).json({ success: false, error: 'Account is not on the ledger.' });
  }
  return res.json({
    success: true,
    data: { user: publicUser(user), wallet: Ledger.walletOf(user.id) }
  });
});

function cryptoRandom() {
  return `apex_${Math.random().toString(36).slice(2, 12)}`;
}

authRouter.post('/compliance', async (req: Request, res: Response) => {
  try {
    const header = req.headers.authorization || '';
    const payload = header.startsWith('Bearer ') ? AuthService.verifyToken(header.slice(7)) : null;
    if (!payload) return res.status(401).json({ success: false, error: 'Login required.' });
    const user = await ComplianceService.updateProfile(payload.userId, {
      ageConfirmed: req.body.ageConfirmed,
      termsVersion: req.body.termsVersion,
      legalName: req.body.legalName,
      panNumber: req.body.panNumber,
      dailyDepositCap: req.body.dailyDepositCap,
      selfExcludeDays: req.body.selfExcludeDays
    });
    return res.json({
      success: true,
      data: {
        ageConfirmed: user.ageConfirmed,
        termsVersion: user.termsVersion,
        legalName: user.legalName,
        panNumber: user.panNumber,
        dailyDepositCap: user.dailyDepositCap == null ? null : Number(user.dailyDepositCap),
        selfExcludedUntil: user.selfExcludedUntil
      }
    });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

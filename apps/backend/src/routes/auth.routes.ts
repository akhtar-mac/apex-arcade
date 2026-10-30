import { Router, Request, Response } from 'express';
import { AuthService } from '../services/auth.service.js';
import { otpRateLimiter, authRateLimiter } from '../middlewares/rate-limiter.middleware.js';
import { Ledger } from '../services/ledger.service.js';
import { ComplianceService } from '../services/compliance.service.js';
import bcrypt from 'bcryptjs';
import { attachSession, clearSessionCookie, readAccessToken } from '../services/session-cookie.js';

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
    return res.json({
      success: true,
      message: `If this number can receive messages, a verification code was sent to +91 ${cleanPhone.slice(0, 2)}******${cleanPhone.slice(-2)}.`
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

authRouter.post('/verify-otp', authRateLimiter, async (req: Request, res: Response) => {
  try {
    const cleanPhone = (req.body.phoneNumber || '').toString().replace(/\D/g, '').slice(-10);
    const otp = (req.body.otp || '').toString().trim();
    if (cleanPhone.length !== 10) {
      return res.status(400).json({ success: false, error: 'Valid 10-digit phone number is required.' });
    }
    if (!await AuthService.verifyOtp(cleanPhone, otp)) {
      return res.status(400).json({ success: false, error: 'Invalid or expired verification code.' });
    }

    if (AuthService.isShowcasePhone(cleanPhone)) {
      const showcase = await Ledger.ensureShowcasePlayer(cleanPhone);
      const tokens = AuthService.generateTokenPair(showcase.user.id, showcase.user.phoneNumber, showcase.user.role);
      attachSession(res, tokens.accessToken);
      return res.json({
        success: true,
        isNewUser: false,
        message: 'Demo account ready. Play money cannot be withdrawn.',
        data: { user: publicUser(showcase.user), wallet: showcase.wallet, ...tokens }
      });
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
      attachSession(res, tokens.accessToken);
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
      phoneNumber: cleanPhone,
      registrationToken: AuthService.generateRegistrationToken(cleanPhone)
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

authRouter.post('/register', authRateLimiter, async (req: Request, res: Response) => {
  try {
    const { fullName, phoneNumber, state, email, payoutUpi, ageConfirmed, registrationToken, password } = req.body;
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
    if (!AuthService.verifyRegistrationToken(String(registrationToken || ''), cleanPhone)) {
      return res.status(400).json({ success: false, error: 'Registration verification expired. Request a new OTP.' });
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
    attachSession(res, tokens.accessToken);
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
    if (!Config.enableDemoLogin) {
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
        ageConfirmed: true,
        isDemo: true
      });
      user = created.user;
    }
    if (!user) {
      return res.status(500).json({ success: false, error: 'Demo account could not be opened.' });
    }
    user = await Ledger.markAsDemo(user.id);
    await ComplianceService.assertCanUseAccount(user.id);
    const wallet = await Ledger.ensureShowcaseFunds(user.id, 100000);
    const tokens = AuthService.generateTokenPair(user.id, user.phoneNumber, user.role);
    attachSession(res, tokens.accessToken);
    return res.json({
      success: true,
      message: 'Demo account ready.',
      data: { user: publicUser(user), wallet, ...tokens }
    });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

authRouter.post('/quick-login', authRateLimiter, async (req: Request, res: Response) => {
  try {
    const cleanPhone = (req.body.phoneNumber || '').toString().replace(/\D/g, '').slice(-10);
    const otp = (req.body.otp || '').toString().trim();
    if (cleanPhone.length !== 10) {
      return res.status(400).json({ success: false, error: 'Valid 10-digit phone number is required.' });
    }
    if (!await AuthService.verifyOtp(cleanPhone, otp)) {
      return res.status(400).json({ success: false, error: 'Invalid or expired verification code.' });
    }

    const user = await Ledger.findUserByPhone(cleanPhone);
    if (user) {
      await ComplianceService.assertCanUseAccount(user.id);
    }
    if (!user) {
      return res.status(409).json({
        success: false,
        isNewUser: true,
        error: 'Complete registration before using this account.'
      });
    }

    const tokens = AuthService.generateTokenPair(user.id, user.phoneNumber, user.role);
    attachSession(res, tokens.accessToken);
    return res.json({
      success: true,
      message: 'Login successful.',
      data: { user: publicUser(user), wallet: Ledger.walletOf(user.id), ...tokens }
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
    attachSession(res, tokens.accessToken);
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
    attachSession(res, tokens.accessToken);
    return res.json({
      success: true,
      data: { user: publicUser(user), wallet: Ledger.walletOf(user.id), ...tokens }
    });
  } catch (err: any) {
    return res.status(401).json({ success: false, error: err.message });
  }
});

authRouter.post('/logout', async (req: Request, res: Response) => {
  await AuthService.revokePresentedToken(readAccessToken(req));
  res.setHeader('Set-Cookie', clearSessionCookie());
  return res.json({ success: true });
});

authRouter.get('/me', async (req: Request, res: Response) => {
  const token = readAccessToken(req);
  if (!token) {
    return res.status(401).json({ success: false, error: 'Missing authorization token' });
  }
  const payload = await AuthService.verifyToken(token);
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
    const payload = await AuthService.verifyToken(readAccessToken(req));
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

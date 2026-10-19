import React, { useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import {
  Wallet,
  Trophy,
  History,
  User,
  Zap,
  QrCode,
  Smartphone,
  ChevronRight,
  ArrowUpRight,
  ArrowDownLeft,
  X,
  Volume2,
  VolumeX,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Flame,
  ArrowRight,
  RefreshCw,
  LogOut,
  Sliders,
  Copy,
  Info,
  Play,
  Download,
  Upload,
  Headphones,
  MessageCircle,
  HelpCircle,
  Send,
  FileText,
  ExternalLink,
  Check,
  Lock
} from 'lucide-react';
import { NativeUpiService, HapticFeedback } from './services/native-upi.js';

// ══════════════════════════════════════════════════════════════════════════
// CONSTANTS & GAME DATA
// ══════════════════════════════════════════════════════════════════════════

export interface PictureCard {
  id: number;
  name: string;
  symbol: string;
  hindi: string;
  color: string;
  imageUrl: string;
}

export const PICTURE_CARDS: PictureCard[] = [
  { id: 1,  name: 'Lion',     symbol: '🦁', hindi: 'Sher',   color: '#f59e0b', imageUrl: '/cards/card_1.jpg' },
  { id: 2,  name: 'Tiger',    symbol: '🐯', hindi: 'Bagh',   color: '#ea580c', imageUrl: '/cards/card_2.jpg' },
  { id: 3,  name: 'Elephant', symbol: '🐘', hindi: 'Hathi',  color: '#64748b', imageUrl: '/cards/card_3.jpg' },
  { id: 4,  name: 'Horse',    symbol: '🐎', hindi: 'Ghoda',  color: '#854d0e', imageUrl: '/cards/card_4.jpg' },
  { id: 5,  name: 'Eagle',    symbol: '🦅', hindi: 'Cheel',  color: '#0284c7', imageUrl: '/cards/card_5.jpg' },
  { id: 6,  name: 'Peacock',  symbol: '🦚', hindi: 'Mor',    color: '#0d9488', imageUrl: '/cards/card_6.jpg' },
  { id: 7,  name: 'Crown',    symbol: '👑', hindi: 'Taj',    color: '#eab308', imageUrl: '/cards/card_7.jpg' },
  { id: 8,  name: 'Diamond',  symbol: '💎', hindi: 'Heera',  color: '#06b6d4', imageUrl: '/cards/card_8.jpg' },
  { id: 9,  name: 'Sword',    symbol: '⚔️', hindi: 'Talwar', color: '#dc2626', imageUrl: '/cards/card_9.jpg' },
  { id: 10, name: 'Shield',   symbol: '🛡️', hindi: 'Dhaal',  color: '#4f46e5', imageUrl: '/cards/card_10.jpg' },
  { id: 11, name: 'Rose',     symbol: '🌹', hindi: 'Gulab',  color: '#e11d48', imageUrl: '/cards/card_11.jpg' },
  { id: 12, name: 'Lotus',    symbol: '🪷', hindi: 'Kamal',  color: '#d946ef', imageUrl: '/cards/card_12.jpg' },
  { id: 13, name: 'Snake',    symbol: '🐍', hindi: 'Saap',   color: '#4ade80', imageUrl: '/cards/card_13.jpg' },
  { id: 14, name: 'Dragon',   symbol: '🐉', hindi: 'Nag',    color: '#fb7185', imageUrl: '/cards/card_14.jpg' },
];

export interface RoomTier {
  id: string;
  name: string;
  tierLabel: string;
  minEntry: number;
  interval: number;
  activePlayers: number;
  multiplier?: number;
  fixedStake?: boolean;
  cards?: PictureCard[];
}

export const ROOMS: RoomTier[] = [
  { id: 'room-tier-10',  name: 'Blitz Arena',  tierLabel: 'FAST 120s', minEntry: 10,  interval: 120, activePlayers: 0 },
  { id: 'room-tier-50',  name: 'Classic Tier', tierLabel: 'PRO 180s',  minEntry: 50,  interval: 180, activePlayers: 0 },
  { id: 'room-tier-100', name: 'High Roller',  tierLabel: 'VIP 240s',  minEntry: 100, interval: 240, activePlayers: 0 },
];

export type NavTab = 'lobby' | 'arena' | 'activity' | 'profile';
export type RoundStatus = 'BETTING' | 'LOCKED' | 'RESOLVING';

export interface ActivityItem {
  id: string;
  type: 'BET' | 'DEPOSIT' | 'WITHDRAW';
  title: string;
  amount: number;
  isPositive: boolean;
  status: 'COMPLETED' | 'PENDING' | 'WON' | 'LOST';
  timestamp: string;
  reference?: string;
}

export interface GameDrawItem {
  roundNumber: number;
  cardId: number;
  timestamp: string;
}

export interface LiveFeedBetItem {
  id: string;
  userId: string;
  cardId: number;
  amount: number;
  timestamp: string;
  isSelf?: boolean;
}

// ══════════════════════════════════════════════════════════════════════════
// AUDIO SYNTHESIZER (Pure Web Audio - No Assets Needed)
// ══════════════════════════════════════════════════════════════════════════

class SoundFX {
  private ctx: AudioContext | null = null;
  public enabled: boolean = true;

  private getContext() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  playChip() {
    if (!this.enabled) return;
    try {
      const ctx = this.getContext();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(620, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(840, ctx.currentTime + 0.05);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.07);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.07);
    } catch {}
  }

  playTick() {
    if (!this.enabled) return;
    try {
      const ctx = this.getContext();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.04);
    } catch {}
  }

  playWin() {
    if (!this.enabled) return;
    try {
      const ctx = this.getContext();
      if (!ctx) return;
      const notes = [523.25, 659.25, 783.99, 1046.50];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.08);
        gain.gain.setValueAtTime(0.18, ctx.currentTime + idx * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.08 + 0.28);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + idx * 0.08);
        osc.stop(ctx.currentTime + idx * 0.08 + 0.3);
      });
    } catch {}
  }
}

const sound = new SoundFX();

// ══════════════════════════════════════════════════════════════════════════
// MAIN APPLICATION COMPONENT
// ══════════════════════════════════════════════════════════════════════════

export default function MobileApp() {
  // Navigation & Auth
  const [isLoggedIn, setIsLoggedIn] = useState(() => typeof window !== 'undefined' ? !!localStorage.getItem('apex_token') : false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [accountId, setAccountId] = useState('');
  const [otpInput, setOtpInput] = useState('');
  const [loginStep, setLoginStep] = useState<'phone' | 'otp'>('phone');
  const [activeTab, setActiveTab] = useState<NavTab>('lobby');
  const [walletReady, setWalletReady] = useState(false);
  const [hasPaidDeposit, setHasPaidDeposit] = useState(false);
  const [fundWizardOpen, setFundWizardOpen] = useState(false);
  const [offerDismissed, setOfferDismissed] = useState(false);

  // User Balance & Sound
  const [balance, setBalance] = useState<number>(0);
  const [lockedBalance, setLockedBalance] = useState<number>(0);
  const [balanceFlash, setBalanceFlash] = useState(false);
  const [soundOn, setSoundOn] = useState(true);

  // Selected Room & Game State
  const [selectedRoom, setSelectedRoom] = useState<RoomTier>(ROOMS[0]);
  const [eventRooms, setEventRooms] = useState<RoomTier[]>([]);
  const [eventsReady, setEventsReady] = useState(false);
  const [brand, setBrand] = useState({ appName: 'Apex Arcade', shortName: 'APEX', tagline: '', logoUrl: '' });
  const [roundNumber, setRoundNumber] = useState<number>(0);
  const roundIdRef = useRef('');
  const [roundStatus, setRoundStatus] = useState<RoundStatus>('BETTING');
  const [secondsRemaining, setSecondsRemaining] = useState<number>(55);
  const [selectedChip, setSelectedChip] = useState<number>(50);
  const [placedBets, setPlacedBets] = useState<Record<number, number>>({});
  const [lastPlacedBets, setLastPlacedBets] = useState<Record<number, number>>({});
  const [winningCard, setWinningCard] = useState<number | null>(null);
  const [winModalData, setWinModalData] = useState<{ card: PictureCard; winAmount: number } | null>(null);

  // Recent Game Draws State (Last 2-3 Winning Pictures)
  const [recentDraws, setRecentDraws] = useState<GameDrawItem[]>([]);
  const [liveBetsFeed, setLiveBetsFeed] = useState<LiveFeedBetItem[]>([]);

  // Modals
  const [depositModalOpen, setDepositModalOpen] = useState(false);
  const [withdrawModalOpen, setWithdrawModalOpen] = useState(false);
  const [depositTab, setDepositTab] = useState<'instant' | 'p2p'>('instant');
  const [depositAmount, setDepositAmount] = useState(500);
  const [isAutoPaying, setIsAutoPaying] = useState(false);
  const [utrInput, setUtrInput] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState(1000);
  const [withdrawUpi, setWithdrawUpi] = useState('');
  const [dailyCapChoice, setDailyCapChoice] = useState<number | null>(null);
  const [breakDays, setBreakDays] = useState<number | null>(null);
  const [isProcessingWithdraw, setIsProcessingWithdraw] = useState(false);

  // 24/7 Live Customer Support & Help Center State
  const [supportModalOpen, setSupportModalOpen] = useState(false);
  const [helpRulesModalOpen, setHelpRulesModalOpen] = useState(false);
  const [responsibleGamingOpen, setResponsibleGamingOpen] = useState(false);
  const [activeHelpTab, setActiveHelpTab] = useState<'rules' | 'payouts' | 'fairness' | 'faq'>('rules');
  const [supportInput, setSupportInput] = useState('');
  const [isAgentTyping, setIsAgentTyping] = useState(false);
  const [supportMessages, setSupportMessages] = useState<Array<{ id: string; sender: 'agent' | 'user'; text: string; time: string }>>([
    {
      id: 'msg-1',
      sender: 'agent',
      text: 'Deposits: pay the published QR, then enter the 12-digit UTR. The wallet changes only after the desk matches it. Withdrawals stay pending until an agent sends the money and types that UTR.',
      time: 'Just now'
    }
  ]);

  // Verified Depositor Badge State
  const [isVerifiedDepositor, setIsVerifiedDepositor] = useState(false);
  const [activeUpiInfo, setActiveUpiInfo] = useState({
    upiId: '',
    holderName: '',
    bankName: '',
    qrImageUrl: ''
  });
  const [pendingDepositId, setPendingDepositId] = useState('');

  // User Profile Data
  const [userName, setUserName] = useState('Aarav Sharma');
  const [userEmail, setUserEmail] = useState('aarav.sharma@example.com');
  const [userState, setUserState] = useState('Maharashtra');

  // Auth Modes & Registration Form
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [regForm, setRegForm] = useState({
    fullName: '',
    phone: '',
    email: '',
    state: 'Maharashtra',
    payoutUpi: '',
    ageConfirmed: false
  });

  // Attached Payment Screenshot for Manual Verification
  const [paymentScreenshot, setPaymentScreenshot] = useState<string | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const placedBetsRef = useRef<Record<number, number>>({});
  placedBetsRef.current = placedBets;

  const backendHost = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
  const isCapacitorNative = typeof window !== 'undefined' && (Boolean((window as any).Capacitor?.isNativePlatform?.()) || window.location.protocol === 'capacitor:');
  const isLocalHost = backendHost === 'localhost' || backendHost === '127.0.0.1' || backendHost.startsWith('192.168.');
  const API_BASE = import.meta.env.VITE_API_URL
    || (isCapacitorNative || !isLocalHost ? 'https://apex-arcade-api.onrender.com' : `http://${backendHost}:4000`);

  // Fetch live active rotated UPI account on mount
  useEffect(() => {
    fetch(`${API_BASE}/api/v1/payments/active-upi`)
      .then(res => res.json())
      .then(res => {
        if (res?.data?.upiId) {
          setActiveUpiInfo({
            upiId: res.data.upiId,
            holderName: res.data.holderName,
            bankName: res.data.bankName,
            qrImageUrl: res.data.qrImageUrl || `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=upi%3A%2F%2Fpay%3Fpa%3D${encodeURIComponent(res.data.upiId)}%26pn%3DApexArcade%26cu%3DINR`
          });
        }
      })
      .catch(() => {});
  }, [API_BASE]);

  // Toast System
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3200);
  };

  const [isSubmittingAuth, setIsSubmittingAuth] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);

  // Hydrate user session from local SQL database on app load
  useEffect(() => {
    const token = localStorage.getItem('apex_token');
    if (token) {
      fetch(`${API_BASE}/api/v1/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(res => res.json())
        .then(res => {
          if (res?.success && res.data) {
            const { user, wallet } = res.data;
            if (wallet?.balance !== undefined) setBalance(Number(wallet.balance));
            if (wallet?.locked !== undefined) setLockedBalance(Number(wallet.locked));
            setWalletReady(true);
            if (user?.id) setAccountId(user.id);
            if (user?.fullName) setUserName(user.fullName);
            if (user?.phoneNumber) setPhoneNumber(user.phoneNumber);
            if (user?.upiId) setWithdrawUpi(user.upiId);
            if (user?.email) setUserEmail(user.email);
            if (user?.state) setUserState(user.state);
            setIsLoggedIn(true);
        setActiveTab('lobby');
        setWalletReady(true);
          }
        })
        .catch(() => {});
    }
  }, [API_BASE]);

  // Auth Action Handlers connected to Local SQL Backend
  const handleSendOtpClick = async () => {
    const cleanPhone = phoneNumber.replace(/\D/g, '').slice(-10);
    if (cleanPhone.length !== 10) {
      showToast('Please enter a valid 10-digit mobile number.');
      return;
    }
    setIsSubmittingAuth(true);
    setSendingOtp(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: cleanPhone })
      });
      const data = await res.json();
      if (data.success) {
        showToast('Verification code sent.');
        setLoginStep('otp');
      } else {
        showToast(data.error || 'Failed to send OTP.');
      }
    } catch {
      showToast('Could not reach the login server.');
    } finally {
      setSendingOtp(false);
      setIsSubmittingAuth(false);
    }
  };

  const handleVerifyOtpClick = async () => {
    const cleanPhone = phoneNumber.replace(/\D/g, '').slice(-10);
    if (!otpInput) {
      showToast('Please enter the 4-digit code.');
      return;
    }
    setIsSubmittingAuth(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: cleanPhone, otp: otpInput })
      });
      const data = await res.json();
      if (data.success) {
        if (data.isNewUser) {
          showToast('OTP verified. Finish registration. New wallets start at ₹0.');
          setRegForm(prev => ({ ...prev, phone: cleanPhone }));
          setAuthMode('register');
        } else if (data.data) {
          const { user, wallet, accessToken } = data.data;
          if (accessToken) localStorage.setItem('apex_token', accessToken);
          if (wallet?.balance !== undefined) setBalance(Number(wallet.balance));
          if (wallet?.locked !== undefined) setLockedBalance(Number(wallet.locked));
          if (user?.id) setAccountId(user.id);
          if (user?.fullName) setUserName(user.fullName);
          if (user?.phoneNumber) setPhoneNumber(user.phoneNumber);
          if (user?.upiId) setWithdrawUpi(user.upiId);
          if (user?.email) setUserEmail(user.email);
          if (user?.state) setUserState(user.state);
          setFundWizardOpen(false);
          setOfferDismissed(false);
          setIsLoggedIn(true);
          setActiveTab('lobby');
          setWalletReady(true);
          showToast(`Welcome back, ${user.fullName || 'Player'}!`);
        }
      } else {
        showToast(data.error || 'Invalid OTP code.');
      }
    } catch (err: any) {
      showToast('Login error: ' + err.message);
    } finally {
      setIsSubmittingAuth(false);
    }
  };

  const handleShowcaseLoginClick = async () => {
    setIsSubmittingAuth(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/auth/demo-login`, { method: 'POST' });
      const data = await res.json();
      if (data.success && data.data) {
        const { user, wallet, accessToken } = data.data;
        if (accessToken) localStorage.setItem('apex_token', accessToken);
        if (wallet?.balance !== undefined) setBalance(Number(wallet.balance));
        if (wallet?.locked !== undefined) setLockedBalance(Number(wallet.locked));
        if (user?.id) setAccountId(user.id);
        if (user?.fullName) setUserName(user.fullName);
        if (user?.phoneNumber) setPhoneNumber(user.phoneNumber);
        if (user?.upiId) setWithdrawUpi(user.upiId);
        if (user?.email) setUserEmail(user.email || '');
        if (user?.state) setUserState(user.state);
        setFundWizardOpen(false);
        setOfferDismissed(false);
        setIsLoggedIn(true);
        setActiveTab('lobby');
        setWalletReady(true);
        showToast(`Demo account open. Balance ₹${Number(wallet?.balance || 0).toLocaleString('en-IN')}.`);
      } else {
        showToast(data.error || 'Demo login is not available.');
      }
    } catch {
      showToast('Could not reach the login server.');
    } finally {
      setIsSubmittingAuth(false);
    }
  };

  const handleRegisterSubmit = async () => {
    if (!regForm.fullName.trim() || regForm.fullName.trim().length < 2) {
      showToast('Enter your full name.');
      return;
    }
    if (regForm.phone.length !== 10) {
      showToast('Enter a 10-digit mobile number.');
      return;
    }
    if (regForm.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(regForm.email.trim())) {
      showToast('Enter a valid email, or leave it blank.');
      return;
    }
    if (!regForm.ageConfirmed) {
      showToast('Confirm you are 18 or older.');
      return;
    }
    setIsSubmittingAuth(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: regForm.fullName,
          phoneNumber: regForm.phone,
          state: regForm.state,
          email: regForm.email.trim() || undefined,
          payoutUpi: regForm.payoutUpi,
          ageConfirmed: regForm.ageConfirmed,
          otp: '1234'
        })
      });
      const data = await res.json();
      if (data.success && data.data) {
        const { user, wallet, accessToken } = data.data;
        if (accessToken) localStorage.setItem('apex_token', accessToken);
        if (wallet?.balance !== undefined) setBalance(Number(wallet.balance));
        if (wallet?.locked !== undefined) setLockedBalance(Number(wallet.locked));
        if (user?.id) setAccountId(user.id);
        if (user?.fullName) setUserName(user.fullName);
        if (user?.phoneNumber) setPhoneNumber(user.phoneNumber);
        if (user?.upiId) setWithdrawUpi(user.upiId);
        if (user?.email) setUserEmail(user.email);
        if (user?.state) setUserState(user.state);
        setHasPaidDeposit(false);
        setFundWizardOpen(false);
        setOfferDismissed(false);
        setIsLoggedIn(true);
        setActiveTab('lobby');
        setWalletReady(true);
        showToast(`Welcome, ${user.fullName}. Your wallet starts at ₹0.`);
      } else {
        showToast(data.error || 'Registration failed.');
      }
    } catch (err: any) {
      showToast('Registration error: ' + err.message);
    } finally {
      setIsSubmittingAuth(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('apex_token');
    setIsLoggedIn(false);
    setWalletReady(false);
    setHasPaidDeposit(false);
    setOfferDismissed(false);
    setActiveTab('lobby');
    setAuthMode('login');
    setLoginStep('phone');
    showToast('Logged out successfully.');
  };

  const toggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    sound.enabled = next;
    showToast(next ? 'Sound FX Enabled' : 'Sound Muted');
  };

  // Activity History State
  const [activityHistory, setActivityHistory] = useState<ActivityItem[]>([]);

  useEffect(() => {
    if (!isLoggedIn) return;
    const token = localStorage.getItem('apex_token');
    if (!token) return;
    fetch(`${API_BASE}/api/v1/payments/history`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => {
        if (!Array.isArray(d?.data)) return;
        setHasPaidDeposit(d.data.some((tx: { type?: string; status?: string; gatewayName?: string }) => tx.type === 'DEPOSIT' && tx.status === 'SUCCESS' && tx.gatewayName !== 'FIRST_DEPOSIT_BONUS'));
        setActivityHistory(d.data.map((tx: any) => ({
          id: tx.id,
          type: tx.type === 'WITHDRAWAL' ? 'WITHDRAW' : tx.type === 'DEPOSIT' ? 'DEPOSIT' : 'BET',
          title: tx.type === 'DEPOSIT' ? 'UPI deposit' : tx.type === 'WITHDRAWAL' ? 'UPI withdrawal' : tx.type,
          amount: Number(tx.amount),
          isPositive: tx.type === 'DEPOSIT' || tx.type === 'BET_WON' || tx.type === 'REFUND',
          status: tx.status,
          timestamp: tx.createdAt ? new Date(tx.createdAt).toLocaleString('en-IN') : '',
          reference: tx.utrNumber || undefined
        })));
      })
      .catch(() => {});
  }, [isLoggedIn, API_BASE]);

  useEffect(() => {
    if (!isLoggedIn || activeTab === 'arena') return;
    const token = localStorage.getItem('apex_token');
    if (!token) return;
    const refreshWallet = () => {
      fetch(`${API_BASE}/api/v1/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json())
        .then(res => {
          const wallet = res?.data?.wallet;
          if (wallet?.balance !== undefined) setBalance(Number(wallet.balance));
          if (wallet?.locked !== undefined) setLockedBalance(Number(wallet.locked));
          setWalletReady(true);
        })
        .catch(() => {});
    };
    const timer = setInterval(refreshWallet, 20000);
    return () => clearInterval(timer);
  }, [isLoggedIn, activeTab, API_BASE]);

  // Activity filter tab
  const [activityFilter, setActivityFilter] = useState<'ALL' | 'BET' | 'DEPOSIT' | 'WITHDRAW'>('ALL');

  // ════════════════════════════════════════════════════════════════════════
  // TRUE REAL-TIME SOCKET.IO ENGINE SYNCHRONIZATION
  // ════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!isLoggedIn || activeTab !== 'arena') return;
    const socket = io(API_BASE, {
      transports: ['websocket', 'polling'],
      auth: { token: localStorage.getItem('apex_token') || '' }
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('join:room', selectedRoom.id);
      socket.emit('round:sync', { roomId: selectedRoom.id });
    });

    socket.on('round:sync:response', (data: any) => {
      if (data && data.success && data.roomId === selectedRoom.id) {
        if (data.roundId) roundIdRef.current = data.roundId;
        setRoundNumber(data.roundNumber);
        setSecondsRemaining(data.secondsRemaining);
        if (typeof data.walletLocked === 'number') setLockedBalance(data.walletLocked);
        if (data.status === 'BETTING') setRoundStatus('BETTING');
        else if (data.status === 'LOCKED') setRoundStatus('LOCKED');
        else if (data.status === 'SETTLING') setRoundStatus('RESOLVING');

        if (typeof data.walletBalance === 'number') {
          setBalance(data.walletBalance);
        }
        if (Array.isArray(data.userBets)) {
          const map: { [cardId: number]: number } = {};
          data.userBets.forEach((b: any) => {
            map[b.card] = (map[b.card] || 0) + b.amount;
          });
          setPlacedBets(map);
          placedBetsRef.current = map;
        }
      }
    });

    socket.on('round:tick', (data: any) => {
      if (data.roomId === selectedRoom.id) {
        if (data.roundId) roundIdRef.current = data.roundId;
        setRoundNumber(data.roundNumber);
        setSecondsRemaining(data.secondsRemaining);
        if (data.status === 'BETTING') {
          setRoundStatus('BETTING');
        } else if (data.status === 'LOCKED') {
          setRoundStatus('LOCKED');
        }
      }
    });

    socket.on('round:locked', (data: any) => {
      if (data.roomId === selectedRoom.id) {
        setRoundStatus('LOCKED');
        HapticFeedback.roundLocked();
        showToast('🔒 Bets Closed! Drawing winning card...');
      }
    });

    socket.on('round:result', (data: any) => {
      if (data.roomId === selectedRoom.id) {
        setRoundStatus('RESOLVING');
        const winningId = data.winningCard;
        setWinningCard(winningId);
        const cardObj = (data.winningSymbol && data.winningSymbol.name)
          ? { ...PICTURE_CARDS[0], ...data.winningSymbol, id: winningId, hindi: data.winningSymbol.hindi || data.winningSymbol.hindiName || '' }
          : (arenaCards.find(c => c.id === winningId) || PICTURE_CARDS[0]);
        const userBet = placedBetsRef.current[winningId] || 0;

        // Record in recent draws history (Last 2-3 Winning Pictures)
        setRecentDraws(prev => [
          { roundNumber: data.roundNumber, cardId: winningId, timestamp: 'Just now' },
          ...prev.slice(0, 4)
        ]);

        if (userBet > 0) {
          const payout = userBet * (Number(data.multiplier) || arenaMultiplier);
          setBalanceFlash(true);
          setTimeout(() => setBalanceFlash(false), 800);
          sound.playWin();
          HapticFeedback.winCelebration();
          setWinModalData({ card: cardObj, winAmount: payout });
          setActivityHistory(h => [
            {
              id: `TX-${Date.now()}`,
              type: 'BET',
              title: `Round #${data.roundNumber} — #${cardObj.id} ${cardObj.name}`,
              amount: payout,
              isPositive: true,
              status: 'WON',
              timestamp: 'Just now'
            },
            ...h
          ]);
        } else if (Object.keys(placedBetsRef.current).length > 0) {
          const totalBet = Object.values(placedBetsRef.current).reduce((a, b) => a + b, 0);
          setActivityHistory(h => [
            {
              id: `TX-${Date.now()}`,
              type: 'BET',
              title: `Round #${data.roundNumber} — Bets Settled`,
              amount: totalBet,
              isPositive: false,
              status: 'LOST',
              timestamp: 'Just now'
            },
            ...h
          ]);
        }

        setLastPlacedBets({ ...placedBetsRef.current });
        setTimeout(() => {
          setRoundStatus('BETTING');
          setPlacedBets({});
          setWinningCard(null);
          setWinModalData(null);
        }, 5000);
      }
    });

    // Real-time live bets feed from room
    socket.on('bet:broadcast', (data: any) => {
      setLiveBetsFeed(prev => [
        {
          id: `bc-${Date.now()}-${Math.random()}`,
          userId: data.userId || 'Player',
          cardId: data.cardId,
          amount: data.amount,
          timestamp: 'Just now'
        },
        ...prev.slice(0, 24)
      ]);
    });

    socket.on('wallet:update', (data: any) => {
      if (typeof data.balance === 'number') {
        setBalance(data.balance);
      }
      if (typeof data.locked === 'number') {
        setLockedBalance(data.locked);
      }
    });

    // Local countdown fallback in case socket reconnects
    const fallbackTimer = setInterval(() => {
      setSecondsRemaining(prev => {
        if (prev > 1) {
          if (prev <= 5) sound.playTick();
          return prev - 1;
        }
        return prev;
      });
    }, 1000);

    return () => {
      clearInterval(fallbackTimer);
      socket.emit('leave:room', selectedRoom.id);
      socket.disconnect();
    };
  }, [selectedRoom.id, API_BASE, isLoggedIn, activeTab]);

  useEffect(() => {
    let stop = false;
    const loadEvents = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/v1/game/events`);
        const json = await res.json();
        if (stop || !Array.isArray(json.data)) return;
        const rooms: RoomTier[] = json.data.map((event: { id: string; name: string; stake: number; multiplier: number; intervalSec: number; fixedStake?: boolean; cards: PictureCard[] }) => ({
          id: event.id,
          name: event.name,
          tierLabel: event.fixedStake ? `${event.multiplier}×` : `${event.intervalSec}s`,
          minEntry: event.stake,
          interval: event.intervalSec,
          activePlayers: 0,
          multiplier: event.multiplier,
          fixedStake: Boolean(event.fixedStake),
          cards: event.cards
        }));
        setEventRooms(rooms);
        setEventsReady(true);
      } catch {
        if (!stop) setEventsReady(false);
      }
    };
    fetch(`${API_BASE}/api/v1/brand`).then(r => r.json()).then(json => {
      if (!stop && json?.data?.appName) setBrand(json.data);
    }).catch(() => undefined);
    loadEvents();
    const timer = setInterval(loadEvents, 15000);
    return () => {
      stop = true;
      clearInterval(timer);
    };
  }, [API_BASE]);

  // ════════════════════════════════════════════════════════════════════════
  // BETTING ACTIONS
  // ════════════════════════════════════════════════════════════════════════
  const arenaCards = selectedRoom.cards && selectedRoom.cards.length === 14 ? selectedRoom.cards : PICTURE_CARDS;
  const arenaMultiplier = selectedRoom.multiplier || 10;
  const roomList = eventsReady ? eventRooms : ROOMS;
  const needsDepositFirst = walletReady && balance <= 0 && !hasPaidDeposit;

  const openArena = (room?: RoomTier) => {
    if (needsDepositFirst) {
      setFundWizardOpen(true);
      return;
    }
    if (room) {
      setSelectedRoom(room);
      if (room.fixedStake) setSelectedChip(room.minEntry);
    }
    setActiveTab('arena');
  };

  const openDeposit = () => {
    setFundWizardOpen(false);
    setDepositModalOpen(true);
  };

  const handlePlaceBet = (cardId: number, amount = selectedChip) => {
    const stake = selectedRoom.fixedStake ? selectedRoom.minEntry : amount;
    if (balance < stake) {
      setFundWizardOpen(true);
      return;
    }
    if (roundStatus !== 'BETTING') {
      showToast('Bets are locked for this round.');
      return;
    }
    const roundId = roundIdRef.current;
    if (!roundId) {
      showToast('Waiting for the live round.');
      return;
    }
    const socket = socketRef.current;
    if (!socket?.connected) {
      showToast('Not connected to the game.');
      return;
    }

    sound.playChip();
    socket.emit('place:bet', {
      roomId: selectedRoom.id,
      roundId,
      chosenCard: cardId,
      amount: stake
    }, (res: { success?: boolean; error?: string; newBalance?: number }) => {
      if (!res?.success) {
        showToast(res?.error || 'Bet was not accepted.');
        return;
      }
      if (typeof res.newBalance === 'number') setBalance(res.newBalance);
        setPlacedBets(prev => {
        const next = { ...prev, [cardId]: (prev[cardId] || 0) + stake };
        placedBetsRef.current = next;
        return next;
      });
      setLiveBetsFeed(prev => [
        {
          id: `self-${Date.now()}`,
          userId: 'You',
          cardId,
          amount: stake,
          timestamp: 'Just now',
          isSelf: true
        },
        ...prev.slice(0, 24)
      ]);
    });
  };

  const handleClearBets = () => {
    showToast('A placed bet stays until the round ends.');
  };

  const handleDoubleBets = () => {
    const entries = Object.entries(placedBets).filter(([, amount]) => amount > 0);
    if (entries.length === 0) {
      showToast('Place a bet first to double.');
      return;
    }
    for (const [cardId, amount] of entries) {
      handlePlaceBet(Number(cardId), amount);
    }
  };

  const handleRepeatBets = () => {
    const entries = Object.entries(lastPlacedBets).filter(([, amount]) => amount > 0);
    if (entries.length === 0) {
      showToast('No previous round bets found.');
      return;
    }
    for (const [cardId, amount] of entries) {
      handlePlaceBet(Number(cardId), amount);
    }
  };

  // ════════════════════════════════════════════════════════════════════════
  // DEPOSIT HANDLER (1-Click Auto + Manual P2P)
  // ════════════════════════════════════════════════════════════════════════
  const authHeaders = () => {
    const token = localStorage.getItem('apex_token');
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    };
  };

  const handleExecuteInstantDeposit = async () => {
    if (!localStorage.getItem('apex_token')) {
      showToast('Log in before adding money.');
      return;
    }
    if (!activeUpiInfo.upiId) {
      showToast('No QR is live yet. Ask the admin or P2P desk to publish a UPI ID.');
      return;
    }
    setIsAutoPaying(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/payments/deposit-intent`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ amount: depositAmount })
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        showToast(data?.error || 'Could not open the payment QR.');
        setIsAutoPaying(false);
        return;
      }
      const intent = data.data;
      setPendingDepositId(intent.transactionId);
      setActiveUpiInfo({
        upiId: intent.upiId,
        holderName: intent.holderName,
        bankName: intent.bankName,
        qrImageUrl: intent.qrImageUrl || ''
      });
      if (intent.upiUri) window.location.href = intent.upiUri;
      setDepositTab('p2p');
      showToast('Pay in your UPI app, then enter the 12-digit UTR. Balance updates after P2P approves.');
    } catch {
      showToast('Could not reach the payment desk.');
    } finally {
      setIsAutoPaying(false);
    }
  };

  const handleExecuteManualUtrDeposit = async () => {
    if (!localStorage.getItem('apex_token')) {
      showToast('Log in before adding money.');
      return;
    }
    if (utrInput.length !== 12) {
      showToast('Please enter a valid 12-digit UTR reference.');
      return;
    }
    if (!pendingDepositId) {
      showToast('Open the payment QR first, then submit the 12-digit UTR.');
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/v1/payments/submit-utr`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          utrNumber: utrInput,
          amount: depositAmount,
          transactionId: pendingDepositId || undefined
        })
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        showToast(data?.error || 'UTR was not accepted.');
        return;
      }
      showToast(`UTR ${utrInput} sent to P2P. Your balance updates when they match it.`);
      setActivityHistory(h => [
        {
          id: `TX-${Date.now()}`,
          type: 'DEPOSIT',
          title: 'P2P QR deposit',
          amount: depositAmount,
          isPositive: true,
          status: 'PENDING',
          timestamp: 'Just now',
          reference: `UTR-${utrInput}`
        },
        ...h
      ]);
      setDepositModalOpen(false);
      setUtrInput('');
      setPendingDepositId('');
    } catch {
      showToast('Could not submit the UTR.');
    }
  };

  // ════════════════════════════════════════════════════════════════════════
  // WITHDRAWAL HANDLER
  // ════════════════════════════════════════════════════════════════════════
  const handleExecuteWithdrawal = async () => {
    if (!localStorage.getItem('apex_token')) {
      showToast('Log in before withdrawing.');
      return;
    }
    if (!withdrawUpi.includes('@')) {
      showToast('Enter the UPI ID that should receive the money.');
      return;
    }
    if (withdrawAmount > balance) {
      showToast('Insufficient playable balance.');
      return;
    }
    if (withdrawAmount < 500) {
      showToast('Minimum withdrawal is ₹500.');
      return;
    }

    setIsProcessingWithdraw(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/payments/withdraw`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ amount: withdrawAmount, upiId: withdrawUpi })
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        showToast(data?.error || 'Withdrawal was not queued.');
        return;
      }
      if (typeof data.data?.newBalance === 'number') setBalance(data.data.newBalance);
      setWithdrawModalOpen(false);
      showToast(data.data?.message || `₹${withdrawAmount} is waiting for a P2P agent to pay ${withdrawUpi}.`);
      setActivityHistory(h => [
        {
          id: `TX-${Date.now()}`,
          type: 'WITHDRAW',
          title: 'P2P payout request',
          amount: withdrawAmount,
          isPositive: false,
          status: 'PENDING',
          timestamp: 'Just now',
          reference: withdrawUpi
        },
        ...h
      ]);
    } catch {
      showToast('Could not reach the payout desk.');
    } finally {
      setIsProcessingWithdraw(false);
    }
  };

  // Computations
  const totalBetAmount = Object.values(placedBets).reduce((a, b) => a + b, 0);
  const activeCardsCount = Object.keys(placedBets).length;
  const maxPotentialWin = (activeCardsCount > 0 ? Math.max(...Object.values(placedBets)) : 0) * 10;

  // Filtered activity
  const filteredActivity = activityHistory.filter(item => {
    if (activityFilter === 'ALL') return true;
    return item.type === activityFilter;
  });

  // ════════════════════════════════════════════════════════════════════════
  // 24/7 CUSTOMER SUPPORT HANDLER
  // ════════════════════════════════════════════════════════════════════════
  const handleSendSupportMessage = (textToSend?: string) => {
    const text = textToSend || supportInput.trim();
    if (!text) return;

    const userMsg = {
      id: `usr-${Date.now()}`,
      sender: 'user' as const,
      text,
      time: 'Just now'
    };

    setSupportMessages(prev => [...prev, userMsg]);
    if (!textToSend) setSupportInput('');
    setIsAgentTyping(true);

    setTimeout(() => {
      let reply = 'This desk does not auto-pay. Pay the published QR, submit the 12-digit UTR, and wait for an agent to match it. Withdrawals stay pending until the agent types the UTR of the money they sent.';
      const lower = text.toLowerCase();
      if (lower.includes('rule') || lower.includes('10x') || lower.includes('how to play') || lower.includes('card')) {
        reply = 'Pick one of 14 cards. The winning card is sealed when the round starts. A winning stake pays 10×. Bets lock in the last 10 seconds. Rooms last 120, 180, or 240 seconds.';
      } else if (lower.includes('tds') || lower.includes('tax')) {
        reply = 'A withdrawal of ₹10,000 or more needs your PAN and legal name before an agent can pay it.';
      }

      setSupportMessages(prev => [
        ...prev,
        {
          id: `agt-${Date.now()}`,
          sender: 'agent' as const,
          text: reply,
          time: 'Just now'
        }
      ]);
      setIsAgentTyping(false);
    }, 1100);
  };

  // ════════════════════════════════════════════════════════════════════════
  // AUXILIARY MODALS: SUPPORT, RULES & RESPONSIBLE GAMING
  // ════════════════════════════════════════════════════════════════════════
  const renderSupportModal = () => {
    if (!supportModalOpen) return null;
    return (
      <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in">
        <div className="w-full max-w-md bg-[#0D0F14] border border-white/[0.1] rounded-t-3xl sm:rounded-3xl flex flex-col h-[85vh] sm:h-[650px] overflow-hidden shadow-2xl">
          {/* Header */}
          <div className="p-4 bg-[#111319] border-b border-white/[0.08] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-10 h-10 rounded-full bg-[#00F59B]/10 border border-[#00F59B]/30 flex items-center justify-center text-[#00F59B]">
                  <Headphones className="w-5 h-5" />
                </div>
                <span className="w-3 h-3 rounded-full bg-[#00F59B] border-2 border-[#111319] absolute -bottom-0.5 -right-0.5 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm text-white">Desk guide</h3>
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-[#00F59B]/10 text-[#00F59B] border border-[#00F59B]/20">
                    ONLINE
                  </span>
                </div>
                <p className="text-[11px] text-[#94A3B8]">Answers stay on this device</p>
              </div>
            </div>
            <button
              onClick={() => setSupportModalOpen(false)}
              className="w-8 h-8 rounded-full bg-white/[0.06] hover:bg-white/[0.12] flex items-center justify-center text-[#94A3B8] hover:text-white transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <p className="px-3 py-2 text-[11px] text-[#94A3B8] border-b border-white/[0.06]">
            This chat explains the desk. It does not move money.
          </p>

          {/* Quick Problem Selector Chips */}
          <div className="px-3 py-2 bg-[#111319]/50 border-b border-white/[0.04] overflow-x-auto flex gap-1.5 no-scrollbar">
            {[
              'How do I deposit?',
              'How do withdrawals work?',
              'How do the 10× rules work?',
              'When is PAN required?'
            ].map(chip => (
              <button
                key={chip}
                onClick={() => handleSendSupportMessage(chip)}
                className="whitespace-nowrap px-2.5 py-1 rounded-full bg-white/[0.05] hover:bg-[#00F59B]/10 hover:text-[#00F59B] hover:border-[#00F59B]/30 border border-white/[0.08] text-[10px] text-[#94A3B8] font-medium transition"
              >
                {chip}
              </button>
            ))}
          </div>

          {/* Chat Messages Thread */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3 font-sans text-xs">
            {supportMessages.map(msg => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 leading-relaxed ${
                    msg.sender === 'user'
                      ? 'bg-[#00F59B] text-black font-medium rounded-br-none shadow-md shadow-[#00F59B]/10'
                      : 'bg-[#181B24] text-white border border-white/[0.08] rounded-bl-none'
                  }`}
                >
                  {msg.text}
                </div>
                <span className="text-[10px] text-[#64748B] mt-1 px-1">{msg.time}</span>
              </div>
            ))}

            {isAgentTyping && (
              <div className="flex items-center gap-2 text-xs text-[#94A3B8] bg-[#181B24] border border-white/[0.08] rounded-2xl rounded-bl-none px-3.5 py-2 w-fit">
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#00F59B] animate-bounce" />
                  <span className="w-1.5 h-1.5 rounded-full bg-[#00F59B] animate-bounce [animation-delay:0.2s]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-[#00F59B] animate-bounce [animation-delay:0.4s]" />
                </div>
                <span className="text-[10px]">Writing a reply...</span>
              </div>
            )}
          </div>

          {/* Input Form */}
          <form
            onSubmit={e => {
              e.preventDefault();
              handleSendSupportMessage();
            }}
            className="p-3 bg-[#111319] border-t border-white/[0.08] flex items-center gap-2"
          >
            <input
              type="text"
              value={supportInput}
              onChange={e => setSupportInput(e.target.value)}
              placeholder="Type message or paste 12-digit UTR..."
              className="flex-1 bg-[#181B24] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-[#64748B] outline-none focus:border-[#00F59B]"
            />
            <button
              type="submit"
              disabled={!supportInput.trim()}
              className="w-10 h-10 rounded-xl bg-[#00F59B] hover:bg-[#00D989] text-black flex items-center justify-center font-bold disabled:opacity-40 disabled:cursor-not-allowed transition shadow-md shadow-[#00F59B]/20"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    );
  };

  const renderHelpRulesModal = () => {
    if (!helpRulesModalOpen) return null;
    return (
      <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in">
        <div className="w-full max-w-md bg-[#0D0F14] border border-white/[0.1] rounded-t-3xl sm:rounded-3xl flex flex-col h-[88vh] sm:h-[680px] overflow-hidden shadow-2xl">
          {/* Header */}
          <div className="p-4 bg-[#111319] border-b border-white/[0.08] flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-400/10 border border-amber-400/30 flex items-center justify-center text-amber-400">
                <HelpCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-white">Help & Rules Center</h3>
                <p className="text-[11px] text-[#94A3B8]">14 Picture Cards • Flat 10.0x Payout System</p>
              </div>
            </div>
            <button
              onClick={() => setHelpRulesModalOpen(false)}
              className="w-8 h-8 rounded-full bg-white/[0.06] hover:bg-white/[0.12] flex items-center justify-center text-[#94A3B8] hover:text-white transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Tabs */}
          <div className="grid grid-cols-4 bg-[#111319] border-b border-white/[0.08] p-1 text-center text-xs font-semibold">
            {[
              { key: 'rules', label: 'Game Rules' },
              { key: 'payouts', label: '10x & Bank' },
              { key: 'fairness', label: 'Provably Fair' },
              { key: 'faq', label: 'FAQs' }
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveHelpTab(tab.key as any)}
                className={`py-2 rounded-lg transition ${
                  activeHelpTab === tab.key
                    ? 'bg-[#00F59B] text-black font-bold'
                    : 'text-[#94A3B8] hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Content Area */}
          <div className="flex-1 p-4 overflow-y-auto space-y-4 text-xs text-[#CBD5E1]">
            {activeHelpTab === 'rules' && (
              <div className="space-y-4">
                <div className="p-3.5 rounded-2xl bg-gradient-to-r from-amber-500/10 to-amber-600/5 border border-amber-500/20">
                  <span className="text-[10px] font-mono font-bold text-amber-400 uppercase tracking-widest block mb-1">
                    ⭐ Core Gameplay Objective
                  </span>
                  <p className="text-white text-xs leading-relaxed">
                    Pick one of <strong>14 picture cards</strong>. The winning card is sealed when the round starts. A winning stake pays <strong>10×</strong>. Rooms last 120, 180, or 240 seconds.
                  </p>
                </div>

                <div className="space-y-2.5">
                  <h4 className="text-white font-bold text-xs uppercase tracking-wider text-[#94A3B8]">
                    How to Play Step-by-Step:
                  </h4>
                  <div className="space-y-2">
                    <div className="p-2.5 rounded-xl bg-[#181B24] border border-white/[0.06] flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-[#00F59B] text-black font-black text-[11px] flex items-center justify-center shrink-0">1</span>
                      <p><strong className="text-white">Choose Your Chips:</strong> Select chips ranging from ₹10 to ₹5,000 using the quick chip bar.</p>
                    </div>
                    <div className="p-2.5 rounded-xl bg-[#181B24] border border-white/[0.06] flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-[#00F59B] text-black font-black text-[11px] flex items-center justify-center shrink-0">2</span>
                      <p><strong className="text-white">Tap Any Picture Card:</strong> Tap one or multiple cards among the 14 available choices (Lion, Tiger, Eagle, Horse, Elephant, Dragon, etc.).</p>
                    </div>
                    <div className="p-2.5 rounded-xl bg-[#181B24] border border-white/[0.06] flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-[#00F59B] text-black font-black text-[11px] flex items-center justify-center shrink-0">3</span>
                      <p><strong className="text-white">Timer:</strong> Bets close in the last 10 seconds. The clock shows minutes and seconds.</p>
                    </div>
                    <div className="p-2.5 rounded-xl bg-[#181B24] border border-white/[0.06] flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-[#00F59B] text-black font-black text-[11px] flex items-center justify-center shrink-0">4</span>
                      <p><strong className="text-white">Instant 10x Settlement:</strong> Winning card is highlighted with celebration. Winnings credit to your withdrawable wallet in real-time!</p>
                    </div>
                  </div>
                </div>

                {/* 14 Picture Directory Preview */}
                <div className="pt-2">
                  <h4 className="text-white font-bold text-xs mb-2">The 14 Picture Cards Roster:</h4>
                  <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                    {arenaCards.map(c => (
                      <div key={c.id} className="p-2 rounded-xl bg-[#111319] border border-white/[0.06] flex items-center gap-2">
                        <img src={c.imageUrl} alt={c.name} className="w-7 h-7 rounded-lg object-cover" />
                        <div>
                          <p className="font-bold text-white leading-tight">#{c.id} {c.name}</p>
                          <p className="text-[10px] text-[#94A3B8]">{c.hindi} • {arenaMultiplier}.0x</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeHelpTab === 'payouts' && (
              <div className="space-y-4">
                <div className="p-3.5 rounded-2xl bg-[#181B24] border border-white/[0.08] space-y-2">
                  <h4 className="font-bold text-white text-sm">10.0x Payout Multiplier Table</h4>
                  <table className="w-full text-left text-xs font-mono-numbers">
                    <thead>
                      <tr className="border-b border-white/[0.08] text-[#94A3B8]">
                        <th className="pb-1.5">Stake</th>
                        <th className="pb-1.5">Multiplier</th>
                        <th className="pb-1.5 text-right">Net Return</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.04]">
                      <tr><td className="py-1.5 font-bold text-white">₹50</td><td className="py-1.5 text-amber-400">10.0x</td><td className="py-1.5 text-right font-black text-[#00F59B]">₹500</td></tr>
                      <tr><td className="py-1.5 font-bold text-white">₹100</td><td className="py-1.5 text-amber-400">10.0x</td><td className="py-1.5 text-right font-black text-[#00F59B]">₹1,000</td></tr>
                      <tr><td className="py-1.5 font-bold text-white">₹500</td><td className="py-1.5 text-amber-400">10.0x</td><td className="py-1.5 text-right font-black text-[#00F59B]">₹5,000</td></tr>
                      <tr><td className="py-1.5 font-bold text-white">₹2,000</td><td className="py-1.5 text-amber-400">10.0x</td><td className="py-1.5 text-right font-black text-[#00F59B]">₹20,000</td></tr>
                      <tr><td className="py-1.5 font-bold text-white">₹5,000</td><td className="py-1.5 text-amber-400">10.0x</td><td className="py-1.5 text-right font-black text-[#00F59B]">₹50,000</td></tr>
                    </tbody>
                  </table>
                </div>

                <div className="p-3.5 rounded-2xl bg-[#181B24] border border-white/[0.08] space-y-2">
                  <h4 className="font-bold text-white text-xs uppercase tracking-wider text-[#94A3B8]">Deposit & Withdrawal Banking Rules</h4>
                  <ul className="space-y-1.5 text-xs">
                    <li>• <strong>UPI deposit:</strong> Pay the published QR, then submit the 12-digit UTR. The wallet changes only after an agent matches it.</li>
                    <li>• <strong>Withdrawal:</strong> The amount is held until an agent pays your UPI and types the 12-digit UTR of that payment. Rejecting the request returns the hold.</li>
                    <li>• <strong>PAN:</strong> A withdrawal of ₹10,000 or more needs your legal name and PAN before an agent can pay it.</li>
                  </ul>
                </div>
              </div>
            )}

            {activeHelpTab === 'fairness' && (
              <div className="space-y-4">
                <div className="p-3.5 rounded-2xl bg-[#00F59B]/10 border border-[#00F59B]/30 space-y-2">
                  <div className="flex items-center gap-2 text-[#00F59B] font-bold">
                    <ShieldCheck className="w-5 h-5" />
                    <span>SHA-256 Cryptographic Provably Fair</span>
                  </div>
                  <p className="text-white text-xs leading-relaxed">
                    Every round draw outcome is generated using cryptographic random seeds with public SHA-256 hashes committed <em>before</em> bets begin. The outcome cannot be altered or tampered with by any party.
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-[#181B24] border border-white/[0.08] space-y-2 font-mono text-[11px]">
                  <span className="text-[#94A3B8] block text-[10px] uppercase font-bold">Fair Play Verification Formula:</span>
                  <div className="p-2.5 rounded-lg bg-black/60 text-[#00F59B] overflow-x-auto">
                    Outcome = HMAC_SHA256(ServerSeed, ClientSeed + RoundID) % 14 + 1
                  </div>
                  <p className="text-[#94A3B8] text-[11px]">
                    Players can independently audit any historical round using standard public SHA-256 checksum tools.
                  </p>
                </div>
              </div>
            )}

            {activeHelpTab === 'faq' && (
              <div className="space-y-2.5">
                {[
                  {
                    q: 'What is the minimum and maximum bet per card?',
                    a: 'The minimum bet per card is ₹10. The maximum is ₹5,000 per card.'
                  },
                  {
                    q: 'How fast do UPI deposits reflect in my account?',
                    a: 'After you submit the 12-digit UTR, the wallet changes only when an agent matches it. There is no automatic credit.'
                  },
                  {
                    q: 'How long do withdrawals take?',
                    a: 'A withdrawal stays pending until an agent sends the money and types the 12-digit UTR. There is no automatic bank payout.'
                  },
                  {
                    q: 'Can I bet on more than one picture in the same round?',
                    a: 'Yes! You can split your stake across any number of cards (e.g., ₹100 on Lion, ₹100 on King, ₹100 on Tiger).'
                  },
                  {
                    q: 'What should I do if my deposit is delayed?',
                    a: 'Click on the 24/7 Support Desk icon in the top header, select "Deposit UTR Recon", and paste your 12-digit UTR. Our team will verify it immediately.'
                  }
                ].map((faq, idx) => (
                  <div key={idx} className="p-3 rounded-xl bg-[#181B24] border border-white/[0.06] space-y-1">
                    <p className="font-bold text-white text-xs">Q: {faq.q}</p>
                    <p className="text-[#94A3B8] text-[11px] leading-relaxed">A: {faq.a}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-3 bg-[#111319] border-t border-white/[0.08] flex items-center justify-between">
            <button
              onClick={() => {
                setHelpRulesModalOpen(false);
                setSupportModalOpen(true);
              }}
              className="text-xs text-[#00F59B] hover:underline flex items-center gap-1.5 font-bold"
            >
              <Headphones className="w-3.5 h-3.5" /> Still have questions? Chat with Support
            </button>
            <button
              onClick={() => setHelpRulesModalOpen(false)}
              className="px-4 py-2 rounded-xl bg-white/[0.08] hover:bg-white/[0.15] text-white font-bold text-xs"
            >
              Got It
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderResponsibleGamingModal = () => {
    if (!responsibleGamingOpen) return null;
    return (
      <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in">
        <div className="w-full max-w-md bg-[#0D0F14] border border-white/[0.1] rounded-t-3xl sm:rounded-3xl flex flex-col max-h-[85vh] overflow-hidden shadow-2xl">
          {/* Header */}
          <div className="p-4 bg-[#111319] border-b border-white/[0.08] flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-[#00F59B]/10 border border-[#00F59B]/30 flex items-center justify-center text-[#00F59B]">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-white">Responsible Gaming & Limits</h3>
                <p className="text-[11px] text-[#94A3B8]">Safe, disciplined, and age-protected play</p>
              </div>
            </div>
            <button
              onClick={() => setResponsibleGamingOpen(false)}
              className="w-8 h-8 rounded-full bg-white/[0.06] hover:bg-white/[0.12] flex items-center justify-center text-[#94A3B8] hover:text-white transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-4 overflow-y-auto space-y-4 text-xs text-[#CBD5E1]">
            {/* 18+ Alert */}
            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-3">
              <span className="w-7 h-7 rounded-lg bg-amber-500 text-black font-black text-xs flex items-center justify-center shrink-0">18+</span>
              <div>
                <h4 className="font-bold text-white text-xs">Strict 18+ Age Restriction</h4>
                <p className="text-[11px] text-[#94A3B8] mt-0.5">Participation is restricted to Indian adults aged 18 and over. Financial games involve risk; please play responsibly.</p>
              </div>
            </div>

            {/* Daily Stake Limit */}
            <div className="p-3.5 rounded-2xl bg-[#181B24] border border-white/[0.08] space-y-2.5">
              <h4 className="font-bold text-white text-xs uppercase tracking-wider text-[#94A3B8]">Daily Bet Spending Cap</h4>
              <p className="text-[11px] text-[#94A3B8]">Limit your maximum daily betting spend to maintain healthy budget control.</p>
              <div className="grid grid-cols-4 gap-1.5">
                {[{ label: '₹1,000', value: 1000 }, { label: '₹5,000', value: 5000 }, { label: '₹20,000', value: 20000 }, { label: 'No Limit', value: -1 }].map((cap) => (
                  <button
                    key={cap.label}
                    onClick={() => setDailyCapChoice(cap.value)}
                    className={`py-2 rounded-xl text-xs font-bold font-mono-numbers pressable ${
                      dailyCapChoice === cap.value ? 'bg-[#00F59B] text-black' : 'bg-[#111319] text-[#94A3B8] border border-white/[0.06] hover:text-white'
                    }`}
                  >
                    {cap.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Cooling-Off / Take a Break */}
            <div className="p-3.5 rounded-2xl bg-[#181B24] border border-white/[0.08] space-y-2.5">
              <h4 className="font-bold text-white text-xs uppercase tracking-wider text-[#94A3B8]">Cooling-Off / Take a Break</h4>
              <p className="text-[11px] text-[#94A3B8]">Temporarily pause your betting access for self-discipline.</p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: '24 Hours', desc: '1 Day Pause', days: 1 },
                  { label: '7 Days', desc: '1 Week Rest', days: 7 },
                  { label: '30 Days', desc: '1 Month Break', days: 30 }
                ].map(b => (
                  <button
                    key={b.label}
                    onClick={() => setBreakDays(b.days)}
                    className={`p-2.5 rounded-xl border text-center pressable ${
                      breakDays === b.days ? 'bg-[#00F59B] text-black border-[#00F59B]' : 'bg-[#111319] hover:bg-white/[0.08] border-white/[0.06]'
                    }`}
                  >
                    <p className="font-bold text-white text-xs">{b.label}</p>
                    <p className="text-[10px] text-[#94A3B8]">{b.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Self-Exclusion & Help */}
            <div className="p-3.5 rounded-2xl bg-[#181B24] border border-white/[0.08] space-y-2">
              <h4 className="font-bold text-white text-xs uppercase tracking-wider text-[#94A3B8]">Need Support or Self-Exclusion?</h4>
              <p className="text-[11px] text-[#94A3B8]">If you feel betting is negatively affecting you, contact our support team to request voluntary permanent account self-exclusion.</p>
              <button
                onClick={() => setBreakDays(365)}
                className={`w-full py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
                  breakDays === 365 ? 'bg-[#00F59B] text-black' : 'bg-white/[0.06] hover:bg-white/[0.12] text-white'
                }`}
              >
                <Headphones className="w-3.5 h-3.5 text-[#00F59B]" />
                Self-exclude for 365 days
              </button>
            </div>
          </div>

          <div className="p-3 bg-[#111319] border-t border-white/[0.08] flex justify-end">
            <button
              onClick={async () => {
                try {
                  const res = await fetch(`${API_BASE}/api/v1/auth/compliance`, {
                    method: 'POST',
                    headers: authHeaders(),
                    body: JSON.stringify({
                      ageConfirmed: true,
                      termsVersion: '2026-10',
                      ...(dailyCapChoice === -1 ? { dailyDepositCap: null } : dailyCapChoice ? { dailyDepositCap: dailyCapChoice } : {}),
                      ...(breakDays ? { selfExcludeDays: breakDays } : {})
                    })
                  });
                  const data = await res.json();
                  if (!res.ok || !data.success) {
                    showToast(data.error || 'Limits were not saved.');
                    return;
                  }
                  showToast(breakDays ? `Break saved for ${breakDays} days. You will be signed out.` : 'Daily deposit cap saved.');
                  setResponsibleGamingOpen(false);
                  if (breakDays) handleLogout();
                } catch {
                  showToast('Could not save limits.');
                }
              }}
              className="px-5 py-2.5 rounded-xl bg-[#00F59B] text-black font-black text-xs"
            >
              Close & Save
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ════════════════════════════════════════════════════════════════════════
  // VIEW: AUTH SCREEN (If Logged Out)
  // ════════════════════════════════════════════════════════════════════════
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen overflow-y-auto bg-[#08090C] text-white flex flex-col justify-between p-6 max-w-md mx-auto">
        <div className="pt-8">
          {/* Logo badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#111319] border border-white/[0.08] text-xs mb-8">
            <span className="w-2 h-2 rounded-full bg-[#00F59B] animate-pulse" />
            <span className="text-[#94A3B8] font-medium">APEX ARENA • 14 PICTURES</span>
          </div>

          <h1 className="text-3xl font-black tracking-tight mb-2">
            Pick a card.<br />Win <span className="text-[#00F59B]">10×.</span>
          </h1>
          <p className="text-sm text-[#94A3B8] mb-8">
            14 cards, 10× payout. Rooms last 120, 180, or 240 seconds. Money moves only after the desk matches a 12-digit UTR.
          </p>

          {/* Auth Mode Switcher */}
          <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-[#111319] border border-white/[0.08] mb-6">
            <button
              onClick={() => setAuthMode('login')}
              className={`py-2 rounded-lg text-xs font-bold transition pressable ${
                authMode === 'login' ? 'bg-[#00F59B] text-black' : 'text-[#94A3B8] hover:text-white'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => setAuthMode('register')}
              className={`py-2 rounded-lg text-xs font-bold transition pressable ${
                authMode === 'register' ? 'bg-[#00F59B] text-black' : 'text-[#94A3B8] hover:text-white'
              }`}
            >
              New Player Registration
            </button>
          </div>

          {authMode === 'login' ? (
            loginStep === 'phone' ? (
              <div className="space-y-4">
                <div>
                  <label className="text-xs uppercase tracking-wider text-[#94A3B8] font-semibold block mb-2">
                    Mobile Number
                  </label>
                  <div className="flex items-center bg-[#111319] border border-white/[0.08] rounded-xl px-4 py-3.5 focus-within:border-[#00F59B]">
                    <span className="text-[#94A3B8] text-sm font-semibold mr-3 border-r border-white/[0.08] pr-3">+91</span>
                    <input
                      type="tel"
                      maxLength={10}
                      value={phoneNumber}
                      onChange={e => setPhoneNumber(e.target.value.replace(/\D/g, ''))}
                      placeholder="Enter 10-digit number"
                      className="bg-transparent text-white font-mono-numbers text-base outline-none w-full"
                    />
                  </div>
                </div>

                <button
                  onClick={handleSendOtpClick}
                  disabled={phoneNumber.length !== 10 || isSubmittingAuth}
                  className="w-full py-4 rounded-xl bg-[#00F59B] text-black font-black text-sm pressable disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {sendingOtp ? (
                    <>
                      <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                      <span>Sending OTP Code...</span>
                    </>
                  ) : (
                    <span>Send Verification Code</span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleShowcaseLoginClick}
                  disabled={isSubmittingAuth}
                  className="w-full py-3.5 rounded-xl bg-[#111319] border border-[#00F59B]/40 text-[#00F59B] font-black text-xs pressable flex items-center justify-center gap-2"
                >
                  Demo login · ₹1,00,000
                </button>
                <p className="text-[11px] text-center text-[#94A3B8]">Show account. One tap. A new player still starts at ₹0.</p>
              </div>
            ) : (
              <div className="space-y-4 animate-slide-up">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-xs uppercase tracking-wider text-[#94A3B8] font-semibold">
                      4-Digit OTP Code
                    </label>
                    <button onClick={() => setLoginStep('phone')} className="text-xs text-[#00F59B]">
                      Change Number
                    </button>
                  </div>
                  <input
                    type="text"
                    maxLength={4}
                    value={otpInput}
                    onChange={e => setOtpInput(e.target.value.replace(/\D/g, ''))}
                    placeholder="Demo code: 1234"
                    className="w-full bg-[#111319] border border-white/[0.08] rounded-xl px-4 py-3.5 text-center text-2xl font-mono-numbers tracking-widest text-white outline-none focus:border-[#00F59B]"
                  />
                  <p className="text-[11px] text-[#00F59B] text-center mt-1.5 font-medium">
                    Demo OTP is <span className="font-mono-numbers font-bold underline">1234</span>
                  </p>
                </div>

                <button
                  onClick={handleVerifyOtpClick}
                  disabled={!otpInput || isSubmittingAuth}
                  className="w-full py-4 rounded-xl bg-[#00F59B] text-black font-black text-sm pressable flex items-center justify-center gap-2"
                >
                  {isSubmittingAuth ? (
                    <>
                      <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                      <span>Verifying Code...</span>
                    </>
                  ) : (
                    <span>Verify & Continue</span>
                  )}
                </button>
              </div>
            )
          ) : (
            /* ── NEW PLAYER REGISTRATION ONBOARDING ── */
            <div className="space-y-3.5 animate-slide-up text-xs">
              <div>
                <label className="text-[10px] uppercase tracking-wider text-[#94A3B8] font-semibold block mb-1">
                  Full Legal Name (as per Bank / Aadhaar) *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Aarav Sharma"
                  value={regForm.fullName}
                  onChange={e => setRegForm({ ...regForm, fullName: e.target.value })}
                  className="w-full bg-[#111319] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-white outline-none focus:border-[#00F59B]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-[#94A3B8] font-semibold block mb-1">
                    Mobile (+91) *
                  </label>
                  <input
                    type="tel"
                    maxLength={10}
                    placeholder="9876543210"
                    value={regForm.phone}
                    onChange={e => setRegForm({ ...regForm, phone: e.target.value.replace(/\D/g, '') })}
                    className="w-full bg-[#111319] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-white font-mono-numbers outline-none focus:border-[#00F59B]"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-[#94A3B8] font-semibold block mb-1">
                    State / Region *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Maharashtra"
                    value={regForm.state}
                    onChange={e => setRegForm({ ...regForm, state: e.target.value })}
                    className="w-full bg-[#111319] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-white outline-none focus:border-[#00F59B]"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] uppercase tracking-wider text-[#94A3B8] font-semibold block mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  placeholder="aarav@example.com"
                  value={regForm.email}
                  onChange={e => setRegForm({ ...regForm, email: e.target.value })}
                  className="w-full bg-[#111319] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-white outline-none focus:border-[#00F59B]"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase tracking-wider text-[#94A3B8] font-semibold block mb-1">
                  Payout UPI ID
                </label>
                <input
                  type="text"
                  placeholder="e.g. aarav@okhdfcbank"
                  value={regForm.payoutUpi}
                  onChange={e => setRegForm({ ...regForm, payoutUpi: e.target.value })}
                  className="w-full bg-[#111319] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-white font-mono-numbers outline-none focus:border-[#00F59B]"
                />
              </div>

              <div className="flex items-start gap-2 pt-1">
                <input
                  type="checkbox"
                  id="ageCheck"
                  checked={regForm.ageConfirmed}
                  onChange={e => setRegForm({ ...regForm, ageConfirmed: e.target.checked })}
                  className="mt-0.5 accent-[#00F59B] w-4 h-4 rounded"
                />
                <label htmlFor="ageCheck" className="text-[11px] text-[#94A3B8] leading-tight">
                  I confirm that I am 18 years or older, legally eligible to participate, and agree to the Fair Play & Security terms.
                </label>
              </div>

              <button
                disabled={!regForm.fullName || regForm.phone.length !== 10 || !regForm.ageConfirmed || isSubmittingAuth}
                onClick={handleRegisterSubmit}
                className="w-full py-4 rounded-xl bg-[#00F59B] text-black font-black text-sm pressable disabled:opacity-40 disabled:cursor-not-allowed shadow-md shadow-[#00F59B]/20 flex items-center justify-center gap-2"
              >
                {isSubmittingAuth ? (
                  <>
                    <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                    <span>Registering Player...</span>
                  </>
                ) : (
                  <span>Complete registration</span>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Footer Guarantee & Help Desk */}
        <div className="pt-6 border-t border-white/[0.06] text-center space-y-3">
          <div className="flex items-center justify-center gap-3 text-xs">
            <button
              onClick={() => setHelpRulesModalOpen(true)}
              className="text-[#94A3B8] hover:text-white flex items-center gap-1.5 transition"
            >
              <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
              Game Rules & FAQ
            </button>
            <span className="text-white/20">•</span>
            <button
              onClick={() => setSupportModalOpen(true)}
              className="text-[#00F59B] hover:text-white font-semibold flex items-center gap-1.5 transition"
            >
              <Headphones className="w-3.5 h-3.5" />
              24/7 Live Support Desk
            </button>
          </div>
          <div className="flex items-center justify-center gap-2 text-[11px] text-[#64748B]">
            <ShieldCheck className="w-3.5 h-3.5 text-[#00F59B]" />
            <span>18+ only. Manual UPI desk. No payment gateway.</span>
          </div>
        </div>

        {/* Support & Rules Modals available on Login Screen */}
        {renderSupportModal()}
        {renderHelpRulesModal()}
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════
  // VIEW: MAIN APPLICATION SHELL
  // ════════════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-[#08090C] text-white flex flex-col justify-between max-w-md mx-auto relative select-none pb-24">
      {/* ── TOP APP BAR ── */}
      <header className="sticky top-0 z-30 bg-[#08090C]/90 backdrop-blur-md border-b border-white/[0.06] px-4 py-3 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#111319] border border-white/[0.08] flex items-center justify-center font-black text-[#00F59B] text-sm overflow-hidden">
            {brand.logoUrl ? <img src={brand.logoUrl} alt="" className="w-full h-full object-cover" /> : brand.shortName.slice(0, 2)}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-black text-sm tracking-tight text-white">{brand.shortName}</span>
              <span className="text-[10px] font-mono-numbers px-1.5 py-0.2 rounded bg-[#00F59B]/10 text-[#00F59B] border border-[#00F59B]/20">
                10X
              </span>
            </div>
            <p className="text-[10px] text-[#94A3B8]">Round #{roundNumber}</p>
          </div>
        </div>

        {/* Balance & Actions */}
        <div className="flex items-center gap-2">
          {/* Verified Depositor Status Badge */}
          {isVerifiedDepositor ? (
            <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-[#00F59B]/15 border border-[#00F59B]/30 text-[#00F59B] text-[10px] font-black">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>VERIFIED</span>
            </div>
          ) : (
            <button
              onClick={() => setDepositModalOpen(true)}
              className="hidden xs:flex items-center gap-1 px-2 py-1 rounded-lg bg-[#111319] border border-white/[0.08] text-[9px] text-[#94A3B8] hover:text-white"
            >
              <span>Get Verified</span>
            </button>
          )}

          {/* Balance Pill */}
          <div
            onClick={() => setActiveTab('profile')}
            className={`px-3 py-1.5 rounded-xl bg-[#111319] border border-white/[0.08] flex items-center gap-1.5 cursor-pointer pressable transition-colors ${
              balanceFlash ? 'border-[#00F59B] bg-[#00F59B]/10' : ''
            }`}
          >
            <Wallet className="w-3.5 h-3.5 text-[#00F59B]" />
            <span className="font-mono-numbers font-bold text-xs text-white">
              ₹{balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
          </div>

          {/* Deposit Trigger */}
          <button
            onClick={() => setDepositModalOpen(true)}
            className="w-8 h-8 rounded-xl bg-[#00F59B] text-black flex items-center justify-center font-black text-base pressable shadow-sm shadow-[#00F59B]/20"
            title="Add Cash"
          >
            +
          </button>

          {/* Game Rules & Help */}
          <button
            onClick={() => setHelpRulesModalOpen(true)}
            className="w-8 h-8 rounded-xl bg-[#111319] border border-white/[0.08] text-[#94A3B8] hover:text-white flex items-center justify-center pressable"
            title="How to Play & 14 Picture Rules"
          >
            <HelpCircle className="w-4 h-4 text-amber-400" />
          </button>

          {/* 24/7 Live Support Chat */}
          <button
            onClick={() => setSupportModalOpen(true)}
            className="w-8 h-8 rounded-xl bg-[#111319] border border-white/[0.08] text-[#94A3B8] hover:text-white flex items-center justify-center pressable relative"
            title="24/7 Live Support Desk"
          >
            <Headphones className="w-4 h-4 text-[#00F59B]" />
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[#00F59B] animate-pulse" />
          </button>

          {/* Sound Toggle */}
          <button
            onClick={toggleSound}
            className="w-8 h-8 rounded-xl bg-[#111319] border border-white/[0.08] text-[#94A3B8] hover:text-white flex items-center justify-center pressable"
          >
            {soundOn ? <Volume2 className="w-4 h-4 text-[#00F59B]" /> : <VolumeX className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* ── TOAST NOTIFICATION ── */}
      {toastMessage && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 animate-slide-up w-[90%] max-w-sm">
          <div className="bg-[#111319] border border-[#00F59B]/40 text-white px-4 py-2.5 rounded-xl shadow-xl flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#00F59B]" />
              <span className="font-medium">{toastMessage}</span>
            </div>
            <button onClick={() => setToastMessage(null)} className="text-[#94A3B8] hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          VIEW 1: LOBBY (HOME)
         ════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'lobby' && (
        <main className="p-4 space-y-4 animate-fade-in">
          {/* Hero Jackpot Card */}
          <div className="p-5 rounded-2xl bg-[#111319] border border-white/[0.08] relative overflow-hidden">
            <div className="flex justify-between items-start mb-3">
              <div>
                <span className="text-[10px] font-semibold text-[#00F59B] uppercase tracking-wider block">
                  Fixed payout
                </span>
                <h2 className="text-3xl font-black font-mono-numbers text-white tracking-tight mt-1">
                  10×
                </h2>
              </div>
              <div className="w-10 h-10 rounded-xl bg-[#00F59B]/10 border border-[#00F59B]/20 flex items-center justify-center text-[#00F59B]">
                <Trophy className="w-5 h-5" />
              </div>
            </div>
            <p className="text-xs text-[#94A3B8]">
              Fixed <span className="text-white font-semibold">10.0x Payout</span> on every winning picture card. No hidden deductions.
            </p>
          </div>

          {/* Room Selection */}
          <div>
            <div className="flex justify-between items-center mb-2.5">
              <h3 className="text-xs uppercase font-bold tracking-wider text-[#94A3B8]">
                Select Arena Room
              </h3>
              <span className="text-xs text-[#94A3B8] font-mono-numbers">
                {roomList.length} rooms
              </span>
            </div>

            <div className="space-y-2.5">
              {roomList.map(room => (
                <div
                  key={room.id}
                  onClick={() => openArena(room)}
                  className={`p-4 rounded-xl bg-[#111319] border transition-all cursor-pointer pressable flex items-center justify-between ${
                    selectedRoom.id === room.id
                      ? 'border-[#00F59B] shadow-md shadow-[#00F59B]/10'
                      : 'border-white/[0.08] hover:border-white/[0.15]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#181B24] border border-white/[0.08] flex items-center justify-center text-[#00F59B] font-black text-sm">
                      ₹{room.minEntry}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white">{room.name}</h4>
                      <p className="text-xs text-[#94A3B8]">
                        {room.fixedStake ? `₹${room.minEntry} bet • ${room.multiplier}× • ${room.interval}s` : `Entry from ₹${room.minEntry} • ${room.interval}s round`}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono-numbers px-2 py-1 rounded-md bg-[#181B24] text-[#94A3B8] border border-white/[0.08]">
                      {room.tierLabel}
                    </span>
                    <ChevronRight className="w-4 h-4 text-[#94A3B8]" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[#111319] border border-white/[0.08] text-xs text-[#94A3B8]">
            The winning card is sealed when the round starts. Recent results show on the arena after a round settles.
          </div>
        </main>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          VIEW 2: ARENA (LIVE BETTING GAME TABLE)
         ════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'arena' && (
        <main className="p-3.5 pb-28 space-y-3 animate-fade-in">
          {/* Round Header Bar */}
          <div className="p-3.5 rounded-2xl bg-[#111319] border border-white/[0.08] flex items-center justify-between">
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-white">{selectedRoom.name}</span>
                <span className="text-[10px] text-[#94A3B8]">• {arenaMultiplier}x Winner</span>
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="w-2 h-2 rounded-full bg-[#00F59B] animate-pulse" />
                <span className="text-[10px] font-mono-numbers text-[#00F59B]">
                  {roundStatus === 'BETTING' ? 'BETTING OPEN' : roundStatus === 'LOCKED' ? 'BETS LOCKED' : 'SETTLING'}
                </span>
              </div>
            </div>

            {/* Countdown Badge */}
            <div className="text-right">
              <span className="text-[10px] uppercase tracking-wider text-[#94A3B8] block">
                Next Draw In
              </span>
              <span className={`text-xl font-mono-numbers font-black ${
                secondsRemaining <= 10 ? 'text-[#00F59B] animate-pulse' : 'text-white'
              }`}>
                {`${String(Math.floor(Math.max(0, secondsRemaining) / 60)).padStart(2, '0')}:${String(Math.max(0, secondsRemaining) % 60).padStart(2, '0')}`}
              </span>
            </div>
          </div>

          {/* 14 Picture Cards Grid */}
          <div className="grid grid-cols-4 gap-2">
            {arenaCards.map(card => {
              const userBet = placedBets[card.id] || 0;
              const isWinner = winningCard === card.id;

              return (
                <div
                  key={card.id}
                  onClick={() => handlePlaceBet(card.id)}
                  className={`relative p-2 rounded-xl border flex flex-col items-center justify-between min-h-[114px] transition-all cursor-pointer pressable overflow-hidden group ${
                    isWinner
                      ? 'border-amber-400 bg-amber-400/20 shadow-[0_0_25px_rgba(251,191,36,0.6)] animate-pulse'
                      : userBet > 0
                      ? 'border-amber-400/80 bg-[#181B24] shadow-[0_0_15px_rgba(251,191,36,0.25)]'
                      : 'border-white/[0.08] bg-[#111319] hover:border-amber-400/40 hover:bg-[#161922]'
                  }`}
                >
                  {/* Top card index */}
                  <div className="w-full flex justify-between items-center text-[10px] font-mono-numbers text-[#94A3B8] z-10">
                    <span className="font-bold text-amber-400/90">#{card.id}</span>
                    <span className="text-[10px] font-semibold text-slate-300">{card.hindi}</span>
                  </div>

                  {/* 3D Luxury Card Image */}
                  <div className="relative w-14 h-14 my-1 rounded-xl overflow-hidden flex items-center justify-center bg-black/50 border border-amber-400/20 group-hover:scale-105 transition-transform duration-300">
                    <img 
                      src={card.imageUrl} 
                      alt={card.name} 
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                        const fallback = (e.target as HTMLElement).nextElementSibling;
                        if (fallback) (fallback as HTMLElement).style.display = 'block';
                      }}
                    />
                    <span className="text-2xl hidden">{card.symbol}</span>
                  </div>

                  {/* Card Name */}
                  <span className="text-[11px] font-bold text-white tracking-tight leading-none z-10">
                    {card.name}
                  </span>

                  {/* User Bet Pill Overlay */}
                  {userBet > 0 && (
                    <div className="absolute top-1 right-1 px-1.5 py-0.5 rounded-full bg-amber-400 text-black font-mono-numbers font-black text-[9px] shadow-md z-20">
                      ₹{userBet}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Empty Space in Row 4 (Cols 3 & 4): Last 2-3 Game Draws */}
            <div className="col-span-2 relative p-2.5 rounded-xl border border-amber-400/40 bg-gradient-to-br from-[#1c1f2b] via-[#141622] to-[#111319] flex flex-col justify-between min-h-[114px] shadow-lg shadow-amber-400/10 group overflow-hidden">
              <div className="w-full flex justify-between items-center text-[10px] font-mono-numbers z-10">
                <span className="font-black text-amber-400 flex items-center gap-1 tracking-tight">
                  <Trophy className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  LAST DRAWS
                </span>
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-400/10 text-amber-300 border border-amber-400/20">
                  10x WIN
                </span>
              </div>

              {/* 3 Last Winning Picture Cards Thumbnails */}
              <div className="grid grid-cols-3 gap-1.5 my-1 z-10">
                {recentDraws.slice(0, 3).map((draw, idx) => {
                  const card = PICTURE_CARDS.find(c => c.id === draw.cardId) || PICTURE_CARDS[0];
                  return (
                    <div
                      key={idx}
                      className="flex flex-col items-center p-1 rounded-lg bg-black/60 border border-amber-400/30 hover:border-amber-400 transition-all shadow-sm"
                      title={`Round #${draw.roundNumber} Winner: ${card.name}`}
                    >
                      <div className="relative w-8 h-8 rounded-lg overflow-hidden border border-amber-400/50 mb-0.5 bg-black/80">
                        <img
                          src={card.imageUrl}
                          alt={card.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                      </div>
                      <span className="text-[9px] font-bold text-white truncate max-w-[42px] leading-tight">
                        {card.name}
                      </span>
                      <span className="text-[8px] font-mono-numbers text-amber-400 font-bold leading-none mt-0.5">
                        #{draw.roundNumber}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Bottom footer text */}
              <div className="w-full flex items-center justify-between text-[9px] text-[#94A3B8] font-mono-numbers z-10">
                <span className="text-slate-400">Past Winners</span>
                <span className="text-[#00F59B] font-bold flex items-center gap-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#00F59B] inline-block animate-pulse" />
                  VERIFIED
                </span>
              </div>
            </div>
          </div>

          {/* Betting Chip Selector Bar */}
          <div className="p-3 rounded-2xl bg-[#111319] border border-white/[0.08]">
            <div className="flex justify-between items-center mb-2">
              <span className="text-[10px] uppercase tracking-wider text-[#94A3B8] font-bold">
                Select Chip Denomination
              </span>
              <span className="text-[10px] text-[#94A3B8] font-mono-numbers">
                Max Bet: ₹5,000
              </span>
            </div>

            <div className="grid grid-cols-6 gap-1.5">
              {[10, 50, 100, 500, 1000, 5000].map(val => (
                <button
                  key={val}
                  onClick={() => {
                    setSelectedChip(val);
                    sound.playChip();
                  }}
                  className={`py-2 rounded-xl text-xs font-mono-numbers font-black transition-all pressable ${
                    selectedChip === val
                      ? 'bg-[#00F59B] text-black shadow-md shadow-[#00F59B]/20'
                      : 'bg-[#181B24] border border-white/[0.06] text-[#94A3B8] hover:text-white'
                  }`}
                >
                  ₹{val >= 1000 ? `${val / 1000}k` : val}
                </button>
              ))}
            </div>
          </div>

          {/* Quick Bet Controls (Clear, 2x Double, Repeat) */}
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={handleClearBets}
              disabled={roundStatus !== 'BETTING' || totalBetAmount === 0}
              className="py-2.5 rounded-xl bg-[#111319] border border-white/[0.08] text-xs font-bold text-[#94A3B8] hover:text-white pressable disabled:opacity-40"
            >
              Clear Bets
            </button>

            <button
              onClick={handleDoubleBets}
              disabled={roundStatus !== 'BETTING' || totalBetAmount === 0}
              className="py-2.5 rounded-xl bg-[#111319] border border-white/[0.08] text-xs font-bold text-[#00F59B] pressable disabled:opacity-40"
            >
              2x Double
            </button>

            <button
              onClick={handleRepeatBets}
              disabled={roundStatus !== 'BETTING' || Object.keys(lastPlacedBets).length === 0}
              className="py-2.5 rounded-xl bg-[#111319] border border-white/[0.08] text-xs font-bold text-white pressable disabled:opacity-40"
            >
              Rebet Last
            </button>
          </div>

          {/* Live Bet Slip Summary Bar */}
          <div className="p-3.5 rounded-xl bg-[#111319] border border-white/[0.08] flex items-center justify-between">
            <div>
              <span className="text-[10px] uppercase text-[#94A3B8] block">Current Staked</span>
              <span className="text-base font-mono-numbers font-black text-white">
                ₹{totalBetAmount.toLocaleString('en-IN')}
              </span>
            </div>

            <div className="text-right">
              <span className="text-[10px] uppercase text-[#00F59B] block">Max 10x Payout</span>
              <span className="text-base font-mono-numbers font-black text-[#00F59B]">
                ₹{maxPotentialWin.toLocaleString('en-IN')}
              </span>
            </div>
          </div>

          {/* ══════════════════════════════════════════════════════════════
              LIVE ARENA BET STREAM (USER ID, PICTURE CARD & MONEY AMOUNT)
             ══════════════════════════════════════════════════════════════ */}
          <div className="p-4 rounded-2xl bg-[#111319] border border-white/[0.08] space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#00F59B] animate-pulse shrink-0" />
                <div>
                  <h3 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                    Live Players Bet Stream
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#00F59B]/10 text-[#00F59B] font-mono-numbers font-bold border border-[#00F59B]/20">
                      This round
                    </span>
                  </h3>
                  <p className="text-[10px] text-[#94A3B8]">
                    Real-time player bets placed across all 14 picture cards
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-mono-numbers font-bold text-[#00F59B] bg-white/5 border border-white/[0.06] px-2 py-1 rounded-lg">
                Round #{roundNumber}
              </span>
            </div>

            {/* Bet Feed List */}
            <div className="space-y-1.5 max-h-[380px] overflow-y-auto pr-1">
              {liveBetsFeed.map((item) => {
                const card = PICTURE_CARDS.find(c => c.id === item.cardId) || PICTURE_CARDS[0];
                return (
                  <div
                    key={item.id}
                    className={`p-2.5 rounded-xl border flex items-center justify-between transition-all ${
                      item.isSelf
                        ? 'bg-[#00F59B]/10 border-[#00F59B]/40 shadow-sm'
                        : 'bg-[#181B24] border-white/[0.05] hover:border-white/[0.12]'
                    }`}
                  >
                    {/* User ID (Strictly User ID, not name) */}
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-black/50 border border-white/[0.08] flex items-center justify-center text-xs font-mono-numbers text-slate-300 shrink-0">
                        <User className="w-4 h-4 text-slate-400" />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-mono-numbers font-bold text-white tracking-wide">
                            {item.userId}
                          </span>
                          {item.isSelf && (
                            <span className="text-[8px] font-black px-1.5 py-0.5 rounded bg-[#00F59B] text-black">
                              YOU
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-[#94A3B8]">
                          {item.timestamp}
                        </span>
                      </div>
                    </div>

                    {/* Picture Card and Money Amount */}
                    <div className="flex items-center gap-2.5">
                      {/* Picture Staked On */}
                      <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-black/60 border border-amber-400/25">
                        <img
                          src={card.imageUrl}
                          alt={card.name}
                          className="w-5 h-5 rounded object-cover"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                        <span className="text-xs font-bold text-white leading-none">
                          #{card.id} {card.name}
                        </span>
                        <span className="text-[11px] leading-none">{card.symbol}</span>
                      </div>

                      {/* Money Staked */}
                      <div className="text-right min-w-[70px]">
                        <span className="text-xs font-mono-numbers font-black text-amber-400">
                          ₹{item.amount.toLocaleString('en-IN')}
                        </span>
                        <span className="block text-[8px] font-mono text-[#94A3B8] leading-none">
                          10x = ₹{(item.amount * 10).toLocaleString('en-IN')}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </main>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          VIEW 3: ACTIVITY (HISTORY)
         ════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'activity' && (
        <main className="p-4 space-y-4 animate-fade-in">
          <div>
            <h2 className="text-xl font-black text-white">Ledger & Activity</h2>
            <p className="text-xs text-[#94A3B8]">Audit trail of all placed bets and transactions</p>
          </div>

          {/* Filter Pills */}
          <div className="grid grid-cols-4 gap-1.5 p-1 rounded-xl bg-[#111319] border border-white/[0.08]">
            {(['ALL', 'BET', 'DEPOSIT', 'WITHDRAW'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActivityFilter(tab)}
                className={`py-1.5 rounded-lg text-xs font-bold transition-all pressable ${
                  activityFilter === tab
                    ? 'bg-[#00F59B] text-black shadow-sm'
                    : 'text-[#94A3B8] hover:text-white'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* History List */}
          <div className="space-y-2">
            {filteredActivity.length === 0 ? (
              <div className="py-12 text-center text-xs text-[#94A3B8]">
                No transactions recorded under this filter.
              </div>
            ) : (
              filteredActivity.map(item => (
                <div
                  key={item.id}
                  className="p-3.5 rounded-xl bg-[#111319] border border-white/[0.08] flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-[#181B24] border border-white/[0.08] flex items-center justify-center">
                      {item.type === 'DEPOSIT' ? (
                        <ArrowDownLeft className="w-4 h-4 text-[#00F59B]" />
                      ) : item.type === 'WITHDRAW' ? (
                        <ArrowUpRight className="w-4 h-4 text-[#94A3B8]" />
                      ) : (
                        <Trophy className={`w-4 h-4 ${item.status === 'WON' ? 'text-[#00F59B]' : 'text-[#94A3B8]'}`} />
                      )}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white">{item.title}</h4>
                      <p className="text-[10px] text-[#94A3B8]">
                        {item.timestamp} {item.reference ? `• Ref: ${item.reference}` : ''}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className={`text-sm font-mono-numbers font-bold ${
                      item.isPositive ? 'text-[#00F59B]' : 'text-white'
                    }`}>
                      {item.isPositive ? '+' : '-'}₹{item.amount.toLocaleString('en-IN')}
                    </span>
                    <span className="block text-[9px] font-mono uppercase text-[#94A3B8]">
                      {item.status}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </main>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          VIEW 4: PROFILE & SETTINGS
         ════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'profile' && (
        <main className="p-4 space-y-4 animate-fade-in">
          {/* User Card */}
          <div className="p-5 rounded-2xl bg-[#111319] border border-white/[0.08] flex items-center justify-between">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-[#181B24] border border-white/[0.08] flex items-center justify-center text-[#00F59B] font-black text-lg relative">
                AP
                {isVerifiedDepositor && (
                  <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-[#00F59B] text-black flex items-center justify-center text-[10px] font-black">
                    ✓
                  </span>
                )}
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="text-sm font-black text-white">+91 {phoneNumber}</h3>
                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                    isVerifiedDepositor
                      ? 'bg-[#00F59B] text-black'
                      : 'bg-[#00F59B]/10 text-[#00F59B] border border-[#00F59B]/20'
                  }`}>
                    {isVerifiedDepositor ? 'VERIFIED DEPOSITOR' : 'MEMBER'}
                  </span>
                </div>
                <p className="text-xs text-[#94A3B8] font-mono-numbers">ID: {accountId || '—'}</p>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="w-9 h-9 rounded-xl bg-[#181B24] border border-white/[0.08] text-[#94A3B8] hover:text-white flex items-center justify-center pressable"
              aria-label="Log out"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>

          {/* Verified Depositor Perks Card */}
          <div className={`p-4 rounded-xl border flex items-center justify-between transition-all ${
            isVerifiedDepositor
              ? 'bg-[#00F59B]/10 border-[#00F59B]/30'
              : 'bg-[#111319] border-white/[0.08]'
          }`}>
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl border flex items-center justify-center ${
                isVerifiedDepositor
                  ? 'bg-[#00F59B] text-black border-[#00F59B]'
                  : 'bg-[#181B24] text-[#94A3B8] border-white/[0.08]'
              }`}>
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-black text-white block">
                  {isVerifiedDepositor ? '✓ Official Verified Depositor' : 'Standard Unverified Tier'}
                </span>
                <p className="text-[10px] text-[#94A3B8]">
                  {isVerifiedDepositor
                    ? 'A deposit has been matched by the desk'
                    : 'Make any deposit to unlock your permanent Verified badge'}
                </p>
              </div>
            </div>
            {!isVerifiedDepositor && (
              <button
                onClick={() => setDepositModalOpen(true)}
                className="px-2.5 py-1 rounded-lg bg-[#00F59B] text-black font-bold text-[10px]"
              >
                Deposit Now
              </button>
            )}
          </div>

          {/* Wallet Balance Hero Card */}
          <div className="p-5 rounded-2xl bg-[#111319] border border-white/[0.08]">
            <span className="text-xs uppercase tracking-wider text-[#94A3B8] font-bold block mb-1">
              Withdrawable Wallet Balance
            </span>
            <div className="text-3xl font-black font-mono-numbers text-white">
              ₹{balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] text-[#94A3B8] mb-4">
              {lockedBalance > 0
                ? `₹${lockedBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })} is held for a withdrawal the desk has not paid yet.`
                : 'Nothing is held for a withdrawal.'}
            </p>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={() => setDepositModalOpen(true)}
                className="py-3 rounded-xl bg-[#00F59B] text-black font-black text-xs pressable flex items-center justify-center gap-1.5 shadow-md shadow-[#00F59B]/20"
              >
                <Zap className="w-3.5 h-3.5" />
                Add Cash
              </button>

              <button
                onClick={() => setWithdrawModalOpen(true)}
                className="py-3 rounded-xl bg-[#181B24] border border-white/[0.08] text-white font-bold text-xs pressable flex items-center justify-center gap-1.5 hover:border-white/[0.2]"
              >
                <ArrowUpRight className="w-3.5 h-3.5 text-[#00F59B]" />
                Withdraw
              </button>
            </div>
          </div>

          {/* Lifetime Betting Stats */}
          <div className="p-4 rounded-xl bg-[#111319] border border-white/[0.08]">
            <h4 className="text-xs uppercase font-bold tracking-wider text-[#94A3B8] mb-3">
              Performance Statistics
            </h4>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2.5 rounded-lg bg-[#181B24] border border-white/[0.06]">
                <span className="text-[10px] text-[#94A3B8] block">Win Rate</span>
                <span className="text-sm font-mono-numbers font-black text-[#00F59B]">{activityHistory.filter(a => a.type === 'BET').length ? `${Math.round((activityHistory.filter(a => a.type === 'BET' && a.status === 'WON').length / activityHistory.filter(a => a.type === 'BET').length) * 100)}%` : '—'}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-[#181B24] border border-white/[0.06]">
                <span className="text-[10px] text-[#94A3B8] block">Total Bets</span>
                <span className="text-sm font-mono-numbers font-black text-white">{activityHistory.filter(a => a.type === 'BET').length}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-[#181B24] border border-white/[0.06]">
                <span className="text-[10px] text-[#94A3B8] block">Highest Win</span>
                <span className="text-sm font-mono-numbers font-black text-[#00F59B]">₹{activityHistory.filter(a => a.status === 'WON').reduce((max, item) => Math.max(max, item.amount), 0).toLocaleString('en-IN')}</span>
              </div>
            </div>
          </div>

          {/* Linked Bank / UPI Account */}
          <div className="p-4 rounded-xl bg-[#111319] border border-white/[0.08] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#181B24] border border-white/[0.08] flex items-center justify-center text-[#00F59B]">
                <Smartphone className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-white block">Primary UPI Handle</span>
                <span className="text-xs font-mono-numbers text-[#94A3B8]">{withdrawUpi || 'Not set'}</span>
              </div>
            </div>
            <span className="text-[10px] font-bold text-[#94A3B8]">{withdrawUpi ? 'ON FILE' : 'NONE'}</span>
          </div>

          {/* ══════════════════════════════════════════════════════════════════
              SUPPORT, HELP CENTER & LEGAL OPTIONS
             ══════════════════════════════════════════════════════════════════ */}
          <div className="p-4 rounded-xl bg-[#111319] border border-white/[0.08] space-y-3">
            <h4 className="text-xs uppercase font-bold tracking-wider text-[#94A3B8]">
              Help, Support & Integrity
            </h4>

            <div className="space-y-1.5 text-xs">
              {/* 24/7 Live Support Chat */}
              <button
                onClick={() => setSupportModalOpen(true)}
                className="w-full p-3 rounded-xl bg-[#181B24] border border-white/[0.06] hover:border-[#00F59B]/40 flex items-center justify-between text-left pressable transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#00F59B]/10 text-[#00F59B] flex items-center justify-center">
                    <Headphones className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-white block">24/7 Live Customer Support</span>
                    <span className="text-[10px] text-[#94A3B8]">Explains the desk. It does not move money.</span>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-[#00F59B]/10 text-[#00F59B] font-bold text-[9px] flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#00F59B] animate-pulse" />
                  ONLINE
                </span>
              </button>

              {/* Game Rules & How to Play */}
              <button
                onClick={() => {
                  setActiveHelpTab('rules');
                  setHelpRulesModalOpen(true);
                }}
                className="w-full p-3 rounded-xl bg-[#181B24] border border-white/[0.06] hover:border-white/[0.15] flex items-center justify-between text-left pressable transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-400/10 text-amber-400 flex items-center justify-center">
                    <HelpCircle className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-white block">How to Play & 14 Picture Rules</span>
                    <span className="text-[10px] text-[#94A3B8]">10.0x fixed multipliers, round timings & rules</span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-[#94A3B8]" />
              </button>

              {/* Provably Fair Cryptographic Fairness */}
              <button
                onClick={() => {
                  setActiveHelpTab('fairness');
                  setHelpRulesModalOpen(true);
                }}
                className="w-full p-3 rounded-xl bg-[#181B24] border border-white/[0.06] hover:border-white/[0.15] flex items-center justify-between text-left pressable transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-cyan-400/10 text-cyan-400 flex items-center justify-center">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-white block">Provably Fair SHA-256 Engine</span>
                    <span className="text-[10px] text-[#94A3B8]">Verify draw hashes & client seed transparency</span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-[#94A3B8]" />
              </button>

              {/* Responsible Gaming & Safety Limits */}
              <button
                onClick={() => setResponsibleGamingOpen(true)}
                className="w-full p-3 rounded-xl bg-[#181B24] border border-white/[0.06] hover:border-white/[0.15] flex items-center justify-between text-left pressable transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-purple-400/10 text-purple-400 flex items-center justify-center">
                    <Sliders className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-white block">Responsible Gaming & Limits</span>
                    <span className="text-[10px] text-[#94A3B8]">Daily stake caps, timeout & self-exclusion</span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-[#94A3B8]" />
              </button>
            </div>
          </div>

          {/* Direct VIP Channels (WhatsApp & Telegram) */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <button
              type="button"
              onClick={() => setSupportModalOpen(true)}
              className="p-3 rounded-xl bg-[#181B24] border border-white/[0.08] flex items-center gap-2.5 text-white pressable"
            >
              <div className="w-7 h-7 rounded-lg bg-white/10 text-white flex items-center justify-center shrink-0">
                <MessageCircle className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold block">Desk guide</span>
                <span className="text-[9px] text-[#94A3B8]">How QR and UTR work</span>
              </div>
            </button>
          </div>
        </main>
      )}

      {/* ── FIXED BOTTOM NAVIGATION DOCK ── */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#08090C]/95 backdrop-blur-md border-t border-white/[0.06] py-2 px-6 max-w-md mx-auto flex items-center justify-between">
        {[
          { id: 'lobby', label: 'Lobby', icon: Trophy },
          { id: 'arena', label: 'Arena', icon: Play },
          { id: 'activity', label: 'Activity', icon: History },
          { id: 'profile', label: 'Profile', icon: User },
        ].map(item => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => item.id === 'arena' ? openArena() : setActiveTab(item.id as NavTab)}
              className={`flex flex-col items-center gap-1 py-1 pressable ${
                isActive ? 'text-[#00F59B]' : 'text-[#94A3B8] hover:text-white'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-bold tracking-tight">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* ════════════════════════════════════════════════════════════════════
          MODAL: DEPOSIT (1-Click Auto + Manual QR)
         ════════════════════════════════════════════════════════════════════ */}
      {needsDepositFirst && activeTab === 'lobby' && !fundWizardOpen && !depositModalOpen && !offerDismissed && (
        <div
          className="fixed inset-0 z-50 bg-black/80"
          onClick={() => setOfferDismissed(true)}
        >
          <button
            type="button"
            aria-label="Close"
            onClick={() => setOfferDismissed(true)}
            className="absolute top-20 left-1/2 -translate-x-1/2 w-10 h-10 rounded-full bg-[#181B24] border border-white/15 text-white flex items-center justify-center pressable"
          >
            <X className="w-5 h-5" />
          </button>
          <div
            className="absolute bottom-4 left-4 right-4 mx-auto w-full max-w-sm bg-[#111319] border border-[#00F59B]/30 rounded-3xl p-5 space-y-3"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="text-[10px] font-black uppercase tracking-wider text-[#00F59B]">First deposit</p>
            <h3 className="text-xl font-black text-white">50% extra on your first deposit</h3>
            <p className="text-xs text-[#94A3B8]">Deposit first. After the desk matches your 12-digit UTR, the wallet receives that amount plus 50%. The arena opens once the money is in.</p>
            <button type="button" onClick={openDeposit} className="w-full py-3 rounded-xl bg-[#00F59B] text-black font-black text-sm">Deposit</button>
          </div>
        </div>
      )}

      {fundWizardOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-end justify-center p-4">
          <div className="w-full max-w-sm bg-[#111319] border border-white/10 rounded-3xl p-5 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-lg font-black text-white">This picture needs money in the wallet</h3>
              <button
                type="button"
                onClick={() => setFundWizardOpen(false)}
                aria-label="Close"
                className="w-8 h-8 shrink-0 rounded-xl bg-[#181B24] border border-white/[0.08] text-[#94A3B8] hover:text-white flex items-center justify-center pressable"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-[#94A3B8]">The stake is higher than the balance. Deposit, then come back to the arena.</p>
            <button type="button" onClick={openDeposit} className="w-full py-3 rounded-xl bg-[#00F59B] text-black font-black text-sm">Deposit</button>
          </div>
        </div>
      )}

      {depositModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full max-w-sm bg-[#111319] border border-white/[0.08] rounded-t-3xl sm:rounded-3xl p-5 space-y-4 animate-slide-up">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-white flex items-center gap-1.5">
                  Deposit Funds <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#00F59B]/10 text-[#00F59B] border border-[#00F59B]/20">AFTER UTR</span>
                </h3>
                <p className="text-xs text-[#94A3B8]">Balance changes after the desk matches your UTR</p>
              </div>
              <button
                onClick={() => setDepositModalOpen(false)}
                className="w-8 h-8 rounded-xl bg-[#181B24] border border-white/[0.08] text-[#94A3B8] hover:text-white flex items-center justify-center pressable"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Segmented Switcher */}
            <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-[#181B24] border border-white/[0.06]">
              <button
                onClick={() => setDepositTab('instant')}
                className={`py-2 rounded-lg text-xs font-bold transition-all pressable ${
                  depositTab === 'instant'
                    ? 'bg-[#00F59B] text-black shadow-sm'
                    : 'text-[#94A3B8] hover:text-white'
                }`}
              >
                Pay with UPI
              </button>
              <button
                onClick={() => setDepositTab('p2p')}
                className={`py-2 rounded-lg text-xs font-bold transition-all pressable ${
                  depositTab === 'p2p'
                    ? 'bg-[#00F59B] text-black shadow-sm'
                    : 'text-[#94A3B8] hover:text-white'
                }`}
              >
                Enter UTR
              </button>
            </div>

            {/* TAB 1: INSTANT AUTO PAY */}
            {depositTab === 'instant' ? (
              <div className="space-y-3.5">
                <div>
                  <label className="text-[10px] uppercase font-bold text-[#94A3B8] block mb-1.5">
                    Select Amount
                  </label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[200, 500, 1000, 2500].map(amt => (
                      <button
                        key={amt}
                        onClick={() => setDepositAmount(amt)}
                        className={`py-2.5 rounded-xl font-mono-numbers font-black text-xs pressable ${
                          depositAmount === amt
                            ? 'bg-[#00F59B] text-black shadow-md shadow-[#00F59B]/20'
                            : 'bg-[#181B24] border border-white/[0.06] text-white hover:border-white/[0.15]'
                        }`}
                      >
                        ₹{amt}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-[#181B24] border border-white/[0.06] flex items-center justify-between text-xs text-[#94A3B8]">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#00F59B] animate-pulse" />
                    <span>Pays the live QR. You enter the UTR next.</span>
                  </div>
                  <span className="text-[#00F59B] font-mono-numbers">P2P check</span>
                </div>

                <button
                  disabled={isAutoPaying}
                  onClick={handleExecuteInstantDeposit}
                  className="w-full py-4 rounded-xl bg-[#00F59B] text-black font-black text-sm pressable flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isAutoPaying ? (
                    <>
                      <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                      <span>Verifying Bank Settlement...</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4" />
                      <span>Open UPI for ₹{depositAmount.toLocaleString('en-IN')}</span>
                    </>
                  )}
                </button>
              </div>
            ) : (
              /* TAB 2: MANUAL P2P QR */
              <div className="space-y-3.5">
                <div className="p-3.5 rounded-xl bg-[#181B24] border border-white/[0.06] flex flex-col items-center">
                  {/* Clean QR Display */}
                  <div className="w-32 h-32 bg-white p-2 rounded-xl mb-2 flex items-center justify-center shadow-lg">
                    {activeUpiInfo.upiId ? (
                      <img
                        src={activeUpiInfo.qrImageUrl || `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=upi%3A%2F%2Fpay%3Fpa%3D${encodeURIComponent(activeUpiInfo.upiId)}%26pn%3D${encodeURIComponent(activeUpiInfo.holderName || 'Apex')}%26cu%3DINR`}
                        alt="UPI Payment QR"
                        className="w-full h-full object-contain rounded-lg"
                      />
                    ) : (
                      <p className="text-[11px] text-center text-[#64748B] px-2">No QR is published yet.</p>
                    )}
                  </div>

                  {/* Download QR to Gallery Button */}
                  <button
                    onClick={() => {
                      const qrUrl = activeUpiInfo.qrImageUrl || `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=upi%3A%2F%2Fpay%3Fpa%3D${encodeURIComponent(activeUpiInfo.upiId)}%26pn%3DApexArcade%26cu%3DINR`;
                      const link = document.createElement('a');
                      link.href = qrUrl;
                      link.download = `APEX_UPI_QR_${activeUpiInfo.upiId}.png`;
                      link.target = '_blank';
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                      showToast('📥 QR code saved to gallery! Scan via GPay / PhonePe.');
                    }}
                    className="w-full py-2 px-3 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs flex items-center justify-center gap-1.5 pressable border border-white/[0.08] mb-2"
                  >
                    <Download className="w-3.5 h-3.5 text-[#00F59B]" />
                    <span>📥 Download QR to Gallery</span>
                  </button>

                  <div className="flex items-center gap-2 text-xs font-mono-numbers text-white">
                    <span>{activeUpiInfo.upiId}</span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(activeUpiInfo.upiId);
                        showToast('Rotated UPI ID copied!');
                      }}
                      className="text-[#00F59B] text-xs font-bold"
                    >
                      Copy
                    </button>
                  </div>
                  <span className="text-[10px] text-[#94A3B8] mt-1">
                    {activeUpiInfo.holderName} • {activeUpiInfo.bankName}
                  </span>
                  <span className="mt-1 px-2 py-0.5 rounded-full bg-[#00F59B]/10 text-[#00F59B] text-[9px] font-mono">
                    ⚡ Auto-Rotated Channel (Daily Bank Limits Monitored)
                  </span>
                </div>

                {/* Screenshot Upload for Payment Proof */}
                <div>
                  <label className="text-[10px] uppercase font-bold text-[#94A3B8] block mb-1">
                    Payment Done Screenshot (Fast Verification)
                  </label>
                  {paymentScreenshot ? (
                    <div className="p-2 rounded-xl bg-[#181B24] border border-[#00F59B]/40 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <img src={paymentScreenshot} alt="Proof" className="w-8 h-8 rounded-lg object-cover border border-white/10" />
                        <span className="text-xs text-white truncate max-w-[170px]">payment_receipt.jpg</span>
                      </div>
                      <button onClick={() => setPaymentScreenshot(null)} className="text-[#94A3B8] hover:text-white p-1">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <label className="w-full py-2.5 px-3 rounded-xl bg-[#181B24] border border-dashed border-white/[0.15] hover:border-[#00F59B] text-center flex items-center justify-center gap-2 cursor-pointer pressable">
                      <Upload className="w-3.5 h-3.5 text-[#00F59B]" />
                      <span className="text-xs text-[#94A3B8]">Tap to upload payment screenshot</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={e => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onloadend = () => {
                              setPaymentScreenshot(reader.result as string);
                              showToast('Screenshot attached successfully.');
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>

                <div>
                  <label className="text-[10px] uppercase font-bold text-[#94A3B8] block mb-1">
                    12-Digit Bank UTR Reference
                  </label>
                  <input
                    type="text"
                    maxLength={12}
                    placeholder="e.g. 427189012345"
                    value={utrInput}
                    onChange={e => setUtrInput(e.target.value.replace(/\D/g, ''))}
                    className="w-full bg-[#181B24] border border-white/[0.08] rounded-xl px-4 py-2.5 text-white font-mono-numbers text-sm outline-none focus:border-[#00F59B]"
                  />
                </div>

                <button
                  onClick={handleExecuteManualUtrDeposit}
                  className="w-full py-4 rounded-xl bg-[#181B24] border border-[#00F59B]/30 text-white font-black text-sm pressable hover:border-[#00F59B]"
                >
                  Submit UTR for approval
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          MODAL: WITHDRAWAL
         ════════════════════════════════════════════════════════════════════ */}
      {withdrawModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full max-w-sm bg-[#111319] border border-white/[0.08] rounded-t-3xl sm:rounded-3xl p-5 space-y-4 animate-slide-up">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-white">Request a UPI payout</h3>
                <p className="text-xs text-[#94A3B8]">The amount is held until an agent pays it and types the UTR</p>
              </div>
              <button
                onClick={() => setWithdrawModalOpen(false)}
                className="w-8 h-8 rounded-xl bg-[#181B24] border border-white/[0.08] text-[#94A3B8] hover:text-white flex items-center justify-center pressable"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Available Balance Box */}
            <div className="p-3 rounded-xl bg-[#181B24] border border-white/[0.06] flex items-center justify-between text-xs">
              <span className="text-[#94A3B8]">Withdrawable Cash</span>
              <span className="font-mono-numbers font-black text-[#00F59B]">
                ₹{balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>

            {/* Amount input */}
            <div>
              <label className="text-[10px] uppercase font-bold text-[#94A3B8] block mb-1">
                Withdrawal Amount (₹)
              </label>
              <input
                type="number"
                value={withdrawAmount}
                onChange={e => setWithdrawAmount(Number(e.target.value))}
                className="w-full bg-[#181B24] border border-white/[0.08] rounded-xl px-4 py-2.5 text-white font-mono-numbers text-lg font-bold outline-none focus:border-[#00F59B]"
              />
            </div>

            {/* Preset pills */}
            <div className="grid grid-cols-4 gap-1.5">
              {[500, 1000, 2000, 5000].map(amt => (
                <button
                  key={amt}
                  onClick={() => setWithdrawAmount(amt)}
                  className={`py-1.5 rounded-lg text-xs font-mono-numbers font-bold pressable ${
                    withdrawAmount === amt
                      ? 'bg-[#00F59B] text-black'
                      : 'bg-[#181B24] text-[#94A3B8] border border-white/[0.06]'
                  }`}
                >
                  ₹{amt}
                </button>
              ))}
            </div>

            {/* Destination UPI */}
            <div>
              <label className="text-[10px] uppercase font-bold text-[#94A3B8] block mb-1">
                Destination UPI ID
              </label>
              <input
                type="text"
                value={withdrawUpi}
                onChange={e => setWithdrawUpi(e.target.value)}
                className="w-full bg-[#181B24] border border-white/[0.08] rounded-xl px-4 py-2.5 text-white font-mono-numbers text-xs outline-none focus:border-[#00F59B]"
              />
            </div>

            <button
              disabled={isProcessingWithdraw || withdrawAmount > balance}
              onClick={handleExecuteWithdrawal}
              className="w-full py-4 rounded-xl bg-[#00F59B] text-black font-black text-sm pressable flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isProcessingWithdraw ? (
                <>
                  <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  <span>Sending request...</span>
                </>
              ) : (
                <span>Withdraw ₹{withdrawAmount.toLocaleString('en-IN')}</span>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          MODAL: WIN CELEBRATION (10x Payout)
         ════════════════════════════════════════════════════════════════════ */}
      {winModalData && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-gradient-to-b from-[#181B24] to-[#0D0F14] border-2 border-amber-400 rounded-3xl p-6 text-center space-y-4 animate-slide-up shadow-[0_0_50px_rgba(251,191,36,0.35)] relative overflow-hidden">
            <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-44 h-44 bg-amber-400/20 rounded-full blur-3xl pointer-events-none" />

            <div className="w-32 h-32 rounded-2xl border-2 border-amber-400 overflow-hidden mx-auto shadow-2xl bg-black/50 p-1">
              <img
                src={winModalData.card.imageUrl}
                alt={winModalData.card.name}
                className="w-full h-full object-cover rounded-xl animate-pulse"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                  const fallback = (e.target as HTMLElement).nextElementSibling;
                  if (fallback) (fallback as HTMLElement).style.display = 'block';
                }}
              />
              <span className="text-5xl hidden pt-6">{winModalData.card.symbol}</span>
            </div>

            <div>
              <span className="text-[10px] font-mono uppercase tracking-widest text-amber-400 font-bold px-3 py-1 rounded-full bg-amber-400/10 border border-amber-400/30">
                10.0X PAYOUT UNLOCKED
              </span>
              <h3 className="text-2xl font-black text-white mt-3">
                #{winModalData.card.id} {winModalData.card.name} ({winModalData.card.hindi}) Won!
              </h3>
              <p className="text-3xl font-mono-numbers font-black text-amber-400 mt-2 drop-shadow-[0_0_15px_rgba(251,191,36,0.5)]">
                +₹{winModalData.winAmount.toLocaleString('en-IN')}
              </p>
            </div>

            <button
              onClick={() => setWinModalData(null)}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-black font-black text-sm uppercase tracking-wider shadow-lg pressable"
            >
              Claim & Continue
            </button>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          MODALS: 24/7 SUPPORT, RULES CENTER & RESPONSIBLE GAMING
         ════════════════════════════════════════════════════════════════════ */}
      {renderSupportModal()}
      {renderHelpRulesModal()}
      {renderResponsibleGamingModal()}
    </div>
  );
}

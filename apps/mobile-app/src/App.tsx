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
  Lock,
  Sparkles,
  Eye,
  EyeOff,
  KeyRound
} from 'lucide-react';
import { NativeUpiService, HapticFeedback } from './services/native-upi.js';
import { sound } from './services/sound.js';

// CONSTANTS & GAME DATA

export interface PictureCard {
  id: number;
  name: string;
  symbol: string;
  hindi: string;
  color: string;
  imageUrl: string;
}

export const PICTURE_CARDS: PictureCard[] = [
  { id: 1,  name: 'Goat',      symbol: '🐐', hindi: 'Bakri',    color: '#b45309', imageUrl: '/cards/card_1.jpg' },
  { id: 2,  name: 'Diya',      symbol: '🪔', hindi: 'Deepak',   color: '#f59e0b', imageUrl: '/cards/card_2.jpg' },
  { id: 3,  name: 'Rose',      symbol: '🌹', hindi: 'Gulab',    color: '#e11d48', imageUrl: '/cards/card_3.jpg' },
  { id: 4,  name: 'Sun',       symbol: '☀️', hindi: 'Suraj',    color: '#eab308', imageUrl: '/cards/card_4.jpg' },
  { id: 5,  name: 'Bucket',    symbol: '🪣', hindi: 'Balti',    color: '#0284c7', imageUrl: '/cards/card_5.jpg' },
  { id: 6,  name: 'Football',  symbol: '⚽', hindi: 'Football', color: '#334155', imageUrl: '/cards/card_6.jpg' },
  { id: 7,  name: 'Butterfly', symbol: '🦋', hindi: 'Titli',    color: '#06b6d4', imageUrl: '/cards/card_7.jpg' },
  { id: 8,  name: 'Rabbit',    symbol: '🐇', hindi: 'Khargosh', color: '#78716c', imageUrl: '/cards/card_8.jpg' },
  { id: 9,  name: 'Pigeon',    symbol: '🕊️', hindi: 'Kabootar', color: '#64748b', imageUrl: '/cards/card_9.jpg' },
  { id: 10, name: 'Kite',      symbol: '🪁', hindi: 'Patang',   color: '#ea580c', imageUrl: '/cards/card_10.jpg' },
  { id: 11, name: 'Dholak',    symbol: '🪘', hindi: 'Dholak',   color: '#92400e', imageUrl: '/cards/card_11.jpg' },
  { id: 12, name: 'Cow',       symbol: '🐄', hindi: 'Gai',      color: '#dc2626', imageUrl: '/cards/card_12.jpg' },
  { id: 13, name: 'Umbrella',  symbol: '☂️', hindi: 'Chhatri',  color: '#b91c1c', imageUrl: '/cards/card_13.jpg' },
  { id: 14, name: 'Lantern',   symbol: '🏮', hindi: 'Lalten',   color: '#d97706', imageUrl: '/cards/card_14.jpg' },
];

export function getCardHindi(card?: { id: number; name?: string; hindi?: string; hindiName?: string }): string {
  if (!card) return '';
  if (card.id === 13) return (card.hindi && card.hindi !== 'Saap' && card.hindi !== 'Snake') ? card.hindi : 'Chhatri';
  if (card.id === 14) return (card.hindi && card.hindi !== 'Nag' && card.hindi !== 'Dragon') ? card.hindi : 'Lalten';
  if (card.id === 12 && (card.hindi === 'Kamal' || card.name === 'Lotus')) return 'Gai';
  if (card.id === 8 && (card.hindi === 'Heera' || card.name === 'Diamond')) return 'Khargosh';
  if (card.id === 2 && (card.hindi === 'Bagh' || card.name === 'Tiger')) return 'Deepak';
  if (card.id === 1 && (card.hindi === 'Sher' || card.name === 'Lion')) return 'Bakri';
  return card.hindi || card.hindiName || card.name || `Card ${card.id}`;
}

export function getCardEnglish(card?: { id: number; name?: string }): string {
  if (!card) return '';
  if (card.id === 13 && (card.name === 'Snake' || card.name === 'Saap')) return 'Umbrella';
  if (card.id === 14 && (card.name === 'Dragon' || card.name === 'Nag')) return 'Lantern';
  if (card.id === 12 && (card.name === 'Lotus' || card.name === 'Kamal')) return 'Cow';
  if (card.id === 8 && (card.name === 'Diamond' || card.name === 'Heera')) return 'Rabbit';
  if (card.id === 2 && (card.name === 'Tiger' || card.name === 'Bagh')) return 'Diya';
  if (card.id === 1 && (card.name === 'Lion' || card.name === 'Sher')) return 'Goat';
  return card.name || `Card ${card.id}`;
}

export interface RoomTier {
  id: string;
  name: string;
  tierLabel: string;
  minEntry: number;
  interval: number;
  activePlayers: number;
  multiplier?: number;
  fixedStake?: boolean;
  hostessName?: string;
  hostessImageUrl?: string;
  hostessTagline?: string;
  cards?: PictureCard[];
}

export const ROOMS: RoomTier[] = [
  { id: 'room-tier-10',  name: 'Blitz Arena',  tierLabel: 'FAST 120s', minEntry: 10,  interval: 120, activePlayers: 0, cards: PICTURE_CARDS },
  { id: 'room-tier-50',  name: 'Classic Tier', tierLabel: 'PRO 180s',  minEntry: 50,  interval: 180, activePlayers: 0, cards: PICTURE_CARDS },
  { id: 'room-tier-100', name: 'High Roller',  tierLabel: 'VIP 240s',  minEntry: 100, interval: 240, activePlayers: 0, cards: PICTURE_CARDS },
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

// Centralized betting sound system imported from ./services/sound.js
let memoryAccessToken = '';

if (typeof window !== 'undefined') {
  const nativeFetch = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => nativeFetch(input, {
    ...init,
    credentials: init?.credentials ?? 'include'
  });
}

// MAIN APPLICATION COMPONENT

export default function MobileApp() {
  // Navigation & Auth (Phone + Password authentication scheme)
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [accountId, setAccountId] = useState('');
  const [forgotModalOpen, setForgotModalOpen] = useState(false);
  const [resetPhone, setResetPhone] = useState('');
  const [resetPassword, setResetPassword] = useState('');
  const [resetConfirmPassword, setResetConfirmPassword] = useState('');
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [activeTab, setActiveTab] = useState<NavTab>('lobby');
  const [walletReady, setWalletReady] = useState(false);
  const [hasPaidDeposit, setHasPaidDeposit] = useState(false);
  const [fundWizardOpen, setFundWizardOpen] = useState(false);
  const [offerDismissed, setOfferDismissed] = useState(false);

  // User Balance & Sound
  const [balance, setBalance] = useState<number>(0);
  const [lockedBalance, setLockedBalance] = useState<number>(0);
  const [balanceFlash, setBalanceFlash] = useState(false);
  const [soundOn, setSoundOn] = useState(() => sound.enabled);

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
  const [userName, setUserName] = useState('Player');
  const [userEmail, setUserEmail] = useState('');
  const [userState, setUserState] = useState('');

  // Auth Modes & Registration Form
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [regForm, setRegForm] = useState({
    fullName: '',
    phone: '',
    email: '',
    state: 'Maharashtra',
    password: '',
    confirmPassword: '',
    showPassword: false,
    payoutUpi: '',
    ageConfirmed: false
  });

  // Attached Payment Screenshot for Manual Verification
  const [paymentScreenshot, setPaymentScreenshot] = useState<string | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const placedBetsRef = useRef<Record<number, number>>({});
  placedBetsRef.current = placedBets;

  const backendHost = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
  const isCapacitorNative = typeof window !== 'undefined' && (
    Boolean((window as any).Capacitor?.isNativePlatform?.())
    || (window as any).Capacitor?.getPlatform?.() === 'android'
    || (window as any).Capacitor?.getPlatform?.() === 'ios'
    || window.location.protocol === 'capacitor:'
  );
  const isLocalHost = backendHost === 'localhost' || backendHost === '127.0.0.1' || backendHost.startsWith('192.168.');
  const isAppAllowed = true; // Fully enabled for mobile browser, PWA, and Capacitor native shell
  const API_BASE = import.meta.env.VITE_API_URL
    || (isCapacitorNative || !isLocalHost ? 'https://apex-arcade-api.onrender.com' : `http://${backendHost}:4000`);
  const demoLoginEnabled = import.meta.env.VITE_ENABLE_DEMO_LOGIN === 'true';

  useEffect(() => {
    fetch(`${API_BASE}/api/v1/auth/me`, { credentials: 'include' })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => {
        const user = data?.data?.user;
        const wallet = data?.data?.wallet;
        if (!data?.success || !user) return;
        if (wallet?.balance !== undefined) setBalance(Number(wallet.balance));
        if (wallet?.locked !== undefined) setLockedBalance(Number(wallet.locked));
        if (user.id) setAccountId(user.id);
        if (user.fullName) setUserName(user.fullName);
        if (user.phoneNumber) setPhoneNumber(user.phoneNumber);
        if (user.upiId) setWithdrawUpi(user.upiId);
        if (user.email) setUserEmail(user.email);
        if (user.state) setUserState(user.state);
        setIsLoggedIn(true);
        setWalletReady(true);
      })
      .catch(() => undefined);
  }, [API_BASE]);

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

  // Hydrate user session from local SQL database on app load
  useEffect(() => {
    const token = memoryAccessToken;
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

  // Direct Phone + Password Authentication Handlers (No OTP)
  const handleLoginSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanPhone = phoneNumber.replace(/\D/g, '').slice(-10);
    if (cleanPhone.length !== 10) {
      sound.playError();
      showToast('Please enter a valid 10-digit mobile number.');
      return;
    }
    if (!password || password.length < 6) {
      sound.playError();
      showToast('Please enter your password (minimum 6 characters).');
      return;
    }
    setIsSubmittingAuth(true);
    sound.playButtonClick();
    try {
      const res = await fetch(`${API_BASE}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: cleanPhone, password })
      });
      const data = await res.json();
      if (data.success && data.data) {
        sound.playSuccess();
        const { user, wallet, accessToken } = data.data;
        if (accessToken) memoryAccessToken = accessToken;
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
        showToast(`Welcome back, ${user?.fullName || 'Player'}!`);
      } else {
        sound.playError();
        showToast(data.error || 'Invalid mobile number or password.');
      }
    } catch {
      sound.playError();
      showToast('Could not reach the login server.');
    } finally {
      setIsSubmittingAuth(false);
    }
  };

  const handleRegisterSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!regForm.fullName.trim() || regForm.fullName.trim().length < 2) {
      sound.playError();
      showToast('Please enter your full legal name.');
      return;
    }
    const cleanPhone = regForm.phone.replace(/\D/g, '').slice(-10);
    if (cleanPhone.length !== 10) {
      sound.playError();
      showToast('Please enter a valid 10-digit mobile number.');
      return;
    }
    if (!regForm.state.trim()) {
      sound.playError();
      showToast('Please enter your state/jurisdiction.');
      return;
    }
    if (!regForm.password || regForm.password.length < 6) {
      sound.playError();
      showToast('Password must be at least 6 characters long.');
      return;
    }
    if (regForm.password !== regForm.confirmPassword) {
      sound.playError();
      showToast('Passwords do not match. Please re-enter.');
      return;
    }
    if (regForm.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(regForm.email.trim())) {
      sound.playError();
      showToast('Please enter a valid email, or leave it blank.');
      return;
    }
    if (!regForm.ageConfirmed) {
      sound.playError();
      showToast('You must confirm you are 18 years or older.');
      return;
    }
    setIsSubmittingAuth(true);
    sound.playButtonClick();
    try {
      const res = await fetch(`${API_BASE}/api/v1/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: regForm.fullName.trim(),
          phoneNumber: cleanPhone,
          state: regForm.state.trim(),
          email: regForm.email.trim() || undefined,
          payoutUpi: regForm.payoutUpi.trim() || undefined,
          password: regForm.password,
          ageConfirmed: regForm.ageConfirmed
        })
      });
      const data = await res.json();
      if (data.success && data.data) {
        sound.playSuccess();
        const { user, wallet, accessToken } = data.data;
        if (accessToken) memoryAccessToken = accessToken;
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
        showToast(`Registration complete! Welcome, ${user?.fullName || 'Player'}!`);
      } else {
        sound.playError();
        showToast(data.error || 'Registration failed.');
      }
    } catch (err: any) {
      sound.playError();
      showToast('Registration error: ' + (err.message || 'Server unreachable'));
    } finally {
      setIsSubmittingAuth(false);
    }
  };

  const handleResetPasswordSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanPhone = resetPhone.replace(/\D/g, '').slice(-10);
    if (cleanPhone.length !== 10) {
      sound.playError();
      showToast('Please enter a valid 10-digit mobile number.');
      return;
    }
    if (!resetPassword || resetPassword.length < 6) {
      sound.playError();
      showToast('New password must be at least 6 characters.');
      return;
    }
    if (resetPassword !== resetConfirmPassword) {
      sound.playError();
      showToast('Passwords do not match.');
      return;
    }
    setIsSubmittingAuth(true);
    sound.playButtonClick();
    try {
      const res = await fetch(`${API_BASE}/api/v1/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber: cleanPhone,
          newPassword: resetPassword
        })
      });
      const data = await res.json();
      if (data.success) {
        sound.playSuccess();
        showToast(data.message || 'Password reset! Please sign in.');
        setForgotModalOpen(false);
        setPhoneNumber(cleanPhone);
        setPassword(resetPassword);
        setResetPassword('');
        setResetConfirmPassword('');
      } else {
        sound.playError();
        showToast(data.error || 'Failed to reset password.');
      }
    } catch {
      sound.playError();
      showToast('Could not reach the server.');
    } finally {
      setIsSubmittingAuth(false);
    }
  };

  const handleShowcaseLoginClick = async () => {
    setIsSubmittingAuth(true);
    sound.playButtonClick();
    try {
      const res = await fetch(`${API_BASE}/api/v1/auth/demo-login`, { method: 'POST' });
      const data = await res.json();
      if (data.success && data.data) {
        sound.playSuccess();
        const { user, wallet, accessToken } = data.data;
        if (accessToken) memoryAccessToken = accessToken;
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
        setActiveTab('arena');
        setWalletReady(true);
        showToast(`Welcome! Demo account active with ₹${Number(wallet?.balance || 100000).toLocaleString('en-IN')}.`);
      } else {
        sound.playError();
        showToast(data.error || 'Demo login is not available.');
      }
    } catch {
      sound.playError();
      showToast('Could not reach the login server.');
    } finally {
      setIsSubmittingAuth(false);
    }
  };

  const handleLogout = () => {
    memoryAccessToken = '';
    fetch(`${API_BASE}/api/v1/auth/logout`, { method: 'POST', credentials: 'include' }).catch(() => undefined);
    setIsLoggedIn(false);
    setWalletReady(false);
    setHasPaidDeposit(false);
    setOfferDismissed(false);
    setActiveTab('lobby');
    setAuthMode('login');
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
    const token = memoryAccessToken;
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
    const token = memoryAccessToken;
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

  // TRUE REAL-TIME SOCKET.IO ENGINE SYNCHRONIZATION
  useEffect(() => {
    if (!isLoggedIn || activeTab !== 'arena') return;
    const socket = io(API_BASE, {
      transports: ['websocket', 'polling'],
      withCredentials: true,
      auth: { token: memoryAccessToken || '' }
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
        sound.playBetClosed();
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

        // Record in recent draws history (Last Winning Pictures)
        setRecentDraws(prev => [
          { roundNumber: data.roundNumber, cardId: winningId, timestamp: 'Just now' },
          ...prev.filter(p => p.roundNumber !== data.roundNumber).slice(0, 9)
        ]);

        if (userBet > 0) {
          const payout = userBet * (Number(data.multiplier) || arenaMultiplier);
          setBalanceFlash(true);
          setTimeout(() => setBalanceFlash(false), 800);
          sound.playBetWon();
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
          sound.playBetLost();
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
        } else {
          sound.playNotification();
        }

        setLastPlacedBets({ ...placedBetsRef.current });
        setTimeout(() => {
          setRoundStatus('BETTING');
          sound.playBetNow();
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
        const rooms: RoomTier[] = json.data.map((event: {
          id: string;
          name: string;
          stake: number;
          multiplier: number;
          intervalSec: number;
          fixedStake?: boolean;
          hostessName?: string;
          hostessImageUrl?: string;
          hostessTagline?: string;
          cards: PictureCard[];
        }) => ({
          id: event.id,
          name: event.name,
          tierLabel: event.fixedStake ? `${event.multiplier}×` : `${event.intervalSec}s`,
          minEntry: event.stake,
          intervalSec: event.intervalSec,
          activePlayers: 0,
          multiplier: event.multiplier,
          fixedStake: Boolean(event.fixedStake),
          hostessName: event.hostessName || 'Hostess Maya',
          hostessImageUrl: event.hostessImageUrl || '/hostess.jpg',
          hostessTagline: event.hostessTagline || 'Royal Hostess',
          cards: event.cards
        }));
        setEventRooms(rooms);
        setEventsReady(true);
        setSelectedRoom(prev => {
          const match = rooms.find(r => r.id === prev.id);
          return match ? { ...prev, ...match } : prev;
        });
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

  // Dynamic game history sync for arena & last winning draws
  useEffect(() => {
    let stop = false;
    const fetchHistory = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/v1/game/history/${selectedRoom.id}`);
        const json = await res.json();
        if (stop || !json?.success || !Array.isArray(json.data)) return;
        const mapped: GameDrawItem[] = json.data.map((r: any) => ({
          roundNumber: r.roundNumber,
          cardId: r.resultCard,
          timestamp: r.createdAt ? new Date(r.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recent'
        }));
        setRecentDraws(mapped);
      } catch {
        // silent fallback
      }
    };
    fetchHistory();
    const timer = setInterval(fetchHistory, 10000);
    return () => {
      stop = true;
      clearInterval(timer);
    };
  }, [selectedRoom.id, API_BASE]);

  // BETTING ACTIONS
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
    if (roundStatus !== 'BETTING' || secondsRemaining <= 10) {
      showToast('Bets close in the last 10 seconds.');
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

    sound.playCoin();
    socket.emit('place:bet', {
      roomId: selectedRoom.id,
      roundId,
      chosenCard: cardId,
      amount: stake
    }, (res: { success?: boolean; error?: string; newBalance?: number }) => {
      if (!res?.success) {
        sound.playError();
        showToast(res?.error || 'Bet was not accepted.');
        return;
      }
      sound.playBetPlaced();
      HapticFeedback.betPlaced();
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

  // DEPOSIT HANDLER (1-Click Auto + Manual P2P)
  const authHeaders = () => {
    const token = memoryAccessToken;
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    };
  };

  const handleExecuteInstantDeposit = async () => {
    if (!memoryAccessToken) {
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
    if (!memoryAccessToken) {
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

  // WITHDRAWAL HANDLER
  const handleExecuteWithdrawal = async () => {
    if (!memoryAccessToken) {
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

  // 24/7 CUSTOMER SUPPORT HANDLER
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

  // FORGOT / RESET PASSWORD MODAL
  const renderForgotPasswordModal = () => {
    if (!forgotModalOpen) return null;
    return (
      <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
        <div className="w-full max-w-sm bg-[#140f0a] border-2 border-amber-500/40 rounded-3xl p-5 space-y-4 shadow-2xl">
          <div className="flex justify-between items-center border-b border-amber-500/20 pb-3">
            <div className="flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-amber-400" />
              <h3 className="text-base font-black text-amber-100 font-serif">Reset Password</h3>
            </div>
            <button
              type="button"
              onClick={() => setForgotModalOpen(false)}
              className="w-7 h-7 rounded-full bg-[#221810] border border-amber-500/30 text-amber-200 flex items-center justify-center hover:text-white pressable"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleResetPasswordSubmit} className="space-y-3 text-xs">
            <div>
              <label className="text-[10px] uppercase tracking-wider text-amber-200/80 font-bold block mb-1">
                Registered Mobile (+91)
              </label>
              <input
                type="tel"
                inputMode="numeric"
                autoComplete="tel"
                maxLength={10}
                placeholder="10-digit number"
                value={resetPhone}
                onChange={e => setResetPhone(e.target.value.replace(/\D/g, ''))}
                className="w-full bg-[#18130e] border border-amber-500/30 rounded-xl px-3.5 py-2.5 text-base sm:text-xs text-amber-100 placeholder:text-amber-200/30 font-mono-numbers outline-none focus:border-amber-400"
              />
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-wider text-amber-200/80 font-bold block mb-1">
                New Password (min 6 chars)
              </label>
              <div className="flex items-center bg-[#18130e] border border-amber-500/30 rounded-xl px-3 py-2 focus-within:border-amber-400">
                <input
                  type={showResetPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="Enter new password"
                  value={resetPassword}
                  onChange={e => setResetPassword(e.target.value)}
                  className="bg-transparent text-amber-100 placeholder:text-amber-200/30 text-xs outline-none w-full"
                />
                <button
                  type="button"
                  onClick={() => setShowResetPassword(!showResetPassword)}
                  className="text-amber-400/80 hover:text-amber-300 p-0.5 ml-1"
                >
                  {showResetPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-wider text-amber-200/80 font-bold block mb-1">
                Confirm New Password
              </label>
              <input
                type={showResetPassword ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="Repeat new password"
                value={resetConfirmPassword}
                onChange={e => setResetConfirmPassword(e.target.value)}
                className="w-full bg-[#18130e] border border-amber-500/30 rounded-xl px-3 py-2 text-xs text-amber-100 placeholder:text-amber-200/30 outline-none focus:border-amber-400"
              />
            </div>

            <button
              type="submit"
              disabled={resetPhone.length !== 10 || resetPassword.length < 6 || resetPassword !== resetConfirmPassword || isSubmittingAuth}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 text-black font-black text-sm pressable disabled:opacity-40 disabled:cursor-not-allowed shadow-md shadow-amber-500/20 flex items-center justify-center gap-2 border border-amber-300"
            >
              {isSubmittingAuth ? (
                <>
                  <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  <span>Updating Password...</span>
                </>
              ) : (
                <span>Update Password</span>
              )}
            </button>
          </form>
        </div>
      </div>
    );
  };

  // AUXILIARY MODALS: SUPPORT, RULES & RESPONSIBLE GAMING
  const renderSupportModal = () => {
    if (!supportModalOpen) return null;
    return (
      <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in">
        <div className="w-full max-w-md bg-[#140f0a] border-2 border-amber-500/35 rounded-t-3xl sm:rounded-3xl flex flex-col h-[85vh] sm:h-[650px] overflow-hidden shadow-2xl shadow-black">
          {/* Header */}
          <div className="p-4 bg-[#1c150e] border-b border-amber-500/20 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-10 h-10 rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <Headphones className="w-5 h-5" />
                </div>
                <span className="w-3 h-3 rounded-full bg-emerald-400 border-2 border-[#1c150e] absolute -bottom-0.5 -right-0.5 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm text-amber-100 font-serif">Desk Guide & Support</h3>
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                    ONLINE
                  </span>
                </div>
                <p className="text-[11px] text-amber-200/60">Live assistance for deposits, rules & draws</p>
              </div>
            </div>
            <button
              onClick={() => setSupportModalOpen(false)}
              className="w-8 h-8 rounded-full bg-white/[0.06] hover:bg-white/[0.12] flex items-center justify-center text-amber-200/70 hover:text-white transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <p className="px-3 py-2 text-[11px] text-amber-200/60 border-b border-amber-500/15 bg-[#18130e]/60">
            This chat explains the desk and verifies transactions. It does not move money automatically.
          </p>

          {/* Quick Problem Selector Chips */}
          <div className="px-3 py-2 bg-[#18130e]/90 border-b border-amber-500/15 overflow-x-auto flex gap-1.5 no-scrollbar">
            {[
              'How do I deposit?',
              'How do withdrawals work?',
              'How do the 10× rules work?',
              'When is PAN required?'
            ].map(chip => (
              <button
                key={chip}
                onClick={() => handleSendSupportMessage(chip)}
                className="whitespace-nowrap px-2.5 py-1 rounded-full bg-[#221810] hover:bg-amber-500/20 hover:text-amber-100 hover:border-amber-400/40 border border-amber-500/25 text-[10px] text-amber-200/80 font-medium transition"
              >
                {chip}
              </button>
            ))}
          </div>

          {/* Chat Messages Thread */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3 font-sans text-xs bg-[#0e0b08]">
            {supportMessages.map(msg => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 leading-relaxed ${
                    msg.sender === 'user'
                      ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-black font-semibold rounded-br-none shadow-md shadow-amber-500/20'
                      : 'bg-[#1c150e] text-amber-100 border border-amber-500/25 rounded-bl-none'
                  }`}
                >
                  {msg.text}
                </div>
                <span className="text-[10px] text-amber-200/40 mt-1 px-1">{msg.time}</span>
              </div>
            ))}

            {isAgentTyping && (
              <div className="flex items-center gap-2 text-xs text-amber-200/80 bg-[#1c150e] border border-amber-500/25 rounded-2xl rounded-bl-none px-3.5 py-2 w-fit">
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-bounce" />
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-bounce [animation-delay:0.2s]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-bounce [animation-delay:0.4s]" />
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
            className="p-3 bg-[#1c150e] border-t border-amber-500/25 flex items-center gap-2"
          >
            <input
              type="text"
              value={supportInput}
              onChange={e => setSupportInput(e.target.value)}
              placeholder="Type message or paste 12-digit UTR..."
              className="flex-1 bg-[#140f0a] border border-amber-500/30 rounded-xl px-3.5 py-2.5 text-xs text-amber-100 placeholder:text-amber-200/40 outline-none focus:border-amber-400"
            />
            <button
              type="submit"
              disabled={!supportInput.trim()}
              className="w-10 h-10 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:brightness-110 text-black flex items-center justify-center font-bold disabled:opacity-40 disabled:cursor-not-allowed transition shadow-md shadow-amber-500/20 border border-amber-300"
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
        <div className="w-full max-w-md bg-[#140f0a] border-2 border-amber-500/35 rounded-t-3xl sm:rounded-3xl flex flex-col h-[88vh] sm:h-[680px] overflow-hidden shadow-2xl">
          {/* Header */}
          <div className="p-4 bg-[#1c150e] border-b border-amber-500/20 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <HelpCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-amber-100 font-serif">Help & Rules Center</h3>
                <p className="text-[11px] text-amber-200/60">Pappu Playing Pictures • 10.0× Winner Payout</p>
              </div>
            </div>
            <button
              onClick={() => setHelpRulesModalOpen(false)}
              className="w-8 h-8 rounded-full bg-white/[0.06] hover:bg-white/[0.12] flex items-center justify-center text-amber-200/70 hover:text-white transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Tabs */}
          <div className="grid grid-cols-4 bg-[#18130e] border-b border-amber-500/20 p-1 text-center text-xs font-semibold">
            {[
              { key: 'rules', label: 'Game Rules' },
              { key: 'payouts', label: '10× & Bank' },
              { key: 'fairness', label: 'Fairness' },
              { key: 'faq', label: 'FAQs' }
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveHelpTab(tab.key as any)}
                className={`py-2 rounded-lg transition ${
                  activeHelpTab === tab.key
                    ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-black font-bold shadow-md'
                    : 'text-amber-200/60 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Content Area */}
          <div className="flex-1 p-4 overflow-y-auto space-y-4 text-xs text-amber-100/90 bg-[#0e0b08]">
            {activeHelpTab === 'rules' && (
              <div className="space-y-4">
                <div className="p-3.5 rounded-2xl bg-gradient-to-r from-amber-500/15 via-[#251b12] to-[#1c150e] border border-amber-500/30">
                  <span className="text-[10px] font-mono font-bold text-amber-400 uppercase tracking-widest block mb-1">
                    ⭐ Core Gameplay Objective
                  </span>
                  <p className="text-amber-100 text-xs leading-relaxed">
                    Pick any of the <strong>12 picture cards</strong> (or bonus symbols). The winning card is sealed inside Hostess Maya's royal medallion before bets open. A winning stake pays <strong>10.0×</strong> instantly into your balance!
                  </p>
                </div>

                <div className="space-y-2.5">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-amber-300">
                    How to Play Step-by-Step:
                  </h4>
                  <div className="space-y-2">
                    <div className="p-2.5 rounded-xl bg-[#1c150e] border border-amber-500/20 flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 text-black font-black text-[11px] flex items-center justify-center shrink-0">1</span>
                      <p><strong className="text-amber-200">Choose Your Chips:</strong> Select chips ranging from ₹10 to ₹5,000 using the quick chip tray.</p>
                    </div>
                    <div className="p-2.5 rounded-xl bg-[#1c150e] border border-amber-500/20 flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 text-black font-black text-[11px] flex items-center justify-center shrink-0">2</span>
                      <p><strong className="text-amber-200">Tap Any Picture Card:</strong> Tap your lucky picture cards on the board (Goat, Diya, Rose, Sun, Bucket, Football, Butterfly, Rabbit, Pigeon, Kite, Dholak, Cow).</p>
                    </div>
                    <div className="p-2.5 rounded-xl bg-[#1c150e] border border-amber-500/20 flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 text-black font-black text-[11px] flex items-center justify-center shrink-0">3</span>
                      <p><strong className="text-amber-200">Draw Countdown:</strong> Bets close in the last 10 seconds. The royal countdown timer shows exact seconds left.</p>
                    </div>
                    <div className="p-2.5 rounded-xl bg-[#1c150e] border border-amber-500/20 flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 text-black font-black text-[11px] flex items-center justify-center shrink-0">4</span>
                      <p><strong className="text-amber-200">Instant 10× Settlement:</strong> The sealed card reveals under Hostess Maya. Winnings credit to your withdrawable wallet instantly!</p>
                    </div>
                  </div>
                </div>

                {/* 14 Picture Directory Preview */}
                <div className="pt-2">
                  <h4 className="text-amber-300 font-bold text-xs mb-2">Pappu Playing Pictures Gallery:</h4>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    {arenaCards.map(c => (
                      <div key={c.id} className="parchment-texture parchment-border p-2 rounded-xl flex items-center gap-2 shadow-sm">
                        <img src={c.imageUrl} alt={c.name} className="w-8 h-8 rounded-lg object-cover border border-[#8c6239]" />
                        <div>
                          <p className="font-black text-[#451a03] leading-tight">#{c.id} {c.name}</p>
                          <p className="text-[10px] text-[#78350f] font-semibold">{c.hindi} • {arenaMultiplier}.0x</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeHelpTab === 'payouts' && (
              <div className="space-y-4">
                <div className="p-3.5 rounded-2xl bg-[#1c150e] border border-amber-500/25 space-y-2">
                  <h4 className="font-bold text-amber-200 text-sm">10.0x Payout Multiplier Table</h4>
                  <table className="w-full text-left text-xs font-mono-numbers">
                    <thead>
                      <tr className="border-b border-amber-500/20 text-amber-200/60">
                        <th className="pb-1.5">Stake</th>
                        <th className="pb-1.5">Multiplier</th>
                        <th className="pb-1.5 text-right">Net Return</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-amber-500/10">
                      <tr><td className="py-1.5 font-bold text-amber-100">₹50</td><td className="py-1.5 text-amber-400">10.0x</td><td className="py-1.5 text-right font-black text-amber-300">₹500</td></tr>
                      <tr><td className="py-1.5 font-bold text-amber-100">₹100</td><td className="py-1.5 text-amber-400">10.0x</td><td className="py-1.5 text-right font-black text-amber-300">₹1,000</td></tr>
                      <tr><td className="py-1.5 font-bold text-amber-100">₹500</td><td className="py-1.5 text-amber-400">10.0x</td><td className="py-1.5 text-right font-black text-amber-300">₹5,000</td></tr>
                      <tr><td className="py-1.5 font-bold text-amber-100">₹2,000</td><td className="py-1.5 text-amber-400">10.0x</td><td className="py-1.5 text-right font-black text-amber-300">₹20,000</td></tr>
                      <tr><td className="py-1.5 font-bold text-amber-100">₹5,000</td><td className="py-1.5 text-amber-400">10.0x</td><td className="py-1.5 text-right font-black text-amber-300">₹50,000</td></tr>
                    </tbody>
                  </table>
                </div>

                <div className="p-3.5 rounded-2xl bg-[#1c150e] border border-amber-500/25 space-y-2">
                  <h4 className="font-bold text-amber-300 text-xs uppercase tracking-wider">Deposit & Withdrawal Banking Rules</h4>
                  <ul className="space-y-1.5 text-xs text-amber-200/80">
                    <li>• <strong>UPI deposit:</strong> Scan the published QR, then submit the 12-digit UTR. The wallet changes immediately after an agent matches it.</li>
                    <li>• <strong>Withdrawal:</strong> The amount is held safely until an agent pays your UPI handle and enters the 12-digit bank UTR.</li>
                    <li>• <strong>PAN:</strong> A withdrawal of ₹10,000 or more requires verification before payment dispatch.</li>
                  </ul>
                </div>
              </div>
            )}

            {activeHelpTab === 'fairness' && (
              <div className="space-y-4">
                <div className="p-3.5 rounded-2xl bg-amber-500/15 border border-amber-500/30 space-y-2">
                  <div className="flex items-center gap-2 text-amber-300 font-bold">
                    <ShieldCheck className="w-5 h-5 text-amber-400" />
                    <span>SHA-256 Cryptographic Provably Fair</span>
                  </div>
                  <p className="text-amber-100 text-xs leading-relaxed">
                    Every round draw outcome is generated using cryptographic random seeds with public SHA-256 hashes committed <em>before</em> bets begin. The outcome cannot be altered or tampered with by any party.
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-[#1c150e] border border-amber-500/25 space-y-2 font-mono text-[11px]">
                  <span className="text-amber-300 block text-[10px] uppercase font-bold">Fair Play Verification Formula:</span>
                  <div className="p-2.5 rounded-lg bg-black/60 text-amber-400 border border-amber-500/30 overflow-x-auto">
                    Outcome = HMAC_SHA256(ServerSeed, ClientSeed + RoundID) % 14 + 1
                  </div>
                  <p className="text-amber-200/70 text-[11px]">
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
                    a: 'After you submit the 12-digit UTR, the wallet credits once the desk confirms the bank reference.'
                  },
                  {
                    q: 'How long do withdrawals take?',
                    a: 'Withdrawals are processed directly by our 24/7 payout desk via IMPS/UPI fast rails.'
                  },
                  {
                    q: 'Can I bet on more than one picture in the same round?',
                    a: 'Yes! You can spread your stakes across any number of cards (e.g., ₹100 on Goat, ₹100 on Diya, ₹100 on Rose).'
                  },
                  {
                    q: 'What should I do if my deposit is delayed?',
                    a: 'Click on the 24/7 Support Desk icon in the top header, select "Deposit UTR Recon", and paste your 12-digit UTR. Our team will verify it immediately.'
                  }
                ].map((faq, idx) => (
                  <div key={idx} className="p-3 rounded-xl bg-[#1c150e] border border-amber-500/20 space-y-1">
                    <p className="font-bold text-amber-200 text-xs">Q: {faq.q}</p>
                    <p className="text-amber-200/70 text-[11px] leading-relaxed">A: {faq.a}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-3 bg-[#1c150e] border-t border-amber-500/20 flex items-center justify-between">
            <button
              onClick={() => {
                setHelpRulesModalOpen(false);
                setSupportModalOpen(true);
              }}
              className="text-xs text-amber-300 hover:text-amber-100 flex items-center gap-1.5 font-bold"
            >
              <Headphones className="w-3.5 h-3.5" /> Still have questions? Chat with Support
            </button>
            <button
              onClick={() => setHelpRulesModalOpen(false)}
              className="px-4 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/35 text-amber-200 font-bold text-xs"
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
        <div className="w-full max-w-md bg-[#140f0a] border-2 border-amber-500/35 rounded-t-3xl sm:rounded-3xl flex flex-col max-h-[85vh] overflow-hidden shadow-2xl">
          {/* Header */}
          <div className="p-4 bg-[#1c150e] border-b border-amber-500/20 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-amber-100 font-serif">Responsible Gaming & Limits</h3>
                <p className="text-[11px] text-amber-200/60">Safe, disciplined, and age-protected play</p>
              </div>
            </div>
            <button
              onClick={() => setResponsibleGamingOpen(false)}
              className="w-8 h-8 rounded-full bg-white/[0.06] hover:bg-white/[0.12] flex items-center justify-center text-amber-200/70 hover:text-white transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-4 overflow-y-auto space-y-4 text-xs text-amber-100/90 bg-[#0e0b08]">
            {/* 18+ Alert */}
            <div className="p-3.5 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-start gap-3">
              <span className="w-7 h-7 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 text-black font-black text-xs flex items-center justify-center shrink-0">18+</span>
              <div>
                <h4 className="font-bold text-amber-200 text-xs">Strict 18+ Age Restriction</h4>
                <p className="text-[11px] text-amber-200/70 mt-0.5">Participation is restricted to Indian adults aged 18 and over. Financial games involve risk; please play responsibly.</p>
              </div>
            </div>

            {/* Daily Stake Limit */}
            <div className="p-3.5 rounded-2xl bg-[#1c150e] border border-amber-500/25 space-y-2.5">
              <h4 className="font-bold text-amber-300 text-xs uppercase tracking-wider">Daily Bet Spending Cap</h4>
              <p className="text-[11px] text-amber-200/70">Limit your maximum daily betting spend to maintain healthy budget control.</p>
              <div className="grid grid-cols-4 gap-1.5">
                {[{ label: '₹1,000', value: 1000 }, { label: '₹5,000', value: 5000 }, { label: '₹20,000', value: 20000 }, { label: 'No Limit', value: -1 }].map((cap) => (
                  <button
                    key={cap.label}
                    onClick={() => setDailyCapChoice(cap.value)}
                    className={`py-2 rounded-xl text-xs font-bold font-mono-numbers pressable ${
                      dailyCapChoice === cap.value
                        ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-black shadow-md'
                        : 'bg-[#221810] text-amber-200/70 border border-amber-500/20 hover:text-white'
                    }`}
                  >
                    {cap.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Cooling-Off / Take a Break */}
            <div className="p-3.5 rounded-2xl bg-[#1c150e] border border-amber-500/25 space-y-2.5">
              <h4 className="font-bold text-amber-300 text-xs uppercase tracking-wider">Cooling-Off / Take a Break</h4>
              <p className="text-[11px] text-amber-200/70">Temporarily pause your betting access for self-discipline.</p>
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
                      breakDays === b.days
                        ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-black font-bold border-amber-300'
                        : 'bg-[#221810] hover:bg-white/[0.08] border-amber-500/20 text-amber-200/70'
                    }`}
                  >
                    <p className="font-bold text-white text-xs">{b.label}</p>
                    <p className="text-[10px] text-amber-200/50">{b.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Self-Exclusion & Help */}
            <div className="p-3.5 rounded-2xl bg-[#1c150e] border border-amber-500/25 space-y-2">
              <h4 className="font-bold text-amber-300 text-xs uppercase tracking-wider">Need Support or Self-Exclusion?</h4>
              <p className="text-[11px] text-amber-200/70">If you feel betting is negatively affecting you, contact our support team to request voluntary permanent account self-exclusion.</p>
              <button
                onClick={() => setBreakDays(365)}
                className={`w-full py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
                  breakDays === 365
                    ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-black'
                    : 'bg-[#221810] hover:bg-white/[0.12] text-amber-200 border border-amber-500/20'
                }`}
              >
                <Headphones className="w-3.5 h-3.5 text-amber-400" />
                Self-exclude for 365 days
              </button>
            </div>
          </div>

          <div className="p-3 bg-[#1c150e] border-t border-amber-500/20 flex justify-end">
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
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 text-black font-black text-xs border border-amber-300 shadow-md shadow-amber-500/20"
            >
              Close & Save
            </button>
          </div>
        </div>
      </div>
    );
  };

  if (typeof window !== 'undefined' && !isAppAllowed) {
    const landingUrl = 'https://apex-web-landing-o6u0.onrender.com';
    return (
      <div className="min-h-[100dvh] w-full bg-[#08090C] text-white flex flex-col items-center justify-center p-6 text-center">
        <div className="w-full max-w-sm bg-[#111319] border border-white/[0.08] rounded-3xl p-6 space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-[#00F59B]/10 border border-[#00F59B]/30 flex items-center justify-center text-[#00F59B] font-black text-xl mx-auto">
            {brand.shortName.slice(0, 2)}
          </div>
          <h1 className="text-2xl font-black text-white">{brand.appName} is App-Only</h1>
          <p className="text-xs text-[#94A3B8] leading-relaxed">
            Signed Android distribution remains unavailable until the independent release gate is complete.
          </p>
          <a
            href={landingUrl}
            className="w-full py-3.5 rounded-xl bg-[#00F59B] text-black font-black text-sm flex items-center justify-center gap-2 pressable"
          >
            Check App Release
          </a>
          <a
            href="https://apex-web-landing-o6u0.onrender.com"
            className="block text-xs text-[#94A3B8] hover:text-white pt-1"
          >
            Visit Website & Rules
          </a>
        </div>
      </div>
    );
  }

  // VIEW: AUTH SCREEN (If Logged Out)
  if (!isLoggedIn) {
    return (
      <div className="min-h-[100dvh] w-full overflow-y-auto bg-[#0c0a08] text-[#fdf6e7] flex flex-col justify-between px-4 sm:px-6 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1.25rem,env(safe-area-inset-bottom))] max-w-md mx-auto">
        <div className="pt-1 sm:pt-4">
          {/* Royal Hostess Header Card */}
          <div className="parchment-texture parchment-border p-3.5 rounded-2xl relative overflow-hidden shadow-xl mb-4 flex items-center gap-3">
            <div className="w-14 h-16 rounded-xl overflow-hidden border-2 border-[#8c6239] shrink-0 shadow-md">
              <img src="/hostess.jpg" alt="Hostess Maya" className="w-full h-full object-cover object-top" />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#8c6239] text-amber-100 text-[9px] font-black tracking-wider uppercase mb-1">
                ★ PAPPU PLAYING PICTURES
              </div>
              <h2 className="text-base font-black text-[#451a03] font-serif leading-tight">
                Pick A Lucky Card. Win 10×.
              </h2>
              <p className="text-[10px] text-[#6d4621] font-medium mt-0.5">
                Authentic Indian 14-picture arcade game.
              </p>
            </div>
          </div>

          {/* Auth Mode Switcher */}
          <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-[#18130e] border border-amber-500/25 mb-4">
            <button
              onClick={() => setAuthMode('login')}
              className={`py-2 rounded-lg text-xs font-black transition pressable ${
                authMode === 'login' ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-black shadow-md' : 'text-amber-200/60 hover:text-white'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => setAuthMode('register')}
              className={`py-2 rounded-lg text-xs font-black transition pressable ${
                authMode === 'register' ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-black shadow-md' : 'text-amber-200/60 hover:text-white'
              }`}
            >
              New Player Registration
            </button>
          </div>

          {authMode === 'login' ? (
            <form onSubmit={handleLoginSubmit} className="space-y-3.5">
              <div>
                <label className="text-xs uppercase tracking-wider text-amber-200/80 font-bold block mb-1.5">
                  Mobile Number
                </label>
                <div className="flex items-center bg-[#18130e] border border-amber-500/30 rounded-xl px-4 py-3 focus-within:border-amber-400">
                  <span className="text-amber-300 text-sm font-black mr-3 border-r border-amber-500/30 pr-3">+91</span>
                  <input
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel"
                    maxLength={10}
                    value={phoneNumber}
                    onChange={e => setPhoneNumber(e.target.value.replace(/\D/g, ''))}
                    placeholder="Enter 10-digit number"
                    className="bg-transparent text-amber-100 font-mono-numbers text-base outline-none w-full placeholder:text-amber-200/30 font-semibold"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-xs uppercase tracking-wider text-amber-200/80 font-bold">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setResetPhone(phoneNumber);
                      setForgotModalOpen(true);
                    }}
                    className="text-xs text-amber-400 hover:text-amber-300 font-semibold hover:underline"
                  >
                    Forgot Password?
                  </button>
                </div>
                <div className="flex items-center bg-[#18130e] border border-amber-500/30 rounded-xl px-4 py-3 focus-within:border-amber-400">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="bg-transparent text-amber-100 text-base outline-none w-full placeholder:text-amber-200/30 font-semibold"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-amber-400/80 hover:text-amber-300 p-1 shrink-0 ml-2 pressable"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={phoneNumber.length !== 10 || password.length < 6 || isSubmittingAuth}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 text-black font-black text-sm pressable disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 border border-amber-300 shadow-md shadow-amber-500/20"
              >
                {isSubmittingAuth ? (
                  <>
                    <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                    <span>Signing In...</span>
                  </>
                ) : (
                  <span>Sign In</span>
                )}
              </button>

              {demoLoginEnabled && (
                <div className="pt-2 space-y-2">
                  <div className="relative flex py-1 items-center">
                    <div className="flex-grow border-t border-white/[0.08]" />
                    <span className="flex-shrink mx-3 text-[10px] font-bold text-amber-400 uppercase tracking-widest font-mono-numbers">
                      ⚡ INSTANT TEST PLAY
                    </span>
                    <div className="flex-grow border-t border-white/[0.08]" />
                  </div>

                  <button
                    type="button"
                    id="demo-login-btn"
                    onClick={handleShowcaseLoginClick}
                    disabled={isSubmittingAuth}
                    className="w-full py-4 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 text-black font-black text-sm pressable shadow-lg shadow-amber-500/25 hover:brightness-110 transition-all flex items-center justify-center gap-2 border-2 border-amber-300"
                  >
                    <Zap className="w-4 h-4 fill-black text-black shrink-0" />
                    <span>Demo Login with ₹1,00,000</span>
                  </button>
                  <p className="text-[11px] text-center text-amber-200/70 font-medium leading-tight">
                    Instant access with ₹1,00,000 demo credits to play all picture rooms
                  </p>
                </div>
              )}
            </form>
          ) : (
            /* ── NEW PLAYER REGISTRATION ONBOARDING ── */
            <form onSubmit={handleRegisterSubmit} className="space-y-3 animate-slide-up text-xs">
              <div>
                <label className="text-[10px] uppercase tracking-wider text-amber-200/80 font-bold block mb-1">
                  Full Legal Name (as per Bank / Aadhaar) *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Aarav Sharma"
                  value={regForm.fullName}
                  onChange={e => setRegForm({ ...regForm, fullName: e.target.value })}
                  className="w-full bg-[#18130e] border border-amber-500/30 rounded-xl px-3.5 py-2.5 text-amber-100 placeholder:text-amber-200/30 outline-none focus:border-amber-400"
                />
              </div>

              <div className="grid grid-cols-1 xs:grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-amber-200/80 font-bold block mb-1">
                    Mobile (+91) *
                  </label>
                  <input
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel"
                    maxLength={10}
                    placeholder="9876543210"
                    value={regForm.phone}
                    onChange={e => setRegForm({ ...regForm, phone: e.target.value.replace(/\D/g, '') })}
                    className="w-full bg-[#18130e] border border-amber-500/30 rounded-xl px-3.5 py-2.5 text-base sm:text-xs text-amber-100 placeholder:text-amber-200/30 font-mono-numbers outline-none focus:border-amber-400"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-amber-200/80 font-bold block mb-1">
                    State / Region *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Maharashtra"
                    value={regForm.state}
                    onChange={e => setRegForm({ ...regForm, state: e.target.value })}
                    className="w-full bg-[#18130e] border border-amber-500/30 rounded-xl px-3.5 py-2.5 text-base sm:text-xs text-amber-100 placeholder:text-amber-200/30 outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 xs:grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-amber-200/80 font-bold block mb-1">
                    Password (min 6 chars) *
                  </label>
                  <div className="flex items-center bg-[#18130e] border border-amber-500/30 rounded-xl px-3 py-2 focus-within:border-amber-400">
                    <input
                      type={regForm.showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      placeholder="Create password"
                      value={regForm.password}
                      onChange={e => setRegForm({ ...regForm, password: e.target.value })}
                      className="bg-transparent text-amber-100 placeholder:text-amber-200/30 text-xs outline-none w-full"
                    />
                    <button
                      type="button"
                      onClick={() => setRegForm({ ...regForm, showPassword: !regForm.showPassword })}
                      className="text-amber-400/80 hover:text-amber-300 p-0.5 ml-1 pressable"
                    >
                      {regForm.showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] uppercase tracking-wider text-amber-200/80 font-bold block mb-1">
                    Confirm Password *
                  </label>
                  <input
                    type={regForm.showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="Repeat password"
                    value={regForm.confirmPassword}
                    onChange={e => setRegForm({ ...regForm, confirmPassword: e.target.value })}
                    className="w-full bg-[#18130e] border border-amber-500/30 rounded-xl px-3 py-2 text-xs text-amber-100 placeholder:text-amber-200/30 outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] uppercase tracking-wider text-amber-200/80 font-bold block mb-1">
                  Email Address (Optional)
                </label>
                <input
                  type="email"
                  placeholder="aarav@example.com"
                  value={regForm.email}
                  onChange={e => setRegForm({ ...regForm, email: e.target.value })}
                  className="w-full bg-[#18130e] border border-amber-500/30 rounded-xl px-3.5 py-2.5 text-amber-100 placeholder:text-amber-200/30 outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase tracking-wider text-amber-200/80 font-bold block mb-1">
                  Payout UPI ID (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. aarav@okhdfcbank"
                  value={regForm.payoutUpi}
                  onChange={e => setRegForm({ ...regForm, payoutUpi: e.target.value })}
                  className="w-full bg-[#18130e] border border-amber-500/30 rounded-xl px-3.5 py-2.5 text-amber-100 placeholder:text-amber-200/30 font-mono-numbers outline-none focus:border-amber-400"
                />
              </div>

              <div className="flex items-start gap-2 pt-1">
                <input
                  type="checkbox"
                  id="ageCheck"
                  checked={regForm.ageConfirmed}
                  onChange={e => setRegForm({ ...regForm, ageConfirmed: e.target.checked })}
                  className="mt-0.5 accent-amber-400 w-4 h-4 rounded"
                />
                <label htmlFor="ageCheck" className="text-[11px] text-amber-200/80 leading-tight">
                  I confirm that I am 18 years or older, legally eligible to participate, and agree to the Fair Play & Security terms.
                </label>
              </div>

              <button
                type="submit"
                disabled={
                  !regForm.fullName.trim() ||
                  regForm.phone.length !== 10 ||
                  !regForm.state.trim() ||
                  regForm.password.length < 6 ||
                  regForm.password !== regForm.confirmPassword ||
                  !regForm.ageConfirmed ||
                  isSubmittingAuth
                }
                className="w-full py-4 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 text-black font-black text-sm pressable disabled:opacity-40 disabled:cursor-not-allowed shadow-md shadow-amber-500/20 flex items-center justify-center gap-2 border border-amber-300"
              >
                {isSubmittingAuth ? (
                  <>
                    <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                    <span>Registering Player...</span>
                  </>
                ) : (
                  <span>Register & Play</span>
                )}
              </button>
            </form>
          )}
        </div>

        {/* Footer Guarantee & Help Desk */}
        <div className="pt-6 border-t border-amber-500/20 text-center space-y-3">
          <div className="flex items-center justify-center gap-3 text-xs">
            <button
              onClick={() => setHelpRulesModalOpen(true)}
              className="text-amber-200/70 hover:text-white flex items-center gap-1.5 transition"
            >
              <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
              Game Rules & FAQ
            </button>
            <span className="text-amber-500/30">•</span>
            <button
              onClick={() => setSupportModalOpen(true)}
              className="text-amber-400 hover:text-amber-200 font-semibold flex items-center gap-1.5 transition"
            >
              <Headphones className="w-3.5 h-3.5" />
              24/7 Live Support Desk
            </button>
          </div>
          <div className="flex items-center justify-center gap-2 text-[11px] text-amber-200/60">
            <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
            <span>18+ only. Manual UPI desk. No payment gateway.</span>
          </div>
        </div>

        {/* Support, Rules & Password Modals available on Login Screen */}
        {renderForgotPasswordModal()}
        {renderSupportModal()}
        {renderHelpRulesModal()}
      </div>
    );
  }

  // VIEW: MAIN APPLICATION SHELL
  return (
    <div className="min-h-[100dvh] w-full bg-[#0c0a08] text-[#fdf6e7] flex flex-col justify-between max-w-md mx-auto relative select-none pb-24">
      {/* ── TOP APP BAR ── */}
      <header className="sticky top-0 z-30 bg-[#140f0a]/95 backdrop-blur-md border-b border-amber-500/25 px-2.5 xs:px-3.5 sm:px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2.5 sm:pb-3 flex items-center justify-between shadow-md gap-2">
        {/* Brand */}
        <div className="flex items-center gap-2 min-w-0 shrink">
          <div className="w-8 h-8 rounded-lg bg-[#221810] border border-amber-500/40 flex items-center justify-center font-black text-amber-400 text-sm overflow-hidden shadow-inner shrink-0">
            {brand.logoUrl ? <img src={brand.logoUrl} alt="" className="w-full h-full object-cover" /> : brand.shortName.slice(0, 2)}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1">
              <span className="font-black text-xs sm:text-sm tracking-tight text-amber-100 font-serif truncate">{brand.shortName}</span>
              <span className="text-[9px] font-mono-numbers px-1 py-0.2 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 font-bold shrink-0">
                10X
              </span>
            </div>
            <p className="text-[9px] sm:text-[10px] text-amber-200/70 font-mono-numbers leading-none truncate">Round #{roundNumber}</p>
          </div>
        </div>

        {/* Balance & Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Balance Pill */}
          <div
            onClick={() => setActiveTab('profile')}
            className={`px-2.5 py-1.5 rounded-xl bg-[#1c150e] border border-amber-500/30 flex items-center gap-1.5 cursor-pointer pressable transition-colors ${
              balanceFlash ? 'border-amber-400 bg-amber-500/20 shadow-[0_0_12px_rgba(245,158,11,0.5)]' : ''
            }`}
          >
            <Wallet className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="font-mono-numbers font-bold text-xs text-amber-200 whitespace-nowrap">
              ₹{balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
          </div>

          {/* Deposit Trigger */}
          <button
            onClick={() => setDepositModalOpen(true)}
            className="w-8 h-8 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-black flex items-center justify-center font-black text-base pressable shadow-md shadow-amber-500/20 border border-amber-300 shrink-0"
            title="Add Cash"
          >
            +
          </button>

          {/* 24/7 Live Support Chat */}
          <button
            onClick={() => setSupportModalOpen(true)}
            className="w-8 h-8 rounded-xl bg-[#1c150e] border border-amber-500/30 text-amber-300 hover:text-white flex items-center justify-center pressable relative shadow-inner shrink-0"
            title="24/7 Live Support Desk"
          >
            <Headphones className="w-4 h-4 text-amber-400" />
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          </button>

          {/* Sound Toggle */}
          <button
            onClick={toggleSound}
            className="w-8 h-8 rounded-xl bg-[#1c150e] border border-amber-500/30 text-amber-300 hover:text-white flex items-center justify-center pressable shadow-inner shrink-0"
            title="Sound Effects"
          >
            {soundOn ? <Volume2 className="w-4 h-4 text-amber-400" /> : <VolumeX className="w-4 h-4 text-amber-200/50" />}
          </button>
        </div>
      </header>

      {/* ── TOAST NOTIFICATION ── */}
      {toastMessage && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 animate-slide-up w-[90%] max-w-sm">
          <div className="bg-[#221810] border border-amber-500/40 text-amber-100 px-4 py-2.5 rounded-xl shadow-2xl shadow-black/80 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_6px_#f59e0b]" />
              <span className="font-medium text-amber-100">{toastMessage}</span>
            </div>
            <button onClick={() => setToastMessage(null)} className="text-amber-200/60 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {activeTab === 'lobby' && (
        <main className="p-4 space-y-4 animate-fade-in">
          {/* Hero Royal Pappu Card */}
          <div className="parchment-texture parchment-border p-4 sm:p-5 rounded-2xl relative overflow-hidden shadow-xl">
            <div className="flex justify-between items-start mb-2">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl overflow-hidden border-2 border-[#8c6239] shrink-0 shadow-md">
                  <img src="/hostess.jpg" alt="Maya" className="w-full h-full object-cover" />
                </div>
                <div>
                  <span className="text-[10px] font-black text-[#8c6239] uppercase tracking-wider block font-serif">
                    Pappu Playing Pictures
                  </span>
                  <h2 className="text-2xl sm:text-3xl font-black font-mono-numbers text-[#451a03] tracking-tight">
                    10× <span className="text-sm font-bold text-[#78350f]">Instant Win</span>
                  </h2>
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-600/40 flex items-center justify-center text-amber-900 shadow-inner">
                <Trophy className="w-5 h-5 text-[#8c6239]" />
              </div>
            </div>
            <p className="text-xs text-[#5a3818] font-medium leading-relaxed mt-1">
              Provably fair 14-picture game sealed before bets. Instant 10.0× winner payout on every draw.
            </p>
          </div>

          {/* Room Selection */}
          <div>
            <div className="flex justify-between items-center mb-2.5">
              <h3 className="text-xs uppercase font-bold tracking-wider text-amber-300 font-mono-numbers">
                ★ Select Arena Room
              </h3>
              <span className="text-xs text-amber-200/60 font-mono-numbers">
                {roomList.length} live rooms
              </span>
            </div>

            <div className="space-y-2.5">
              {roomList.map(room => (
                <div
                  key={room.id}
                  onClick={() => openArena(room)}
                  className={`p-3.5 sm:p-4 rounded-xl transition-all cursor-pointer pressable flex items-center justify-between ${
                    selectedRoom.id === room.id
                      ? 'border-2 border-amber-400 bg-[#261d15] shadow-lg shadow-amber-500/20'
                      : 'border border-amber-500/25 bg-[#18130e] hover:border-amber-500/50 hover:bg-[#201811]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 text-black font-black text-sm flex items-center justify-center shadow-md border border-amber-300">
                      ₹{room.minEntry}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-amber-100 font-serif">{room.name}</h4>
                      <p className="text-xs text-amber-200/60 font-mono-numbers">
                        {room.fixedStake ? `₹${room.minEntry} bet • ${room.multiplier}× • ${room.interval}s` : `Entry from ₹${room.minEntry} • ${room.interval}s round`}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono-numbers px-2 py-1 rounded-md bg-[#241a12] text-amber-300 border border-amber-500/30 font-bold">
                      {room.tierLabel}
                    </span>
                    <ChevronRight className="w-4 h-4 text-amber-400" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[#18130e] border border-amber-500/25 text-xs text-amber-200/80">
            The winning card is sealed when the round starts. Recent results show on the arena after a round settles.
          </div>
        </main>
      )}

      {activeTab === 'arena' && (
        <main className="p-2 sm:p-3 pb-28 space-y-3 animate-fade-in max-w-lg mx-auto">
          {/* Top Indian Hostess Stage with Mughal Arch & Ambient Palace Glow */}
          <div className="relative rounded-3xl overflow-hidden border-2 border-amber-500/40 bg-gradient-to-b from-[#241a10] via-[#14100c] to-[#0d0a08] shadow-[0_10px_30px_rgba(0,0,0,0.8)]">
            {/* Ambient Gold Radial Glow */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(245,158,11,0.25),transparent_70%)] pointer-events-none" />

            {/* Hostess Header Bar */}
            <div className="relative z-10 px-3.5 pt-3 pb-1 flex items-center justify-between border-b border-amber-500/20 bg-black/40 backdrop-blur-sm">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#34d399]" />
                <div>
                  <div className="text-xs font-black text-amber-300 tracking-wide uppercase font-mono-numbers">
                    {selectedRoom.name}
                  </div>
                  <div className="text-[10px] text-amber-200/70 font-semibold">
                    {arenaMultiplier}× Payout Tier
                  </div>
                </div>
              </div>

              {/* Next Draw Countdown Medallion */}
              <div className="flex items-center gap-2 bg-gradient-to-r from-amber-950/80 to-amber-900/60 border border-amber-400/40 px-3 py-1 rounded-full shadow-inner">
                <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="text-[10px] font-bold text-amber-200/80 uppercase tracking-wider">Draw In:</span>
                <span className={`text-sm font-mono-numbers font-black ${
                  secondsRemaining <= 10 ? 'text-amber-300 animate-pulse' : 'text-white'
                }`}>
                  {`${String(Math.floor(Math.max(0, secondsRemaining) / 60)).padStart(2, '0')}:${String(Math.max(0, secondsRemaining) % 60).padStart(2, '0')}`}
                </span>
              </div>
            </div>

            {/* Hostess Portrait & Revealing Card Stage */}
            <div className="relative z-10 p-2.5 sm:p-3 flex flex-row items-stretch gap-2.5 sm:gap-3">
              {/* Hostess Portrait in Mughal Arch */}
              <div className="relative w-24 h-28 sm:w-28 sm:h-32 shrink-0 rounded-2xl overflow-hidden border-2 border-amber-400/60 shadow-[0_8px_20px_rgba(0,0,0,0.6)] bg-[#18110a]">
                <img
                  src={selectedRoom.hostessImageUrl || '/hostess.jpg'}
                  alt={selectedRoom.hostessName || 'Royal Hostess'}
                  className="w-full h-full object-cover object-top hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20 pointer-events-none" />
                <div className="absolute bottom-1 inset-x-0 text-center">
                  <span className="px-1.5 py-0.5 rounded-full bg-amber-500/90 text-black text-[8px] sm:text-[9px] font-black tracking-wide uppercase shadow truncate max-w-[90%] inline-block">
                    {selectedRoom.hostessName || 'Hostess Maya'}
                  </span>
                </div>
              </div>

              {/* Center Stage: Revealing Card / Active Sealed Card */}
              <div className="flex-1 min-w-0 relative parchment-texture parchment-border rounded-2xl p-2 flex flex-col items-center justify-center text-center shadow-lg overflow-hidden min-h-[112px]">
                {/* Filigree corner decorations */}
                <div className="absolute top-1 left-1 text-amber-900/50 text-[10px] select-none">❧</div>
                <div className="absolute top-1 right-1 text-amber-900/50 text-[10px] select-none">☙</div>
                <div className="absolute bottom-1 left-1 text-amber-900/50 text-[10px] select-none">❧</div>
                <div className="absolute bottom-1 right-1 text-amber-900/50 text-[10px] select-none">☙</div>

                {winningCard ? (
                  // Revealed Winner Card
                  <div className="relative flex flex-col items-center animate-slide-up w-full">
                    {/* Symbol Confirmed Banner */}
                    <div className="px-3 py-0.5 mb-1 rounded-full bg-gradient-to-r from-red-700 via-amber-600 to-red-700 text-amber-100 border border-amber-300/80 font-black text-[9px] sm:text-[10px] tracking-widest uppercase shadow-md animate-pulse">
                      ★ SYMBOL CONFIRMED ★
                    </div>
                    
                    <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden border-2 border-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.6)] bg-black/40">
                      <img
                        src={(PICTURE_CARDS.find(c => c.id === winningCard) || PICTURE_CARDS[0]).imageUrl}
                        alt="Winning Card"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute bottom-0 inset-x-0 bg-black/75 text-amber-300 text-[9px] sm:text-[10px] font-black py-0.5">
                        {getCardHindi(PICTURE_CARDS.find(c => c.id === winningCard) || PICTURE_CARDS[0])}
                      </div>
                    </div>

                    <div className="mt-1 flex items-center gap-1.5">
                      <span className="text-xs font-black text-amber-950 font-serif">
                        #{getCardEnglish(PICTURE_CARDS.find(c => c.id === winningCard) || PICTURE_CARDS[0])}
                      </span>
                      <span className="px-1.5 py-0.5 rounded text-[8px] sm:text-[9px] font-black bg-amber-600 text-white font-mono-numbers">
                        {arenaMultiplier}× Payout
                      </span>
                    </div>
                  </div>
                ) : (
                  // Sealed / Betting Round Active Card
                  <div className="relative flex flex-col items-center justify-center w-full py-0.5">
                    <div className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden border-2 border-amber-700/60 bg-[#9a764d] shadow-inner flex items-center justify-center group">
                      {/* Cloud / Mystery reveal layer */}
                      <div className="absolute inset-0 bg-gradient-to-br from-amber-200/40 via-amber-700/50 to-amber-950/70" />
                      <div className="absolute inset-0 flex items-center justify-center opacity-40 cloud-veil">
                        <span className="text-2xl sm:text-3xl select-none">☁️</span>
                      </div>
                      <div className="relative z-10 w-10 h-10 sm:w-11 sm:h-11 rounded-full border-2 border-amber-400/90 bg-amber-900/90 flex flex-col items-center justify-center shadow-lg">
                        <Lock className="w-3.5 h-3.5 text-amber-300" />
                        <span className="text-[6px] sm:text-[7px] font-black text-amber-200 tracking-tighter">SEALED</span>
                      </div>
                      {/* Multiplier Tag */}
                      <div className="absolute bottom-0.5 right-0.5 px-1 py-0.2 rounded-full multiplier-tag text-[7px] z-20">
                        25K
                      </div>
                    </div>

                    <div className="mt-1 text-center">
                      <div className="text-[10px] sm:text-[11px] font-black text-amber-950 uppercase tracking-tight">
                        {roundStatus === 'BETTING' ? '🎲 Card Sealed Before Bets' : '🔒 Bets Locked • Revealing'}
                      </div>
                      <div className="text-[8px] sm:text-[9px] font-semibold text-amber-900/80 font-mono-numbers">
                        Round #{roundNumber} • Provably Fair SHA-256
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 12 Classic Picture Cards Board (Pappu Playing Pictures Vintage Parchment Grid) */}
          <div className="parchment-texture parchment-border p-2.5 sm:p-3 rounded-2xl relative shadow-2xl">
            {/* Header: PAPPU Playing Pictures Ribbon */}
            <div className="flex items-center justify-between pb-2 mb-2 border-b-2 border-[#8c6239]/40">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="text-xs sm:text-sm font-black text-[#5a3818] tracking-wider uppercase font-serif">
                  PAPPU PLAYING PICTURES
                </span>
                <span className="text-[8px] sm:text-[9px] font-black px-1.5 sm:px-2 py-0.5 rounded-full bg-[#8c6239] text-amber-100 shadow">
                  12 CARDS
                </span>
              </div>
              <div className="text-[9px] sm:text-[10px] font-bold text-[#6d4621] font-mono-numbers">
                Tap to place ₹{selectedChip}
              </div>
            </div>

            {/* 4 Columns x 3 Rows Classic 12 Picture Cards Grid */}
            <div className="grid grid-cols-4 gap-1.5 xs:gap-2 sm:gap-2.5">
              {arenaCards.slice(0, 12).map((card) => {
                const userBet = placedBets[card.id] || 0;
                const isWinner = winningCard === card.id;

                // Authentic multipliers tags matching the reference screenshots
                const displayMultipliers: Record<number, string> = {
                  1: '25K',
                  2: '600X',
                  6: '1800X',
                  7: '1800X',
                  8: '1800X',
                  11: '2500X',
                  12: '25K'
                };
                const tag = displayMultipliers[card.id];

                return (
                  <div
                    key={card.id}
                    onClick={() => handlePlaceBet(card.id)}
                    className={`relative rounded-xl transition-all duration-200 cursor-pointer pressable overflow-hidden flex flex-col items-center justify-between p-1 sm:p-1.5 min-h-[105px] xs:min-h-[112px] sm:min-h-[120px] ${
                      isWinner
                        ? 'gold-shimmer-border scale-105 z-20 bg-amber-200/90'
                        : userBet > 0
                        ? 'border-2 border-amber-600 bg-amber-100 shadow-[0_4px_12px_rgba(180,83,9,0.35)]'
                        : 'border border-[#9b7247]/70 bg-[#f4e6c8] hover:border-amber-600 hover:bg-[#faeed6] shadow-sm'
                    }`}
                  >
                    {/* Card Header: Index, Hindi Name & Multiplier Tag */}
                    <div className="w-full flex items-center justify-between text-[8px] xs:text-[9px] font-bold text-[#6d4621] z-10 px-0.5 leading-none">
                      <div className="flex items-center gap-0.5 min-w-0 overflow-hidden">
                        <span className="font-mono-numbers text-amber-900 font-black shrink-0">#{card.id}</span>
                        <span className="font-serif text-[#451a03] font-black truncate">{getCardHindi(card)}</span>
                      </div>
                      <span className="shrink-0 px-1 py-0.2 rounded-full multiplier-tag text-[7px] xs:text-[8px] font-black leading-none shadow-xs">
                        {tag || '10×'}
                      </span>
                    </div>

                    {/* Card Illustration in Parchment Frame */}
                    <div className="relative w-full max-w-[56px] xs:max-w-[62px] sm:max-w-[68px] aspect-square my-0.5 rounded-lg overflow-hidden flex items-center justify-center bg-[#ecd3a5] border border-[#a87a4c]/50 shadow-inner group-hover:scale-105 transition-transform duration-300">
                      <img
                        src={card.imageUrl}
                        alt={getCardEnglish(card)}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                          const fallback = (e.target as HTMLElement).nextElementSibling;
                          if (fallback) (fallback as HTMLElement).style.display = 'block';
                        }}
                      />
                      <span className="text-xl hidden">{card.symbol}</span>
                      {userBet > 0 && (
                        <div className="absolute inset-x-0 bottom-0 py-0.5 bg-black/85 text-amber-300 font-mono-numbers font-black text-[8px] xs:text-[9px] text-center leading-none">
                          ₹{userBet}
                        </div>
                      )}
                    </div>

                    {/* Card English Name */}
                    <span className="text-[9px] xs:text-[10px] font-black text-[#3a200a] tracking-tight leading-none z-10 text-center truncate max-w-full">
                      {getCardEnglish(card)}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Extra Cards (Card 13 Umbrella, Card 14 Lantern) & Recent Draw Feed */}
            {arenaCards.length > 12 && (
              <div className="mt-2.5 pt-2 border-t border-[#8c6239]/30 space-y-2">
                {/* Bonus Symbols (Card 13: Chhatri, Card 14: Lalten) */}
                <div className="flex items-center justify-between gap-2 bg-[#fbf6ed]/90 rounded-xl p-2 border border-[#8c6239]/20 shadow-xs">
                  <span className="text-[10px] font-black text-[#6d4621] uppercase tracking-wider flex items-center gap-1 shrink-0">
                    <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                    Bonus:
                  </span>
                  <div className="grid grid-cols-2 gap-1.5 flex-1">
                    {arenaCards.slice(12, 14).map(card => {
                      const userBet = placedBets[card.id] || 0;
                      const isWinner = winningCard === card.id;
                      const cardHindi = getCardHindi(card);
                      const cardEnglish = getCardEnglish(card);
                      return (
                        <button
                          key={card.id}
                          type="button"
                          onClick={() => handlePlaceBet(card.id)}
                          className={`flex items-center justify-between px-2 py-1.5 rounded-lg border cursor-pointer pressable transition-all ${
                            isWinner
                              ? 'gold-shimmer-border bg-amber-200'
                              : userBet > 0
                              ? 'border-2 border-amber-600 bg-amber-100 shadow-sm'
                              : 'border-[#9b7247]/70 bg-[#f4e6c8] hover:bg-[#ecd9b5]'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 min-w-0">
                            <img src={card.imageUrl} alt={cardEnglish} className="w-5 h-5 rounded object-cover shadow-2xs shrink-0" />
                            <div className="text-left min-w-0">
                              <span className="text-[10px] font-black text-[#3a200a] block leading-tight truncate">#{card.id} {cardHindi}</span>
                              <span className="text-[8px] text-[#78350f] font-semibold block leading-tight truncate">{cardEnglish}</span>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            {userBet > 0 ? (
                              <span className="text-[8px] font-black bg-amber-600 text-white px-1.5 py-0.5 rounded-full font-mono-numbers">₹{userBet}</span>
                            ) : (
                              <span className="text-[8px] font-bold text-amber-900 bg-amber-300/70 px-1 py-0.5 rounded font-mono-numbers">10×</span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Last Winning Draws Bar */}
                {recentDraws.length > 0 && (
                  <div className="flex items-center gap-2 bg-[#fbf6ed]/70 rounded-xl px-2.5 py-1.5 border border-[#8c6239]/20">
                    <span className="text-[9px] font-black text-[#6d4621] uppercase tracking-wider flex items-center gap-1 shrink-0">
                      <Trophy className="w-3.5 h-3.5 text-amber-700" />
                      Recent:
                    </span>
                    <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar flex-1">
                      {recentDraws.slice(0, 5).map((draw, idx) => {
                        const c = arenaCards.find(x => x.id === draw.cardId) || PICTURE_CARDS.find(x => x.id === draw.cardId) || PICTURE_CARDS[0];
                        return (
                          <div
                            key={idx}
                            className="flex items-center gap-1 bg-[#ecd9b5] border border-[#8c6239]/50 px-2 py-0.5 rounded-md text-[9px] font-bold text-[#3a200a] whitespace-nowrap shrink-0 shadow-2xs"
                            title={`Round #${draw.roundNumber} winner`}
                          >
                            <img src={c.imageUrl} alt={getCardEnglish(c)} className="w-3.5 h-3.5 rounded object-cover shadow-2xs" />
                            <span>#{c.id} {getCardHindi(c)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>


          {/* Betting Chip Selector Bar */}
          <div className="p-3 rounded-2xl bg-[#1a140f] border border-amber-500/30 shadow-lg">
            <div className="flex justify-between items-center mb-2">
              <span className="text-[10px] uppercase tracking-wider text-amber-200/80 font-bold">
                Select Chip Denomination
              </span>
              <span className="text-[10px] text-amber-300 font-mono-numbers font-semibold">
                Max Bet: ₹5,000
              </span>
            </div>

            <div className="grid grid-cols-6 gap-1.5">
              {[10, 50, 100, 500, 1000, 5000].map(val => (
                <button
                  key={val}
                  onClick={() => {
                    setSelectedChip(val);
                    sound.playCoin();
                  }}
                  className={`py-2 rounded-xl text-xs font-mono-numbers font-black transition-all pressable ${
                    selectedChip === val
                      ? 'bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 text-black shadow-md shadow-amber-500/30 border border-amber-200 scale-105'
                      : 'bg-[#261d15] border border-amber-500/20 text-amber-200/70 hover:text-white'
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
              className="py-2.5 rounded-xl bg-[#1a140f] border border-amber-500/25 text-xs font-bold text-amber-200/70 hover:text-white pressable disabled:opacity-40"
            >
              Clear Bets
            </button>

            <button
              onClick={handleDoubleBets}
              disabled={roundStatus !== 'BETTING' || totalBetAmount === 0}
              className="py-2.5 rounded-xl bg-gradient-to-r from-amber-600/30 to-amber-700/20 border border-amber-400/60 text-xs font-black text-amber-300 pressable disabled:opacity-40"
            >
              2x Double
            </button>

            <button
              onClick={handleRepeatBets}
              disabled={roundStatus !== 'BETTING' || Object.keys(lastPlacedBets).length === 0}
              className="py-2.5 rounded-xl bg-[#1a140f] border border-amber-500/25 text-xs font-bold text-amber-100 pressable disabled:opacity-40"
            >
              Rebet Last
            </button>
          </div>

          {/* Live Bet Slip Summary Bar */}
          <div className="p-3.5 rounded-xl bg-gradient-to-r from-[#1c150e] via-[#221a12] to-[#1c150e] border border-amber-500/30 flex items-center justify-between shadow-md">
            <div>
              <span className="text-[10px] uppercase text-amber-200/70 block font-semibold">Current Staked</span>
              <span className="text-base font-mono-numbers font-black text-amber-300">
                ₹{totalBetAmount.toLocaleString('en-IN')}
              </span>
            </div>

            <div className="text-right">
              <span className="text-[10px] uppercase text-amber-400/80 block font-semibold">Max 10× Payout</span>
              <span className="text-base font-mono-numbers font-black text-amber-300">
                ₹{maxPotentialWin.toLocaleString('en-IN')}
              </span>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-[#140f0a] border border-amber-500/25 space-y-3 shadow-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                <div>
                  <h3 className="text-xs font-black text-amber-100 uppercase tracking-wider flex items-center gap-1.5 font-serif">
                    Live Players Bet Stream
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 font-mono-numbers font-bold border border-amber-500/30">
                      This round
                    </span>
                  </h3>
                  <p className="text-[10px] text-amber-200/60">
                    Real-time player bets placed across all 14 picture cards
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-mono-numbers font-bold text-amber-300 bg-[#221810] border border-amber-500/30 px-2 py-1 rounded-lg">
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
                        ? 'bg-amber-500/15 border-amber-500/40 shadow-sm'
                        : 'bg-[#1c150e] border-amber-500/20 hover:border-amber-500/40'
                    }`}
                  >
                    {/* User ID */}
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-[#221810] border border-amber-500/30 flex items-center justify-center text-xs font-mono-numbers text-amber-300 shrink-0">
                        <User className="w-4 h-4 text-amber-400" />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-mono-numbers font-bold text-amber-100 tracking-wide">
                            {item.userId}
                          </span>
                          {item.isSelf && (
                            <span className="text-[8px] font-black px-1.5 py-0.5 rounded bg-amber-400 text-black">
                              YOU
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-amber-200/50">
                          {item.timestamp}
                        </span>
                      </div>
                    </div>

                    {/* Picture Card and Money Amount */}
                    <div className="flex items-center gap-2.5">
                      {/* Picture Staked On */}
                      <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-black/60 border border-amber-500/30">
                        <img
                          src={card.imageUrl}
                          alt={card.name}
                          className="w-5 h-5 rounded object-cover"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                        <span className="text-xs font-bold text-amber-100 leading-none">
                          #{card.id} {card.name}
                        </span>
                        <span className="text-[11px] leading-none">{card.symbol}</span>
                      </div>

                      {/* Money Staked */}
                      <div className="text-right min-w-[70px]">
                        <span className="text-xs font-mono-numbers font-black text-amber-400">
                          ₹{item.amount.toLocaleString('en-IN')}
                        </span>
                        <span className="block text-[8px] font-mono text-amber-200/60 leading-none">
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

      {activeTab === 'activity' && (
        <main className="p-4 space-y-4 animate-fade-in">
          <div>
            <h2 className="text-xl font-black text-amber-100 font-serif">Ledger & Activity</h2>
            <p className="text-xs text-amber-200/60">Audit trail of all placed bets and transactions</p>
          </div>

          {/* Filter Pills */}
          <div className="grid grid-cols-4 gap-1.5 p-1 rounded-xl bg-[#140f0a] border border-amber-500/25">
            {(['ALL', 'BET', 'DEPOSIT', 'WITHDRAW'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActivityFilter(tab)}
                className={`py-1.5 rounded-lg text-xs font-bold transition-all pressable ${
                  activityFilter === tab
                    ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-black shadow-md font-black'
                    : 'text-amber-200/60 hover:text-white'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* History List */}
          <div className="space-y-2">
            {filteredActivity.length === 0 ? (
              <div className="py-12 text-center text-xs text-amber-200/50">
                No transactions recorded under this filter.
              </div>
            ) : (
              filteredActivity.map(item => (
                <div
                  key={item.id}
                  className="p-3.5 rounded-xl bg-[#18130e] border border-amber-500/20 flex items-center justify-between shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-[#221810] border border-amber-500/30 flex items-center justify-center">
                      {item.type === 'DEPOSIT' ? (
                        <ArrowDownLeft className="w-4 h-4 text-amber-400" />
                      ) : item.type === 'WITHDRAW' ? (
                        <ArrowUpRight className="w-4 h-4 text-amber-200/60" />
                      ) : (
                        <Trophy className={`w-4 h-4 ${item.status === 'WON' ? 'text-amber-400' : 'text-amber-200/50'}`} />
                      )}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-amber-100">{item.title}</h4>
                      <p className="text-[10px] text-amber-200/60 font-mono-numbers">
                        {item.timestamp} {item.reference ? `• Ref: ${item.reference}` : ''}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className={`text-sm font-mono-numbers font-bold ${
                      item.isPositive ? 'text-amber-300 font-black' : 'text-amber-100/90'
                    }`}>
                      {item.isPositive ? '+' : '-'}₹{item.amount.toLocaleString('en-IN')}
                    </span>
                    <span className="block text-[9px] font-mono uppercase text-amber-200/60">
                      {item.status}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </main>
      )}

      {activeTab === 'profile' && (
        <main className="p-4 space-y-4 animate-fade-in">
          {/* User Card */}
          <div className="p-5 rounded-2xl bg-[#18130e] border border-amber-500/25 flex items-center justify-between shadow-md">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-[#221810] border border-amber-500/35 flex items-center justify-center text-amber-400 font-black text-lg font-serif relative shadow-inner">
                AP
                {isVerifiedDepositor && (
                  <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-amber-400 text-black flex items-center justify-center text-[10px] font-black shadow">
                    ✓
                  </span>
                )}
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="text-sm font-black text-amber-100 font-mono-numbers">+91 {phoneNumber}</h3>
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                    {isVerifiedDepositor ? 'VERIFIED DEPOSITOR' : 'MEMBER'}
                  </span>
                </div>
                <p className="text-xs text-amber-200/60 font-mono-numbers">ID: {accountId || '—'}</p>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="w-9 h-9 rounded-xl bg-[#221810] border border-amber-500/25 text-amber-200/60 hover:text-white flex items-center justify-center pressable"
              aria-label="Log out"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>

          {/* Verified Depositor Perks Card */}
          <div className="p-4 rounded-xl border border-amber-500/25 bg-[#1c150e] flex items-center justify-between transition-all">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl border border-amber-500/30 bg-amber-500/15 text-amber-400 flex items-center justify-center">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-black text-amber-100 block">
                  {isVerifiedDepositor ? '✓ Official Verified Depositor' : 'Standard Player Tier'}
                </span>
                <p className="text-[10px] text-amber-200/60">
                  {isVerifiedDepositor
                    ? 'A deposit has been verified and matched by the desk'
                    : 'Make any deposit to unlock your permanent Verified badge'}
                </p>
              </div>
            </div>
            {!isVerifiedDepositor && (
              <button
                onClick={() => setDepositModalOpen(true)}
                className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 text-black font-bold text-[10px] shadow"
              >
                Deposit Now
              </button>
            )}
          </div>

          {/* Wallet Balance Hero Card */}
          <div className="p-5 rounded-2xl bg-[#18130e] border border-amber-500/30 shadow-lg">
            <span className="text-xs uppercase tracking-wider text-amber-200/70 font-bold block mb-1">
              Withdrawable Wallet Balance
            </span>
            <div className="text-3xl font-black font-mono-numbers text-amber-100">
              ₹{balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] text-amber-200/60 mb-4">
              {lockedBalance > 0
                ? `₹${lockedBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })} is held for a withdrawal the desk has not paid yet.`
                : 'All funds ready for play or instant UPI payout.'}
            </p>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={() => setDepositModalOpen(true)}
                className="py-3 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 text-black font-black text-xs pressable flex items-center justify-center gap-1.5 shadow-md shadow-amber-500/20 border border-amber-300"
              >
                <Zap className="w-3.5 h-3.5" />
                Add Cash
              </button>

              <button
                onClick={() => setWithdrawModalOpen(true)}
                className="py-3 rounded-xl bg-[#221810] border border-amber-500/30 text-amber-200 font-bold text-xs pressable flex items-center justify-center gap-1.5 hover:border-amber-400"
              >
                <ArrowUpRight className="w-3.5 h-3.5 text-amber-400" />
                Withdraw
              </button>
            </div>
          </div>

          {/* Lifetime Betting Stats */}
          <div className="p-4 rounded-xl bg-[#18130e] border border-amber-500/25">
            <h4 className="text-xs uppercase font-bold tracking-wider text-amber-300 mb-3">
              Performance Statistics
            </h4>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2.5 rounded-lg bg-[#221810] border border-amber-500/20">
                <span className="text-[10px] text-amber-200/60 block">Win Rate</span>
                <span className="text-sm font-mono-numbers font-black text-amber-300">{activityHistory.filter(a => a.type === 'BET').length ? `${Math.round((activityHistory.filter(a => a.type === 'BET' && a.status === 'WON').length / activityHistory.filter(a => a.type === 'BET').length) * 100)}%` : '—'}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-[#221810] border border-amber-500/20">
                <span className="text-[10px] text-amber-200/60 block">Total Bets</span>
                <span className="text-sm font-mono-numbers font-black text-amber-100">{activityHistory.filter(a => a.type === 'BET').length}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-[#221810] border border-amber-500/20">
                <span className="text-[10px] text-amber-200/60 block">Highest Win</span>
                <span className="text-sm font-mono-numbers font-black text-amber-300">₹{activityHistory.filter(a => a.status === 'WON').reduce((max, item) => Math.max(max, item.amount), 0).toLocaleString('en-IN')}</span>
              </div>
            </div>
          </div>

          {/* Linked Bank / UPI Account */}
          <div className="p-4 rounded-xl bg-[#18130e] border border-amber-500/25 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#221810] border border-amber-500/30 flex items-center justify-center text-amber-400">
                <Smartphone className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-amber-100 block">Primary UPI Handle</span>
                <span className="text-xs font-mono-numbers text-amber-200/70">{withdrawUpi || 'Not set'}</span>
              </div>
            </div>
            <span className="text-[10px] font-bold text-amber-300 px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 font-mono">
              {withdrawUpi ? 'ON FILE' : 'NONE'}
            </span>
          </div>

          <div className="p-4 rounded-xl bg-[#18130e] border border-amber-500/25 space-y-3">
            <h4 className="text-xs uppercase font-bold tracking-wider text-amber-300">
              Help, Support & Integrity
            </h4>

            <div className="space-y-1.5 text-xs">
              {/* 24/7 Live Support Chat */}
              <button
                onClick={() => setSupportModalOpen(true)}
                className="w-full p-3 rounded-xl bg-[#221810] border border-amber-500/20 hover:border-amber-400/40 flex items-center justify-between text-left pressable transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/15 text-amber-400 flex items-center justify-center">
                    <Headphones className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-amber-100 block">24/7 Live Customer Support</span>
                    <span className="text-[10px] text-amber-200/60">Live desk assistance for bank reconciliations</span>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 font-bold text-[9px] flex items-center gap-1 border border-amber-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  ONLINE
                </span>
              </button>

              {/* Game Rules & How to Play */}
              <button
                onClick={() => {
                  setActiveHelpTab('rules');
                  setHelpRulesModalOpen(true);
                }}
                className="w-full p-3 rounded-xl bg-[#221810] border border-amber-500/20 hover:border-amber-400/40 flex items-center justify-between text-left pressable transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/15 text-amber-400 flex items-center justify-center">
                    <HelpCircle className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-amber-100 block">How to Play & 14 Picture Rules</span>
                    <span className="text-[10px] text-amber-200/60">10.0x fixed multipliers, round timings & rules</span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-amber-400" />
              </button>

              {/* Provably Fair Cryptographic Fairness */}
              <button
                onClick={() => {
                  setActiveHelpTab('fairness');
                  setHelpRulesModalOpen(true);
                }}
                className="w-full p-3 rounded-xl bg-[#221810] border border-amber-500/20 hover:border-amber-400/40 flex items-center justify-between text-left pressable transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/15 text-amber-400 flex items-center justify-center">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-amber-100 block">Provably Fair SHA-256 Engine</span>
                    <span className="text-[10px] text-amber-200/60">Verify draw hashes & client seed transparency</span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-amber-400" />
              </button>

              {/* Responsible Gaming & Safety Limits */}
              <button
                onClick={() => setResponsibleGamingOpen(true)}
                className="w-full p-3 rounded-xl bg-[#221810] border border-amber-500/20 hover:border-amber-400/40 flex items-center justify-between text-left pressable transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/15 text-amber-400 flex items-center justify-center">
                    <Sliders className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-amber-100 block">Responsible Gaming & Limits</span>
                    <span className="text-[10px] text-amber-200/60">Daily stake caps, timeout & self-exclusion</span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-amber-400" />
              </button>
            </div>
          </div>

          {/* Direct VIP Channels (WhatsApp & Telegram) */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <button
              type="button"
              onClick={() => setSupportModalOpen(true)}
              className="p-3 rounded-xl bg-[#18130e] border border-amber-500/25 flex items-center gap-2.5 text-amber-100 pressable"
            >
              <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/30">
                <MessageCircle className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold block">Desk Guide</span>
                <span className="text-[9px] text-amber-200/60">How QR & UTR work</span>
              </div>
            </button>
          </div>
        </main>
      )}

      {/* ── FIXED BOTTOM NAVIGATION DOCK ── */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#140f0a]/95 backdrop-blur-md border-t border-amber-500/25 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] px-4 xs:px-6 max-w-md mx-auto flex items-center justify-between shadow-[0_-5px_20px_rgba(0,0,0,0.7)]">
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
              onClick={() => {
                sound.playButtonClick();
                if (item.id === 'arena') openArena();
                else setActiveTab(item.id as NavTab);
              }}
              className={`flex flex-col items-center justify-center min-w-[52px] min-h-[44px] py-1 pressable transition-all duration-200 ${
                isActive ? 'text-amber-400 drop-shadow-[0_0_8px_rgba(245,158,11,0.6)] scale-105' : 'text-amber-200/50 hover:text-amber-200'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-bold tracking-tight">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {needsDepositFirst && activeTab === 'lobby' && !fundWizardOpen && !depositModalOpen && !offerDismissed && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md"
          onClick={() => setOfferDismissed(true)}
        >
          <button
            type="button"
            aria-label="Close"
            onClick={() => setOfferDismissed(true)}
            className="absolute top-20 left-1/2 -translate-x-1/2 w-10 h-10 rounded-full bg-[#221810] border border-amber-500/30 text-amber-200 flex items-center justify-center pressable shadow-lg"
          >
            <X className="w-5 h-5" />
          </button>
          <div
            className="absolute bottom-4 left-4 right-4 mx-auto w-full max-w-sm bg-[#140f0a] border-2 border-amber-500/40 rounded-3xl p-5 space-y-3 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="text-[10px] font-black uppercase tracking-wider text-amber-400 font-serif">★ Royal Welcome Privilege</p>
            <h3 className="text-xl font-black text-amber-100 font-serif">50% Extra on Your First Deposit</h3>
            <p className="text-xs text-amber-200/70">Deposit first. After the desk matches your 12-digit UTR, the wallet receives that amount plus 50%. The arena opens once the money is in.</p>
            <button type="button" onClick={openDeposit} className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 text-black font-black text-sm border border-amber-300 shadow-md shadow-amber-500/20">
              Claim Bonus & Deposit
            </button>
          </div>
        </div>
      )}

      {fundWizardOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-end justify-center p-4" onClick={() => setFundWizardOpen(false)}>
          <button
            type="button"
            onClick={() => setFundWizardOpen(false)}
            aria-label="Close insufficient funds message"
            className="absolute top-20 left-1/2 -translate-x-1/2 w-10 h-10 rounded-full bg-[#221810] border border-amber-500/30 text-amber-200 flex items-center justify-center pressable shadow-lg"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="w-full max-w-sm bg-[#140f0a] border-2 border-amber-500/40 rounded-3xl p-5 space-y-3 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-lg font-black text-amber-100 font-serif">Picture Stakes Require Wallet Balance</h3>
            </div>
            <p className="text-xs text-amber-200/70">The selected card stake exceeds your current balance. Add funds to participate in this live round.</p>
            <button type="button" onClick={openDeposit} className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 text-black font-black text-sm border border-amber-300 shadow-md shadow-amber-500/20">
              Deposit Funds
            </button>
          </div>
        </div>
      )}

      {depositModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full max-w-sm bg-[#140f0a] border-2 border-amber-500/40 rounded-t-3xl sm:rounded-3xl p-5 space-y-4 animate-slide-up shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-amber-100 flex items-center gap-1.5 font-serif">
                  Deposit Funds <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">AFTER UTR</span>
                </h3>
                <p className="text-xs text-amber-200/60">Balance updates once the desk verifies your bank UTR</p>
              </div>
              <button
                onClick={() => setDepositModalOpen(false)}
                className="w-8 h-8 rounded-xl bg-[#221810] border border-amber-500/30 text-amber-200/70 hover:text-white flex items-center justify-center pressable"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Segmented Switcher */}
            <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-[#1c150e] border border-amber-500/25">
              <button
                onClick={() => setDepositTab('instant')}
                className={`py-2 rounded-lg text-xs font-bold transition-all pressable ${
                  depositTab === 'instant'
                    ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-black shadow-md font-black'
                    : 'text-amber-200/60 hover:text-white'
                }`}
              >
                Pay with UPI
              </button>
              <button
                onClick={() => setDepositTab('p2p')}
                className={`py-2 rounded-lg text-xs font-bold transition-all pressable ${
                  depositTab === 'p2p'
                    ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-black shadow-md font-black'
                    : 'text-amber-200/60 hover:text-white'
                }`}
              >
                Enter UTR
              </button>
            </div>

            {depositTab === 'instant' ? (
              <div className="space-y-3.5">
                <div>
                  <label className="text-[10px] uppercase font-bold text-amber-200/70 block mb-1.5">
                    Select Amount
                  </label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[200, 500, 1000, 2500].map(amt => (
                      <button
                        key={amt}
                        onClick={() => setDepositAmount(amt)}
                        className={`py-2.5 rounded-xl font-mono-numbers font-black text-xs pressable ${
                          depositAmount === amt
                            ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-black shadow-md border border-amber-300'
                            : 'bg-[#221810] border border-amber-500/25 text-amber-200 hover:border-amber-400'
                        }`}
                      >
                        ₹{amt}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-[#1c150e] border border-amber-500/20 flex items-center justify-between text-xs text-amber-200/70">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Pays the live QR. You enter the UTR next.</span>
                  </div>
                  <span className="text-amber-400 font-mono-numbers font-bold">Fast UTR Desk</span>
                </div>

                <button
                  disabled={isAutoPaying}
                  onClick={handleExecuteInstantDeposit}
                  className="w-full py-4 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 text-black font-black text-sm pressable flex items-center justify-center gap-2 border border-amber-300 shadow-md shadow-amber-500/20 disabled:opacity-50"
                >
                  {isAutoPaying ? (
                    <>
                      <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                      <span>Verifying Bank Settlement...</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4 fill-black" />
                      <span>Open UPI for ₹{depositAmount.toLocaleString('en-IN')}</span>
                    </>
                  )}
                </button>
              </div>
            ) : (
              <div className="space-y-3.5">
                <div className="p-3.5 rounded-xl bg-[#1c150e] border border-amber-500/25 flex flex-col items-center">
                  {/* Clean QR Display */}
                  <div className="w-32 h-32 bg-white p-2 rounded-xl mb-2 flex items-center justify-center shadow-lg border border-amber-500/30">
                    {activeUpiInfo.upiId ? (
                      <img
                        src={activeUpiInfo.qrImageUrl || `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=upi%3A%2F%2Fpay%3Fpa%3D${encodeURIComponent(activeUpiInfo.upiId)}%26pn%3D${encodeURIComponent(activeUpiInfo.holderName || 'Apex')}%26cu%3DINR`}
                        alt="UPI Payment QR"
                        className="w-full h-full object-contain rounded-lg"
                      />
                    ) : (
                      <p className="text-[11px] text-center text-slate-500 px-2">No QR published yet.</p>
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
                    className="w-full py-2 px-3 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-200 font-bold text-xs flex items-center justify-center gap-1.5 pressable border border-amber-500/30 mb-2"
                  >
                    <Download className="w-3.5 h-3.5 text-amber-400" />
                    <span>📥 Download QR to Gallery</span>
                  </button>

                  <div className="flex items-center gap-2 text-xs font-mono-numbers text-amber-100">
                    <span>{activeUpiInfo.upiId}</span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(activeUpiInfo.upiId);
                        showToast('Rotated UPI ID copied!');
                      }}
                      className="text-amber-400 text-xs font-bold hover:underline"
                    >
                      Copy
                    </button>
                  </div>
                  <span className="text-[10px] text-amber-200/60 mt-1">
                    {activeUpiInfo.holderName} • {activeUpiInfo.bankName}
                  </span>
                  <span className="mt-1 px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 text-[9px] font-mono border border-amber-500/30">
                    ⚡ Auto-Rotated Channel (Daily Bank Limits Monitored)
                  </span>
                </div>

                {/* Screenshot Upload for Payment Proof */}
                <div>
                  <label className="text-[10px] uppercase font-bold text-amber-200/70 block mb-1">
                    Payment Done Screenshot (Fast Verification)
                  </label>
                  {paymentScreenshot ? (
                    <div className="p-2 rounded-xl bg-[#1c150e] border border-amber-500/40 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <img src={paymentScreenshot} alt="Proof" className="w-8 h-8 rounded-lg object-cover border border-amber-500/30" />
                        <span className="text-xs text-amber-100 truncate max-w-[170px]">payment_receipt.jpg</span>
                      </div>
                      <button onClick={() => setPaymentScreenshot(null)} className="text-amber-200/60 hover:text-white p-1">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <label className="w-full py-2.5 px-3 rounded-xl bg-[#1c150e] border border-dashed border-amber-500/30 hover:border-amber-400 text-center flex items-center justify-center gap-2 cursor-pointer pressable">
                      <Upload className="w-3.5 h-3.5 text-amber-400" />
                      <span className="text-xs text-amber-200/70">Tap to upload payment screenshot</span>
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
                  <label className="text-[10px] uppercase font-bold text-amber-200/70 block mb-1">
                    12-Digit Bank UTR Reference
                  </label>
                  <input
                    type="text"
                    maxLength={12}
                    placeholder="e.g. 427189012345"
                    value={utrInput}
                    onChange={e => setUtrInput(e.target.value.replace(/\D/g, ''))}
                    className="w-full bg-[#1c150e] border border-amber-500/30 rounded-xl px-4 py-2.5 text-amber-100 placeholder:text-amber-200/30 font-mono-numbers text-sm outline-none focus:border-amber-400"
                  />
                </div>

                <button
                  onClick={handleExecuteManualUtrDeposit}
                  className="w-full py-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-black font-black text-sm pressable border border-amber-300 shadow-md shadow-amber-500/20"
                >
                  Submit UTR for Approval
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {withdrawModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full max-w-sm bg-[#140f0a] border-2 border-amber-500/40 rounded-t-3xl sm:rounded-3xl p-5 space-y-4 animate-slide-up shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-amber-100 font-serif">Request a UPI Payout</h3>
                <p className="text-xs text-amber-200/60">Amount is held safely until an agent processes the transfer</p>
              </div>
              <button
                onClick={() => setWithdrawModalOpen(false)}
                className="w-8 h-8 rounded-xl bg-[#221810] border border-amber-500/30 text-amber-200/70 hover:text-white flex items-center justify-center pressable"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Available Balance Box */}
            <div className="p-3 rounded-xl bg-[#1c150e] border border-amber-500/25 flex items-center justify-between text-xs">
              <span className="text-amber-200/70">Withdrawable Balance</span>
              <span className="font-mono-numbers font-black text-amber-300">
                ₹{balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>

            {/* Amount input */}
            <div>
              <label className="text-[10px] uppercase font-bold text-amber-200/70 block mb-1">
                Withdrawal Amount (₹)
              </label>
              <input
                type="number"
                value={withdrawAmount}
                onChange={e => setWithdrawAmount(Number(e.target.value))}
                className="w-full bg-[#1c150e] border border-amber-500/30 rounded-xl px-4 py-2.5 text-amber-100 font-mono-numbers text-lg font-bold outline-none focus:border-amber-400"
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
                      ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-black font-black border border-amber-300'
                      : 'bg-[#221810] text-amber-200/70 border border-amber-500/25 hover:text-white'
                  }`}
                >
                  ₹{amt}
                </button>
              ))}
            </div>

            {/* Destination UPI */}
            <div>
              <label className="text-[10px] uppercase font-bold text-amber-200/70 block mb-1">
                Destination UPI Handle
              </label>
              <input
                type="text"
                value={withdrawUpi}
                onChange={e => setWithdrawUpi(e.target.value)}
                placeholder="e.g. yourname@okhdfcbank"
                className="w-full bg-[#1c150e] border border-amber-500/30 rounded-xl px-4 py-2.5 text-amber-100 placeholder:text-amber-200/30 font-mono-numbers text-xs outline-none focus:border-amber-400"
              />
            </div>

            <button
              disabled={isProcessingWithdraw || withdrawAmount > balance}
              onClick={handleExecuteWithdrawal}
              className="w-full py-4 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 text-black font-black text-sm pressable flex items-center justify-center gap-2 border border-amber-300 shadow-md shadow-amber-500/20 disabled:opacity-50"
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
                #{winModalData.card.id} {getCardEnglish(winModalData.card)} ({getCardHindi(winModalData.card)}) Won!
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

      {renderSupportModal()}
      {renderHelpRulesModal()}
      {renderResponsibleGamingModal()}
    </div>
  );
}

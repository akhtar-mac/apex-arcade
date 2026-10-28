import React, { useState, useEffect } from 'react';
import EventsPage from './EventsPage';
import BrandPage from './BrandPage';
import {
  LayoutDashboard,
  Sliders,
  Users,
  Percent,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  TrendingUp,
  ShieldCheck,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownLeft,
  RefreshCw,
  Lock,
  Zap,
  Ban,
  Wallet,
  Settings,
  Bell,
  Eye,
  Check,
  X,
  CreditCard,
  QrCode,
  Smartphone,
  Plus,
  Globe
} from 'lucide-react';

// CONSTANTS & 14 PICTURE CARDS

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

export type AdminTab = 'overview' | 'profit-engine' | 'live-rounds' | 'risk-ops' | 'events' | 'website' | 'players' | 'payments' | 'upi-rotator' | 'settings';

export interface UserAccount {
  id: string;
  phone: string;
  balance: number;
  totalBets: number;
  isBanned: boolean;
  role?: string;
  isVerifiedDepositor?: boolean;
  registeredDate: string;
}

export interface PaymentRequest {
  id: string;
  type: 'DEPOSIT' | 'WITHDRAW';
  phone: string;
  amount: number;
  reference: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  timestamp: string;
}

export interface UpiAccountItem {
  id: string;
  upiId: string;
  holderName: string;
  bankName: string;
  dailyLimit: number;
  currentCollected: number;
  isActive: boolean;
  status: 'ACTIVE' | 'LIMIT_REACHED' | 'PAUSED';
  isCurrentlyServing: boolean;
  utilizationPercent: number;
  remainingCapacity: number;
}

// ADMIN CONTROL PANEL COMPONENT

export default function AdminApp() {
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [brand, setBrand] = useState({ appName: 'Apex Arcade', shortName: 'APEX', logoUrl: '' });

  // Live Game Round State
  const [currentRound, setCurrentRound] = useState(0);
  const [countdown, setCountdown] = useState(0);
  const [cardPools, setCardPools] = useState<Record<number, number>>({});

  // Player Management State (with Verified Badge support)
  const [players, setPlayers] = useState<UserAccount[]>([]);
  const [playerSearch, setPlayerSearch] = useState('');

  // Payment Settlement Queue State
  const [payments, setPayments] = useState<PaymentRequest[]>([]);

  // Multi-QR & UPI Daily Limit Rotation State
  const [upiList, setUpiList] = useState<UpiAccountItem[]>([]);

  // Modal to add new UPI QR
  const [newUpiModal, setNewUpiModal] = useState(false);
  const [newUpiId, setNewUpiId] = useState('');
  const [newHolderName, setNewHolderName] = useState('');
  const [newBankName, setNewBankName] = useState('');
  const [newDailyLimit, setNewDailyLimit] = useState(50000);
  const [newQrImage, setNewQrImage] = useState('');

  const backendHost = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
  const isLocalHost = backendHost === 'localhost' || backendHost === '127.0.0.1' || backendHost.startsWith('192.168.');
  const API_BASE = import.meta.env.VITE_API_URL
    || (!isLocalHost ? 'https://apex-arcade-api.onrender.com' : `http://${backendHost}:4000`);

  // Toast System
  const [adminToast, setAdminToast] = useState<string | null>(null);
  const [staffToken, setStaffToken] = useState('');
  const [loginPhone, setLoginPhone] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const showToast = (msg: string) => {
    setAdminToast(msg);
    setTimeout(() => setAdminToast(null), 3200);
  };

  useEffect(() => {
    fetch(`${API_BASE}/api/v1/auth/me`, { credentials: 'include' })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => {
        if (data?.success && data.data?.user?.role === 'ADMIN') setStaffToken('cookie-session');
      })
      .catch(() => undefined);
  }, [API_BASE]);

  // Emergency Kill Switches & Risk Ops State
  const [bettingFrozen, setBettingFrozen] = useState(false);
  const [payoutsHalted, setPayoutsHalted] = useState(false);
  const [riskMetrics, setRiskMetrics] = useState({
    roomId: 'room-tier-10',
    roundNumber: 0,
    secondsRemaining: 0,
    totalPool: 0,
    maxLiabilityExposure: 0,
    estimatedHouseProfit: 0,
    estimatedProfitMargin: 0,
    highestExposedCard: 0,
    openBetsCount: 0,
    activeCcu: 0,
    cardLiabilities: [] as { card: number; name: string; bets: number; payout: number; liabilityNet: number }[]
  });
  const [deskStats, setDeskStats] = useState({
    activePlayersCount: 0,
    totalRegisteredUsers: 0,
    totalUserEscrowBalance: 0,
    totalDeposits: 0,
    totalWithdrawals: 0,
    totalBetVolume: 0,
    totalPayouts: 0,
    houseMarginPercent: 0,
    pendingP2PDeposits: 0,
    flaggedWithdrawals: 0,
    systemHealth: 'ONLINE'
  });
  const [scaleProof, setScaleProof] = useState<{
    sockets: number;
    p95ConnectMs: number;
    bets: number;
    negativeBalances: number;
    measuredAt: string;
    note: string;
  } | null>(null);
  const [roundReports, setRoundReports] = useState<Array<{
    roundNumber: number;
    winningCard: number;
    winningCardName: string;
    winningCardSymbol: string;
    totalPool: number;
    totalPayout: number;
    adminProfit: number;
    marginPercent: number;
  }>>([]);

  useEffect(() => {
    if (!staffToken) return;
    const originalFetch = window.fetch.bind(window);
    window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      if (url.includes('/api/')) {
        const headers = new Headers(init?.headers || (typeof Request !== 'undefined' && input instanceof Request ? input.headers : undefined));
        if (staffToken !== 'cookie-session' && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${staffToken}`);
        return originalFetch(input, { ...init, headers, credentials: 'include' });
      }
      return originalFetch(input, init);
    };
    return () => {
      window.fetch = originalFetch;
    };
  }, [staffToken]);

  useEffect(() => {
    fetch(`${API_BASE}/api/v1/brand`).then(r => r.json()).then(json => {
      if (json?.data?.appName) setBrand(json.data);
    }).catch(() => undefined);
  }, [API_BASE]);

  // Fetch live UPI accounts from backend
  const fetchUpiAccounts = () => {
    fetch(`${API_BASE}/api/v1/payments/upi-accounts`)
      .then(r => r.json())
      .then(d => {
        const accounts = Array.isArray(d?.data) ? d.data : d?.data?.accounts;
        if (Array.isArray(accounts)) setUpiList(accounts);
      })
      .catch(() => {});
  };

  const fetchRiskOps = () => {
    fetch(`${API_BASE}/api/v1/admin/kill-switches`)
      .then(r => r.json())
      .then(d => {
        if (d?.data) {
          setBettingFrozen(!!d.data.bettingFrozen);
          setPayoutsHalted(!!d.data.payoutsHalted);
        }
      })
      .catch(() => {});

    fetch(`${API_BASE}/api/v1/admin/risk-metrics`)
      .then(r => r.json())
      .then(d => {
        if (d?.data) {
          setRiskMetrics(prev => ({ ...prev, ...d.data }));
          if (typeof d.data.roundNumber === 'number') setCurrentRound(d.data.roundNumber);
          if (typeof d.data.secondsRemaining === 'number') setCountdown(d.data.secondsRemaining);
          if (Array.isArray(d.data.cardLiabilities)) {
            const pools: Record<number, number> = {};
            for (const row of d.data.cardLiabilities) pools[row.card] = Number(row.bets || 0);
            setCardPools(pools);
          }
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    if (!staffToken) return;
    fetchUpiAccounts();
    fetchRiskOps();
    fetch(`${API_BASE}/api/v1/admin/stats`)
      .then(r => r.json())
      .then(d => { if (d?.data) setDeskStats(prev => ({ ...prev, ...d.data })); })
      .catch(() => {});
    fetch(`${API_BASE}/api/v1/admin/scale-proof`)
      .then(r => r.json())
      .then(d => { if (d?.data) setScaleProof(d.data); })
      .catch(() => {});
    fetch(`${API_BASE}/api/v1/admin/game-logs`)
      .then(r => r.json())
      .then(d => { if (Array.isArray(d?.data)) setRoundReports(d.data.slice(0, 12)); })
      .catch(() => {});
    fetch(`${API_BASE}/api/v1/admin/users`)
      .then(r => r.json())
      .then(d => {
        if (!Array.isArray(d?.data)) return;
        setPlayers(d.data.map((u: any) => ({
          id: u.id,
          phone: u.phoneNumber,
          balance: Number(u.balance || 0),
          totalBets: Number(u.totalBets || 0),
          isBanned: !!u.isBanned,
          role: u.role,
          isVerifiedDepositor: false,
          registeredDate: u.createdAt ? new Date(u.createdAt).toLocaleDateString('en-IN') : ''
        })));
      })
      .catch(() => {});
    Promise.all([
      fetch(`${API_BASE}/api/v1/admin/p2p-queue`).then(r => r.json()).catch(() => null),
      fetch(`${API_BASE}/api/v1/admin/withdrawals`).then(r => r.json()).catch(() => null)
    ]).then(([deposits, withdrawals]) => {
      const rows: PaymentRequest[] = [];
      if (deposits?.success && Array.isArray(deposits.data)) {
        for (const item of deposits.data) {
          rows.push({
            id: item.id,
            type: 'DEPOSIT',
            phone: item.userPhone || 'Unknown',
            amount: Number(item.amount),
            reference: item.utrNumber || '',
            status: 'PENDING',
            timestamp: item.createdAt ? new Date(item.createdAt).toLocaleString('en-IN') : ''
          });
        }
      }
      if (withdrawals?.success && Array.isArray(withdrawals.data)) {
        for (const item of withdrawals.data) {
          rows.push({
            id: item.id,
            type: 'WITHDRAW',
            phone: item.userPhone || 'Unknown',
            amount: Number(item.amount),
            reference: item.payoutDetails?.upiId || item.payoutUpi || '',
            status: 'PENDING',
            timestamp: item.createdAt ? new Date(item.createdAt).toLocaleString('en-IN') : ''
          });
        }
      }
      setPayments(rows);
    }).catch(() => {});
    const interval = setInterval(fetchRiskOps, 4000);
    return () => clearInterval(interval);
  }, [staffToken]);

  const handleToggleFreezeBetting = async () => {
    const nextVal = !bettingFrozen;
    try {
      const res = await fetch(`${API_BASE}/api/v1/admin/kill-switches/freeze-betting`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ freeze: nextVal })
      });
      if (!res.ok) {
        showToast('The betting pause was not saved.');
        return;
      }
      setBettingFrozen(nextVal);
      showToast(nextVal ? 'Betting is frozen across all rooms.' : 'Betting resumed across all rooms.');
    } catch {
      showToast('Could not reach the API.');
    }
  };

  const handleToggleHaltPayouts = async () => {
    const nextVal = !payoutsHalted;
    try {
      const res = await fetch(`${API_BASE}/api/v1/admin/kill-switches/halt-payouts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ halt: nextVal })
      });
      if (!res.ok) {
        showToast('The payout pause was not saved.');
        return;
      }
      setPayoutsHalted(nextVal);
      showToast(nextVal ? 'New payout requests are paused.' : 'Payout requests are open again. Payment is still manual.');
    } catch {
      showToast('Could not reach the API.');
    }
  };

  const handleForceRefund = async () => {
    if (!window.confirm(`Are you sure you want to FORCE REFUND all bets for Round #${currentRound}? All player stakes will be credited back immediately.`)) return;
    try {
      const res = await fetch(`${API_BASE}/api/v1/admin/kill-switches/force-refund-round`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId: 'room-tier-10', roundId: String(currentRound) })
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || data?.success === false) {
        showToast(data?.error || 'The round was not refunded.');
        return;
      }
      showToast(`Round #${currentRound} refund requested.`);
    } catch {
      showToast('Could not reach the API.');
    }
  };

  // UPI Rotator Actions
  const handleResetVolume = async (id: string) => {
    try {
      await fetch(`${API_BASE}/api/v1/payments/upi-accounts/${id}/reset`, { method: 'POST' });
      fetchUpiAccounts();
      showToast('Daily collected volume reset to ₹0.');
    } catch {
      showToast('Could not reset the daily volume.');
    }
  };

  const handleToggleUpi = async (id: string) => {
    try {
      await fetch(`${API_BASE}/api/v1/payments/upi-accounts/${id}/toggle`, { method: 'PUT' });
      fetchUpiAccounts();
      showToast('Account status updated.');
    } catch {
      showToast('Could not update the account status.');
    }
  };

  const handleAddNewUpiAccount = async () => {
    if (!newUpiId || !newHolderName) {
      showToast('Please enter UPI ID and Holder Name.');
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/v1/payments/upi-accounts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          upiId: newUpiId,
          holderName: newHolderName,
          bankName: newBankName || 'Bank',
          dailyLimit: newDailyLimit,
          qrImageUrl: newQrImage || undefined
        })
      });
      if (!res.ok) {
        showToast('The QR was not published.');
        return;
      }
      fetchUpiAccounts();
      setNewUpiModal(false);
      setNewUpiId('');
      setNewHolderName('');
      setNewQrImage('');
      showToast(`Published ${newUpiId}.`);
    } catch {
      showToast('Could not reach the API.');
    }
  };

  // Compute Total Stake & Liabilities
  const totalStakeInRound = Object.values(cardPools).reduce((a, b) => a + b, 0);

  // Filtered Players
  const filteredPlayers = players.filter(p => p.phone.includes(playerSearch));

  // Payment Queue Actions (Approving deposit verifies player!)
  const handleResolvePayment = async (id: string, status: 'APPROVED' | 'REJECTED') => {
    const payment = payments.find((item) => item.id === id);
    if (!payment) return;
    let body: Record<string, string> = {};
    if (payment.type === 'WITHDRAW' && status === 'APPROVED') {
      const payoutUtr = window.prompt('Enter the 12-digit UTR from the payout sent to the player:') || '';
      if (!/^\d{12}$/.test(payoutUtr)) {
        showToast('A valid 12-digit payout UTR is required.');
        return;
      }
      body = { payoutUtr };
    } else if (status === 'REJECTED') {
      const reason = window.prompt('Reason for rejection:') || 'Rejected by admin';
      body = { reason };
    }
    const queue = payment.type === 'WITHDRAW' ? 'withdrawals' : 'p2p-queue';
    const action = status === 'APPROVED' ? 'approve' : 'reject';
    try {
      const res = await fetch(`${API_BASE}/api/v1/admin/${queue}/${id}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || data?.success === false) {
        showToast(data?.error || 'The ledger action failed.');
        return;
      }
      setPayments((list) => list.filter((item) => item.id !== id));
      showToast(status === 'APPROVED' ? 'Ledger action completed.' : 'Payment rejected.');
    } catch {
      showToast('Could not reach the API. No ledger change was made.');
    }
  };

  // Aggregated Rotator Stats
  const totalRotatorLimit = upiList.reduce((acc, u) => acc + u.dailyLimit, 0);
  const totalRotatorCollected = upiList.reduce((acc, u) => acc + u.currentCollected, 0);
  const activeServingUpi = upiList.find(u => u.isCurrentlyServing) || upiList[0];

  const submitStaffLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoginError('');
    try {
      const res = await fetch(`${API_BASE}/api/v1/auth/staff-login`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: loginPhone, password: loginPassword })
      });
      const data = await res.json();
      if (!data.success || data.data?.user?.role !== 'ADMIN') {
        setLoginError(data.error || 'Admin login failed.');
        return;
      }
      setStaffToken(data.data.accessToken);
    } catch {
      setLoginError('Could not reach the API.');
    }
  };

  if (!staffToken) {
    return (
      <div className="min-h-screen bg-[#0c0a08] text-white flex items-center justify-center px-6">
        <form onSubmit={submitStaffLogin} className="w-full max-w-sm bg-[#140f0a] border border-amber-500/20 rounded-2xl p-6 space-y-4 shadow-2xl">
          <h1 className="text-lg font-black text-amber-400">Admin login</h1>
          <p className="text-xs text-[#94A3B8]">The desk is closed until an admin signs in.</p>
          <input value={loginPhone} onChange={e => setLoginPhone(e.target.value)} placeholder="Phone" className="w-full bg-[#0c0a08] border border-amber-500/20 rounded-lg px-3 py-2 text-sm text-white focus:border-amber-400 focus:outline-none" />
          <input type="password" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} placeholder="Password" className="w-full bg-[#0c0a08] border border-amber-500/20 rounded-lg px-3 py-2 text-sm text-white focus:border-amber-400 focus:outline-none" />
          {loginError && <p className="text-xs text-red-400">{loginError}</p>}
          <button type="submit" className="w-full bg-gradient-to-r from-amber-500 to-amber-600 text-black font-black rounded-lg py-2.5 shadow-md shadow-amber-500/20 hover:brightness-110 transition-all">Sign in</button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0c0a08] text-white flex flex-col antialiased select-none">
      {/* ── TOP HEADER ── */}
      <header className="sticky top-0 z-30 bg-[#140f0a]/95 backdrop-blur-md border-b border-amber-500/20 px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#1c150e] border border-amber-500/30 flex items-center justify-center font-black text-amber-400 text-sm overflow-hidden">
            {brand.logoUrl ? <img src={brand.logoUrl} alt="" className="w-full h-full object-cover" /> : brand.shortName.slice(0, 2)}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-black text-sm tracking-tight text-white">{brand.appName}</span>
              <span className="text-[10px] font-mono-numbers px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                DESK
              </span>
            </div>
            <p className="text-[10px] text-[#94A3B8]">Round #{currentRound} • {countdown}s left</p>
          </div>
        </div>

        {/* Status Indicators */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#18130e] border border-amber-500/20 text-xs">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-[#94A3B8]">Active Rotator:</span>
            <span className="font-mono-numbers text-amber-400 font-bold">{activeServingUpi?.upiId || 'Auto'}</span>
          </div>

          <button
            onClick={() => {
              fetchUpiAccounts();
              showToast('Dashboard & UPI Rotator reloaded');
            }}
            className="w-9 h-9 rounded-xl bg-[#18130e] border border-amber-500/20 text-[#94A3B8] hover:text-amber-400 flex items-center justify-center pressable transition-all"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* ── TOAST ALERT ── */}
      {adminToast && (
        <div className="fixed top-16 right-6 z-50 animate-slide-up">
          <div className="bg-[#18130e] border border-amber-500/40 text-white px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-2 text-xs">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            <span className="font-medium">{adminToast}</span>
          </div>
        </div>
      )}

      {/* ── MAIN LAYOUT WITH SIDEBAR & CONTENT ── */}
      <div className="flex-1 flex max-w-7xl w-full mx-auto p-4 sm:p-6 gap-6">
        {/* Navigation Sidebar */}
        <aside className="w-56 shrink-0 hidden md:flex flex-col justify-between">
          <nav className="space-y-1">
            {[
              { id: 'overview', label: 'Executive Overview', icon: LayoutDashboard },
              { id: 'risk-ops', label: 'Risk Ops & Kill Switches', icon: AlertTriangle },
              { id: 'profit-engine', label: 'Round report', icon: Sliders },
              { id: 'live-rounds', label: 'Live Arena Monitor', icon: Zap },
              { id: 'upi-rotator', label: 'Multi-QR & Limits', icon: QrCode },
              { id: 'events', label: 'Events', icon: Plus },
              { id: 'website', label: 'Website', icon: Globe },
              { id: 'players', label: 'Player Management', icon: Users },
              { id: 'payments', label: 'Settlement Queue', icon: CreditCard },
              { id: 'settings', label: 'System Limits', icon: Settings },
            ].map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as AdminTab)}
                  className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-xs font-bold text-left transition-all pressable ${
                    isActive
                      ? 'bg-[#18130e] text-amber-400 border border-amber-500/30 shadow-sm'
                      : 'text-[#94A3B8] hover:text-white hover:bg-[#18130e]/50'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Quick Stat Footer */}
          <div className="p-4 rounded-2xl bg-[#140f0a] border border-amber-500/20 text-xs">
            <span className="text-[10px] uppercase font-bold text-[#94A3B8] block mb-1">
              Active UPI Serving
            </span>
            <div className="flex items-center justify-between text-white font-mono-numbers">
              <span className="truncate max-w-[120px] text-amber-400 font-bold">{activeServingUpi?.upiId}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">ONLINE</span>
            </div>
            <div className="flex items-center justify-between text-white font-mono-numbers mt-1.5">
              <span>Next Draw:</span>
              <span className="text-amber-400 font-bold">{countdown}s</span>
            </div>
          </div>
        </aside>

        {/* Content Body */}
        <main className="flex-1 space-y-6">
          {/* Mobile Tab Switcher */}
          <div className="flex md:hidden overflow-x-auto pb-2 gap-1.5">
            {[
              { id: 'overview', label: 'Overview' },
              { id: 'risk-ops', label: 'Kill Switches' },
              { id: 'profit-engine', label: 'Round report' },
              { id: 'live-rounds', label: 'Live Arena' },
              { id: 'upi-rotator', label: 'QR Rotator' },
              { id: 'events', label: 'Events' },
              { id: 'website', label: 'Website' },
              { id: 'players', label: 'Players' },
              { id: 'payments', label: 'Payments' },
              { id: 'settings', label: 'Settings' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as AdminTab)}
                className={`px-3 py-2 rounded-xl text-xs font-bold shrink-0 pressable ${
                  activeTab === tab.id ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-black font-black' : 'bg-[#18130e] text-[#94A3B8]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Emergency System & Kill Switch Status Bar */}
              <div className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                bettingFrozen || payoutsHalted
                  ? 'bg-red-500/10 border-red-500/30 text-red-400'
                  : 'bg-[#140f0a] border-amber-500/20 text-[#94A3B8]'
              }`}>
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full shrink-0 ${
                    bettingFrozen || payoutsHalted ? 'bg-red-500 animate-pulse' : 'bg-emerald-400'
                  }`} />
                  <div>
                    <div className="text-xs font-bold text-white flex items-center gap-2">
                      <span>Desk status:</span>
                      <span className={bettingFrozen || payoutsHalted ? 'text-red-400' : 'text-emerald-400 font-bold'}>
                        {bettingFrozen ? 'BETTING FROZEN' : payoutsHalted ? 'NEW PAYOUTS PAUSED' : deskStats.systemHealth}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#94A3B8]">
                      One API process. Wallets are written in Postgres. Payouts stay manual.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => setActiveTab('risk-ops')}
                    className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs pressable flex items-center gap-1.5"
                  >
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                    <span>Risk Ops Center</span>
                  </button>
                  <button
                    onClick={handleToggleFreezeBetting}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black pressable ${
                      bettingFrozen
                        ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-black shadow-md'
                        : 'bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30'
                    }`}
                  >
                    {bettingFrozen ? 'Resume Betting' : 'Freeze Betting'}
                  </button>
                </div>
              </div>

              {/* 4 Metric Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-5 rounded-2xl bg-[#140f0a] border border-amber-500/20 shadow-md">
                  <span className="text-[10px] uppercase tracking-wider text-[#94A3B8] font-bold block mb-1">
                    Bet volume
                  </span>
                  <div className="text-2xl font-black font-mono-numbers text-white">
                    ₹{deskStats.totalBetVolume.toLocaleString('en-IN')}
                  </div>
                  <span className="text-[10px] text-[#94A3B8] font-mono-numbers mt-1 block">
                    Paid out ₹{deskStats.totalPayouts.toLocaleString('en-IN')}
                  </span>
                </div>

                <div className="p-5 rounded-2xl bg-[#140f0a] border border-amber-500/20 shadow-md">
                  <span className="text-[10px] uppercase tracking-wider text-[#94A3B8] font-bold block mb-1">
                    Total payouts
                  </span>
                  <div className="text-2xl font-black font-mono-numbers text-amber-400">
                    ₹{deskStats.totalPayouts.toLocaleString('en-IN')}
                  </div>
                  <span className="text-[10px] text-[#94A3B8] font-mono-numbers mt-1 block">
                    Settled winnings
                  </span>
                </div>

                <div className="p-5 rounded-2xl bg-[#140f0a] border border-amber-500/20 shadow-md">
                  <span className="text-[10px] uppercase tracking-wider text-[#94A3B8] font-bold block mb-1">
                    Connected players
                  </span>
                  <div className="text-2xl font-black font-mono-numbers text-white">
                    {deskStats.activePlayersCount}
                  </div>
                  <span className="text-[10px] text-[#94A3B8] font-mono-numbers mt-1 block">
                    {deskStats.totalRegisteredUsers} accounts
                  </span>
                </div>

                <div className="p-5 rounded-2xl bg-[#140f0a] border border-amber-500/20 shadow-md">
                  <span className="text-[10px] uppercase tracking-wider text-[#94A3B8] font-bold block mb-1">
                    Published QRs
                  </span>
                  <div className="text-2xl font-black font-mono-numbers text-amber-400">
                    {upiList.filter(u => u.isActive).length}
                  </div>
                  <span className="text-[10px] text-[#94A3B8] font-mono-numbers mt-1 block">
                    {deskStats.pendingP2PDeposits} deposits waiting
                  </span>
                </div>
              </div>

              <div className="p-6 rounded-2xl bg-[#140f0a] border border-amber-500/20 space-y-2">
                <h3 className="text-base font-black text-white">Last measurement on this machine</h3>
                {scaleProof ? (
                  <p className="text-sm text-[#94A3B8]">
                    {scaleProof.sockets} sockets, connect p95 {scaleProof.p95ConnectMs} ms, {scaleProof.bets} real bets, {scaleProof.negativeBalances} negative balances.
                    {' '}{scaleProof.note}
                  </p>
                ) : (
                  <p className="text-sm text-[#94A3B8]">No socket measurement has been recorded yet.</p>
                )}
              </div>

              {/* Round Integrity Card */}
              <div className="p-6 rounded-2xl bg-[#140f0a] border border-amber-500/20 space-y-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-base font-black text-white">Round integrity</h3>
                    <p className="text-xs text-[#94A3B8]">The winning card is sealed when the round starts. The desk does not pick the card.</p>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs font-bold font-mono-numbers">
                    SEALED DRAW
                  </span>
                </div>
              </div>

              {/* Completed Game Rounds Table */}
              <div className="p-6 rounded-2xl bg-[#140f0a] border border-amber-500/20">
                <h3 className="text-base font-black text-white mb-4">Completed Game Rounds</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="border-b border-amber-500/20 text-[#94A3B8] font-bold">
                        <th className="py-2.5">Round #</th>
                        <th className="py-2.5">Winning Card</th>
                        <th className="py-2.5">Total Pool</th>
                        <th className="py-2.5">Payout (10x)</th>
                        <th className="py-2.5">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.04] font-mono-numbers">
                      {roundReports.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-6 text-[#94A3B8]">No settled rounds yet.</td>
                        </tr>
                      ) : roundReports.map(row => (
                        <tr key={row.roundNumber}>
                          <td className="py-3 text-white font-bold">#{row.roundNumber}</td>
                          <td className="py-3 text-amber-400 font-bold">#{row.winningCard} {row.winningCardName} {row.winningCardSymbol}</td>
                          <td className="py-3 text-white">₹{Number(row.totalPool || 0).toLocaleString('en-IN')}</td>
                          <td className="py-3 text-white">₹{Number(row.totalPayout || 0).toLocaleString('en-IN')}</td>
                          <td className="py-3 text-[#94A3B8]">Sealed at start</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'risk-ops' && (
            <div className="space-y-6">
              {/* Header Banner */}
              <div className="p-6 rounded-2xl bg-[#140f0a] border border-amber-500/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2.5 py-0.5 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 font-bold text-[10px] uppercase tracking-wider">
                      SUPER ADMIN CONTROLS
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 font-bold text-[10px]">
                      ONE API PROCESS
                    </span>
                  </div>
                  <h3 className="text-xl font-black text-white">Emergency Risk Ops & Kill Switches</h3>
                  <p className="text-xs text-[#94A3B8]">
                    Real-time liability exposure mitigation, Redis sub-millisecond bet freezing, and disaster recovery.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={fetchRiskOps}
                    className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold text-xs pressable flex items-center gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Sync Metrics</span>
                  </button>
                  <button
                    onClick={handleForceRefund}
                    className="px-4 py-2 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 font-bold text-xs pressable flex items-center gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Force Round Refund</span>
                  </button>
                </div>
              </div>

              {/* The Two Master Emergency Kill Switches */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Kill Switch 1: Freeze Betting */}
                <div className={`p-6 rounded-2xl border transition-all ${
                  bettingFrozen
                    ? 'bg-red-500/10 border-red-500/40 shadow-lg shadow-red-500/10'
                    : 'bg-[#140f0a] border-amber-500/20'
                }`}>
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        bettingFrozen ? 'bg-red-500 text-white animate-pulse' : 'bg-[#1c150e] text-[#94A3B8]'
                      }`}>
                        <Ban className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-base font-black text-white">Kill Switch #1: Freeze All Betting</h4>
                        <span className="text-[10px] uppercase font-bold tracking-wider text-[#94A3B8]">
                          Engine Status:{' '}
                          <span className={bettingFrozen ? 'text-red-400 font-black' : 'text-emerald-400 font-bold'}>
                            {bettingFrozen ? '🚨 FROZEN (HTTP 423 REJECTION)' : '🟢 ACTIVE (ACCEPTING BETS)'}
                          </span>
                        </span>
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-[#94A3B8] mb-6 leading-relaxed">
                    Instantly blocks incoming bets across all 14 cards within &lt;0.5ms at the Redis layer. WebSockets and REST reject new stakes immediately before database writes.
                  </p>
                  <button
                    onClick={handleToggleFreezeBetting}
                    className={`w-full py-3.5 rounded-xl font-black text-xs pressable flex items-center justify-center gap-2 transition-all ${
                      bettingFrozen
                        ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-black shadow-lg shadow-amber-500/20'
                        : 'bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-600/30'
                    }`}
                  >
                    <Ban className="w-4 h-4" />
                    <span>{bettingFrozen ? 'RESUME BETTING INGESTION' : 'EMERGENCY: FREEZE ALL BETTING NOW'}</span>
                  </button>
                </div>

                {/* Kill Switch 2: Halt Automated Payouts */}
                <div className={`p-6 rounded-2xl border transition-all ${
                  payoutsHalted
                    ? 'bg-amber-500/10 border-amber-500/40 shadow-lg shadow-amber-500/10'
                    : 'bg-[#140f0a] border-amber-500/20'
                }`}>
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        payoutsHalted ? 'bg-amber-500 text-black animate-pulse' : 'bg-[#1c150e] text-[#94A3B8]'
                      }`}>
                        <Lock className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-base font-black text-white">Pause new payout requests</h4>
                        <span className="text-[10px] uppercase font-bold tracking-wider text-[#94A3B8]">
                          Payouts are already manual.{' '}
                          <span className={payoutsHalted ? 'text-amber-400 font-black' : 'text-emerald-400 font-bold'}>
                            {payoutsHalted ? 'NEW REQUESTS PAUSED' : 'REQUESTS OPEN'}
                          </span>
                        </span>
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-[#94A3B8] mb-6 leading-relaxed">
                    This only pauses new withdrawal requests. Money still leaves the desk when an agent types a 12-digit UTR.
                  </p>
                  <button
                    onClick={handleToggleHaltPayouts}
                    className={`w-full py-3.5 rounded-xl font-black text-xs pressable flex items-center justify-center gap-2 transition-all ${
                      payoutsHalted
                        ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-black shadow-lg shadow-amber-500/20'
                        : 'bg-amber-600 hover:bg-amber-500 text-black font-black shadow-lg shadow-amber-600/30'
                    }`}
                  >
                    <Lock className="w-4 h-4" />
                    <span>{payoutsHalted ? 'RESUME AUTOMATED PAYOUTS' : 'EMERGENCY: HALT ALL PAYOUTS NOW'}</span>
                  </button>
                </div>
              </div>

              {/* Real-Time Risk Exposure & Margin Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-5 rounded-2xl bg-[#140f0a] border border-amber-500/20 shadow-md">
                  <span className="text-[10px] uppercase tracking-wider text-[#94A3B8] font-bold block mb-1">
                    Round #{currentRound} Pool
                  </span>
                  <div className="text-2xl font-black font-mono-numbers text-white">
                    ₹{Object.values(cardPools).reduce((a, b) => a + b, 0).toLocaleString()}
                  </div>
                  <span className="text-[10px] text-amber-400 font-mono-numbers mt-1 block">
                    Across 14 picture cards
                  </span>
                </div>

                <div className="p-5 rounded-2xl bg-[#140f0a] border border-amber-500/20 shadow-md">
                  <span className="text-[10px] uppercase tracking-wider text-[#94A3B8] font-bold block mb-1">
                    Max Net Exposure
                  </span>
                  <div className="text-2xl font-black font-mono-numbers text-amber-400">
                    ₹{(() => { const stakes = Object.values(cardPools); if (!stakes.length) return '0'; return (Math.max(...stakes) * 10 - stakes.reduce((a, b) => a + b, 0)).toLocaleString('en-IN'); })()}
                  </div>
                  <span className="text-[10px] text-[#94A3B8] font-mono-numbers mt-1 block">
                    Worst-case scenario card
                  </span>
                </div>

                <div className="p-5 rounded-2xl bg-[#140f0a] border border-amber-500/20 shadow-md">
                  <span className="text-[10px] uppercase tracking-wider text-[#94A3B8] font-bold block mb-1">
                    Payout Multiplier
                  </span>
                  <div className="text-2xl font-black font-mono-numbers text-amber-400">
                    10×
                  </div>
                  <span className="text-[10px] text-[#94A3B8] font-mono-numbers mt-1 block">
                    14 picture cards
                  </span>
                </div>

                <div className="p-5 rounded-2xl bg-[#140f0a] border border-amber-500/20 shadow-md">
                  <span className="text-[10px] uppercase tracking-wider text-[#94A3B8] font-bold block mb-1">
                    Pending withdrawals
                  </span>
                  <div className="text-2xl font-black font-mono-numbers text-amber-400">
                    {deskStats.flaggedWithdrawals}
                  </div>
                  <span className="text-[10px] text-[#94A3B8] font-mono-numbers mt-1 block">
                    Withdrawals waiting on the desk
                  </span>
                </div>
              </div>

              {/* 14-Card Live Liability Table & Force Settlement Override */}
              <div className="p-6 rounded-2xl bg-[#140f0a] border border-amber-500/20 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h4 className="text-base font-black text-white">Live 14-Card Liability Exposure Matrix</h4>
                    <p className="text-xs text-[#94A3B8]">
                      Stakes on each card for the open round. The winning card is already sealed.
                    </p>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-white/5 border border-white/[0.08] text-xs font-mono-numbers text-[#94A3B8]">
                    Draw in: <strong className="text-amber-400">{countdown}s</strong>
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-mono-numbers">
                    <thead>
                      <tr className="border-b border-amber-500/20 text-[#94A3B8] text-[10px] uppercase">
                        <th className="py-2.5">Card</th>
                        <th className="py-2.5">Stakes Placed</th>
                        <th className="py-2.5">10x Payout</th>
                        <th className="py-2.5">Risk Level</th>
                        <th className="py-2.5 text-right">Intervention</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.04]">
                      {PICTURE_CARDS.map(card => {
                        const stakes = cardPools[card.id] || 0;
                        const payout = stakes * 10.0;
                        const poolValues = Object.values(cardPools);
                        const isHighestRisk = poolValues.length > 0 && stakes === Math.max(...poolValues) && stakes > 0;

                        return (
                          <tr key={card.id} className="hover:bg-white/[0.02]">
                            <td className="py-3 font-sans text-white font-bold flex items-center gap-2">
                              <span className="text-lg">{card.symbol}</span>
                              <div>
                                <span>#{card.id} {card.name}</span>
                                <span className="text-[10px] text-[#94A3B8] block font-normal">{card.hindi}</span>
                              </div>
                            </td>
                            <td className="py-3 text-white">₹{stakes.toLocaleString()}</td>
                            <td className="py-3 text-white">₹{payout.toLocaleString()}</td>
                            <td className="py-3 font-sans">
                              {isHighestRisk ? (
                                <span className="px-2 py-0.5 rounded bg-red-500/10 text-red-400 text-[10px] font-bold">
                                  MAX EXPOSURE
                                </span>
                              ) : stakes <= 1000 ? (
                                <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[10px] font-bold">
                                  SAFE / OPTIMAL
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded bg-white/5 text-[#94A3B8] text-[10px] font-bold">
                                  NORMAL
                                </span>
                              )}
                            </td>
                            <td className="py-3 text-right text-[10px] text-[#94A3B8]">Sealed</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'profit-engine' && (
            <div className="p-6 rounded-2xl bg-[#140f0a] border border-amber-500/20 space-y-3">
              <h3 className="text-lg font-black text-white">Round report</h3>
              <p className="text-sm text-[#94A3B8] leading-relaxed">
                The winning card is sealed when the round starts. This screen cannot choose it.
              </p>
              {roundReports.length === 0 ? (
                <p className="text-xs text-[#94A3B8]">No settled rounds yet.</p>
              ) : (
                <ul className="space-y-2 text-xs font-mono-numbers">
                  {roundReports.map(row => (
                    <li key={row.roundNumber} className="flex justify-between border-b border-amber-500/10 py-2">
                      <span>#{row.roundNumber} {row.winningCardName}</span>
                      <span>Pool ₹{Number(row.totalPool || 0).toLocaleString('en-IN')} · paid ₹{Number(row.totalPayout || 0).toLocaleString('en-IN')}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {activeTab === 'live-rounds' && (
            <div className="space-y-6">
              <div className="p-6 rounded-2xl bg-[#140f0a] border border-amber-500/20">
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h3 className="text-lg font-black text-white">Live Round #{currentRound} Card Liabilities</h3>
                    <p className="text-xs text-[#94A3B8]">Total Pool: ₹{totalStakeInRound.toLocaleString('en-IN')} • Draw in {countdown}s</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] uppercase text-[#94A3B8] block">Card</span>
                    <span className="text-sm font-mono-numbers font-black text-amber-400">
                      Sealed at round start
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                  {PICTURE_CARDS.map(card => {
                    const stake = cardPools[card.id] || 0;
                    const payout = stake * 10;
                    return (
                      <div
                        key={card.id}
                        className="p-3 rounded-xl border flex flex-col justify-between border-amber-500/20 bg-[#18130e]"
                      >
                        <div>
                          <div className="flex justify-between items-center text-xs font-mono-numbers">
                            <span className="text-amber-400 font-bold">#{card.id}</span>
                            <div className="w-8 h-8 rounded-lg overflow-hidden border border-amber-500/30 bg-black/40 flex items-center justify-center">
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
                              <span className="text-sm hidden">{card.symbol}</span>
                            </div>
                          </div>
                          <span className="text-xs font-bold text-white block mt-1">{card.name}</span>
                        </div>

                        <div className="mt-3 pt-2 border-t border-amber-500/10 text-[10px] font-mono-numbers space-y-0.5">
                          <div className="flex justify-between text-[#94A3B8]">
                            <span>Stake:</span>
                            <span className="text-white">₹{stake}</span>
                          </div>
                          <div className="flex justify-between text-[#94A3B8]">
                            <span>10x Payout:</span>
                            <span className="text-white">₹{payout}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'upi-rotator' && (
            <div className="space-y-6">
              {/* Header Overview Card */}
              <div className="p-6 rounded-2xl bg-[#140f0a] border border-amber-500/20 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-black text-white">Multi-QR & UPI Limit Rotator</h3>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-mono font-bold border border-emerald-500/30">
                      AUTO-ROTATION ON
                    </span>
                  </div>
                  <p className="text-xs text-[#94A3B8] mt-1">
                    When an account hits its daily volume threshold, the system automatically routes players to the next active QR.
                  </p>
                </div>

                <button
                  onClick={() => setNewUpiModal(true)}
                  className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-black font-black text-xs pressable flex items-center gap-1.5 shadow-md shadow-amber-500/20 hover:brightness-110 transition-all"
                >
                  <Plus className="w-4 h-4" />
                  Add New UPI Account
                </button>
              </div>

              {/* Pool Capacity Status */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-[#140f0a] border border-amber-500/20">
                  <span className="text-[10px] uppercase font-bold text-[#94A3B8] block mb-1">Total Pool Capacity</span>
                  <span className="text-xl font-black font-mono-numbers text-white">
                    ₹{totalRotatorLimit.toLocaleString('en-IN')}
                  </span>
                  <span className="text-[10px] text-[#94A3B8] block mt-1">Sum of all configured daily limits</span>
                </div>

                <div className="p-4 rounded-xl bg-[#140f0a] border border-amber-500/20">
                  <span className="text-[10px] uppercase font-bold text-[#94A3B8] block mb-1">Total Collected Today</span>
                  <span className="text-xl font-black font-mono-numbers text-amber-400">
                    ₹{totalRotatorCollected.toLocaleString('en-IN')}
                  </span>
                  <span className="text-[10px] text-amber-400 block mt-1">
                    {Math.round((totalRotatorCollected / (totalRotatorLimit || 1)) * 100)}% utilized
                  </span>
                </div>

                <div className="p-4 rounded-xl bg-[#140f0a] border border-amber-500/20">
                  <span className="text-[10px] uppercase font-bold text-[#94A3B8] block mb-1">Active Serving QR</span>
                  <span className="text-sm font-bold font-mono-numbers text-white truncate block">
                    {activeServingUpi?.upiId}
                  </span>
                  <span className="text-[10px] text-emerald-400 block mt-1 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    Currently serving player deposits
                  </span>
                </div>
              </div>

              {/* List of Configured UPI Accounts with Progress Bars */}
              <div className="space-y-3">
                <h4 className="text-xs uppercase font-bold tracking-wider text-[#94A3B8]">
                  Configured Accounts in Rotation ({upiList.length})
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {upiList.map(acc => {
                    const isFull = acc.currentCollected >= acc.dailyLimit;
                    const percent = Math.min(100, Math.round((acc.currentCollected / acc.dailyLimit) * 100));

                    return (
                      <div
                        key={acc.id}
                        className={`p-5 rounded-2xl border transition-all ${
                          acc.isCurrentlyServing
                            ? 'bg-[#18130e] border-amber-400 shadow-md shadow-amber-500/10'
                            : isFull
                            ? 'bg-[#140f0a]/60 border-amber-500/10'
                            : 'bg-[#140f0a] border-amber-500/20'
                        }`}
                      >
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-white">{acc.holderName}</span>
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#1c150e] border border-amber-500/20 text-[#94A3B8]">
                                {acc.bankName}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-sm font-mono-numbers font-black text-white">{acc.upiId}</span>
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(acc.upiId);
                                  showToast('UPI ID copied!');
                                }}
                                className="text-[10px] text-amber-400 hover:underline font-bold"
                              >
                                Copy
                              </button>
                            </div>
                          </div>

                          {/* Status Pill */}
                          <div>
                            {acc.isCurrentlyServing ? (
                              <span className="px-2.5 py-1 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 text-black font-black text-[10px] flex items-center gap-1 shadow-sm">
                                <span className="w-1.5 h-1.5 rounded-full bg-black animate-pulse" />
                                SERVING PLAYERS
                              </span>
                            ) : isFull ? (
                              <span className="px-2.5 py-1 rounded-full bg-white/10 text-[#94A3B8] font-bold text-[10px]">
                                LIMIT FULL (ROTATED)
                              </span>
                            ) : !acc.isActive ? (
                              <span className="px-2.5 py-1 rounded-full bg-white/5 text-[#94A3B8] font-bold text-[10px]">
                                PAUSED
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 rounded-full bg-[#1c150e] border border-amber-500/20 text-[#94A3B8] font-bold text-[10px]">
                                STANDBY
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Progress bar */}
                        <div className="space-y-1.5 mb-4">
                          <div className="flex justify-between text-xs font-mono-numbers">
                            <span className="text-[#94A3B8]">
                              Collected: ₹{acc.currentCollected.toLocaleString('en-IN')} / ₹{acc.dailyLimit.toLocaleString('en-IN')}
                            </span>
                            <span className={isFull ? 'text-white' : 'text-amber-400 font-bold'}>{percent}%</span>
                          </div>
                          <div className="h-2.5 w-full bg-[#0c0a08] rounded-full overflow-hidden border border-amber-500/20">
                            <div
                              style={{ width: `${percent}%` }}
                              className={`h-full transition-all duration-500 ${
                                isFull ? 'bg-white/40' : 'bg-gradient-to-r from-amber-500 to-amber-600'
                              }`}
                            />
                          </div>
                          <div className="flex justify-between text-[10px] text-[#94A3B8] font-mono-numbers">
                            <span>Remaining Limit: ₹{Math.max(0, acc.dailyLimit - acc.currentCollected).toLocaleString('en-IN')}</span>
                            <span>Daily Cap: ₹{acc.dailyLimit.toLocaleString('en-IN')}</span>
                          </div>
                        </div>

                        {/* Controls */}
                        <div className="flex items-center gap-2 pt-3 border-t border-amber-500/10">
                          <button
                            onClick={() => handleResetVolume(acc.id)}
                            className="px-3 py-1.5 rounded-lg bg-[#1c150e] border border-amber-500/20 text-[11px] font-bold text-white hover:border-amber-400 pressable transition-all"
                          >
                            Reset Volume to ₹0
                          </button>
                          <button
                            onClick={() => handleToggleUpi(acc.id)}
                            className="px-3 py-1.5 rounded-lg bg-[#1c150e] border border-amber-500/20 text-[11px] font-bold text-[#94A3B8] hover:text-white pressable transition-all"
                          >
                            {acc.isActive ? 'Pause' : 'Activate'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'events' && (
            <EventsPage apiBase={API_BASE} showToast={showToast} />
          )}

          {activeTab === 'website' && (
            <BrandPage apiBase={API_BASE} showToast={showToast} />
          )}

          {activeTab === 'players' && (
            <div className="space-y-6">
              <div className="p-6 rounded-2xl bg-[#140f0a] border border-amber-500/20 space-y-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-lg font-black text-white">Registered Players & Verified Badges</h3>
                    <p className="text-xs text-[#94A3B8]">Balances come from the ledger. Ban blocks login and bets. This screen cannot add money.</p>
                  </div>
                  {/* Search */}
                  <div className="flex items-center bg-[#1c150e] border border-amber-500/20 rounded-xl px-3 py-2 text-xs">
                    <Search className="w-3.5 h-3.5 text-[#94A3B8] mr-2" />
                    <input
                      type="text"
                      placeholder="Search phone number..."
                      value={playerSearch}
                      onChange={e => setPlayerSearch(e.target.value)}
                      className="bg-transparent text-white outline-none w-40 font-mono-numbers"
                    />
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="border-b border-amber-500/20 text-[#94A3B8] font-bold">
                        <th className="py-2.5">User ID</th>
                        <th className="py-2.5">Phone Number</th>
                        <th className="py-2.5">Badge Tier</th>
                        <th className="py-2.5">Playable Balance</th>
                        <th className="py-2.5">Total Bets</th>
                        <th className="py-2.5">Account Status</th>
                        <th className="py-2.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.04]">
                      {filteredPlayers.map(p => (
                        <tr key={p.id}>
                          <td className="py-3 text-[#94A3B8] font-mono-numbers">{p.id}</td>
                          <td className="py-3 font-bold text-white font-mono-numbers">+91 {p.phone}</td>
                          <td className="py-3">
                            {p.isVerifiedDepositor ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30 text-[10px] font-black">
                                <ShieldCheck className="w-3 h-3" />
                                VERIFIED DEPOSITOR
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[10px] text-[#94A3B8] bg-[#1c150e]">
                                UNVERIFIED
                              </span>
                            )}
                          </td>
                          <td className="py-3 font-bold font-mono-numbers text-amber-400">
                            ₹{p.balance.toLocaleString('en-IN')}
                          </td>
                          <td className="py-3 font-mono-numbers text-white">{p.totalBets}</td>
                          <td className="py-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              p.isBanned
                                ? 'bg-white/10 text-[#94A3B8]'
                                : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            }`}>
                              {p.isBanned ? 'BANNED' : 'ACTIVE'}
                            </span>
                          </td>
                          <td className="py-3 text-right">
                            {p.role === 'USER' ? (
                              <button
                                type="button"
                                onClick={async () => {
                                  const res = await fetch(`${API_BASE}/api/v1/admin/users/${p.id}/ban`, { method: 'POST' });
                                  const data = await res.json();
                                  if (!res.ok || !data.success) return;
                                  setPlayers(prev => prev.map(row => row.id === p.id ? { ...row, isBanned: Boolean(data.isBanned) } : row));
                                }}
                                className="px-2 py-1 rounded-lg bg-white/10 text-white text-[10px] font-bold hover:bg-white/20 pressable"
                              >
                                {p.isBanned ? 'Unban' : 'Ban'}
                              </button>
                            ) : (
                              <span className="text-[10px] text-[#94A3B8]">Desk</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'payments' && (
            <div className="space-y-6">
              <div className="p-6 rounded-2xl bg-[#140f0a] border border-amber-500/20 space-y-4">
                <div>
                  <h3 className="text-lg font-black text-white">Payment Settlement Queue</h3>
                  <p className="text-xs text-[#94A3B8]">Review pending P2P manual UTR deposits. Approving grants the player a VERIFIED badge.</p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="border-b border-amber-500/20 text-[#94A3B8] font-bold">
                        <th className="py-2.5">ID</th>
                        <th className="py-2.5">Type</th>
                        <th className="py-2.5">Player</th>
                        <th className="py-2.5">Amount</th>
                        <th className="py-2.5">Reference</th>
                        <th className="py-2.5">Status</th>
                        <th className="py-2.5 text-right">Settlement Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.04]">
                      {payments.map(pay => (
                        <tr key={pay.id}>
                          <td className="py-3 text-[#94A3B8] font-mono-numbers">{pay.id}</td>
                          <td className="py-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              pay.type === 'DEPOSIT'
                                ? 'bg-amber-500/10 text-amber-400'
                                : 'bg-white/10 text-white'
                            }`}>
                              {pay.type}
                            </span>
                          </td>
                          <td className="py-3 font-mono-numbers text-white">+91 {pay.phone}</td>
                          <td className="py-3 font-bold font-mono-numbers text-white">
                            ₹{pay.amount.toLocaleString('en-IN')}
                          </td>
                          <td className="py-3 font-mono-numbers text-[#94A3B8]">{pay.reference}</td>
                          <td className="py-3">
                            <span className={`text-[10px] font-bold ${
                              pay.status === 'APPROVED' ? 'text-emerald-400' : 'text-[#94A3B8]'
                            }`}>
                              {pay.status}
                            </span>
                          </td>
                          <td className="py-3 text-right">
                            {pay.status === 'PENDING' ? (
                              <div className="space-x-1.5">
                                <button
                                  onClick={() => handleResolvePayment(pay.id, 'APPROVED')}
                                  className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 text-black text-[10px] font-black pressable shadow-sm"
                                >
                                  Approve & Verify
                                </button>
                                <button
                                  onClick={() => handleResolvePayment(pay.id, 'REJECTED')}
                                  className="px-2.5 py-1 rounded-lg bg-[#1c150e] border border-amber-500/20 text-[10px] font-bold text-[#94A3B8] hover:text-white pressable"
                                >
                                  Reject
                                </button>
                              </div>
                            ) : (
                              <span className="text-[10px] text-[#94A3B8]">Settled</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="space-y-6">
              <div className="p-6 rounded-2xl bg-[#140f0a] border border-amber-500/20 space-y-4">
                <div>
                  <h3 className="text-lg font-black text-white">Platform Settings & Limits</h3>
                  <p className="text-xs text-[#94A3B8]">These limits are enforced by the API. This screen does not change them.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="p-4 rounded-xl bg-[#18130e] border border-amber-500/20 space-y-2">
                    <span className="font-bold text-white block">Minimum withdrawal</span>
                    <p className="font-mono-numbers text-amber-400 font-black">₹500</p>
                  </div>
                  <div className="p-4 rounded-xl bg-[#18130e] border border-amber-500/20 space-y-2">
                    <span className="font-bold text-white block">Minimum bet</span>
                    <p className="font-mono-numbers text-amber-400 font-black">₹10</p>
                  </div>
                  <div className="p-4 rounded-xl bg-[#18130e] border border-amber-500/20 space-y-2 sm:col-span-2">
                    <span className="font-bold text-white block">Published QR</span>
                    <p className="font-mono-numbers text-amber-400 font-black">{activeServingUpi?.upiId || 'No QR published'}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {newUpiModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#140f0a] border border-amber-500/30 rounded-2xl p-6 space-y-4 animate-slide-up shadow-2xl">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-base font-black text-white">Add New UPI / QR Channel</h3>
                <p className="text-xs text-[#94A3B8]">Set daily volume limit for automatic rotation</p>
              </div>
              <button onClick={() => setNewUpiModal(false)} className="text-[#94A3B8] hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-[10px] uppercase font-bold text-[#94A3B8] block mb-1">
                  UPI ID (VPA)
                </label>
                <input
                  type="text"
                  placeholder="e.g. business.apex@icici"
                  value={newUpiId}
                  onChange={e => setNewUpiId(e.target.value)}
                  className="w-full bg-[#0c0a08] border border-amber-500/20 rounded-xl px-3 py-2.5 text-white font-mono-numbers outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-[#94A3B8] block mb-1">
                  Account Holder / Business Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Apex Enterprise Pvt Ltd"
                  value={newHolderName}
                  onChange={e => setNewHolderName(e.target.value)}
                  className="w-full bg-[#0c0a08] border border-amber-500/20 rounded-xl px-3 py-2.5 text-white outline-none focus:border-amber-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] uppercase font-bold text-[#94A3B8] block mb-1">
                    Bank Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. HDFC Bank"
                    value={newBankName}
                    onChange={e => setNewBankName(e.target.value)}
                    className="w-full bg-[#0c0a08] border border-amber-500/20 rounded-xl px-3 py-2.5 text-white outline-none focus:border-amber-400"
                  />
                </div>

                <div>
                  <label className="text-[10px] uppercase font-bold text-[#94A3B8] block mb-1">
                    Daily Volume Cap (₹)
                  </label>
                  <input
                    type="number"
                    value={newDailyLimit}
                    onChange={e => setNewDailyLimit(Number(e.target.value))}
                    className="w-full bg-[#0c0a08] border border-amber-500/20 rounded-xl px-3 py-2.5 text-white font-mono-numbers outline-none focus:border-amber-400"
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] uppercase font-bold text-[#94A3B8] block mb-1">
                  QR image from your UPI app
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = () => setNewQrImage(String(reader.result || ''));
                    reader.readAsDataURL(file);
                  }}
                  className="w-full text-[11px] text-[#94A3B8]"
                />
                {newQrImage && <p className="text-[10px] text-amber-400 font-bold mt-1">QR image attached</p>}
              </div>
            </div>

            <button
              onClick={handleAddNewUpiAccount}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-black font-black text-xs pressable shadow-lg shadow-amber-500/20 hover:brightness-110 transition-all"
            >
              Add to Active Rotator
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  CheckCircle,
  XCircle,
  Clock,
  Copy,
  Search,
  ShieldCheck,
  Check,
  RefreshCw,
  Wallet,
  History,
  Bell,
  AlertTriangle,
  Zap,
  TrendingUp,
  Activity,
  ExternalLink,
  Timer,
  QrCode,
  Plus,
  Headphones,
  MessageSquare,
  Send,
  CheckCheck,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface DepositItem {
  id: string;
  userId: string;
  phone: string;
  name: string;
  amount: number;
  utrNumber: string;
  time: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  ageSeconds: number;
  screenshot?: string;
}

interface WithdrawalItem {
  id: string;
  userId: string;
  phone: string;
  name: string;
  amount: number;
  payoutMethod: string;
  details: string;
  upiId?: string;
  qrCode?: string;
  screenshot?: string;
  time: string;
  status: 'PENDING' | 'DISPATCHED' | 'REJECTED';
  ageSeconds: number;
}

interface LogEntry {
  id: string;
  text: string;
  time: string;
  type: 'DEP' | 'WD';
}

interface DisputeItem {
  id: string;
  userId: string;
  phone: string;
  name: string;
  amount: number;
  type: string;
  status: string;
  utrNumber?: string;
  disputeReason?: string;
  disputeEvidence?: string;
  disputedAt?: string;
  createdAt: string;
  ageSeconds: number;
}

interface SupportTicketItem {
  id: string;
  userId: string;
  subject: string;
  category: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  priority: string;
  user: {
    phoneNumber: string;
    fullName: string | null;
    wallet?: { balance: any; locked: any; unwagered: any };
    transactions?: Array<{ id: string; type: string; status: string; amount: any; utrNumber?: string; createdAt: string }>;
  };
  messages: Array<{
    id: string;
    senderId: string;
    senderRole: 'USER' | 'AGENT' | 'ADMIN';
    senderName: string;
    message: string;
    attachments?: string | null;
    createdAt: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

type ActiveTab = 'deposits' | 'withdrawals' | 'disputes' | 'support' | 'upi-rotator' | 'logs';

interface UpiAccountItem {
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatAge(sec: number): string {
  if (sec < 60) return `${sec}s ago`;
  return `${Math.floor(sec / 60)}m ago`;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function P2PApp() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('deposits');
  const [brand, setBrand] = useState({ appName: 'SURRAT ND', shortName: 'SURRAT ND', logoUrl: '/logo-emblem.png' });
  const [copied, setCopied] = useState('');

  const backendHost = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
  const isLocalHost = backendHost === 'localhost' || backendHost === '127.0.0.1' || backendHost.startsWith('192.168.');
  const API_BASE = import.meta.env.VITE_API_URL
    || (!isLocalHost ? 'https://apex-arcade-api.onrender.com' : `http://${backendHost}:4000`);

  const [agentStats, setAgentStats] = useState({
    name: 'Desk',
    agentId: '—',
    verifiedToday: 0,
    dispatchedToday: 0,
    avgSpeedSec: 0,
    shifStartTime: 'this shift',
  });

  const [deposits, setDeposits] = useState<DepositItem[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalItem[]>([]);
  const [disputes, setDisputes] = useState<DisputeItem[]>([]);
  const [selectedDeposit, setSelectedDeposit] = useState<DepositItem | null>(null);
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<WithdrawalItem | null>(null);
  const [selectedDispute, setSelectedDispute] = useState<DisputeItem | null>(null);
  const [isResolvingDispute, setIsResolvingDispute] = useState(false);
  const [disputeRejectReason, setDisputeRejectReason] = useState('');
  const [supportTickets, setSupportTickets] = useState<SupportTicketItem[]>([]);
  const [selectedSupportTicket, setSelectedSupportTicket] = useState<SupportTicketItem | null>(null);
  const [supportReplyText, setSupportReplyText] = useState('');
  const [isSendingSupportReply, setIsSendingSupportReply] = useState(false);
  const [supportFilter, setSupportFilter] = useState<'ALL' | 'OPEN' | 'IN_PROGRESS' | 'RESOLVED'>('ALL');
  const [payoutUtr, setPayoutUtr] = useState('');
  const [upiAccounts, setUpiAccounts] = useState<UpiAccountItem[]>([]);
  const [newUpiId, setNewUpiId] = useState('');
  const [newHolder, setNewHolder] = useState('');
  const [newBank, setNewBank] = useState('');
  const [newLimit, setNewLimit] = useState(50000);
  const [newQr, setNewQr] = useState('');

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [staffToken, setStaffToken] = useState('');
  const [loginPhone, setLoginPhone] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  useEffect(() => {
    fetch(`${API_BASE}/api/v1/auth/me`, { credentials: 'include' })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => {
        const role = data?.data?.user?.role;
        if (data?.success && (role === 'ADMIN' || role === 'AGENT')) setStaffToken('cookie-session');
      })
      .catch(() => undefined);
  }, [API_BASE]);

  // ── Fetch live queues from backend ──
  const fetchLiveQueues = useCallback(async () => {
    if (!staffToken) return;
    try {
      const [depRes, wdRes, disRes, supRes] = await Promise.all([
        fetch(`${API_BASE}/api/v1/admin/p2p-queue`).then(r => r.json()).catch(() => null),
        fetch(`${API_BASE}/api/v1/admin/withdrawals`).then(r => r.json()).catch(() => null),
        fetch(`${API_BASE}/api/v1/admin/disputes`).then(r => r.json()).catch(() => null),
        fetch(`${API_BASE}/api/v1/support/admin/tickets`).then(r => r.json()).catch(() => null),
      ]);

      if (depRes?.success && Array.isArray(depRes.data)) {
        const liveItems: DepositItem[] = depRes.data.map((d: any) => ({
          id: d.id,
          userId: d.userId,
          phone: d.userPhone || 'Unknown',
          name: d.userName || 'Player',
          amount: Number(d.amount),
          utrNumber: d.utrNumber || 'N/A',
          time: new Date(d.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          status: d.status === 'SUCCESS' ? 'APPROVED' : d.status === 'REJECTED' ? 'REJECTED' : 'PENDING',
          ageSeconds: Math.max(0, Math.floor((Date.now() - new Date(d.createdAt).getTime()) / 1000)),
          screenshot: d.screenshot || undefined
        }));
        setDeposits(liveItems);
        setSelectedDeposit(current => liveItems.find(item => item.id === current?.id) || liveItems[0] || null);
      }

      if (wdRes?.success && Array.isArray(wdRes.data)) {
        const liveWd: WithdrawalItem[] = wdRes.data.map((w: any) => {
          const upi = w.payoutDetails?.upiId || w.payoutUpi || '';
          const qr = w.payoutDetails?.qrCode || w.qrCode || w.screenshot || '';
          const methodLabel = w.payoutDetails?.bankAccount
            ? 'Bank Transfer'
            : (qr && upi ? 'UPI ID & QR Code' : (qr ? 'QR Code' : 'UPI ID'));
          return {
            id: w.id,
            userId: w.userId,
            phone: w.userPhone || 'Unknown',
            name: w.userName || w.userPhone || 'Player',
            amount: Number(w.netAmount || w.amount),
            payoutMethod: methodLabel,
            details: upi || `${w.payoutDetails?.bankAccount || ''} ${w.payoutDetails?.ifscCode || ''}`.trim() || 'QR Code Attached',
            upiId: upi || undefined,
            qrCode: qr || undefined,
            screenshot: qr || undefined,
            time: new Date(w.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            status: 'PENDING',
            ageSeconds: Math.max(0, Math.floor((Date.now() - new Date(w.createdAt).getTime()) / 1000))
          };
        });
        setWithdrawals(liveWd);
        setSelectedWithdrawal(current => liveWd.find(item => item.id === current?.id) || liveWd[0] || null);
      }

      if (disRes?.success && Array.isArray(disRes.data)) {
        const liveDis: DisputeItem[] = disRes.data.map((d: any) => ({
          id: d.id,
          userId: d.userId,
          phone: d.user?.phoneNumber || 'Unknown',
          name: d.user?.fullName || d.user?.legalName || `User #${(d.user?.phoneNumber || '').slice(-4)}`,
          amount: Number(d.amount),
          type: d.type,
          status: d.status,
          utrNumber: d.utrNumber || 'N/A',
          disputeReason: d.disputeReason || 'Disputed by player',
          disputeEvidence: d.disputeEvidence || d.screenshot || undefined,
          disputedAt: d.disputedAt || d.createdAt,
          createdAt: d.createdAt,
          ageSeconds: Math.max(0, Math.floor((Date.now() - new Date(d.disputedAt || d.createdAt).getTime()) / 1000))
        }));
        setDisputes(liveDis);
        setSelectedDispute(current => liveDis.find(item => item.id === current?.id) || liveDis[0] || null);
      }

      if (supRes?.success && Array.isArray(supRes.data)) {
        setSupportTickets(supRes.data);
        setSelectedSupportTicket(current => {
          if (!current) return supRes.data[0] || null;
          return supRes.data.find((t: any) => t.id === current.id) || current;
        });
      }
    } catch {}
  }, [API_BASE, staffToken]);

  useEffect(() => {
    fetch(`${API_BASE}/api/v1/brand`).then(r => r.json()).then(json => {
      if (json?.data?.appName) setBrand(json.data);
    }).catch(() => undefined);
  }, [API_BASE]);

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
    if (!staffToken) return;
    fetchLiveQueues();
    fetch(`${API_BASE}/api/v1/auth/me`)
      .then(r => r.json())
      .then(d => {
        const user = d?.data?.user || d?.user;
        if (!user) return;
        setAgentStats(prev => ({
          ...prev,
          name: user.fullName || user.phoneNumber || 'Desk',
          agentId: user.phoneNumber || '—',
          shifStartTime: prev.shifStartTime === 'this shift'
            ? new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })
            : prev.shifStartTime
        }));
      })
      .catch(() => {});
    fetch(`${API_BASE}/api/v1/admin/desk-log`)
      .then(r => r.json())
      .then(d => {
        if (!Array.isArray(d?.data)) return;
        setLogs(d.data.map((row: { id: string; action: string; note?: string; createdAt: string }) => ({
          id: row.id,
          text: row.note || row.action,
          time: new Date(row.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }),
          type: row.action.startsWith('withdrawal') ? 'WD' as const : 'DEP' as const
        })));
      })
      .catch(() => {});
    fetch(`${API_BASE}/api/v1/payments/upi-accounts`)
      .then(r => r.json())
      .then(d => {
        const accounts = Array.isArray(d?.data) ? d.data : d?.data?.accounts;
        if (Array.isArray(accounts)) setUpiAccounts(accounts);
      })
      .catch(() => {});
    const pollTimer = setInterval(fetchLiveQueues, 4000);
    return () => clearInterval(pollTimer);
  }, [fetchLiveQueues]);

  // ── Tick age every second ──
  useEffect(() => {
    const t = setInterval(() => {
      setDeposits(prev => prev.map(d => ({ ...d, ageSeconds: d.ageSeconds + 1 })));
      setWithdrawals(prev => prev.map(w => ({ ...w, ageSeconds: w.ageSeconds + 1 })));
      setDisputes(prev => prev.map(dis => ({ ...dis, ageSeconds: dis.ageSeconds + 1 })));
    }, 1000);
    return () => clearInterval(t);
  }, []);

  // ── Copy helper ──
  const copyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(''), 1800);
  };

  // ── Resolve dispute (Arbitration Desk) ──
  const handleResolveDispute = async (id: string, action: 'APPROVE' | 'REJECT', reason?: string) => {
    setIsResolvingDispute(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/admin/disputes/${id}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, reason: reason || 'Arbitrated by desk operator' })
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        window.alert(data?.error || 'Failed to resolve dispute.');
        return;
      }
      setDisputes(prev => prev.filter(d => d.id !== id));
      setSelectedDispute(null);
      setDisputeRejectReason('');
      fetchLiveQueues();
      const logEntry: LogEntry = {
        id: 'lg-' + Date.now(),
        text: `Arbitration: ${action} dispute ${id.slice(-6)} (${reason || 'Desk verified'})`,
        time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }),
        type: 'DEP',
      };
      setLogs(prev => [logEntry, ...prev]);
    } finally {
      setIsResolvingDispute(false);
    }
  };

  // ── Help Desk Support Handlers ──
  const handleSelectSupportTicket = async (ticket: SupportTicketItem) => {
    setSelectedSupportTicket(ticket);
    try {
      const res = await fetch(`${API_BASE}/api/v1/support/admin/tickets/${ticket.id}`);
      const json = await res.json().catch(() => null);
      if (json?.success && json.data) {
        setSelectedSupportTicket(json.data);
      }
    } catch {}
  };

  const handleSendSupportReply = async () => {
    if (!selectedSupportTicket || !supportReplyText.trim()) return;
    setIsSendingSupportReply(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/support/admin/tickets/${selectedSupportTicket.id}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: supportReplyText.trim() })
      });
      const json = await res.json().catch(() => null);
      if (json?.success) {
        setSupportReplyText('');
        handleSelectSupportTicket(selectedSupportTicket);
        fetchLiveQueues();
      } else {
        window.alert(json?.error || 'Failed to send reply');
      }
    } catch {
      window.alert('Network error sending reply');
    } finally {
      setIsSendingSupportReply(false);
    }
  };

  const handleUpdateTicketStatus = async (ticketId: string, status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED') => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/support/admin/tickets/${ticketId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      const json = await res.json().catch(() => null);
      if (json?.success) {
        fetchLiveQueues();
        if (selectedSupportTicket?.id === ticketId) {
          setSelectedSupportTicket(prev => prev ? { ...prev, status } : null);
        }
      }
    } catch {}
  };

  // ── Approve deposit ──
  const handleApproveDeposit = async (id: string) => {
    const item = deposits.find(d => d.id === id);
    if (!item) return;

    const res = await fetch(`${API_BASE}/api/v1/admin/p2p-queue/${id}/approve`, {
      method: 'POST'
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.success) {
      window.alert(data?.error || 'The deposit was not approved. No wallet change was made.');
      return;
    }

    const nextList = deposits.filter(d => d.id !== id);
    setDeposits(nextList);
    setSelectedDeposit(nextList[0] || null);
    setAgentStats(prev => ({ ...prev, verifiedToday: prev.verifiedToday + item.amount }));
    const logEntry: LogEntry = {
      id: 'lg-' + Date.now(),
      text: `Approved ₹${item.amount.toLocaleString('en-IN')} for ${item.phone} (UTR: ${item.utrNumber}) • WALLET CREDITED`,
      time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }),
      type: 'DEP',
    };
    setLogs(prev => [logEntry, ...prev]);
  };

  // ── Reject deposit ──
  const handleRejectDeposit = async (id: string) => {
    const item = deposits.find(d => d.id === id);
    const res = await fetch(`${API_BASE}/api/v1/admin/p2p-queue/${id}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'Invalid UTR reference' })
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.success) {
      window.alert(data?.error || 'The deposit was not rejected.');
      return;
    }

    const nextList = deposits.filter(d => d.id !== id);
    setDeposits(nextList);
    setSelectedDeposit(nextList[0] || null);
    if (item) {
      setLogs(prev => [{
        id: 'lg-' + Date.now(),
        text: `Rejected ₹${item.amount.toLocaleString('en-IN')} for ${item.phone} (UTR: ${item.utrNumber})`,
        time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }),
        type: 'DEP',
      }, ...prev]);
    }
  };

  // ── Dispatch withdrawal ──
  const handleDispatchWithdrawal = async (id: string) => {
    const item = withdrawals.find(w => w.id === id);
    if (!item) return;
    if (!/^[0-9]{12}$/.test(payoutUtr)) {
      return;
    }

    const ref = payoutUtr;
    const res = await fetch(`${API_BASE}/api/v1/admin/withdrawals/${id}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payoutUtr: ref })
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.success) return;

    const nextList = withdrawals.filter(w => w.id !== id);
    setWithdrawals(nextList);
    setSelectedWithdrawal(nextList[0] || null);
    setPayoutUtr('');
    setAgentStats(prev => ({ ...prev, dispatchedToday: prev.dispatchedToday + item.amount }));
    const logEntry: LogEntry = {
      id: 'lg-' + Date.now(),
      text: `Marked ₹${item.amount.toLocaleString('en-IN')} paid to ${item.details} (UTR: ${ref})`,
      time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }),
      type: 'WD',
    };
    setLogs(prev => [logEntry, ...prev]);
  };

  // ─────────────────────────────────────────────────────────────────────────

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
      const role = data.data?.user?.role;
      if (!data.success || (role !== 'ADMIN' && role !== 'AGENT')) {
        setLoginError(data.error || 'Desk login failed.');
        return;
      }
      setStaffToken(data.data.accessToken);
      const user = data.data.user;
      setAgentStats(prev => ({
        ...prev,
        name: user.fullName || user.phoneNumber || 'Desk',
        agentId: user.phoneNumber || '—',
        shifStartTime: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })
      }));
    } catch {
      setLoginError('Could not reach the API.');
    }
  };

  if (!staffToken) {
    return (
      <div className="min-h-screen bg-[#0b0f19] text-slate-100 flex items-center justify-center px-6">
        <form onSubmit={submitStaffLogin} className="w-full max-w-sm bg-[#111827] border border-amber-500/25 rounded-2xl p-6 space-y-4 shadow-2xl">
          <div className="text-center mb-2">
            <img src="/logo-badge.png" alt="SURRAT ND" className="h-16 mx-auto mb-2 drop-shadow-md" />
            <h1 className="text-lg font-black text-amber-400">SURRAT ND — P2P Desk</h1>
            <p className="text-xs text-slate-400">An agent or admin password is required before any UTR can be approved.</p>
          </div>
          <input value={loginPhone} onChange={e => setLoginPhone(e.target.value)} placeholder="Agent Phone" className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-amber-400 focus:outline-none" />
          <input type="password" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} placeholder="Password" className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-amber-400 focus:outline-none" />
          {loginError && <p className="text-xs text-red-400">{loginError}</p>}
          <button type="submit" className="w-full bg-gradient-to-r from-amber-500 to-amber-600 text-black font-black rounded-lg py-2.5 shadow-md hover:brightness-110 transition-all">Sign in</button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-100 flex flex-col font-sans">

      <header className="bg-[#0f1420] border-b border-white/[0.06] px-6 py-4 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">

          {/* Brand & Agent ID */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#1c150e] border border-amber-500/30 flex items-center justify-center shadow-lg shadow-amber-500/10 shrink-0 overflow-hidden">
              <img src="/logo-emblem.png" alt="SURRAT ND" className="w-full h-full object-cover" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-lg text-white font-serif tracking-wide">SURRAT <span className="text-amber-400">ND</span></span>
                <span className="px-2 py-0.5 rounded-lg bg-amber-500/15 text-amber-300 border border-amber-500/25 text-[10px] font-black tracking-wide">
                  P2P DESK
                </span>
              </div>
              <span className="text-xs text-slate-400 font-medium">{agentStats.name} • {agentStats.agentId} • Shift from {agentStats.shifStartTime}</span>
            </div>
          </div>

          {/* Shift Stats */}
          <div className="flex items-center gap-3">
            {[
              { label: 'Verified this shift', value: `₹${agentStats.verifiedToday.toLocaleString('en-IN')}`, color: '#0df59d' },
              { label: 'Paid this shift', value: `₹${agentStats.dispatchedToday.toLocaleString('en-IN')}`, color: '#00e5ff' },
              { label: 'Waiting', value: `${deposits.length + withdrawals.length}`, color: '#ffb800' },
            ].map(stat => (
              <div key={stat.label} className="px-3 py-2 rounded-xl bg-black/30 border border-white/[0.06] text-center hidden sm:block">
                <span className="text-[10px] text-slate-500 font-semibold block">{stat.label}</span>
                <span className="font-mono-numbers text-sm font-black" style={{ color: stat.color }}>{stat.value}</span>
              </div>
            ))}

            <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <span className="w-2 h-2 rounded-full bg-emerald-400 live-dot" />
              <span className="text-xs font-black text-emerald-400">ACTIVE SHIFT</span>
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 flex flex-col gap-5">

        {/* Queue Counters */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { label: 'Pending Deposits', count: deposits.length, color: '#0df59d', icon: <ArrowDownToLine className="w-4 h-4" />, urgent: deposits.some(d => d.ageSeconds > 300) },
            { label: 'Pending Payouts', count: withdrawals.length, color: '#00e5ff', icon: <ArrowUpFromLine className="w-4 h-4" />, urgent: withdrawals.some(w => w.ageSeconds > 300) },
            { label: 'Open Disputes', count: disputes.length, color: '#f59e0b', icon: <AlertTriangle className="w-4 h-4" />, urgent: disputes.length > 0 },
            { label: 'Help Desk Open', count: supportTickets.filter(t => t.status === 'OPEN').length, color: '#38bdf8', icon: <Headphones className="w-4 h-4" />, urgent: supportTickets.some(t => t.status === 'OPEN') },
            { label: 'Processed Today', count: logs.length, color: '#a78bfa', icon: <CheckCircle className="w-4 h-4" />, urgent: false },
          ].map(c => (
            <div key={c.label} className={`p-4 rounded-2xl bg-[#111826] border transition ${c.urgent ? 'border-amber-500/40 urgent-timer' : 'border-white/[0.06]'}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] text-slate-400 font-semibold">{c.label}</span>
                <span style={{ color: c.color }}>{c.icon}</span>
              </div>
              <span className="text-2xl font-black font-mono-numbers" style={{ color: c.color }}>{c.count}</span>
              {c.urgent && <span className="text-[10px] text-amber-400 font-semibold block mt-0.5">⚠ Action needed</span>}
            </div>
          ))}
        </div>

        {/* ── Tabs ── */}
        <div className="flex items-center gap-1 border-b border-white/[0.06] overflow-x-auto">
          {[
            { id: 'deposits',    icon: <ArrowDownToLine className="w-4 h-4" />, label: `Incoming Deposits (${deposits.length})` },
            { id: 'withdrawals', icon: <ArrowUpFromLine className="w-4 h-4" />,  label: `Outgoing Payouts (${withdrawals.length})` },
            { id: 'disputes',    icon: <AlertTriangle className="w-4 h-4" />,   label: `Disputes & Appeals (${disputes.length})` },
            { id: 'support',     icon: <Headphones className="w-4 h-4" />,      label: `Help Desk (${supportTickets.filter(t => t.status === 'OPEN').length})` },
            { id: 'upi-rotator', icon: <QrCode className="w-4 h-4" />,          label: 'QR Limits & Rotation' },
            { id: 'logs',        icon: <History className="w-4 h-4" />,          label: 'Shift Log' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as ActiveTab)}
              className={`tab-underline ${activeTab === tab.id ? 'active' : ''} px-4 py-3 flex items-center gap-2 font-bold text-xs transition rounded-t-xl ${
                activeTab === tab.id ? 'text-[#0df59d]' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'deposits' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 flex-1">

            {/* Queue List */}
            <div className="lg:col-span-5 space-y-2">
              <div className="flex items-center justify-between text-[11px] text-slate-500 font-bold mb-2 px-1">
                <span>PENDING UTR SUBMISSIONS ({deposits.length})</span>
                <span className="text-emerald-400 font-semibold flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 live-dot" /> Live Sync</span>
              </div>

              {deposits.length === 0 ? (
                <div className="py-16 text-center rounded-2xl bg-[#111826] border border-white/[0.06]">
                  <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-3 opacity-60" />
                  <h4 className="font-black text-white text-sm">All Clear!</h4>
                  <p className="text-xs text-slate-500 mt-1">No pending UTR submissions.</p>
                </div>
              ) : deposits.map(item => (
                <div
                  key={item.id}
                  onClick={() => setSelectedDeposit(item)}
                  className={`queue-item p-4 rounded-2xl border ${selectedDeposit?.id === item.id ? 'selected-dep' : 'bg-[#111826] border-white/[0.06]'}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <span className="font-black text-sm text-white">{item.name}</span>
                      <span className="text-[11px] text-slate-400 block">{item.phone}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-base font-black text-[#0df59d] font-mono-numbers">₹{item.amount.toLocaleString('en-IN')}</span>
                      <span className={`text-[10px] block font-semibold mt-0.5 ${item.ageSeconds > 300 ? 'text-amber-400' : 'text-slate-500'}`}>
                        {item.ageSeconds > 300 ? '⚠ ' : ''}{formatAge(item.ageSeconds)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-mono text-slate-500">UTR: {item.utrNumber}</span>
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 font-bold text-[10px] border border-amber-500/20">PENDING</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Verification Console */}
            <div className="lg:col-span-7">
              {selectedDeposit ? (
                <div className="p-6 rounded-3xl bg-[#111826] border border-white/[0.06] sticky top-24">
                  <div className="flex items-center justify-between pb-4 border-b border-white/[0.06] mb-5">
                    <div>
                      <h3 className="font-black text-xl text-white">UTR Verification & Clearance</h3>
                      <span className="text-[11px] text-slate-500 font-mono">Ref: {selectedDeposit.id}</span>
                    </div>
                    <span className="px-3 py-1 rounded-full text-xs font-black bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      Awaiting Action
                    </span>
                  </div>

                  {/* Details */}
                  <div className="space-y-3 mb-5 text-sm">
                    {[
                      { label: 'Player', value: `${selectedDeposit.name} · ${selectedDeposit.phone}`, valueClass: 'font-bold text-white' },
                      { label: 'Claimed Amount', value: null },
                    ].map((_, i) => i === 0 ? (
                      <div key={i} className="flex justify-between py-2 border-b border-white/[0.04]">
                        <span className="text-slate-400 text-xs">Player</span>
                        <span className="font-bold text-white">{selectedDeposit.name} · {selectedDeposit.phone}</span>
                      </div>
                    ) : null)}

                    <div className="flex justify-between items-center py-2 border-b border-white/[0.04]">
                      <span className="text-slate-400 text-xs">Claimed Amount</span>
                      <span className="text-2xl font-black text-[#0df59d] font-mono-numbers">₹{selectedDeposit.amount.toLocaleString('en-IN')}</span>
                    </div>

                    <div className="flex justify-between items-center py-2 border-b border-white/[0.04]">
                      <span className="text-slate-400 text-xs">12-Digit Bank UTR</span>
                      <div className="flex items-center gap-2">
                        <code className="text-[#00e5ff] font-black text-sm bg-black/40 px-3 py-1.5 rounded-xl border border-white/[0.07] tracking-wider">
                          {selectedDeposit.utrNumber}
                        </code>
                        <button
                          onClick={() => copyText(selectedDeposit.utrNumber, 'utr')}
                          className="w-8 h-8 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] flex items-center justify-center text-slate-400 hover:text-white transition"
                        >
                          {copied === 'utr' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    <div className="flex justify-between py-2">
                      <span className="text-slate-400 text-xs">Waiting Time</span>
                      <span className={`font-bold text-sm ${selectedDeposit.ageSeconds > 300 ? 'text-amber-400' : 'text-slate-300'}`}>
                        {formatAge(selectedDeposit.ageSeconds)}
                      </span>
                    </div>
                  </div>

                  {/* Receipt Placeholder */}
                  <div className="mb-4">
                    <span className="text-[11px] text-slate-500 font-semibold uppercase tracking-wide block mb-2">Payment Proof Screenshot</span>
                    <div className="h-40 rounded-2xl bg-black/40 border border-dashed border-white/15 flex flex-col items-center justify-center gap-2 px-4 text-center">
                      {selectedDeposit.screenshot ? (
                        <img
                          src={selectedDeposit.screenshot}
                          alt="Player-uploaded payment proof"
                          className="max-h-36 max-w-full rounded-xl object-contain"
                        />
                      ) : (
                        <>
                          <span className="text-xs font-bold text-slate-300">No payment screenshot was uploaded.</span>
                          <span className="text-[10px] text-slate-500">Match the 12-digit UTR in your bank app before you credit the wallet.</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Verified Badge Notice */}
                  <div className="mb-4 p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-2.5 text-xs text-emerald-400">
                    <ShieldCheck className="w-5 h-5 shrink-0" />
                    <span>Approving this deposit will automatically grant the user a permanent <strong>VERIFIED DEPOSITOR</strong> badge.</span>
                  </div>

                  {/* Action Buttons */}
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => handleRejectDeposit(selectedDeposit.id)}
                      className="py-3.5 rounded-2xl bg-red-500/10 hover:bg-red-500/15 text-red-400 border border-red-500/20 font-bold text-xs flex items-center justify-center gap-2 transition"
                    >
                      <XCircle className="w-4 h-4" />
                      Reject (Invalid UTR)
                    </button>
                    <button
                      onClick={() => handleApproveDeposit(selectedDeposit.id)}
                      className="py-3.5 rounded-2xl bg-[#0df59d] hover:bg-[#0be58f] text-black font-black text-sm flex items-center justify-center gap-2 transition shadow-lg shadow-emerald-500/20"
                    >
                      <CheckCircle className="w-5 h-5" />
                      Verify & Credit ₹{selectedDeposit.amount.toLocaleString('en-IN')}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="py-24 text-center text-slate-600 rounded-3xl bg-[#111826] border border-dashed border-white/[0.06]">
                  <ArrowDownToLine className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="font-semibold text-sm">Select a deposit to verify</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'withdrawals' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 flex-1">

            {/* Queue List */}
            <div className="lg:col-span-5 space-y-2">
              <div className="flex items-center justify-between text-[11px] text-slate-500 font-bold mb-2 px-1">
                <span>PAYOUT REQUESTS ({withdrawals.length})</span>
                <span className="text-amber-400 font-semibold">Immediate Action</span>
              </div>

              {withdrawals.length === 0 ? (
                <div className="py-16 text-center rounded-2xl bg-[#111826] border border-white/[0.06]">
                  <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-3 opacity-60" />
                  <h4 className="font-black text-white text-sm">All Payouts Dispatched!</h4>
                  <p className="text-xs text-slate-500 mt-1">No pending payout requests.</p>
                </div>
              ) : withdrawals.map(item => (
                <div
                  key={item.id}
                  onClick={() => setSelectedWithdrawal(item)}
                  className={`queue-item p-4 rounded-2xl border ${selectedWithdrawal?.id === item.id ? 'selected-wd' : 'bg-[#111826] border-white/[0.06]'}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <span className="font-black text-sm text-white">{item.name}</span>
                      <span className="text-[11px] text-slate-400 block">{item.phone}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-base font-black text-[#00e5ff] font-mono-numbers">₹{item.amount.toLocaleString('en-IN')}</span>
                      <span className={`text-[10px] block font-semibold mt-0.5 ${item.ageSeconds > 300 ? 'text-amber-400' : 'text-slate-500'}`}>
                        {item.ageSeconds > 300 ? '⚠ ' : ''}{formatAge(item.ageSeconds)}
                      </span>
                    </div>
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono truncate">{item.payoutMethod}: {item.details}</div>
                </div>
              ))}
            </div>

            {/* Payout Dispatch Console */}
            <div className="lg:col-span-7">
              {selectedWithdrawal ? (
                <div className="p-6 rounded-3xl bg-[#111826] border border-white/[0.06] sticky top-24">
                  <div className="flex items-center justify-between pb-4 border-b border-white/[0.06] mb-5">
                    <div>
                      <h3 className="font-black text-xl text-white">Process Outgoing Payout</h3>
                      <span className="text-[11px] text-slate-500 font-mono">Withdrawal Ref: {selectedWithdrawal.id}</span>
                    </div>
                    <span className="px-3 py-1 rounded-full text-xs font-black bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                      Disbursement Queued
                    </span>
                  </div>

                  {/* Details */}
                  <div className="space-y-3 mb-5">
                    <div className="flex justify-between py-2 border-b border-white/[0.04] text-sm">
                      <span className="text-slate-400 text-xs">Player</span>
                      <span className="font-bold text-white">{selectedWithdrawal.name} · {selectedWithdrawal.phone}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-white/[0.04]">
                      <span className="text-slate-400 text-xs">Amount To Send</span>
                      <span className="text-2xl font-black text-[#00e5ff] font-mono-numbers">₹{selectedWithdrawal.amount.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-white/[0.04]">
                      <span className="text-slate-400 text-xs">Payout Method</span>
                      <span className="text-xs font-black text-white">{selectedWithdrawal.payoutMethod}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-white/[0.04]">
                      <span className="text-slate-400 text-xs">Waiting Time</span>
                      <span className={`font-bold text-sm ${selectedWithdrawal.ageSeconds > 300 ? 'text-amber-400' : 'text-slate-300'}`}>
                        {formatAge(selectedWithdrawal.ageSeconds)}
                      </span>
                    </div>
                  </div>

                  {/* Destination Options: UPI and/or QR */}
                  <div className="space-y-3 mb-5">
                    {selectedWithdrawal.upiId && (
                      <div className="p-3.5 rounded-2xl bg-black/40 border border-white/[0.08] flex items-center justify-between">
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Player Receiving UPI ID</span>
                          <span className="text-sm font-bold text-[#ffb800] font-mono select-all">{selectedWithdrawal.upiId}</span>
                        </div>
                        <button
                          onClick={() => copyText(selectedWithdrawal.upiId || '', `wd-upi-${selectedWithdrawal.id}`)}
                          className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold text-white flex items-center gap-1.5 transition-all pressable"
                        >
                          {copied === `wd-upi-${selectedWithdrawal.id}` ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                              <span className="text-emerald-400">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Copy UPI</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}

                    {selectedWithdrawal.qrCode && (
                      <div className="p-4 rounded-2xl bg-black/40 border border-emerald-500/30 text-center space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-[11px] uppercase font-black text-emerald-400 flex items-center gap-1.5">
                            <QrCode className="w-4 h-4" /> Player Payment QR Code
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">Scan directly with UPI App</span>
                        </div>
                        <div className="bg-white/5 p-3 rounded-2xl border border-white/10 inline-block">
                          <img
                            src={selectedWithdrawal.qrCode}
                            alt="Player Receiving QR"
                            className="max-h-52 max-w-full rounded-xl object-contain mx-auto shadow-2xl"
                          />
                        </div>
                        <p className="text-[11px] text-slate-400">
                          Scan to pay exactly <strong className="text-[#00e5ff] font-mono">₹{selectedWithdrawal.amount.toLocaleString('en-IN')}</strong>
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Instructions */}
                  <div className="p-4 rounded-2xl bg-black/30 border border-white/[0.05] mb-5">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-5 h-5 rounded-lg bg-cyan-500/10 flex items-center justify-center text-[10px]">📋</div>
                      <span className="font-black text-sm text-white">Agent Instructions</span>
                    </div>
                    <div className="space-y-1.5 text-xs text-slate-400">
                      {[
                        'Open your UPI or Netbanking app (Google Pay, PhonePe, Paytm, Bank).',
                        selectedWithdrawal.qrCode
                          ? `Scan the player's QR code above or pay to ${selectedWithdrawal.upiId || 'their UPI'}.`
                          : `Send exactly ₹${selectedWithdrawal.amount.toLocaleString('en-IN')} to UPI: ${selectedWithdrawal.details}.`,
                        'After successful payment, copy the 12-digit UTR from your bank/UPI app.',
                        'Paste the 12-digit UTR below and click "Confirm Payout Dispatched".'
                      ].map((step, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <span className="w-4 h-4 rounded-full bg-white/[0.04] flex items-center justify-center text-[9px] font-black text-slate-500 shrink-0 mt-0.5">{i + 1}</span>
                          <span className="leading-relaxed">{step}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Actions */}
                  <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">12-digit UTR you sent</label>
                  <input
                    value={payoutUtr}
                    onChange={e => setPayoutUtr(e.target.value.replace(/\D/g, '').slice(0, 12))}
                    placeholder="UTR from your UPI app"
                    className="w-full mb-3 bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white font-mono outline-none"
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={async () => {
                        const res = await fetch(`${API_BASE}/api/v1/admin/withdrawals/${selectedWithdrawal.id}/reject`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ reason: 'P2P could not pay this UPI' })
                        });
                        const data = await res.json().catch(() => null);
                        if (!res.ok || !data?.success) return;
                        const nextList = withdrawals.filter(w => w.id !== selectedWithdrawal.id);
                        setWithdrawals(nextList);
                        setSelectedWithdrawal(nextList[0] || null);
                        setLogs(prev => [{
                          id: 'lg-' + Date.now(),
                          text: `Rejected payout ₹${selectedWithdrawal.amount.toLocaleString('en-IN')} for ${selectedWithdrawal.phone}. Hold refunded.`,
                          time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }),
                          type: 'WD',
                        }, ...prev]);
                      }}
                      className="py-3.5 rounded-2xl bg-red-500/10 hover:bg-red-500/15 text-red-400 border border-red-500/20 font-bold text-xs transition"
                    >
                      Reject & Refund Balance
                    </button>
                    <button
                      onClick={() => handleDispatchWithdrawal(selectedWithdrawal.id)}
                      disabled={payoutUtr.length !== 12}
                      className="py-3.5 rounded-2xl bg-[#00e5ff] hover:bg-[#00c8e0] text-black font-black text-sm flex items-center justify-center gap-2 transition shadow-lg shadow-cyan-500/20"
                    >
                      <Zap className="w-4 h-4" />
                      Mark paid with UTR
                    </button>
                  </div>
                </div>
              ) : (
                <div className="py-24 text-center text-slate-600 rounded-3xl bg-[#111826] border border-dashed border-white/[0.06]">
                  <ArrowUpFromLine className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="font-semibold text-sm">Select a payout to process</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'disputes' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 flex-1">
            {/* Disputes Queue List */}
            <div className="lg:col-span-5 space-y-2">
              <div className="flex items-center justify-between text-[11px] text-slate-500 font-bold mb-2 px-1">
                <span>OPEN DISPUTES & APPEALS ({disputes.length})</span>
                <span className="text-amber-400 font-semibold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 live-dot" /> Arbitration Desk
                </span>
              </div>

              {disputes.length === 0 ? (
                <div className="py-16 text-center rounded-2xl bg-[#111826] border border-white/[0.06]">
                  <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-3 opacity-60" />
                  <h4 className="font-black text-white text-sm">No Open Disputes</h4>
                  <p className="text-xs text-slate-500 mt-1">All player transactions are reconciled or resolved.</p>
                </div>
              ) : disputes.map(item => (
                <div
                  key={item.id}
                  onClick={() => setSelectedDispute(item)}
                  className={`queue-item p-4 rounded-2xl border cursor-pointer transition ${selectedDispute?.id === item.id ? 'border-amber-400/50 bg-[#1e1b12]' : 'bg-[#111826] border-white/[0.06] hover:border-white/20'}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <span className="font-black text-sm text-white">{item.name}</span>
                      <span className="text-[11px] text-slate-400 block">{item.phone}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-base font-black text-amber-400 font-mono-numbers">₹{item.amount.toLocaleString('en-IN')}</span>
                      <span className="text-[10px] block font-semibold mt-0.5 text-amber-400">
                        {formatAge(item.ageSeconds)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-mono text-slate-500">UTR: {item.utrNumber}</span>
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 font-bold text-[10px] border border-amber-500/30">DISPUTED</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Arbitration Details Console */}
            <div className="lg:col-span-7">
              {selectedDispute ? (
                <div className="p-6 rounded-3xl bg-[#111826] border border-amber-500/20 space-y-5 shadow-2xl">
                  <div className="flex items-center justify-between border-b border-white/[0.06] pb-4">
                    <div>
                      <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider">Arbitration Case</span>
                      <h3 className="text-xl font-black text-white font-mono mt-0.5">{selectedDispute.id}</h3>
                    </div>
                    <span className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 font-bold text-xs border border-amber-500/40">
                      UNDER ARBITRATION
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="p-3.5 rounded-xl bg-black/40 border border-white/[0.06] space-y-1">
                      <span className="text-slate-500 text-[10px] uppercase font-bold block">Player Account</span>
                      <p className="font-bold text-white text-sm">{selectedDispute.name}</p>
                      <p className="font-mono text-slate-400">{selectedDispute.phone}</p>
                    </div>
                    <div className="p-3.5 rounded-xl bg-black/40 border border-white/[0.06] space-y-1">
                      <span className="text-slate-500 text-[10px] uppercase font-bold block">Disputed Amount</span>
                      <p className="font-black text-amber-400 text-lg font-mono-numbers">₹{selectedDispute.amount.toLocaleString('en-IN')}</p>
                      <p className="font-mono text-slate-400">Type: {selectedDispute.type}</p>
                    </div>
                  </div>

                  {/* Player's Stated Reason */}
                  <div className="p-4 rounded-xl bg-[#1c1813] border border-amber-500/30 space-y-1.5">
                    <span className="text-[11px] font-bold text-amber-300 uppercase tracking-wide flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400" /> Player Dispute Explanation
                    </span>
                    <p className="text-xs text-amber-100 font-medium leading-relaxed">
                      "{selectedDispute.disputeReason}"
                    </p>
                    <div className="flex items-center gap-2 pt-1 font-mono text-[11px] text-slate-400">
                      <span>Submitted UTR:</span>
                      <span className="text-white font-bold">{selectedDispute.utrNumber}</span>
                      <button
                        onClick={() => copyText(selectedDispute.utrNumber || '', 'dis-utr')}
                        className="text-amber-400 hover:text-white p-0.5"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {/* Evidence Screenshot if available */}
                  {selectedDispute.disputeEvidence && (
                    <div className="space-y-2">
                      <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block">Player Uploaded Proof</span>
                      <div className="max-h-72 overflow-hidden rounded-2xl border border-white/[0.08] bg-black/50 p-2 flex items-center justify-center">
                        <img
                          src={selectedDispute.disputeEvidence}
                          alt="Dispute Proof"
                          className="max-h-64 object-contain rounded-xl"
                        />
                      </div>
                    </div>
                  )}

                  {/* Reject Reason Input */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-400 uppercase">Operator Decision Notes (Optional for reject)</label>
                    <input
                      type="text"
                      value={disputeRejectReason}
                      onChange={e => setDisputeRejectReason(e.target.value)}
                      placeholder="e.g. Bank statement confirms UTR does not match any incoming credit"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/[0.08] text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  {/* Action Buttons */}
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <button
                      onClick={() => handleResolveDispute(selectedDispute.id, 'REJECT', disputeRejectReason)}
                      disabled={isResolvingDispute}
                      className="py-3.5 rounded-2xl bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/30 font-bold text-xs transition disabled:opacity-50"
                    >
                      Reject Dispute
                    </button>
                    <button
                      onClick={() => handleResolveDispute(selectedDispute.id, 'APPROVE')}
                      disabled={isResolvingDispute}
                      className="py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-black font-black text-xs transition shadow-lg shadow-emerald-500/20 disabled:opacity-50 flex items-center justify-center gap-1.5"
                    >
                      <CheckCircle className="w-4 h-4" />
                      Approve & Credit Balance
                    </button>
                  </div>
                </div>
              ) : (
                <div className="py-24 text-center text-slate-600 rounded-3xl bg-[#111826] border border-dashed border-white/[0.06]">
                  <AlertTriangle className="w-12 h-12 mx-auto mb-3 opacity-30 text-amber-400" />
                  <p className="font-semibold text-sm">Select an open dispute to arbitrate</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'support' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 flex-1">
            {/* Tickets Queue List */}
            <div className="lg:col-span-5 space-y-2">
              <div className="flex items-center justify-between text-[11px] text-slate-500 font-bold mb-2 px-1">
                <span>CUSTOMER SUPPORT INQUIRIES ({supportTickets.length})</span>
                <span className="text-sky-400 font-semibold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-400 live-dot" /> Live Desk
                </span>
              </div>

              {/* Status Filter Tabs */}
              <div className="grid grid-cols-4 gap-1 p-1 rounded-xl bg-[#111826] border border-white/[0.06] mb-2 text-xs">
                {(['ALL', 'OPEN', 'IN_PROGRESS', 'RESOLVED'] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setSupportFilter(f)}
                    className={`py-1 rounded-lg font-bold text-[10px] transition ${
                      supportFilter === f ? 'bg-sky-500 text-black font-black' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>

              {supportTickets.filter(t => supportFilter === 'ALL' || t.status === supportFilter).length === 0 ? (
                <div className="py-16 text-center rounded-2xl bg-[#111826] border border-white/[0.06]">
                  <CheckCircle className="w-12 h-12 text-sky-400 mx-auto mb-3 opacity-60" />
                  <h4 className="font-black text-white text-sm">All Inquiries Handled</h4>
                  <p className="text-xs text-slate-500 mt-1">No open customer support tickets under this filter.</p>
                </div>
              ) : (
                supportTickets
                  .filter(t => supportFilter === 'ALL' || t.status === supportFilter)
                  .map(t => (
                    <div
                      key={t.id}
                      onClick={() => handleSelectSupportTicket(t)}
                      className={`queue-item p-4 rounded-2xl border cursor-pointer transition ${
                        selectedSupportTicket?.id === t.id
                          ? 'border-sky-400/50 bg-[#0f172a]'
                          : 'bg-[#111826] border-white/[0.06] hover:border-white/20'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-sm text-white">{t.user?.fullName || 'VIP Player'}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 font-bold border border-sky-500/30">
                            {t.category}
                          </span>
                        </div>
                        <span
                          className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-full ${
                            t.status === 'OPEN'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : t.status === 'IN_PROGRESS'
                              ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                              : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          }`}
                        >
                          {t.status}
                        </span>
                      </div>

                      <p className="text-xs font-semibold text-slate-300 truncate">{t.subject}</p>
                      {t.messages?.[0] && (
                        <p className="text-[11px] text-slate-400 truncate mt-0.5">"{t.messages[0].message}"</p>
                      )}

                      <div className="flex items-center justify-between text-[10px] text-slate-500 mt-2 pt-2 border-t border-white/[0.04]">
                        <span className="font-mono text-slate-400">{t.user?.phoneNumber}</span>
                        <span>{new Date(t.updatedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>
                  ))
              )}
            </div>

            {/* Conversation Thread & Customer Context Console */}
            <div className="lg:col-span-7">
              {selectedSupportTicket ? (
                <div className="p-5 rounded-3xl bg-[#111826] border border-sky-500/20 space-y-4 shadow-2xl flex flex-col h-[700px]">
                  {/* Top Bar: Customer Context */}
                  <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-black text-white">{selectedSupportTicket.user?.fullName || 'Player'}</h3>
                        <span className="text-xs font-mono text-slate-400">{selectedSupportTicket.user?.phoneNumber}</span>
                      </div>
                      <span className="text-[10px] text-sky-400 font-mono">Case #{selectedSupportTicket.id.slice(-8)} • {selectedSupportTicket.category}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      {selectedSupportTicket.status !== 'RESOLVED' ? (
                        <button
                          onClick={() => handleUpdateTicketStatus(selectedSupportTicket.id, 'RESOLVED')}
                          className="px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-bold transition flex items-center gap-1.5"
                        >
                          <CheckCheck className="w-3.5 h-3.5" />
                          <span>Mark Resolved</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => handleUpdateTicketStatus(selectedSupportTicket.id, 'OPEN')}
                          className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold transition"
                        >
                          Re-open
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Customer Quick Overview Card */}
                  {selectedSupportTicket.user?.wallet && (
                    <div className="grid grid-cols-3 gap-2 p-2.5 rounded-2xl bg-black/40 border border-white/[0.06] text-xs">
                      <div>
                        <span className="text-[10px] text-slate-500 block">Wallet Balance</span>
                        <span className="font-black text-emerald-400 font-mono-numbers">₹{Number(selectedSupportTicket.user.wallet.balance).toLocaleString('en-IN')}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 block">Locked Payouts</span>
                        <span className="font-bold text-amber-300 font-mono-numbers">₹{Number(selectedSupportTicket.user.wallet.locked).toLocaleString('en-IN')}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 block">Unwagered (1.0x)</span>
                        <span className="font-bold text-slate-300 font-mono-numbers">₹{Number(selectedSupportTicket.user.wallet.unwagered).toLocaleString('en-IN')}</span>
                      </div>
                    </div>
                  )}

                  {/* Messages Scroll Area */}
                  <div className="flex-1 overflow-y-auto space-y-3 p-3 rounded-2xl bg-[#0a0f1d] border border-white/[0.06] text-xs">
                    {(selectedSupportTicket.messages || []).map(m => (
                      <div
                        key={m.id}
                        className={`flex flex-col ${m.senderRole === 'USER' ? 'items-start' : 'items-end'}`}
                      >
                        <span className="text-[10px] text-slate-500 mb-0.5 px-1 font-semibold">
                          {m.senderRole === 'USER' ? (selectedSupportTicket.user?.fullName || 'Player') : 'Help Desk Agent'}
                        </span>
                        <div
                          className={`max-w-[85%] rounded-2xl p-3 leading-relaxed ${
                            m.senderRole === 'USER'
                              ? 'bg-[#1e293b] text-slate-200 border border-white/10 rounded-tl-none'
                              : 'bg-gradient-to-r from-sky-500 to-blue-600 text-white font-medium rounded-tr-none shadow-md shadow-sky-500/20'
                          }`}
                        >
                          {m.message}
                          {m.attachments && (
                            <img src={m.attachments} alt="Proof" className="mt-2 max-h-40 rounded-xl object-contain border border-white/20" />
                          )}
                        </div>
                        <span className="text-[9px] text-slate-500 mt-1 px-1 font-mono">
                          {new Date(m.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Reply Input Box */}
                  <form
                    onSubmit={e => {
                      e.preventDefault();
                      handleSendSupportReply();
                    }}
                    className="flex items-center gap-2 pt-1"
                  >
                    <input
                      type="text"
                      value={supportReplyText}
                      onChange={e => setSupportReplyText(e.target.value)}
                      placeholder="Type response to player (press Enter to send)..."
                      className="flex-1 px-4 py-3 rounded-2xl bg-black/40 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-400"
                    />
                    <button
                      type="submit"
                      disabled={isSendingSupportReply || !supportReplyText.trim()}
                      className="px-5 py-3 rounded-2xl bg-gradient-to-r from-sky-500 to-blue-500 hover:from-sky-400 hover:to-blue-400 text-black font-black text-xs transition shadow-lg shadow-sky-500/20 disabled:opacity-40 flex items-center gap-1.5"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{isSendingSupportReply ? 'Sending...' : 'Reply'}</span>
                    </button>
                  </form>
                </div>
              ) : (
                <div className="py-32 text-center text-slate-600 rounded-3xl bg-[#111826] border border-dashed border-white/[0.06]">
                  <Headphones className="w-12 h-12 mx-auto mb-3 opacity-30 text-sky-400" />
                  <p className="font-semibold text-sm">Select an inquiry to communicate with the customer</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'upi-rotator' && (
          <div className="p-6 rounded-3xl bg-[#111826] border border-white/[0.06] space-y-5">
            <div>
              <h3 className="font-black text-lg text-white">Publish a QR and UPI ID</h3>
              <p className="text-xs text-slate-400 mt-0.5">Players pay whichever account is serving. When its daily cap fills, the next active QR is shown.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input value={newUpiId} onChange={e => setNewUpiId(e.target.value)} placeholder="UPI ID" className="bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white" />
              <input value={newHolder} onChange={e => setNewHolder(e.target.value)} placeholder="Account name" className="bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white" />
              <input value={newBank} onChange={e => setNewBank(e.target.value)} placeholder="Bank" className="bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white" />
              <input type="number" value={newLimit} onChange={e => setNewLimit(Number(e.target.value))} placeholder="Daily cap" className="bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white" />
              <input type="file" accept="image/*" onChange={e => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = () => setNewQr(String(reader.result || ''));
                reader.readAsDataURL(file);
              }} className="text-xs text-slate-300 md:col-span-2" />
              <button
                onClick={async () => {
                  if (!newUpiId || !newHolder) return;
                  await fetch(`${API_BASE}/api/v1/payments/upi-accounts`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      upiId: newUpiId,
                      holderName: newHolder,
                      bankName: newBank || 'Bank',
                      dailyLimit: newLimit || 50000,
                      qrImageUrl: newQr || undefined
                    })
                  });
                  setNewUpiId('');
                  setNewHolder('');
                  setNewQr('');
                  const list = await fetch(`${API_BASE}/api/v1/payments/upi-accounts`).then(r => r.json()).catch(() => null);
                  const accounts = Array.isArray(list?.data) ? list.data : list?.data?.accounts;
                  if (Array.isArray(accounts)) setUpiAccounts(accounts);
                }}
                className="md:col-span-2 py-3 rounded-xl bg-[#0df59d] text-black font-black text-sm"
              >
                Publish this QR
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {upiAccounts.length === 0 && (
                <p className="text-sm text-slate-500">No QR published yet.</p>
              )}
              {upiAccounts.map((acc) => (
                <div key={acc.id} className={`p-5 rounded-2xl border ${acc.isCurrentlyServing ? 'border-[#0df59d] bg-black/40' : 'border-white/[0.06] bg-black/20'}`}>
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <span className="text-xs font-bold text-white block">{acc.holderName}</span>
                      <span className="text-[10px] text-slate-400">{acc.bankName}</span>
                    </div>
                    {acc.isCurrentlyServing ? (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500 text-black font-black text-[9px]">SERVING</span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-white/10 text-slate-400 font-bold text-[9px]">{acc.status}</span>
                    )}
                  </div>
                  <span className="font-mono text-xs font-black text-slate-200 block mb-3">{acc.upiId}</span>
                  <span className="text-[10px] text-slate-500 font-mono block">₹{acc.currentCollected.toLocaleString('en-IN')} / ₹{acc.dailyLimit.toLocaleString('en-IN')}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'logs' && (
          <div className="p-6 rounded-3xl bg-[#111826] border border-white/[0.06]">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="font-black text-lg text-white">Shift Audit Activity Stream</h3>
                <p className="text-xs text-slate-400 mt-0.5">{logs.length} actions recorded this shift</p>
              </div>
              <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 live-dot" />
                Live
              </div>
            </div>

            <div className="space-y-2 text-xs">
              {logs.length === 0 ? (
                <div className="py-12 text-center text-slate-600">
                  <History className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p className="font-semibold">No activity yet this shift</p>
                </div>
              ) : logs.map(log => (
                <div key={log.id} className="log-entry p-4 rounded-2xl bg-black/30 border border-white/[0.04] flex items-center justify-between hover:bg-black/40 transition">
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black shrink-0 ${log.type === 'DEP' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20' : 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/20'}`}>
                      {log.type === 'DEP' ? '↓ DEPOSIT' : '↑ PAYOUT'}
                    </span>
                    <span className="text-slate-300 font-medium">{log.text}</span>
                  </div>
                  <span className="text-slate-600 font-mono text-[10px] shrink-0 ml-4">{log.time}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

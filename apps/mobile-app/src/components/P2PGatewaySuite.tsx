import React, { useState, useEffect, useCallback } from 'react';
import {
  Wallet,
  Zap,
  ArrowUpRight,
  ArrowDownLeft,
  QrCode,
  Copy,
  Check,
  CheckCircle2,
  Clock,
  AlertTriangle,
  FileText,
  ShieldCheck,
  RefreshCw,
  Search,
  Filter,
  Download,
  Upload,
  X,
  ExternalLink,
  ChevronRight,
  Headphones,
  Scale,
  Sparkles,
  Lock,
  Camera,
  Info
} from 'lucide-react';

export interface P2PGatewaySuiteProps {
  API_BASE: string;
  balance: number;
  lockedBalance: number;
  phoneNumber: string;
  userName: string;
  authHeaders: () => Record<string, string>;
  showToast: (msg: string) => void;
  sound: any;
  onRefreshWallet: (feedback?: boolean) => void;
  activeUpiInfo: { upiId: string; holderName: string; bankName: string; qrImageUrl?: string };
  onOpenArena: () => void;
  onOpenSupport?: () => void;
  isWaitingP2PApproval: boolean;
  setIsWaitingP2PApproval: (v: boolean) => void;
  submittedUtrRef: string;
  setSubmittedUtrRef: (v: string) => void;
  pendingDepositId: string;
  setPendingDepositId: (v: string) => void;
  initialSubTab?: 'overview' | 'create' | 'checkout' | 'history' | 'disputes';
}

export interface P2PReceipt {
  receiptNumber: string;
  orderId: string;
  utrNumber: string | null;
  type: string;
  status: string;
  grossAmount: number;
  fee: number;
  tdsAmount: number;
  netAmount: number;
  counterparty: { holderName: string; bankName: string; upiId: string } | null;
  payoutUpi?: string | null;
  player: { fullName: string; phoneMasked: string; state: string };
  timeline: Array<{ stage: string; timestamp: string | null; completed: boolean; note?: string }>;
  approvedBy: string | null;
  approvedAt: string | null;
  createdAt: string;
  brand: string;
  complianceHash: string;
}

export function compressImageClient(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const maxDim = 1200;
        if (width > height && width > maxDim) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else if (height > maxDim) {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(String(e.target?.result || ''));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.75));
      };
      img.onerror = reject;
      img.src = String(e.target?.result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function P2PGatewaySuite({
  API_BASE,
  balance,
  lockedBalance,
  phoneNumber,
  userName,
  authHeaders,
  showToast,
  sound,
  onRefreshWallet,
  activeUpiInfo,
  onOpenArena,
  onOpenSupport,
  isWaitingP2PApproval,
  setIsWaitingP2PApproval,
  submittedUtrRef,
  setSubmittedUtrRef,
  pendingDepositId,
  setPendingDepositId,
  initialSubTab = 'overview'
}: P2PGatewaySuiteProps) {
  const [subTab, setSubTab] = useState<'overview' | 'create' | 'checkout' | 'history' | 'disputes'>(
    isWaitingP2PApproval ? 'checkout' : initialSubTab
  );

  // Guided Creator State
  const [createType, setCreateType] = useState<'DEPOSIT' | 'WITHDRAWAL'>('DEPOSIT');
  const [createStep, setCreateStep] = useState<number>(1);
  const [amountChoice, setAmountChoice] = useState<number>(1000);
  const [customAmount, setCustomAmount] = useState<string>('1000');
  const [payoutUpiInput, setPayoutUpiInput] = useState<string>('');
  const [payoutQrImage, setPayoutQrImage] = useState<string | null>(null);
  const [payoutQrFileName, setPayoutQrFileName] = useState<string>('');
  const [isSubmittingOrder, setIsSubmittingOrder] = useState<boolean>(false);

  // Checkout State
  const [checkoutOrderId, setCheckoutOrderId] = useState<string>(pendingDepositId || '');
  const [checkoutAmount, setCheckoutAmount] = useState<number>(1000);
  const [checkoutUpiInfo, setCheckoutUpiInfo] = useState(activeUpiInfo);
  const [utrInput, setUtrInput] = useState<string>(submittedUtrRef || '');
  const [screenshotBase64, setScreenshotBase64] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number>(900); // 15 mins countdown
  const [isSubmittingProof, setIsSubmittingProof] = useState<boolean>(false);
  const [submittedUtrTime, setSubmittedUtrTime] = useState<string>('');

  // Receipt Modal State
  const [activeReceipt, setActiveReceipt] = useState<P2PReceipt | null>(null);
  const [isLoadingReceipt, setIsLoadingReceipt] = useState<boolean>(false);

  // History & Filter State
  const [historyList, setHistoryList] = useState<any[]>([]);
  const [historySearch, setHistorySearch] = useState<string>('');
  const [historyFilter, setHistoryFilter] = useState<'ALL' | 'SUCCESS' | 'PENDING' | 'DISPUTED' | 'WITHDRAWAL'>('ALL');
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(false);

  // Stats State
  const [p2pStats, setP2pStats] = useState({
    user: { totalDeposits: 0, totalWithdrawals: 0, completedCount: 0, pendingCount: 0, disputedCount: 0, successRate: 100 },
    platform: { averageMatchingSec: 45, deskActive: true, verifiedChannelsCount: 11, totalCompletedTransactions: 2450 }
  });

  // Dispute Flow State
  const [disputeTxId, setDisputeTxId] = useState<string>('');
  const [disputeReason, setDisputeReason] = useState<string>('Bank deducted amount but wallet not credited yet');
  const [disputeEvidence, setDisputeEvidence] = useState<string>('');
  const [isSubmittingDispute, setIsSubmittingDispute] = useState<boolean>(false);

  // Synchronize incoming waiting states
  useEffect(() => {
    if (isWaitingP2PApproval && subTab === 'overview') {
      setSubTab('checkout');
    }
  }, [isWaitingP2PApproval]);

  // Checkout Countdown Timer
  useEffect(() => {
    if (subTab !== 'checkout') return;
    const interval = setInterval(() => {
      setSecondsLeft(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [subTab]);

  // Load P2P stats and history
  const loadStatsAndHistory = useCallback(async () => {
    try {
      setIsLoadingHistory(true);
      const [statsRes, historyRes] = await Promise.all([
        fetch(`${API_BASE}/api/v1/payments/p2p-stats`, { headers: authHeaders() }),
        fetch(`${API_BASE}/api/v1/payments/history?limit=40`, { headers: authHeaders() })
      ]);
      const statsJson = await statsRes.json();
      const historyJson = await historyRes.json();
      if (statsJson.success && statsJson.data) setP2pStats(statsJson.data);
      if (historyJson.success && Array.isArray(historyJson.data)) setHistoryList(historyJson.data);
    } catch {
      // silent
    } finally {
      setIsLoadingHistory(false);
    }
  }, [API_BASE, authHeaders]);

  useEffect(() => {
    loadStatsAndHistory();
  }, [loadStatsAndHistory]);

  // Format seconds to mm:ss
  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Step 1 -> 7: Execute Deposit Intent Creation
  const handleCreateDepositIntent = async () => {
    const finalAmt = Number(customAmount) || amountChoice;
    if (finalAmt < 100) {
      sound.playError();
      showToast('Minimum deposit is ₹100.');
      return;
    }
    setIsSubmittingOrder(true);
    sound.playButtonClick();
    try {
      const res = await fetch(`${API_BASE}/api/v1/payments/deposit-intent`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ amount: finalAmt })
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        sound.playError();
        showToast(json.error || 'Could not initiate deposit order.');
        return;
      }
      const data = json.data;
      setPendingDepositId(data.transactionId);
      setCheckoutOrderId(data.transactionId);
      setCheckoutAmount(finalAmt);
      setCheckoutUpiInfo({
        upiId: data.upiId,
        holderName: data.holderName,
        bankName: data.bankName,
        qrImageUrl: data.qrImageUrl
      });
      setSecondsLeft(data.expiresInSec || 900);
      setSubTab('checkout');
      sound.playSuccess();
      showToast('Order generated! Complete UPI payment below.');
    } catch {
      sound.playError();
      showToast('Network error connecting to payment gateway.');
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  // Execute Withdrawal Creation
  const handleCreateWithdrawal = async () => {
    const finalAmt = Number(customAmount);
    if (!finalAmt || isNaN(finalAmt)) {
      sound.playError();
      showToast('Please type the amount you want to withdraw.');
      return;
    }
    if (finalAmt < 500) {
      sound.playError();
      showToast('Minimum payout request is ₹500.');
      return;
    }
    if (finalAmt > 50000) {
      sound.playError();
      showToast('Maximum payout request is ₹50,000 for one time.');
      return;
    }
    if (finalAmt > balance) {
      sound.playError();
      showToast(`Insufficient balance. Your available balance is ₹${balance.toLocaleString('en-IN')}.`);
      return;
    }

    const cleanUpi = payoutUpiInput.trim();
    if (!cleanUpi && !payoutQrImage) {
      sound.playError();
      showToast('Please enter your receiving UPI ID or upload your payment QR code (or both).');
      return;
    }
    if (cleanUpi && !cleanUpi.includes('@')) {
      sound.playError();
      showToast('Please enter a valid receiving UPI ID (e.g. name@okhdfcbank).');
      return;
    }

    setIsSubmittingOrder(true);
    sound.playButtonClick();
    try {
      const res = await fetch(`${API_BASE}/api/v1/payments/withdraw`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          amount: finalAmt,
          upiId: cleanUpi || undefined,
          qrCode: payoutQrImage || undefined
        })
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        sound.playError();
        showToast(json.error || 'Withdrawal was not accepted.');
        return;
      }
      sound.playSuccess();
      showToast(json.data?.message || 'Payout request submitted to desk.');
      onRefreshWallet(false);
      loadStatsAndHistory();
      setSubTab('history');
    } catch {
      sound.playError();
      showToast('Network error reaching payout desk.');
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  // Submit UTR Proof in Checkout
  const handleSubmitUtrProof = async () => {
    const cleanUtr = utrInput.replace(/\D/g, '');
    if (cleanUtr.length !== 12) {
      sound.playError();
      showToast('Please enter a valid 12-digit bank UTR reference.');
      return;
    }
    if (!checkoutOrderId) {
      sound.playError();
      showToast('No active order reference found.');
      return;
    }
    setIsSubmittingProof(true);
    sound.playButtonClick();
    try {
      const res = await fetch(`${API_BASE}/api/v1/payments/submit-utr`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          transactionId: checkoutOrderId,
          utrNumber: cleanUtr,
          amount: checkoutAmount,
          screenshotBase64: screenshotBase64 || undefined
        })
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        sound.playError();
        showToast(json.error || 'Proof submission failed.');
        return;
      }
      setSubmittedUtrRef(cleanUtr);
      setIsWaitingP2PApproval(true);
      const nowTime = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
      setSubmittedUtrTime(nowTime);
      sound.playSuccess();
      showToast(`UTR ${cleanUtr} submitted! Verification in progress...`);
      setTimeout(() => onRefreshWallet(false), 2000);
      loadStatsAndHistory();
    } catch {
      sound.playError();
      showToast('Network error submitting UTR.');
    } finally {
      setIsSubmittingProof(false);
    }
  };

  // Cancel Pending Order
  const handleCancelOrder = async () => {
    if (!checkoutOrderId) return;
    if (isWaitingP2PApproval) {
      showToast('Cannot cancel an order after UTR is submitted. Please raise an appeal if needed.');
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/v1/payments/cancel-order`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ transactionId: checkoutOrderId })
      });
      const json = await res.json();
      if (json.success) {
        showToast('Order cancelled.');
        setCheckoutOrderId('');
        setPendingDepositId('');
        setSubTab('overview');
        loadStatsAndHistory();
      } else {
        showToast(json.error || 'Could not cancel order.');
      }
    } catch {
      showToast('Error cancelling order.');
    }
  };

  // Submit Dispute / Appeal
  const handleSubmitDispute = async () => {
    if (!disputeTxId) {
      showToast('Please select the transaction to dispute.');
      return;
    }
    if (!disputeReason.trim()) {
      showToast('Please enter the reason for the dispute.');
      return;
    }
    setIsSubmittingDispute(true);
    sound.playButtonClick();
    try {
      const res = await fetch(`${API_BASE}/api/v1/payments/dispute`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          transactionId: disputeTxId,
          reason: disputeReason,
          evidence: disputeEvidence || undefined
        })
      });
      const json = await res.json();
      if (json.success) {
        sound.playSuccess();
        showToast('Dispute lodged! Priority escalated to arbitration desk.');
        setDisputeTxId('');
        setDisputeEvidence('');
        loadStatsAndHistory();
        setSubTab('history');
      } else {
        sound.playError();
        showToast(json.error || 'Could not submit dispute.');
      }
    } catch {
      sound.playError();
      showToast('Error lodging dispute.');
    } finally {
      setIsSubmittingDispute(false);
    }
  };

  // Open Verifiable Receipt
  const handleOpenReceipt = async (txId: string) => {
    try {
      setIsLoadingReceipt(true);
      const res = await fetch(`${API_BASE}/api/v1/payments/receipt/${txId}`, { headers: authHeaders() });
      const json = await res.json();
      if (json.success && json.data) {
        setActiveReceipt(json.data);
      } else {
        showToast(json.error || 'Receipt unavailable.');
      }
    } catch {
      showToast('Error generating receipt.');
    } finally {
      setIsLoadingReceipt(false);
    }
  };

  // Filtered History
  const filteredHistory = historyList.filter(item => {
    const q = historySearch.toLowerCase().trim();
    const matchesQuery = !q || (item.utrNumber && item.utrNumber.includes(q)) || (item.id && item.id.includes(q));
    if (!matchesQuery) return false;
    if (historyFilter === 'ALL') return true;
    if (historyFilter === 'SUCCESS') return item.status === 'SUCCESS';
    if (historyFilter === 'PENDING') return item.status === 'PENDING';
    if (historyFilter === 'DISPUTED') return item.status === 'DISPUTED';
    if (historyFilter === 'WITHDRAWAL') return item.type === 'WITHDRAWAL';
    return true;
  });

  return (
    <div className="w-full max-w-md mx-auto min-h-[calc(100vh-120px)] pb-24 text-amber-100 font-sans animate-fade-in">
      {/* ── GATEWAY TOP BAR & SUB-NAV ── */}
      <div className="sticky top-14 z-20 bg-[#140f0a]/95 backdrop-blur-md border-b border-amber-500/20 px-3 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-amber-500/15 border border-amber-500/40 flex items-center justify-center text-amber-400">
            <Zap className="w-4 h-4 fill-amber-400" />
          </div>
          <div>
            <h2 className="text-xs font-black tracking-wide text-amber-100 font-serif">P2P Gateway Suite</h2>
            <p className="text-[9px] text-amber-200/60 leading-none">Instant 1-Click Settlement & Verification</p>
          </div>
        </div>

        {/* Quick Sync */}
        <button
          onClick={() => {
            onRefreshWallet(true);
            loadStatsAndHistory();
          }}
          className="px-2 py-1 rounded-lg bg-[#1c150e] border border-amber-500/30 text-amber-300 text-[10px] font-bold flex items-center gap-1 pressable"
        >
          <RefreshCw className="w-3 h-3 text-amber-400" />
          <span>Sync</span>
        </button>
      </div>

      {/* Sub-Navigation Pills */}
      <div className="p-2.5 flex items-center gap-1.5 overflow-x-auto no-scrollbar border-b border-amber-500/15 bg-[#120d09]">
        {[
          { id: 'overview', label: 'Dashboard', icon: Wallet },
          { id: 'create', label: 'Create Order', icon: Zap },
          { id: 'checkout', label: isWaitingP2PApproval ? '⚡ Active Order' : 'Checkout', icon: Clock },
          { id: 'history', label: 'History & Receipts', icon: FileText },
          { id: 'disputes', label: 'Disputes & SLA', icon: Scale }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = subTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                sound.playButtonClick();
                setSubTab(tab.id as any);
              }}
              className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap flex items-center gap-1.5 transition-all pressable ${
                isActive
                  ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-black shadow-md font-black border border-amber-300'
                  : 'bg-[#1c150e] text-amber-200/70 border border-amber-500/20 hover:text-white'
              }`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <span>{tab.label}</span>
              {tab.id === 'checkout' && isWaitingP2PApproval && (
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              )}
            </button>
          );
        })}
      </div>

      {/* ── SUB-VIEW: OVERVIEW DASHBOARD ── */}
      {subTab === 'overview' && (
        <div className="p-3.5 space-y-4">
          {/* Real-time Ledger Card */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-[#1c150e] via-[#140f0a] to-[#221810] border-2 border-amber-500/30 shadow-xl relative overflow-hidden">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-amber-200/60 block">Playable Wallet Balance</span>
                <span className="font-mono-numbers font-black text-2xl text-amber-300">
                  ₹{balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/40 text-[9px] font-bold text-amber-300 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-amber-400" />
                <span>100% Insured</span>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-amber-500/20">
              <button
                onClick={() => {
                  setCreateType('DEPOSIT');
                  setSubTab('create');
                }}
                className="py-3 px-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-black font-black text-xs pressable flex items-center justify-center gap-1.5 shadow-md shadow-amber-500/20 border border-amber-300"
              >
                <ArrowDownLeft className="w-4 h-4 stroke-[2.5]" />
                <span>Add Money (+50% Bonus)</span>
              </button>
              <button
                onClick={() => {
                  setCreateType('WITHDRAWAL');
                  setSubTab('create');
                }}
                className="py-3 px-3 rounded-xl bg-[#221810] text-amber-200 font-bold text-xs pressable flex items-center justify-center gap-1.5 border border-amber-500/30 hover:border-amber-400"
              >
                <ArrowUpRight className="w-4 h-4 text-amber-400" />
                <span>Request Payout</span>
              </button>
            </div>
          </div>

          {/* Active Order Banner if waiting */}
          {isWaitingP2PApproval && (
            <div
              onClick={() => setSubTab('checkout')}
              className="p-3.5 rounded-2xl bg-amber-500/15 border-2 border-amber-400 flex items-center justify-between cursor-pointer pressable shadow-lg animate-pulse"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-400 flex items-center justify-center text-amber-300">
                  <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
                </div>
                <div>
                  <span className="text-xs font-black text-amber-200 block">Active Settlement In Progress</span>
                  <span className="text-[10px] text-amber-200/70">UTR: {submittedUtrRef || 'Submitted'} • Click to view checkout</span>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-amber-400" />
            </div>
          )}

          {/* Platform Performance & Reliability Metrics */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="p-3 rounded-xl bg-[#1c150e] border border-amber-500/20 space-y-1">
              <span className="text-[10px] uppercase font-bold text-amber-200/60 block">Settlement SLA</span>
              <div className="flex items-center gap-1.5 text-xs font-black text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span>~{p2pStats.platform.averageMatchingSec}s Avg Speed</span>
              </div>
              <span className="text-[9px] text-amber-200/50">11 Rotated Banking Nodes</span>
            </div>

            <div className="p-3 rounded-xl bg-[#1c150e] border border-amber-500/20 space-y-1">
              <span className="text-[10px] uppercase font-bold text-amber-200/60 block">Verified Success Rate</span>
              <span className="text-xs font-black text-amber-300 block">{p2pStats.user.successRate}% Flawless</span>
              <span className="text-[9px] text-amber-200/50">{p2pStats.user.completedCount} Settled Orders</span>
            </div>
          </div>

          {/* Quick Shortcuts to Dispute & Receipts */}
          <div className="space-y-2">
            <div
              onClick={() => setSubTab('history')}
              className="p-3 rounded-xl bg-[#1c150e] border border-amber-500/25 flex items-center justify-between cursor-pointer pressable hover:border-amber-400"
            >
              <div className="flex items-center gap-2.5">
                <FileText className="w-4 h-4 text-amber-400" />
                <div>
                  <span className="text-xs font-bold text-amber-100 block">Download Cryptographic Receipts</span>
                  <span className="text-[10px] text-amber-200/60">Verifiable SHA-256 settlement statements</span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-amber-400" />
            </div>

            <div
              onClick={() => setSubTab('disputes')}
              className="p-3 rounded-xl bg-[#1c150e] border border-amber-500/25 flex items-center justify-between cursor-pointer pressable hover:border-amber-400"
            >
              <div className="flex items-center gap-2.5">
                <Scale className="w-4 h-4 text-amber-400" />
                <div>
                  <span className="text-xs font-bold text-amber-100 block">Arbitration & Dispute Resolution</span>
                  <span className="text-[10px] text-amber-200/60">Resolve delayed or mismatched UTR payments</span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-amber-400" />
            </div>
          </div>
        </div>
      )}

      {/* ── SUB-VIEW: 7-STEP GUIDED CREATOR ── */}
      {subTab === 'create' && (
        <div className="p-3.5 space-y-4">
          {/* Type Toggle */}
          <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-[#1c150e] border border-amber-500/30">
            <button
              onClick={() => setCreateType('DEPOSIT')}
              className={`py-2.5 rounded-lg text-xs font-bold transition-all pressable ${
                createType === 'DEPOSIT'
                  ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-black shadow-md font-black'
                  : 'text-amber-200/60 hover:text-white'
              }`}
            >
              Deposit (Add Cash)
            </button>
            <button
              onClick={() => setCreateType('WITHDRAWAL')}
              className={`py-2.5 rounded-lg text-xs font-bold transition-all pressable ${
                createType === 'WITHDRAWAL'
                  ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-black shadow-md font-black'
                  : 'text-amber-200/60 hover:text-white'
              }`}
            >
              Withdraw (Payout)
            </button>
          </div>

          {/* Amount & Destination Selector */}
          <div className="p-4 rounded-2xl bg-[#1c150e] border border-amber-500/25 space-y-4">
            {createType === 'DEPOSIT' ? (
              <>
                <span className="text-[10px] uppercase font-bold text-amber-200/70 block">Select Order Amount</span>
                <div className="grid grid-cols-4 gap-2">
                  {[200, 500, 1000, 2500].map(amt => (
                    <button
                      key={amt}
                      onClick={() => {
                        setAmountChoice(amt);
                        setCustomAmount(String(amt));
                      }}
                      className={`py-2.5 rounded-xl font-mono-numbers font-black text-xs pressable transition-all ${
                        (Number(customAmount) || amountChoice) === amt
                          ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-black shadow-md border border-amber-300'
                          : 'bg-[#221810] border border-amber-500/25 text-amber-200 hover:border-amber-400'
                      }`}
                    >
                      ₹{amt}
                    </button>
                  ))}
                </div>

                <div>
                  <label className="text-[10px] uppercase font-bold text-amber-200/70 block mb-1">
                    Custom Amount (₹)
                  </label>
                  <input
                    type="number"
                    value={customAmount}
                    onChange={e => setCustomAmount(e.target.value)}
                    placeholder="Enter amount"
                    className="w-full bg-[#140f0a] border border-amber-500/30 rounded-xl px-4 py-3 text-amber-100 placeholder:text-amber-200/30 font-mono-numbers text-base outline-none focus:border-amber-400"
                  />
                </div>
              </>
            ) : (
              <>
                {/* Withdrawal Amount - No suggestions, user types own amount */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] uppercase tracking-wide font-black text-amber-300">
                      Enter Payout Amount
                    </label>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-amber-200/70 font-mono">
                        Available: <strong className="text-white">₹{balance.toLocaleString('en-IN')}</strong>
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const maxVal = Math.min(50000, Math.max(0, balance));
                          setCustomAmount(String(maxVal));
                        }}
                        className="px-2 py-0.5 rounded-md bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] font-black hover:bg-amber-500/30 pressable"
                      >
                        All
                      </button>
                    </div>
                  </div>

                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-amber-400 font-mono text-lg font-black">
                      ₹
                    </span>
                    <input
                      type="number"
                      min={500}
                      max={50000}
                      value={customAmount}
                      onChange={e => setCustomAmount(e.target.value)}
                      placeholder="Type amount to withdraw"
                      className="w-full bg-[#140f0a] border border-amber-500/40 rounded-xl pl-9 pr-4 py-3.5 text-amber-100 placeholder:text-amber-200/30 font-mono-numbers text-lg font-black outline-none focus:border-amber-400 shadow-inner"
                    />
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-amber-200/60 font-mono px-1">
                    <span>Min Payout: ₹500</span>
                    <span className="text-amber-300 font-bold">Max 1-Time: ₹50,000</span>
                  </div>
                </div>

                {/* Receiving Destination - UPI ID or QR Code or Both */}
                <div className="pt-3 border-t border-amber-500/20 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] uppercase font-black text-amber-300 flex items-center gap-1.5">
                      <QrCode className="w-3.5 h-3.5 text-amber-400" />
                      Receiving Destination (UPI ID or QR Code or Both)
                    </span>
                    <span className="text-[9px] text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/30">
                      Direct P2P
                    </span>
                  </div>

                  {/* Field 1: Receiving UPI ID */}
                  <div>
                    <label className="text-[10px] uppercase font-semibold text-amber-200/70 block mb-1">
                      Option 1: Receiving UPI ID
                    </label>
                    <input
                      type="text"
                      value={payoutUpiInput}
                      onChange={e => setPayoutUpiInput(e.target.value)}
                      placeholder="e.g. 7972272861@paytm or name@okhdfcbank"
                      className="w-full bg-[#140f0a] border border-amber-500/30 rounded-xl px-4 py-2.5 text-amber-100 placeholder:text-amber-200/30 font-mono text-xs outline-none focus:border-amber-400"
                    />
                  </div>

                  {/* Field 2: Receiving QR Code */}
                  <div>
                    <label className="text-[10px] uppercase font-semibold text-amber-200/70 block mb-1">
                      Option 2: Receiving QR Code Image
                    </label>
                    {payoutQrImage ? (
                      <div className="p-2.5 rounded-xl bg-[#140f0a] border border-emerald-500/40 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <img
                            src={payoutQrImage}
                            alt="Receiving QR"
                            className="w-12 h-12 rounded-lg object-contain bg-white/10 border border-emerald-500/40 p-0.5 shrink-0"
                          />
                          <div className="min-w-0">
                            <span className="text-xs font-bold text-emerald-300 block truncate max-w-[190px]">
                              {payoutQrFileName || 'Personal QR Code Attached'}
                            </span>
                            <span className="text-[10px] text-emerald-400/80">✓ Verified receiving QR</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setPayoutQrImage(null);
                            setPayoutQrFileName('');
                          }}
                          className="text-amber-200/60 hover:text-white p-1.5 rounded-lg bg-black/40 hover:bg-black/60 pressable"
                        >
                          <X className="w-4 h-4 text-red-400" />
                        </button>
                      </div>
                    ) : (
                      <label className="w-full py-3 px-3.5 rounded-xl bg-[#140f0a] border border-dashed border-amber-500/40 text-center flex flex-col items-center justify-center gap-1 hover:border-amber-400 cursor-pointer pressable transition-all">
                        <div className="flex items-center gap-2 text-amber-300 font-bold text-xs">
                          <Camera className="w-4 h-4 text-amber-400" />
                          <span>Tap to Upload / Choose QR Code Image</span>
                        </div>
                        <span className="text-[10px] text-amber-200/50">
                          GPay, PhonePe, Paytm or Banking QR screenshot
                        </span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={async e => {
                            const file = e.target.files?.[0];
                            if (file) {
                              try {
                                const compressed = await compressImageClient(file);
                                setPayoutQrImage(compressed);
                                setPayoutQrFileName(file.name || 'qr_code.png');
                                showToast('QR Code attached successfully.');
                              } catch {
                                showToast('Could not load QR code image.');
                              }
                            }
                          }}
                          className="hidden"
                        />
                      </label>
                    )}
                  </div>

                  <p className="text-[10px] text-amber-200/50 italic">
                    💡 You can provide your UPI ID, your payment QR code, or both for smooth dispatch.
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Financial Breakdown & Summary */}
          <div className="p-3.5 rounded-2xl bg-[#1c150e] border border-amber-500/25 space-y-2 text-xs font-mono">
            <span className="text-[10px] uppercase font-bold font-sans text-amber-200/60 block">Transparent Order Breakdown</span>
            <div className="flex justify-between">
              <span className="text-amber-200/70">Order Principal:</span>
              <span className="font-bold text-amber-100">
                ₹{(Number(customAmount) || (createType === 'DEPOSIT' ? amountChoice : 0)).toLocaleString('en-IN')}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-amber-200/70">Platform Gateway Fee:</span>
              <span className="font-bold text-emerald-400">₹0.00 (Free)</span>
            </div>
            {createType === 'DEPOSIT' ? (
              <div className="flex justify-between">
                <span className="text-amber-200/70">First Deposit Bonus (+50%):</span>
                <span className="font-bold text-emerald-400">
                  +₹{((Number(customAmount) || amountChoice) * 0.5).toLocaleString('en-IN')}
                </span>
              </div>
            ) : (
              <div className="flex justify-between">
                <span className="text-amber-200/70">Section 194BA 30% TDS:</span>
                <span className="font-bold text-amber-300">₹0.00 (Exempt)</span>
              </div>
            )}
            <div className="flex justify-between border-t border-amber-500/20 pt-2 text-sm font-black">
              <span className="text-amber-200">Total Settlement Value:</span>
              <span className="text-amber-300">
                ₹{createType === 'DEPOSIT'
                  ? ((Number(customAmount) || amountChoice) * 1.5).toLocaleString('en-IN')
                  : (Number(customAmount) || 0).toLocaleString('en-IN')}
              </span>
            </div>
          </div>

          {/* Action Trigger */}
          <button
            disabled={isSubmittingOrder}
            onClick={createType === 'DEPOSIT' ? handleCreateDepositIntent : handleCreateWithdrawal}
            className="w-full py-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-black font-black text-sm pressable shadow-lg shadow-amber-500/20 border border-amber-300 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isSubmittingOrder ? (
              <>
                <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                <span>Creating Verifiable Order...</span>
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 fill-black" />
                <span>
                  {createType === 'DEPOSIT' ? 'Proceed to Gateway Checkout' : 'Submit Payout Request'}
                </span>
              </>
            )}
          </button>
        </div>
      )}

      {/* ── SUB-VIEW: PAYMENT GATEWAY CHECKOUT ── */}
      {subTab === 'checkout' && (
        <div className="p-3.5 space-y-4">
          {/* Checkout Header with Countdown */}
          <div className="p-3.5 rounded-2xl bg-[#1c150e] border border-amber-500/30 flex items-center justify-between">
            <div>
              <span className="text-[10px] uppercase font-bold text-amber-200/60 block">Checkout Session</span>
              <span className="font-mono-numbers font-black text-sm text-amber-300">
                {checkoutOrderId ? `SND-TX-${checkoutOrderId.slice(0, 8).toUpperCase()}` : 'Ready for Order'}
              </span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-500/15 border border-amber-400 text-amber-300 text-xs font-mono font-bold">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span>{formatTimer(secondsLeft)}</span>
            </div>
          </div>

          {/* Desk Payment Credentials Card */}
          <div className="p-4 rounded-2xl bg-[#1c150e] border-2 border-amber-500/30 flex flex-col items-center space-y-3">
            {/* Dynamic Scannable QR Code */}
            <div className="w-40 h-40 bg-white p-2.5 rounded-2xl flex items-center justify-center shadow-2xl border border-amber-500/40">
              {checkoutUpiInfo.upiId ? (
                <img
                  src={checkoutUpiInfo.qrImageUrl || `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=upi%3A%2F%2Fpay%3Fpa%3D${encodeURIComponent(checkoutUpiInfo.upiId)}%26pn%3D${encodeURIComponent(checkoutUpiInfo.holderName || 'SURRAT_ND')}%26cu%3DINR`}
                  alt="Payment QR"
                  className="w-full h-full object-contain rounded-xl"
                />
              ) : (
                <p className="text-[11px] text-slate-500 text-center">Loading rotated desk QR...</p>
              )}
            </div>

            {/* Download QR Button */}
            <button
              onClick={() => {
                const qrUrl = checkoutUpiInfo.qrImageUrl || `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=upi%3A%2F%2Fpay%3Fpa%3D${encodeURIComponent(checkoutUpiInfo.upiId)}%26pn%3DSURRAT_ND%26cu%3DINR`;
                const a = document.createElement('a');
                a.href = qrUrl;
                a.download = `SURRAT_ND_QR_${checkoutUpiInfo.upiId}.png`;
                a.target = '_blank';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                showToast('📥 QR saved to gallery! Scan via GPay/PhonePe.');
              }}
              className="w-full py-2 px-3 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-200 font-bold text-xs flex items-center justify-center gap-1.5 pressable border border-amber-500/30"
            >
              <Download className="w-3.5 h-3.5 text-amber-400" />
              <span>Save QR to Gallery (1-Tap Scan)</span>
            </button>

            {/* Copyable UPI Box */}
            <div className="w-full p-2.5 rounded-xl bg-[#140f0a] border border-amber-500/20 flex items-center justify-between text-xs font-mono">
              <span className="text-amber-200 truncate max-w-[220px]">{checkoutUpiInfo.upiId || 'p2p.desk@bank'}</span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(checkoutUpiInfo.upiId || '');
                  showToast('UPI ID copied to clipboard!');
                }}
                className="text-amber-400 font-bold hover:underline flex items-center gap-1 shrink-0"
              >
                <Copy className="w-3 h-3" />
                <span>Copy</span>
              </button>
            </div>
            <span className="text-[10px] text-amber-200/60">
              Verified Channel: {checkoutUpiInfo.holderName} • {checkoutUpiInfo.bankName}
            </span>
          </div>

          {/* Payment Proof Submission */}
          <div className="p-4 rounded-2xl bg-[#1c150e] border border-amber-500/25 space-y-3">
            <span className="text-[10px] uppercase font-bold text-amber-200/70 block">Submit Payment Reference</span>

            <div>
              <label className="text-[10px] text-amber-200/70 block mb-1">
                12-Digit Bank UTR (from payment confirmation screen)
              </label>
              <input
                type="text"
                maxLength={12}
                disabled={isWaitingP2PApproval}
                readOnly={isWaitingP2PApproval}
                value={utrInput}
                onChange={e => setUtrInput(e.target.value.replace(/\D/g, ''))}
                placeholder="e.g. 429188012345"
                className={`w-full bg-[#140f0a] border rounded-xl px-4 py-2.5 font-mono-numbers text-sm outline-none ${
                  isWaitingP2PApproval
                    ? 'border-emerald-500/40 text-emerald-300 bg-emerald-950/20 cursor-not-allowed'
                    : 'border-amber-500/30 text-amber-100 placeholder:text-amber-200/30 focus:border-amber-400'
                }`}
              />
            </div>

            {/* Screenshot Upload */}
            <div>
              <label className="text-[10px] text-amber-200/70 block mb-1">
                Receipt Screenshot (Optional for Instant Verification)
              </label>
              {screenshotBase64 ? (
                <div className="p-2 rounded-xl bg-[#140f0a] border border-amber-500/40 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <img src={screenshotBase64} alt="Receipt" className="w-8 h-8 rounded-lg object-cover border border-amber-500/30" />
                    <span className="text-xs text-amber-200 truncate max-w-[180px]">receipt_attached.jpg</span>
                  </div>
                  {!isWaitingP2PApproval && (
                    <button onClick={() => setScreenshotBase64(null)} className="text-amber-200/60 hover:text-white p-1">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ) : (
                <label className={`w-full py-2.5 px-3 rounded-xl bg-[#140f0a] border border-dashed border-amber-500/30 text-center flex items-center justify-center gap-2 ${
                  isWaitingP2PApproval ? 'opacity-50 cursor-not-allowed' : 'hover:border-amber-400 cursor-pointer pressable'
                }`}>
                  <Upload className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-xs text-amber-200/70">Upload Payment Receipt</span>
                  <input
                    type="file"
                    accept="image/*"
                    disabled={isWaitingP2PApproval}
                    onChange={async e => {
                      const file = e.target.files?.[0];
                      if (file) {
                        try {
                          const compressed = await compressImageClient(file);
                          setScreenshotBase64(compressed);
                          showToast('Receipt attached.');
                        } catch {
                          showToast('Error attaching image.');
                        }
                      }
                    }}
                    className="hidden"
                  />
                </label>
              )}
            </div>

            {isWaitingP2PApproval ? (
              <div className="space-y-2 pt-1">
                <button
                  disabled={true}
                  className="w-full py-3.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-black text-xs flex items-center justify-center gap-2 cursor-not-allowed shadow-inner"
                >
                  <Lock className="w-4 h-4 text-emerald-400" />
                  <span>UTR Proof Locked at {submittedUtrTime || 'Just now'}</span>
                </button>
                <div className="p-2.5 rounded-xl bg-[#140f0a] border border-amber-500/30 text-[11px] text-amber-200/80 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping shrink-0" />
                  <span>1 Request per UTR strictly enforced. Proof locked at <strong>{submittedUtrTime || 'Just now'}</strong>. P2P desk is verifying your transfer.</span>
                </div>
              </div>
            ) : (
              <button
                disabled={isSubmittingProof || utrInput.length !== 12}
                onClick={handleSubmitUtrProof}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-black font-black text-xs pressable border border-amber-300 shadow-md shadow-amber-500/20 disabled:opacity-40"
              >
                {isSubmittingProof ? 'Submitting to Desk...' : 'Submit Proof for Instant Desk Matching'}
              </button>
            )}
          </div>

          {/* Visual Chronological Timeline Stepper */}
          <div className="p-4 rounded-2xl bg-[#1c150e] border border-amber-500/25 space-y-3">
            <span className="text-[10px] uppercase font-bold text-amber-200/60 block">Live Verification Stepper</span>
            <div className="space-y-3 relative pl-6 border-l-2 border-amber-500/30 ml-2">
              {[
                { label: 'Order Created', desc: 'Reference ID issued', done: true },
                { label: 'Desk Assigned', desc: `${checkoutUpiInfo.holderName || 'P2P Desk Node'} assigned`, done: true },
                { label: 'Payment Initiated', desc: utrInput ? `UTR ${utrInput}` : 'Waiting for payer transfer', done: !!utrInput },
                { label: 'Desk Verification', desc: isWaitingP2PApproval ? 'Matching with bank statement (~45s)' : 'Pending proof', done: !isWaitingP2PApproval && !!utrInput, active: isWaitingP2PApproval },
                { label: 'Wallet Settled', desc: 'Funds credited to playable balance', done: false }
              ].map((step, i) => (
                <div key={i} className="relative">
                  <span className={`absolute -left-[31px] top-0.5 w-4 h-4 rounded-full flex items-center justify-center text-[9px] ${
                    step.done
                      ? 'bg-emerald-500 text-black font-black'
                      : step.active
                      ? 'bg-amber-400 text-black font-black animate-ping'
                      : 'bg-[#221810] border border-amber-500/30 text-amber-200/60'
                  }`}>
                    {step.done ? '✓' : i + 1}
                  </span>
                  <div>
                    <span className="text-xs font-bold text-amber-100 block">{step.label}</span>
                    <span className="text-[10px] text-amber-200/60">{step.desc}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer Controls */}
          <div className="flex gap-2">
            <button
              onClick={() => onRefreshWallet(true)}
              className="flex-1 py-3 rounded-xl bg-[#221810] border border-amber-500/30 text-amber-300 font-bold text-xs pressable flex items-center justify-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
              <span>Check Live Status</span>
            </button>
            <button
              onClick={handleCancelOrder}
              className="px-4 py-3 rounded-xl bg-[#140f0a] border border-red-500/30 text-red-400 font-bold text-xs pressable hover:bg-red-500/10"
            >
              Cancel Order
            </button>
          </div>
        </div>
      )}

      {/* ── SUB-VIEW: TRANSACTION HISTORY & RECEIPTS ── */}
      {subTab === 'history' && (
        <div className="p-3.5 space-y-3.5">
          {/* Search & Filter Bar */}
          <div className="space-y-2">
            <div className="relative">
              <Search className="w-4 h-4 text-amber-400 absolute left-3 top-3" />
              <input
                type="text"
                value={historySearch}
                onChange={e => setHistorySearch(e.target.value)}
                placeholder="Search by 12-digit UTR or Order ID..."
                className="w-full bg-[#1c150e] border border-amber-500/30 rounded-xl pl-9 pr-3 py-2.5 text-xs text-amber-100 placeholder:text-amber-200/30 outline-none focus:border-amber-400 font-mono"
              />
            </div>

            {/* Filter Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              {[
                { id: 'ALL', label: 'All' },
                { id: 'SUCCESS', label: 'Completed' },
                { id: 'PENDING', label: 'Pending' },
                { id: 'DISPUTED', label: 'Disputed' },
                { id: 'WITHDRAWAL', label: 'Payouts' }
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setHistoryFilter(f.id as any)}
                  className={`px-3 py-1 rounded-full text-[10px] font-bold whitespace-nowrap pressable transition-all ${
                    historyFilter === f.id
                      ? 'bg-amber-400 text-black font-black'
                      : 'bg-[#1c150e] text-amber-200/60 border border-amber-500/20'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Transaction List */}
          {filteredHistory.length === 0 ? (
            <div className="p-8 text-center rounded-2xl bg-[#1c150e] border border-amber-500/20 space-y-2">
              <FileText className="w-8 h-8 text-amber-400/50 mx-auto" />
              <p className="text-xs text-amber-200/70">No transactions match your search filter.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredHistory.map(tx => {
                const isDeposit = tx.type === 'DEPOSIT';
                const isSuccess = tx.status === 'SUCCESS';
                const isPending = tx.status === 'PENDING';
                const isDisputed = tx.status === 'DISPUTED';

                return (
                  <div
                    key={tx.id}
                    className="p-3.5 rounded-2xl bg-[#1c150e] border border-amber-500/25 space-y-2.5 hover:border-amber-400 transition-all"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                          isDeposit ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'
                        }`}>
                          {isDeposit ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                        </div>
                        <div>
                          <span className="text-xs font-black text-amber-100 block">
                            {isDeposit ? 'UPI P2P Deposit' : 'Bank Payout Withdrawal'}
                          </span>
                          <span className="text-[10px] text-amber-200/60 font-mono">
                            {new Date(tx.createdAt).toLocaleDateString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className={`font-mono-numbers font-black text-xs block ${
                          isDeposit ? 'text-emerald-400' : 'text-amber-300'
                        }`}>
                          {isDeposit ? '+' : '-'}₹{Number(tx.amount).toLocaleString('en-IN')}
                        </span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full inline-block ${
                          isSuccess
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : isDisputed
                            ? 'bg-red-500/15 text-red-400 border border-red-500/30'
                            : isPending
                            ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                            : 'bg-slate-500/15 text-slate-400 border border-slate-500/30'
                        }`}>
                          {tx.status}
                        </span>
                      </div>
                    </div>

                    {tx.utrNumber && (
                      <div className="p-2 rounded-xl bg-[#140f0a] border border-amber-500/15 flex justify-between items-center text-[10px] font-mono">
                        <span className="text-amber-200/70">Bank UTR: {tx.utrNumber}</span>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(tx.utrNumber);
                            showToast('UTR copied!');
                          }}
                          className="text-amber-400 font-bold hover:underline"
                        >
                          Copy
                        </button>
                      </div>
                    )}

                    {/* Receipt & Dispute Buttons */}
                    <div className="flex gap-2 pt-1 border-t border-amber-500/15">
                      <button
                        onClick={() => handleOpenReceipt(tx.id)}
                        className="flex-1 py-1.5 rounded-lg bg-[#221810] border border-amber-500/30 text-amber-300 font-bold text-[10px] flex items-center justify-center gap-1 pressable"
                      >
                        <FileText className="w-3 h-3 text-amber-400" />
                        <span>View Official Receipt</span>
                      </button>

                      {isPending && (
                        <button
                          onClick={() => {
                            setDisputeTxId(tx.id);
                            setSubTab('disputes');
                          }}
                          className="px-3 py-1.5 rounded-lg bg-red-500/15 border border-red-500/30 text-red-300 font-bold text-[10px] pressable"
                        >
                          Dispute
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── SUB-VIEW: DISPUTES & ARBITRATION ── */}
      {subTab === 'disputes' && (
        <div className="p-3.5 space-y-4">
          <div className="p-4 rounded-2xl bg-[#1c150e] border border-amber-500/30 space-y-2">
            <div className="flex items-center gap-2">
              <Scale className="w-5 h-5 text-amber-400" />
              <h3 className="text-sm font-black text-amber-200 font-serif">P2P Arbitration Guarantee</h3>
            </div>
            <p className="text-xs text-amber-200/70 leading-relaxed">
              Every SURRAT ND transaction is bonded by the operator's reserve pool. If funds left your bank account but your wallet has not been credited after 5 minutes, file an appeal below for immediate resolution.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-[#1c150e] border border-amber-500/25 space-y-3 text-xs">
            <span className="text-[10px] uppercase font-bold text-amber-200/70 block">Select Order to Appeal</span>
            <select
              value={disputeTxId}
              onChange={e => setDisputeTxId(e.target.value)}
              className="w-full bg-[#140f0a] border border-amber-500/30 rounded-xl px-3 py-2.5 text-amber-100 outline-none focus:border-amber-400 font-mono"
            >
              <option value="">-- Choose Pending Transaction --</option>
              {historyList.filter(t => t.status === 'PENDING' || t.status === 'DISPUTED').map(t => (
                <option key={t.id} value={t.id}>
                  {t.type} ₹{t.amount} (UTR: {t.utrNumber || t.id.slice(0, 8)})
                </option>
              ))}
            </select>

            <div>
              <label className="text-[10px] uppercase font-bold text-amber-200/70 block mb-1">
                Dispute Reason
              </label>
              <select
                value={disputeReason}
                onChange={e => setDisputeReason(e.target.value)}
                className="w-full bg-[#140f0a] border border-amber-500/30 rounded-xl px-3 py-2.5 text-amber-100 outline-none focus:border-amber-400"
              >
                <option value="Bank deducted amount but wallet not credited yet">Bank deducted amount but wallet not credited yet</option>
                <option value="Incorrect UTR reference typed">Incorrect UTR reference typed</option>
                <option value="Payment verification delayed over 10 minutes">Payment verification delayed over 10 minutes</option>
                <option value="Double payment made for single order">Double payment made for single order</option>
                <option value="Other settlement query">Other settlement query</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] uppercase font-bold text-amber-200/70 block mb-1">
                Additional Evidence / Bank Reference Details
              </label>
              <textarea
                value={disputeEvidence}
                onChange={e => setDisputeEvidence(e.target.value)}
                placeholder="Type your bank name, exact transfer timestamp, or payer account name..."
                rows={3}
                className="w-full bg-[#140f0a] border border-amber-500/30 rounded-xl px-3 py-2 text-amber-100 placeholder:text-amber-200/30 outline-none focus:border-amber-400"
              />
            </div>

            <button
              disabled={isSubmittingDispute || !disputeTxId}
              onClick={handleSubmitDispute}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-red-500 to-amber-600 text-black font-black text-xs pressable shadow-lg shadow-red-500/20 border border-amber-300 disabled:opacity-40"
            >
              {isSubmittingDispute ? 'Lodging Dispute...' : 'Submit Appeal to Live Arbitration Desk'}
            </button>
          </div>

          {/* 24/7 Live Agent Contact */}
          <div className="p-3.5 rounded-2xl bg-[#1c150e] border border-amber-500/25 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Headphones className="w-5 h-5 text-amber-400" />
              <div>
                <span className="text-xs font-bold text-amber-100 block">Talk to 24/7 Operator Desk</span>
                <span className="text-[10px] text-amber-200/60">Live chat support with human agent</span>
              </div>
            </div>
            <button
              onClick={onOpenSupport}
              className="px-3 py-1.5 rounded-xl bg-amber-500/15 text-amber-300 font-bold text-xs pressable border border-amber-500/30"
            >
              Open Chat
            </button>
          </div>
        </div>
      )}

      {/* ── VERIFIABLE CRYPTOGRAPHIC RECEIPT MODAL ── */}
      {activeReceipt && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="w-full max-w-sm bg-[#140f0a] border-2 border-amber-500/50 rounded-3xl p-5 space-y-4 animate-slide-up shadow-2xl max-h-[90vh] overflow-y-auto font-sans">
            <div className="flex justify-between items-start border-b border-amber-500/20 pb-3">
              <div className="flex items-center gap-2">
                <img src="/logo-emblem.png" alt="SURRAT ND" className="w-8 h-8 rounded-lg object-cover border border-amber-500/40" />
                <div>
                  <h3 className="text-sm font-black text-amber-200 font-serif leading-tight">SURRAT ND</h3>
                  <span className="text-[9px] text-amber-300 font-mono">Official Settlement Receipt</span>
                </div>
              </div>
              <button onClick={() => setActiveReceipt(null)} className="text-amber-200/60 hover:text-white p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Receipt Summary Card */}
            <div className="p-3.5 rounded-2xl bg-[#1c150e] border border-amber-500/30 space-y-1.5 font-mono text-xs">
              <div className="flex justify-between">
                <span className="text-amber-200/60">Receipt Number:</span>
                <span className="text-amber-300 font-bold">{activeReceipt.receiptNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-amber-200/60">Status:</span>
                <span className="text-emerald-400 font-bold">{activeReceipt.status}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-amber-200/60">Order Type:</span>
                <span className="text-amber-100">{activeReceipt.type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-amber-200/60">Bank Reference (UTR):</span>
                <span className="text-amber-100">{activeReceipt.utrNumber || 'N/A'}</span>
              </div>
              <div className="flex justify-between border-t border-amber-500/20 pt-1.5 text-sm font-black">
                <span className="text-amber-200">Settled Amount:</span>
                <span className="text-amber-300">₹{activeReceipt.grossAmount.toLocaleString('en-IN')}</span>
              </div>
            </div>

            {/* Chronological Audit Timeline */}
            <div className="space-y-2">
              <span className="text-[10px] uppercase font-bold text-amber-200/60 block">Audit Trajectory</span>
              <div className="space-y-2 border-l-2 border-amber-500/30 pl-4 ml-2 text-xs">
                {activeReceipt.timeline.map((step, i) => (
                  <div key={i} className="relative">
                    <span className={`absolute -left-[23px] top-1 w-3 h-3 rounded-full ${
                      step.completed ? 'bg-emerald-400' : 'bg-slate-600'
                    }`} />
                    <span className="font-bold text-amber-100 block">{step.stage}</span>
                    <span className="text-[10px] text-amber-200/60 block">{step.note}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Cryptographic Compliance Signature */}
            <div className="p-2.5 rounded-xl bg-[#0c0a08] border border-amber-500/20 text-[9px] font-mono break-all text-amber-200/60">
              <span className="block font-bold text-amber-400">SHA-256 Ledger Hash:</span>
              {activeReceipt.complianceHash}
            </div>

            <button
              onClick={() => {
                window.print?.();
                showToast('Receipt ready to save / print.');
              }}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-black font-black text-xs pressable border border-amber-300 shadow-md"
            >
              Print / Save Receipt
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
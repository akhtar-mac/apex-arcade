import React, { useEffect, useState } from 'react';
import {
  Download,
  ShieldCheck,
  Zap,
  Sparkles,
  CheckCircle2,
  Coins,
  Flame,
  ChevronDown,
  Lock,
  ArrowRight,
  Star,
  Users,
  TrendingUp,
  Clock,
  Play,
  MessageCircle,
  ExternalLink,
  ChevronRight,
  Menu,
  X,
} from 'lucide-react';

// ─── Data ───────────────────────────────────────────────────────────────────

const PICTURE_CARDS = [
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

// ─── Component ──────────────────────────────────────────────────────────────

export default function LandingApp() {
  const [activeFaq, setActiveFaq] = useState<number | null>(null);
  const [downloadModal, setDownloadModal] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [legalPage, setLegalPage] = useState<'terms' | 'privacy' | 'responsible' | null>(null);
  const [brand, setBrand] = useState({ appName: 'Apex Arcade', shortName: 'APEX', tagline: 'Pick a card. Win 10×.', logoUrl: '' });

  const isLocalHost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.hostname.startsWith('192.168.'));
  const apiBase = (import.meta as any).env?.VITE_API_URL || (isLocalHost ? `http://${window.location.hostname}:4000` : 'https://apex-arcade-api.onrender.com');
  const appDownloadUrl = (import.meta as any).env?.VITE_APP_DOWNLOAD_URL || '';
  const appVersion = (import.meta as any).env?.VITE_APP_VERSION || '';
  const appDownloadName = appVersion ? `Apex-Arcade-${appVersion}.apk` : 'Apex-Arcade-App.apk';

  useEffect(() => {
    fetch(`${apiBase}/api/v1/brand`).then(r => r.json()).then(json => {
      if (json?.data?.appName) setBrand(json.data);
    }).catch(() => undefined);
  }, [apiBase]);

  const faqs = [
    {
      q: "How does the 14-picture arcade betting game work?",
      a: "Rooms last 120, 180, or 240 seconds. Pick a picture from 1–14 while betting is open. Bets freeze in the last 10 seconds. A winning stake pays 10× into the play wallet. Cash leaves only after the desk pays your UPI."
    },
    {
      q: "How fast are UPI deposits and withdrawals?",
      a: "Pay the QR and UPI ID published by the desk. Then submit the 12-digit UTR from your UPI app. An agent checks that UTR and credits the wallet. A withdrawal holds the balance until an agent pays your UPI and types the UTR of that payment."
    },
    {
      q: "Is the picture outcome genuinely random and fair?",
      a: "The winning card is sealed when the round starts, before bets, from the round seed. The desk does not pick the card after seeing the bets."
    },
    {
      q: "Is there an Android app?",
      a: appDownloadUrl
        ? "Yes. Tap Download App to get the signed Android release (Android 7.0 or newer). If your phone asks, allow installs from your browser for this file."
        : "A signed Android release will be published here only after technical, security, and independent release authorization checks are complete."
    },
    {
      q: "What are the minimum and maximum bet amounts?",
      a: "Minimum bets start at ₹10 per card. The maximum is ₹5,000 per card. A winning ₹5,000 stake pays ₹50,000 into the play wallet."
    },
  ];

  const steps = [
    { num: '01', icon: '📱', title: 'Install the App', desc: appDownloadUrl ? 'Download and install the signed Android app.' : 'Install a signed Android release after it passes the release gate.' },
    { num: '02', icon: '💳', title: 'Pay the desk QR', desc: 'Scan the published QR, then submit the 12-digit UTR. The wallet changes after an agent matches it.' },
    { num: '03', icon: '🎴', title: 'Pick Your Card', desc: 'Choose from 14 picture symbols. The smallest bet is ₹10.' },
    { num: '04', icon: '🏆', title: 'Win 10×', desc: 'If your card wins, 10× is added to the play wallet. A cash withdrawal waits for the desk.' },
  ];

  if (legalPage) {
    const pages = {
      terms: {
        title: 'Terms',
        body: 'You must be 18 or older. You pay a QR and UPI ID published by the desk, then submit the 12-digit UTR. The wallet is credited only after a person approves that UTR. A withdrawal holds the balance until an agent pays your UPI and enters the UTR of that payment. The winning card is sealed when the round starts.'
      },
      privacy: {
        title: 'Privacy',
        body: 'We store your phone number, wallet ledger, UTR numbers, and, when you provide them, your legal name and PAN. Agents see the legal name and PAN before a withdrawal of ₹10,000 or more. We do not send your money through a payment gateway.'
      },
      responsible: {
        title: '18+ and self-exclusion',
        body: 'Play only if you are 18 or older. You can set a daily deposit cap and freeze your own account from the player profile. Login fails until that freeze ends. If you want to stop, use self-exclusion before you add more money.'
      }
    };
    const page = pages[legalPage];
    return (
      <div className="min-h-screen bg-[#080a0f] text-slate-100 px-6 py-16">
        <div className="max-w-xl mx-auto space-y-4">
          <button type="button" onClick={() => setLegalPage(null)} className="text-sm text-[#0df59d]">Back</button>
          <h1 className="text-3xl font-black">{page.title}</h1>
          <p className="text-sm leading-7 text-slate-300">{page.body}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#080a0f] text-slate-100 selection:bg-[#0df59d] selection:text-black overflow-x-hidden">

      {/* ── Welcome Banner ── */}
      <div className="relative bg-gradient-to-r from-emerald-950/70 via-[#0a1420] to-cyan-950/70 border-b border-emerald-500/15 py-2.5 text-center overflow-hidden">
        <div className="absolute inset-0 shimmer-text opacity-5 pointer-events-none" style={{ background: 'linear-gradient(90deg, transparent, rgba(13,245,157,0.15), transparent)' }} />
        <div className="flex items-center justify-center gap-2 text-xs sm:text-sm font-semibold text-emerald-400">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
          18+ only. New wallets start at ₹0. Money moves after a human matches a 12-digit UTR.
        </div>
      </div>

      {/* ── Navigation ── */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-[#140f0a]/90 border-b border-amber-500/20 shadow-md">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/25 border border-amber-300 overflow-hidden text-black font-black">
              {brand.logoUrl ? <img src={brand.logoUrl} alt="" className="w-full h-full object-cover" /> : <span>👑</span>}
            </div>
            <div>
              <span className="text-lg font-black tracking-tight text-amber-100 font-serif">
                {brand.appName}
              </span>
              <span className="hidden sm:block text-[9px] font-bold text-amber-200/60 uppercase tracking-widest">{brand.tagline || 'Pick a card. Win 10×.'}</span>
            </div>
          </div>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-semibold">
            <a href="#mechanics" className="text-amber-200/70 hover:text-white transition">How It Works</a>
            <a href="#cards" className="text-amber-200/70 hover:text-white transition">14 Cards</a>
            <a href="#banking" className="text-amber-200/70 hover:text-white transition">Banking</a>
            <a href="#faq" className="text-amber-200/70 hover:text-white transition">FAQ</a>
          </nav>

          {/* CTA */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-amber-400 font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              18+ only
            </div>
            <button
              onClick={() => setDownloadModal(true)}
              className="glow-btn bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 text-black font-black text-xs sm:text-sm px-4 sm:px-5 py-2.5 rounded-xl flex items-center gap-2 hover:scale-105 active:scale-95 transition shadow-lg border border-amber-300"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Download App</span>
              <span className="sm:hidden">Get App</span>
            </button>

            <button type="button" aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'} className="md:hidden w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center text-amber-200" onClick={() => setMobileMenuOpen(v => !v)}>
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5 text-amber-400" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-amber-500/20 bg-[#140f0a] px-5 py-4 space-y-3">
            {[
              ['How It Works', '#mechanics'],
              ['14 Cards', '#cards'],
              ['Banking', '#banking'],
              ['FAQ', '#faq'],
            ].map(([label, href]) => (
              <a key={href} href={href} onClick={() => setMobileMenuOpen(false)}
                className="block text-amber-200/80 hover:text-white font-semibold text-sm py-1.5 border-b border-amber-500/10">
                {label}
              </a>
            ))}
          </div>
        )}
      </header>

      <section className="relative pt-20 sm:pt-28 pb-24 px-5 overflow-hidden">
        {/* Background Orbs */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[700px] orb-animate pointer-events-none -z-10"
          style={{ background: 'radial-gradient(ellipse, rgba(245,158,11,0.12) 0%, rgba(217,119,6,0.06) 40%, transparent 70%)' }} />
        <div className="absolute top-1/3 right-0 w-96 h-96 pointer-events-none -z-10"
          style={{ background: 'radial-gradient(ellipse, rgba(251,191,36,0.08) 0%, transparent 70%)' }} />

        <div className="max-w-5xl mx-auto text-center">
          {/* Badge */}
          <div className="float-up inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-xs font-bold text-amber-300 mb-6 tracking-wide font-serif">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            ROYAL PAPPU PLAYING PICTURES ARCADE
          </div>

          {/* Headline */}
          <h1 className="float-up delay-100 text-4xl sm:text-5xl md:text-6xl font-black tracking-tight leading-[1.08] mb-5 text-amber-100 font-serif">
            Pick Your Lucky Card.{' '}
            <br className="hidden sm:block" />
            <span className="shimmer-text">Win 10.0× Instantly.</span>
          </h1>

          <p className="float-up delay-200 text-base sm:text-lg text-amber-200/70 max-w-2xl mx-auto mb-10 leading-relaxed font-sans">
            Authentic 14-picture Indian arcade game with Hostess Maya. Winning cards sealed before bets. Instant 10× winner payout on every draw.
          </p>

          {/* CTA Buttons */}
          <div className="float-up delay-300 flex flex-col sm:flex-row items-center justify-center gap-3 mb-14">
            <button
              onClick={() => setDownloadModal(true)}
              className="glow-btn w-full sm:w-auto bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 text-black font-black text-base px-8 py-4 rounded-2xl flex items-center justify-center gap-3 hover:scale-105 active:scale-95 transition shadow-xl shadow-amber-500/25 border border-amber-300"
            >
              <Download className="w-5 h-5" />
              Download App
            </button>
            <a
              href="#mechanics"
              className="w-full sm:w-auto px-7 py-4 rounded-2xl bg-[#1c150e] hover:bg-[#261d15] border border-amber-500/30 font-bold text-sm text-amber-200 transition flex items-center justify-center gap-2 hover:text-white"
            >
              <Play className="w-4 h-4 text-amber-400" />
              How To Play & Win
              <ArrowRight className="w-4 h-4 text-amber-400/60" />
            </a>
          </div>

          {/* Hero Stats Bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-3xl mx-auto">
            {[
              { label: 'Fixed Multiplier', value: '10.0×', sub: '₹100 bet = ₹1,000', color: '#fbbf24' },
              { label: 'Round Speed', value: '120s', sub: 'Live rooms all day', color: '#f59e0b' },
              { label: 'Cash Out', value: 'Manual', sub: 'Desk verified UTR', color: '#fde047' },
              { label: 'Card Draw', value: 'Sealed', sub: 'Mughal host stage', color: '#fbbf24' },
            ].map(stat => (
              <div key={stat.label} className="glass-card p-4 rounded-2xl text-left hover:border-amber-500/40 transition">
                <span className="text-[11px] text-amber-200/60 font-semibold block mb-1">{stat.label}</span>
                <span className="text-xl font-black font-mono-numbers" style={{ color: stat.color }}>{stat.value}</span>
                <span className="text-[11px] text-amber-200/50 block mt-0.5">{stat.sub}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="cards" className="py-20 px-5 section-alt border-y border-amber-500/20">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <span className="text-[11px] font-black uppercase tracking-widest text-amber-400 font-serif">Pappu Playing Pictures</span>
            <h2 className="text-3xl sm:text-4xl font-black text-amber-100 mt-2 font-serif">Every Picture Pays Exactly 10.0×</h2>
            <p className="text-amber-200/70 text-sm max-w-xl mx-auto mt-2 leading-relaxed">
              Select one or multiple cards during the active betting countdown. Bet ₹10 to ₹5,000 per card. Bets freeze in the final 10 seconds.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3">
            {PICTURE_CARDS.map(card => (
              <div
                key={card.id}
                className="card-float group relative parchment-texture parchment-border p-3 sm:p-3.5 rounded-2xl flex flex-col items-center text-center cursor-pointer transition shadow-md hover:scale-105"
              >
                {/* Number */}
                <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded-md bg-[#451a03]/80 text-amber-100 text-[9px] font-black font-mono-numbers">
                  #{card.id}
                </div>

                <div className="relative w-16 h-16 sm:w-20 sm:h-20 my-2 rounded-xl overflow-hidden shadow-inner border-2 border-[#8c6239] group-hover:scale-105 transition duration-300 bg-[#f7ecd5] p-0.5 flex items-center justify-center">
                  <img
                    src={card.imageUrl}
                    alt={card.name}
                    className="w-full h-full object-cover rounded-lg"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                      const fallback = (e.target as HTMLElement).nextElementSibling;
                      if (fallback) (fallback as HTMLElement).style.display = 'block';
                    }}
                  />
                  <span className="text-3xl sm:text-4xl hidden leading-none filter drop-shadow-md">{card.symbol}</span>
                </div>
                <span className="font-black text-xs sm:text-sm text-[#451a03] font-serif leading-tight">{card.name}</span>
                <span className="text-[9px] sm:text-[11px] text-[#78350f] font-semibold mb-1.5">{card.hindi}</span>
                <span className="text-[9px] font-black px-2 py-0.5 rounded-md border border-[#78350f] bg-gradient-to-r from-amber-400 to-amber-500 text-black shadow-sm font-mono-numbers">
                  10.0×
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="mechanics" className="py-20 px-5">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <span className="text-[11px] font-black uppercase tracking-widest text-[#00e5ff]">Game Mechanics</span>
            <h2 className="text-3xl sm:text-4xl font-black text-white mt-2">How To Play & Win</h2>
          </div>

          {/* Steps */}
          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-6 mb-16">
            {steps.map((step, i) => (
              <div key={i} className="glass-card p-5 rounded-2xl hover:bg-white/[0.05] transition group">
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-2xl">{step.icon}</span>
                  <span className="text-xs font-black text-slate-600 font-mono">{step.num}</span>
                </div>
                <h3 className="font-black text-base text-white mb-2">{step.title}</h3>
                <p className="text-xs text-slate-400 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>

          <div className="p-6 sm:p-8 rounded-3xl glass-card">
            <div className="flex items-center gap-2 mb-6">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <h3 className="font-black text-lg text-white">How a round goes</h3>
            </div>

            <div className="grid sm:grid-cols-4 gap-4">
              {[
                { phase: 'Open', title: 'Betting', icon: '🔓', desc: 'Pick one of 14 pictures. The stake leaves the wallet only after the server accepts the bet.', color: '#0df59d', duration: 'Until T-10s' },
                { phase: 'Locked', title: 'No more bets', icon: '🔒', desc: 'Last 10 seconds. The winning card was already sealed when the round started.', color: '#f59e0b', duration: 'Last 10s' },
                { phase: 'Result', title: 'Winner', icon: '🎯', desc: 'A winning stake pays 10× into the play wallet.', color: '#00e5ff', duration: 'At reveal' },
                { phase: 'Next', title: 'New round', icon: '🔄', desc: 'The next round starts with a new sealed card.', color: '#c084fc', duration: 'Next' },
              ].map(p => (
                <div key={p.phase} className="p-4 rounded-2xl border border-white/[0.06] hover:border-white/20 transition" style={{ background: `${p.color}08` }}>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xl">{p.icon}</span>
                    <span className="text-[9px] font-mono font-bold text-slate-600 bg-black/30 px-2 py-0.5 rounded-full">{p.duration}</span>
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-wider block mb-1" style={{ color: p.color }}>{p.phase}</span>
                  <h4 className="font-black text-sm text-white mb-1.5">{p.title}</h4>
                  <p className="text-[11px] text-slate-400 leading-relaxed">{p.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="banking" className="py-20 px-5 section-alt border-y border-white/[0.06]">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            {/* Left: Copy */}
            <div>
              <span className="text-[11px] font-black uppercase tracking-widest text-[#ffb800]">Indian Banking Infrastructure</span>
              <h2 className="text-3xl sm:text-4xl font-black text-white mt-2 mb-4 leading-tight">
                Desk QR, then a 12-digit UTR
              </h2>
              <p className="text-slate-400 text-sm leading-relaxed mb-8">
                An agent publishes the QR. You pay it, submit the UTR, and the wallet changes only after that person matches it.
              </p>

              <div className="space-y-5">
                {[
                  { icon: '📱', title: 'Published UPI QR', desc: 'Open PhonePe, GPay, or Paytm and pay the QR the desk published. There is no per-session gateway.' },
                  { icon: '🏦', title: 'Manual 12-Digit UTR Fallback', desc: 'Paid via bank transfer? Enter your UTR reference for rapid agent verification.' },
                  { icon: '⚡', title: 'Manual UPI desk', desc: 'Pay the published QR, submit the 12-digit UTR, and an agent confirms before the wallet changes.' },
                ].map(item => (
                  <div key={item.title} className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/[0.07] flex items-center justify-center text-lg shrink-0">
                      {item.icon}
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-white mb-1">{item.title}</h4>
                      <p className="text-xs text-slate-400 leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: Payment Card */}
            <div className="p-6 rounded-3xl glass-card shadow-2xl">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <div className="text-xs font-black text-white">Manual desk</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">No automatic payout</div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-black text-[#0df59d] font-mono-numbers">UTR</div>
                  <div className="text-[10px] text-emerald-400">12 digits required</div>
                </div>
              </div>

              {/* Payment Methods */}
              <div className="space-y-2 mb-5">
                {[
                  { method: 'PhonePe', type: 'UPI', color: '#7c3aed' },
                  { method: 'Google Pay', type: 'UPI', color: '#1a73e8' },
                  { method: 'Paytm', type: 'UPI', color: '#009CDE' },
                  { method: 'IMPS/NEFT', type: 'Bank', color: '#f59e0b' },
                ].map(m => (
                  <div key={m.method} className="flex items-center justify-between py-2 px-3 rounded-xl bg-black/30 border border-white/[0.04]">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg flex items-center justify-center text-xs font-black text-white" style={{ background: `${m.color}40` }}>
                        {m.method[0]}
                      </div>
                      <span className="text-xs font-semibold text-white">{m.method}</span>
                    </div>
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full text-white" style={{ background: `${m.color}55` }}>{m.type}</span>
                  </div>
                ))}
              </div>

              {/* Limits */}
              <div className="p-3 rounded-2xl bg-black/30 border border-white/[0.04] space-y-1.5 text-xs mb-5">
                {[
                  { label: 'Min. Deposit', value: '₹100', color: 'text-white' },
                  { label: 'Min. Withdrawal', value: '₹500', color: 'text-white' },
                  { label: 'Gateway', value: 'None', color: 'text-[#0df59d]' },
                  { label: 'Credit', value: 'After match', color: 'text-[#ffb800]' },
                ].map(r => (
                  <div key={r.label} className="flex justify-between">
                    <span className="text-slate-500">{r.label}</span>
                    <span className={`font-black ${r.color}`}>{r.value}</span>
                  </div>
                ))}
              </div>

              <button
                onClick={() => setDownloadModal(true)}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-[#0df59d] to-[#00e5ff] text-black font-black text-sm hover:scale-[1.02] active:scale-[0.98] transition shadow-lg shadow-emerald-500/20"
              >
                Check App Release
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 px-5">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <span className="text-[11px] font-black uppercase tracking-widest text-[#818cf8]">Security & Fairness</span>
            <h2 className="text-3xl font-black text-white mt-2">Built on Enterprise-Grade Infrastructure</h2>
          </div>
          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: <ShieldCheck className="w-6 h-6" />, title: 'Provably Fair', desc: 'SHA-256 HMAC cryptographic outcome verification', color: '#0df59d' },
              { icon: <Lock className="w-6 h-6" />, title: 'Row lock', desc: 'Wallet changes use a database row lock in one API process', color: '#818cf8' },
              { icon: <Zap className="w-6 h-6" />, title: 'One server', desc: 'This build is a single API process, not a measured 10,000-player cluster', color: '#ffb800' },
              { icon: <TrendingUp className="w-6 h-6" />, title: 'Real-Time Socket', desc: 'WebSocket live sync — zero page refresh ever', color: '#00e5ff' },
            ].map(item => (
              <div key={item.title} className="glass-card p-5 rounded-2xl hover:bg-white/[0.04] transition text-center">
                <div className="w-12 h-12 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: `${item.color}15`, border: `1px solid ${item.color}30`, color: item.color }}>
                  {item.icon}
                </div>
                <h4 className="font-black text-sm text-white mb-1">{item.title}</h4>
                <p className="text-[11px] text-slate-400 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="faq" className="py-20 px-5 section-alt border-t border-white/[0.06]">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <span className="text-[11px] font-black uppercase tracking-widest text-[#0df59d]">Got Questions?</span>
            <h2 className="text-3xl font-black text-white mt-2">Frequently Asked Questions</h2>
          </div>

          <div className="space-y-3">
            {faqs.map((faq, idx) => (
              <div
                key={idx}
                className="rounded-2xl border border-white/[0.07] overflow-hidden transition"
                style={{ background: activeFaq === idx ? 'rgba(13,245,157,0.04)' : 'rgba(255,255,255,0.02)' }}
              >
                <button
                  onClick={() => setActiveFaq(activeFaq === idx ? null : idx)}
                  className="w-full p-5 text-left flex items-center justify-between gap-4"
                >
                  <span className="font-bold text-sm text-white">{faq.q}</span>
                  <ChevronDown className={`w-4 h-4 shrink-0 transition-transform ${activeFaq === idx ? 'rotate-180 text-[#0df59d]' : 'text-slate-500'}`} />
                </button>
                {activeFaq === idx && (
                  <div className="px-5 pb-5 text-sm text-slate-400 leading-relaxed border-t border-white/[0.05] pt-4">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 px-5">
        <div className="max-w-2xl mx-auto text-center">
          <div className="p-8 sm:p-12 rounded-3xl relative overflow-hidden" style={{ background: 'linear-gradient(135deg, rgba(13,245,157,0.08), rgba(0,229,255,0.06), rgba(255,184,0,0.05))' }}>
            <div className="absolute inset-0 pointer-events-none" style={{ border: '1px solid rgba(13,245,157,0.2)', borderRadius: '1.5rem' }} />
            <h2 className="text-3xl sm:text-4xl font-black text-white mb-3">Android Release</h2>
            <p className="text-slate-400 text-sm mb-8">{appDownloadUrl ? `The signed Android App${appVersion ? ` v${appVersion}` : ''} is ready to install.` : 'The signed App will be available after release authorization.'} New accounts start at ₹0.</p>
            <button
              onClick={() => setDownloadModal(true)}
              className="glow-btn bg-gradient-to-r from-[#0df59d] to-[#00e5ff] text-black font-black text-lg px-10 py-4 rounded-2xl hover:scale-105 active:scale-95 transition shadow-xl shadow-emerald-500/25 mx-auto flex items-center gap-3"
            >
              <Download className="w-5 h-5" />
              Download App
            </button>
            <p className="text-[11px] text-slate-500 mt-4">Unsigned and debug builds are not distributed.</p>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/[0.06] bg-[#050709] py-12 px-5">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row items-start justify-between gap-8 mb-8">
            {/* Brand */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#0df59d] to-[#00e5ff] flex items-center justify-center shadow-md">
                  <span className="text-base">🎰</span>
                </div>
                <span className="font-black text-white text-lg font-['Outfit']">APEX<span className="text-[#0df59d]">ARCADE</span></span>
              </div>
              <p className="text-xs text-slate-500 max-w-xs leading-relaxed">
                A restricted-stage 14-picture arcade backed by PostgreSQL and Redis. Transactional features remain disabled until release authorization.
              </p>
            </div>

            {/* Links */}
            <div className="flex flex-wrap gap-8">
              <div>
                <div className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3">Platform</div>
                <div className="space-y-2 text-xs text-slate-500">
                  <a href="#mechanics" className="hover:text-white block transition">How It Works</a>
                  <a href="#cards" className="hover:text-white block transition">14 Cards</a>
                  <a href="#banking" className="hover:text-white block transition">Room Tiers</a>
                </div>
              </div>
              <div>
                <div className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3">Legal</div>
                <div className="space-y-2 text-xs text-slate-500">
                  <button type="button" onClick={() => setLegalPage('terms')} className="hover:text-white block transition text-left">Terms & Conditions</button>
                  <button type="button" onClick={() => setLegalPage('privacy')} className="hover:text-white block transition text-left">Privacy Policy</button>
                  <button type="button" onClick={() => setLegalPage('responsible')} className="hover:text-white block transition text-left">18+ and self-exclusion</button>
                </div>
              </div>
              <div>
                <div className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3">Support</div>
                <div className="space-y-2 text-xs text-slate-500">
                  <button type="button" onClick={() => setLegalPage('responsible')} className="hover:text-white block transition text-left">Responsible Gaming</button>
                </div>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-white/[0.05] pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-red-500/20 text-red-400 font-black text-[10px] border border-red-500/20">18+ ONLY</span>
              <span className="text-xs text-slate-500">Play Responsibly. Not available in AP, Telangana, Assam, Odisha.</span>
            </div>
            <span className="text-[11px] text-slate-600">© 2026 {brand.appName}</span>
          </div>
        </div>
      </footer>

      {downloadModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md glass-card rounded-3xl p-7 shadow-2xl relative">
            <button
              onClick={() => setDownloadModal(false)}
              className="absolute top-5 right-5 w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="text-center mb-6">
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-3xl mx-auto mb-4">📱</div>
              <h3 className="text-2xl font-black text-white">Install {brand.appName} App</h3>
              <p className="text-sm text-slate-400 mt-1">
                {appDownloadUrl ? `Install the signed Android release${appVersion ? ` v${appVersion}` : ''} (Android 7.0+).` : 'The Android download is disabled while release checks are incomplete.'}
              </p>
            </div>

            {/* Steps */}
            <div className="space-y-3 mb-6">
              {[
                'Download and install the official App on your phone.',
                'Register or sign in with your mobile number (starts at ₹0).',
                'Pay the published desk QR and submit your 12-digit UTR.',
                'Enter the arena once the desk matches your UTR.',
              ].map((step, i) => (
                <div key={i} className="flex items-center gap-3 text-sm text-slate-300">
                  <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-[#0df59d] font-black text-[10px] flex items-center justify-center shrink-0 border border-emerald-500/20">
                    {i + 1}
                  </div>
                  <span>{step}</span>
                </div>
              ))}
            </div>

            <div className="space-y-2.5">
              {appDownloadUrl ? (
                <a
                  href={appDownloadUrl}
                  download={appDownloadName}
                  onClick={() => setDownloadModal(false)}
                  className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-[#0df59d] to-[#00e5ff] text-black font-black text-sm flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition shadow-xl shadow-emerald-500/20"
                >
                  <Download className="w-4 h-4" />
                  Download Signed App
                </a>
              ) : (
                <button
                  type="button"
                  disabled
                  className="w-full py-3.5 rounded-2xl bg-slate-700 text-slate-300 font-black text-sm cursor-not-allowed"
                >
                  Release Pending
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

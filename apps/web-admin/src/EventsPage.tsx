import React, { useEffect, useState } from 'react';
import {
  Sparkles,
  Crown,
  Layers,
  Upload,
  RefreshCw,
  Plus,
  Trash2,
  Copy,
  Radio,
  Image as ImageIcon,
  CheckCircle,
  AlertCircle,
  HelpCircle,
  Sliders,
  Eye
} from 'lucide-react';

export interface EventCard {
  id: number;
  name: string;
  hindi: string;
  symbol: string;
  imageUrl: string;
}

export interface GameEvent {
  id: string;
  name: string;
  stake: number;
  multiplier: number;
  intervalSec: number;
  isLive: boolean;
  fixedStake?: boolean;
  hostessName?: string;
  hostessImageUrl?: string;
  hostessTagline?: string;
  cards: EventCard[];
}

export const DEFAULT_PICTURE_CARDS: EventCard[] = [
  { id: 1,  name: 'Goat',      symbol: '🐐', hindi: 'Bakri',    imageUrl: '/cards/card_1.jpg' },
  { id: 2,  name: 'Diya',      symbol: '🪔', hindi: 'Deepak',   imageUrl: '/cards/card_2.jpg' },
  { id: 3,  name: 'Rose',      symbol: '🌹', hindi: 'Gulab',    imageUrl: '/cards/card_3.jpg' },
  { id: 4,  name: 'Sun',       symbol: '☀️', hindi: 'Suraj',    imageUrl: '/cards/card_4.jpg' },
  { id: 5,  name: 'Bucket',    symbol: '🪣', hindi: 'Balti',    imageUrl: '/cards/card_5.jpg' },
  { id: 6,  name: 'Football',  symbol: '⚽', hindi: 'Football', imageUrl: '/cards/card_6.jpg' },
  { id: 7,  name: 'Butterfly', symbol: '🦋', hindi: 'Titli',    imageUrl: '/cards/card_7.jpg' },
  { id: 8,  name: 'Rabbit',    symbol: '🐇', hindi: 'Khargosh', imageUrl: '/cards/card_8.jpg' },
  { id: 9,  name: 'Pigeon',    symbol: '🕊️', hindi: 'Kabootar', imageUrl: '/cards/card_9.jpg' },
  { id: 10, name: 'Kite',      symbol: '🪁', hindi: 'Patang',   imageUrl: '/cards/card_10.jpg' },
  { id: 11, name: 'Dholak',    symbol: '🪘', hindi: 'Dholak',   imageUrl: '/cards/card_11.jpg' },
  { id: 12, name: 'Cow',       symbol: '🐄', hindi: 'Gai',      imageUrl: '/cards/card_12.jpg' },
  { id: 13, name: 'Umbrella',  symbol: '☂️', hindi: 'Chhatri',  imageUrl: '/cards/card_13.jpg' },
  { id: 14, name: 'Lantern',   symbol: '🏮', hindi: 'Lalten',   imageUrl: '/cards/card_14.jpg' }
];

async function shrinkImage(file: File, maxDim = 480, quality = 0.78): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Could not load image file.'));
      image.src = url;
    });
    const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not process canvas context.');
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', quality);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function EventsPage({
  apiBase,
  showToast
}: {
  apiBase: string;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}) {
  const [events, setEvents] = useState<GameEvent[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState('Blitz Arena');
  const [stake, setStake] = useState(10);
  const [multiplier, setMultiplier] = useState(10);
  const [intervalSec, setIntervalSec] = useState(120);
  const [hostessName, setHostessName] = useState('Hostess Maya');
  const [hostessImageUrl, setHostessImageUrl] = useState('/hostess.jpg');
  const [hostessTagline, setHostessTagline] = useState('Royal Hostess');
  const [cards, setCards] = useState<EventCard[]>(DEFAULT_PICTURE_CARDS.map(c => ({ ...c })));
  const [activeCardsTab, setActiveCardsTab] = useState<'main12' | 'bonus'>('main12');
  const [saving, setSaving] = useState(false);

  const selected = events.find((event) => event.id === selectedId) || null;

  const load = async () => {
    try {
      const res = await fetch(`${apiBase}/api/v1/admin/events`);
      const json = await res.json();
      if (res.ok && Array.isArray(json.data)) {
        setEvents(json.data);
        if (!selectedId && json.data.length > 0) {
          fill(json.data[0]);
        }
      }
    } catch {
      showToast('Could not load events from server.', 'error');
    }
  };

  useEffect(() => {
    load();
  }, [apiBase]);

  const fill = (event: GameEvent) => {
    setSelectedId(event.id);
    setName(event.name);
    setStake(event.stake);
    setMultiplier(event.multiplier);
    setIntervalSec(event.intervalSec);
    setHostessName(event.hostessName || 'Hostess Maya');
    setHostessImageUrl(event.hostessImageUrl || '/hostess.jpg');
    setHostessTagline(event.hostessTagline || 'Royal Hostess');
    if (Array.isArray(event.cards) && event.cards.length === 14) {
      setCards(event.cards.map(c => ({ ...c })));
    } else {
      setCards(DEFAULT_PICTURE_CARDS.map(c => ({ ...c })));
    }
  };

  const createBlank = () => {
    setSelectedId(null);
    setName('Royal Darbar ₹50');
    setStake(50);
    setMultiplier(10);
    setIntervalSec(120);
    setHostessName('Hostess Maya');
    setHostessImageUrl('/hostess.jpg');
    setHostessTagline('Royal Hostess');
    setCards(DEFAULT_PICTURE_CARDS.map(c => ({ ...c })));
  };

  const cloneSelected = () => {
    setSelectedId(null);
    setName(`${name} (Copy)`);
    showToast('Game duplicated into form as new game. Click "Create Game" to save.', 'info');
  };

  const payload = () => ({
    name,
    stake,
    multiplier,
    intervalSec,
    hostessName,
    hostessImageUrl,
    hostessTagline,
    cards: cards.map((card) => ({
      position: card.id,
      name: card.name,
      hindi: card.hindi,
      symbol: card.symbol,
      imageUrl: card.imageUrl
    }))
  });

  const save = async () => {
    if (!name.trim()) {
      showToast('Please enter a game name.', 'error');
      return;
    }
    if (cards.length !== 14) {
      showToast('A game requires all 14 pictures.', 'error');
      return;
    }
    setSaving(true);
    try {
      const url = selectedId ? `${apiBase}/api/v1/admin/events/${selectedId}` : `${apiBase}/api/v1/admin/events`;
      const method = selectedId ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload())
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        showToast(json.error || 'Could not save the game event.', 'error');
        return;
      }
      showToast(selectedId ? '✨ Game updated! The next round will run with these cards and hostess.' : '🎉 Game created! It will be offline until toggled live.', 'success');
      setSelectedId(json.data.id);
      await load();
    } catch (err: any) {
      showToast(err.message || 'Server error saving game event.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const toggleLive = async (live: boolean) => {
    if (!selectedId) return;
    try {
      const res = await fetch(`${apiBase}/api/v1/admin/events/${selectedId}/live`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ live })
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        showToast(json.error || 'Could not toggle live switch.', 'error');
        return;
      }
      showToast(json.message || (live ? 'Game is now LIVE in player lobby!' : 'Game taken OFFLINE.'), 'success');
      await load();
    } catch {
      showToast('Could not reach backend.', 'error');
    }
  };

  const remove = async () => {
    if (!selectedId) return;
    if (!window.confirm(`Are you sure you want to delete "${name}"? This action cannot be undone.`)) return;
    try {
      const res = await fetch(`${apiBase}/api/v1/admin/events/${selectedId}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok || !json.success) {
        showToast(json.error || 'Could not delete the event.', 'error');
        return;
      }
      setSelectedId(null);
      showToast('Game deleted successfully.', 'success');
      await load();
    } catch {
      showToast('Could not delete game.', 'error');
    }
  };

  const resetAllCardsToOriginal = () => {
    if (window.confirm('Reset all 14 cards to the authentic Pappu Playing Pictures original artworks & names?')) {
      setCards(DEFAULT_PICTURE_CARDS.map(c => ({ ...c })));
      showToast('All 14 picture cards reset to default Pappu set.', 'info');
    }
  };

  const resetSingleCard = (id: number) => {
    const orig = DEFAULT_PICTURE_CARDS.find(c => c.id === id);
    if (!orig) return;
    setCards(prev => prev.map(c => c.id === id ? { ...orig } : c));
    showToast(`Card #${id} (${orig.name}) reset to default.`, 'info');
  };

  return (
    <div className="space-y-6">
      {/* ── TOP BANNER: GAME ARENA STUDIO ── */}
      <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-r from-[#18130e] via-[#140f0a] to-[#18130e] border border-amber-500/30 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-full bg-[radial-gradient(ellipse_at_top_right,rgba(245,158,11,0.12),transparent_70%)] pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-black tracking-wide uppercase mb-2">
              <Crown className="w-3.5 h-3.5 text-amber-400" />
              Game Arena & Studio Manager
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
              Pappu Playing Pictures & Custom Arenas
            </h2>
            <p className="text-xs text-[#94A3B8] max-w-2xl mt-1 leading-relaxed">
              Create new game arenas, assign custom royal hostesses, and customize all 12 Pappu picture cards plus 2 bonus symbols. All card outcomes remain 100% provably fair (sealed with SHA-256 before betting begins).
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={createBlank}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-black text-xs font-black shadow-lg shadow-amber-500/20 hover:brightness-110 pressable transition-all flex items-center gap-2"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>New Game Arena</span>
            </button>
            <button
              onClick={load}
              className="p-2.5 rounded-xl bg-[#1c150e] border border-amber-500/20 text-[#94A3B8] hover:text-amber-400 pressable transition-all"
              title="Refresh Game List"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ── MAIN WORKSPACE: LEFT ARENA LIST / RIGHT DETAILED EDITOR ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
        {/* Left Side: Game Arenas Selector */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-black text-amber-400 uppercase tracking-wider">
              Arenas ({events.length})
            </span>
            <span className="text-[10px] text-[#94A3B8]">
              {events.filter(e => e.isLive).length} Live
            </span>
          </div>

          <div className="space-y-2">
            {events.map((event) => {
              const isSelected = selectedId === event.id;
              return (
                <div
                  key={event.id}
                  onClick={() => fill(event)}
                  className={`p-3 rounded-2xl border transition-all cursor-pointer pressable relative overflow-hidden ${
                    isSelected
                      ? 'border-amber-500/80 bg-[#1c150e] shadow-lg shadow-amber-500/10'
                      : 'border-white/[0.08] bg-[#140f0a]/90 hover:border-amber-500/40 hover:bg-[#18130e]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {/* Hostess Avatar Thumbnail */}
                    <div className="w-11 h-12 rounded-xl overflow-hidden border border-amber-500/40 shrink-0 bg-[#0c0a08] shadow-sm">
                      <img
                        src={event.hostessImageUrl || '/hostess.jpg'}
                        alt={event.hostessName || 'Hostess'}
                        className="w-full h-full object-cover object-top"
                        onError={(e) => { (e.target as HTMLImageElement).src = '/hostess.jpg'; }}
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-black text-white truncate">
                          {event.name}
                        </span>
                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${
                          event.isLive
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                        }`}>
                          {event.isLive ? 'LIVE' : 'OFFLINE'}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 mt-1 text-[10px] text-[#94A3B8] font-mono-numbers">
                        <span className="text-amber-400 font-bold">₹{event.stake}</span>
                        <span>•</span>
                        <span>{event.multiplier}×</span>
                        <span>•</span>
                        <span>{event.intervalSec}s</span>
                      </div>

                      <div className="text-[10px] text-amber-500/70 truncate mt-0.5">
                        {event.hostessName || 'Hostess Maya'}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {events.length === 0 && (
              <div className="p-6 text-center rounded-2xl bg-[#140f0a] border border-white/[0.06] text-xs text-[#94A3B8]">
                No game arenas configured yet. Click "New Game Arena" to start.
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Comprehensive Studio Editor */}
        <div className="space-y-6">
          {/* SECTION 1: GAME CORE PARAMETERS */}
          <div className="p-5 rounded-2xl bg-[#140f0a] border border-amber-500/20 shadow-md space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-black text-white uppercase tracking-wide">
                  1. Game Parameters
                </h3>
              </div>
              {selected && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={cloneSelected}
                    className="px-2.5 py-1 rounded-lg bg-[#1c150e] border border-amber-500/20 text-[11px] font-bold text-amber-400 hover:border-amber-500/50 flex items-center gap-1.5 pressable"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    Clone Game
                  </button>
                  <button
                    onClick={() => toggleLive(!selected.isLive)}
                    className={`px-3 py-1 rounded-lg text-[11px] font-black pressable flex items-center gap-1.5 transition-all ${
                      selected.isLive
                        ? 'bg-amber-500/15 border border-amber-500/40 text-amber-400 hover:bg-amber-500/25'
                        : 'bg-emerald-500 text-black hover:brightness-110 shadow-sm'
                    }`}
                  >
                    <Radio className="w-3.5 h-3.5" />
                    {selected.isLive ? 'Take Offline' : 'Make Live'}
                  </button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Game Name */}
              <div className="sm:col-span-2">
                <label className="text-[11px] font-bold text-[#94A3B8] block mb-1">
                  Arena / Game Name
                </label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Blitz Arena, Royal Darbar"
                  className="w-full bg-[#0c0a08] border border-amber-500/20 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400 font-medium"
                />
              </div>

              {/* Stake Amount */}
              <div>
                <label className="text-[11px] font-bold text-[#94A3B8] block mb-1">
                  Min Stake (₹)
                </label>
                <input
                  type="number"
                  value={stake}
                  min={10}
                  max={5000}
                  onChange={(e) => setStake(Number(e.target.value))}
                  className="w-full bg-[#0c0a08] border border-amber-500/20 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-400 font-mono-numbers font-bold"
                />
                <div className="flex gap-1 mt-1.5">
                  {[10, 50, 100, 500].map(val => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setStake(val)}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono-numbers font-bold ${
                        stake === val ? 'bg-amber-500 text-black' : 'bg-[#1c150e] text-[#94A3B8] hover:text-white'
                      }`}
                    >
                      ₹{val}
                    </button>
                  ))}
                </div>
              </div>

              {/* Multiplier Payout */}
              <div>
                <label className="text-[11px] font-bold text-[#94A3B8] block mb-1">
                  Payout Multiplier (×)
                </label>
                <input
                  type="number"
                  value={multiplier}
                  min={1}
                  max={20}
                  onChange={(e) => setMultiplier(Number(e.target.value))}
                  className="w-full bg-[#0c0a08] border border-amber-500/20 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-400 font-mono-numbers font-bold"
                />
                <div className="flex gap-1 mt-1.5">
                  {[10, 12, 14, 20].map(val => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setMultiplier(val)}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono-numbers font-bold ${
                        multiplier === val ? 'bg-amber-500 text-black' : 'bg-[#1c150e] text-[#94A3B8] hover:text-white'
                      }`}
                    >
                      {val}×
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Round Duration */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#94A3B8]">Round Duration:</span>
                <div className="flex gap-1.5">
                  {[
                    { sec: 60, label: '60s Blitz' },
                    { sec: 120, label: '120s Standard' },
                    { sec: 180, label: '180s Pro' },
                    { sec: 240, label: '240s VIP' }
                  ].map(tier => (
                    <button
                      key={tier.sec}
                      type="button"
                      onClick={() => setIntervalSec(tier.sec)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all pressable ${
                        intervalSec === tier.sec
                          ? 'bg-amber-500 text-black shadow-sm'
                          : 'bg-[#1c150e] border border-white/[0.08] text-[#94A3B8] hover:text-white'
                      }`}
                    >
                      {tier.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Dynamic Payout Preview Pill */}
              <div className="px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs font-mono-numbers text-amber-300">
                Winning ₹{stake || 0} bet pays <strong className="text-amber-400 font-black">₹{(stake || 0) * (multiplier || 0)}</strong>
              </div>
            </div>
          </div>

          {/* SECTION 2: ROYAL HOSTESS STUDIO */}
          <div className="p-5 rounded-2xl bg-[#140f0a] border border-amber-500/20 shadow-md space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
              <div className="flex items-center gap-2">
                <Crown className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-black text-white uppercase tracking-wide">
                  2. Royal Hostess Setup
                </h3>
              </div>
              <span className="text-[10px] text-amber-400/80 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                Shown on Arena Stage & Lobby Banner
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-[180px_1fr] gap-5 items-center">
              {/* Hostess Live Stage Preview (Exact Mughal Arch styling) */}
              <div className="flex flex-col items-center">
                <div className="relative w-32 h-40 rounded-2xl overflow-hidden border-2 border-amber-400/60 shadow-[0_8px_20px_rgba(0,0,0,0.6)] bg-[#18110a] group">
                  <img
                    src={hostessImageUrl || '/hostess.jpg'}
                    alt={hostessName}
                    className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-500"
                    onError={(e) => { (e.target as HTMLImageElement).src = '/hostess.jpg'; }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20 pointer-events-none" />
                  <div className="absolute bottom-1 inset-x-0 text-center px-1">
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/95 text-black text-[9px] font-black tracking-wide uppercase shadow truncate max-w-full inline-block">
                      {hostessName || 'Hostess Maya'}
                    </span>
                  </div>
                </div>
                <span className="text-[10px] text-[#94A3B8] mt-2 flex items-center gap-1">
                  <Eye className="w-3 h-3 text-amber-400" />
                  Live Arena Preview
                </span>
              </div>

              {/* Hostess Inputs & Photo Uploader */}
              <div className="space-y-3.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-[#94A3B8] block mb-1">
                      Hostess Name
                    </label>
                    <input
                      value={hostessName}
                      onChange={(e) => setHostessName(e.target.value)}
                      placeholder="e.g. Hostess Maya"
                      className="w-full bg-[#0c0a08] border border-amber-500/20 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-[#94A3B8] block mb-1">
                      Role / Tagline
                    </label>
                    <input
                      value={hostessTagline}
                      onChange={(e) => setHostessTagline(e.target.value)}
                      placeholder="e.g. Royal Hostess"
                      className="w-full bg-[#0c0a08] border border-amber-500/20 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>

                {/* Hostess Photo Upload / URL */}
                <div>
                  <label className="text-[11px] font-bold text-[#94A3B8] block mb-1">
                    Hostess Portrait Photo
                  </label>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <label className="px-3.5 py-2 rounded-xl bg-[#1c150e] border border-amber-500/30 text-amber-300 text-xs font-bold hover:bg-amber-500/10 cursor-pointer flex items-center justify-center gap-2 pressable transition-all shrink-0">
                      <Upload className="w-3.5 h-3.5" />
                      <span>Upload Hostess Photo</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          try {
                            const compressed = await shrinkImage(file, 512, 0.82);
                            setHostessImageUrl(compressed);
                            showToast('Hostess photo updated!', 'success');
                          } catch (err: any) {
                            showToast(err.message || 'Could not load hostess photo.', 'error');
                          }
                        }}
                      />
                    </label>

                    <input
                      value={hostessImageUrl}
                      onChange={(e) => setHostessImageUrl(e.target.value)}
                      placeholder="Or enter Image URL (e.g. /hostess.jpg or https://...)"
                      className="flex-1 bg-[#0c0a08] border border-amber-500/20 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                    />

                    <button
                      type="button"
                      onClick={() => {
                        setHostessImageUrl('/hostess.jpg');
                        setHostessName('Hostess Maya');
                        showToast('Reset hostess to default Maya portrait.', 'info');
                      }}
                      className="px-2.5 py-2 rounded-xl bg-[#1c150e] border border-white/[0.08] text-xs text-[#94A3B8] hover:text-white shrink-0 pressable"
                      title="Reset Hostess to Maya"
                    >
                      Reset Maya
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 3: 12 PICTURE CARDS + 2 BONUS SYMBOLS STUDIO */}
          <div className="p-5 rounded-2xl bg-[#140f0a] border border-amber-500/20 shadow-md space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-white/[0.08] gap-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-black text-white uppercase tracking-wide">
                  3. Picture Cards & Artwork Studio
                </h3>
              </div>

              <div className="flex items-center gap-2">
                {/* Switcher: 12 Main vs 2 Bonus */}
                <div className="p-1 rounded-xl bg-[#0c0a08] border border-amber-500/20 flex gap-1">
                  <button
                    type="button"
                    onClick={() => setActiveCardsTab('main12')}
                    className={`px-3 py-1 rounded-lg text-xs font-black transition-all ${
                      activeCardsTab === 'main12'
                        ? 'bg-amber-500 text-black shadow-sm'
                        : 'text-[#94A3B8] hover:text-white'
                    }`}
                  >
                    12 Classic Cards (#1 to #12)
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveCardsTab('bonus')}
                    className={`px-3 py-1 rounded-lg text-xs font-black transition-all ${
                      activeCardsTab === 'bonus'
                        ? 'bg-amber-500 text-black shadow-sm'
                        : 'text-[#94A3B8] hover:text-white'
                    }`}
                  >
                    2 Bonus Symbols (#13 & #14)
                  </button>
                </div>

                <button
                  type="button"
                  onClick={resetAllCardsToOriginal}
                  className="px-2.5 py-1.5 rounded-xl bg-[#1c150e] border border-amber-500/30 text-[11px] font-bold text-amber-400 hover:bg-amber-500/10 pressable transition-all flex items-center gap-1.5"
                  title="Reset all 14 pictures to authentic Pappu set"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Reset Authentic 14</span>
                </button>
              </div>
            </div>

            {/* CARDS GRID */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3.5">
              {cards
                .filter(c => activeCardsTab === 'main12' ? c.id <= 12 : c.id > 12)
                .map((card, idx) => {
                  const globalIndex = cards.findIndex(c => c.id === card.id);

                  // Traditional authentic multiplier tags matching Pappu Playing Pictures
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
                      className="p-3 rounded-2xl bg-[#18130e] border border-amber-500/20 hover:border-amber-500/50 shadow-md space-y-2.5 transition-all group"
                    >
                      {/* Live Parchment Card Preview Tile */}
                      <div className="parchment-texture parchment-border p-2 rounded-xl flex flex-col items-center justify-between min-h-[110px] relative shadow-sm overflow-hidden">
                        {/* Header: #ID, Hindi Name, Multiplier */}
                        <div className="w-full flex items-center justify-between text-[9px] font-bold text-[#6d4621] leading-none mb-1">
                          <div className="flex items-center gap-1 truncate">
                            <span className="font-mono-numbers text-amber-900 font-black">#{card.id}</span>
                            <span className="font-serif text-[#451a03] font-black truncate">{card.hindi || 'Naam'}</span>
                          </div>
                          {tag ? (
                            <span className="px-1 py-0.5 rounded-full multiplier-tag text-[8px] font-black leading-none shadow-sm">
                              {tag}
                            </span>
                          ) : (
                            <span className="text-[8px] font-bold text-amber-900/60 font-mono-numbers">{multiplier}×</span>
                          )}
                        </div>

                        {/* Card Image */}
                        <div className="relative w-16 h-16 rounded-lg overflow-hidden flex items-center justify-center bg-[#ecd3a5] border border-[#a87a4c]/50 shadow-inner group-hover:scale-105 transition-transform duration-300">
                          {card.imageUrl ? (
                            <img
                              src={card.imageUrl}
                              alt={card.name}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                                const fallback = (e.target as HTMLElement).nextElementSibling;
                                if (fallback) (fallback as HTMLElement).style.display = 'block';
                              }}
                            />
                          ) : null}
                          <span className={`text-2xl ${card.imageUrl ? 'hidden' : 'block'}`}>
                            {card.symbol || '🎴'}
                          </span>
                        </div>

                        {/* Card English Name */}
                        <span className="text-[10px] font-black text-[#3a200a] tracking-tight leading-none mt-1 text-center truncate max-w-full">
                          {card.name || `Picture #${card.id}`}
                        </span>
                      </div>

                      {/* Card Inputs */}
                      <div className="space-y-1.5">
                        <div className="grid grid-cols-2 gap-1.5">
                          <div>
                            <span className="text-[9px] text-[#94A3B8] font-bold block mb-0.5">Name</span>
                            <input
                              value={card.name}
                              placeholder="English name"
                              onChange={(e) => {
                                const val = e.target.value;
                                setCards(prev => prev.map((item, i) => i === globalIndex ? { ...item, name: val } : item));
                              }}
                              className="w-full bg-[#0c0a08] border border-amber-500/20 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-amber-400 font-medium"
                            />
                          </div>

                          <div>
                            <span className="text-[9px] text-[#94A3B8] font-bold block mb-0.5">Hindi / Regional</span>
                            <input
                              value={card.hindi}
                              placeholder="Hindi name"
                              onChange={(e) => {
                                const val = e.target.value;
                                setCards(prev => prev.map((item, i) => i === globalIndex ? { ...item, hindi: val } : item));
                              }}
                              className="w-full bg-[#0c0a08] border border-amber-500/20 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-amber-400 font-medium"
                            />
                          </div>
                        </div>

                        {/* Emoji Symbol & Photo Upload Row */}
                        <div className="flex items-center gap-1.5">
                          <input
                            value={card.symbol}
                            placeholder="Emoji"
                            title="Card Emoji / Symbol"
                            onChange={(e) => {
                              const val = e.target.value;
                              setCards(prev => prev.map((item, i) => i === globalIndex ? { ...item, symbol: val } : item));
                            }}
                            className="w-10 text-center bg-[#0c0a08] border border-amber-500/20 rounded-lg py-1 text-sm text-white focus:outline-none focus:border-amber-400 shrink-0"
                          />

                          <label className="flex-1 px-2 py-1 rounded-lg bg-[#1c150e] border border-amber-500/30 text-amber-300 text-[10px] font-bold hover:bg-amber-500/10 cursor-pointer flex items-center justify-center gap-1 pressable transition-all truncate">
                            <Upload className="w-3 h-3 shrink-0" />
                            <span className="truncate">Upload Image</span>
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                try {
                                  const compressed = await shrinkImage(file, 400, 0.76);
                                  setCards(prev => prev.map((item, i) => i === globalIndex ? { ...item, imageUrl: compressed } : item));
                                  showToast(`Card #${card.id} image updated.`, 'success');
                                } catch (err: any) {
                                  showToast(err.message || 'Could not load image file.', 'error');
                                }
                              }}
                            />
                          </label>

                          <button
                            type="button"
                            onClick={() => resetSingleCard(card.id)}
                            className="p-1 rounded-lg bg-[#0c0a08] border border-white/[0.08] text-[#94A3B8] hover:text-white shrink-0"
                            title={`Reset Card #${card.id} to original`}
                          >
                            <RefreshCw className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* ── STICKY BOTTOM ACTION BAR ── */}
          <div className="p-4 rounded-2xl bg-[#140f0a] border border-amber-500/30 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-3 sticky bottom-4 z-20">
            <div className="flex items-center gap-2 text-xs text-[#94A3B8]">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                Changes take effect dynamically on the next round without disrupting ongoing player rounds.
              </span>
            </div>

            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              {selected && !selected.isLive && (
                <button
                  type="button"
                  onClick={remove}
                  className="px-4 py-2.5 rounded-xl border border-red-500/30 text-red-400 hover:bg-red-500/10 text-xs font-bold pressable transition-all flex items-center gap-1.5"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Delete Game</span>
                </button>
              )}

              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="flex-1 sm:flex-initial px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 text-black text-xs font-black shadow-lg shadow-amber-500/25 hover:brightness-110 disabled:opacity-50 pressable transition-all flex items-center justify-center gap-2"
              >
                {saving ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Saving Arena…</span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4 stroke-[3]" />
                    <span>{selectedId ? 'Save & Publish Changes' : 'Create Game Arena'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

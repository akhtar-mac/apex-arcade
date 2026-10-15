import React, { useEffect, useState } from 'react';

interface EventCard {
  id: number;
  name: string;
  hindi: string;
  symbol: string;
  imageUrl: string;
}

interface GameEvent {
  id: string;
  name: string;
  stake: number;
  multiplier: number;
  intervalSec: number;
  isLive: boolean;
  cards: EventCard[];
}

const EMPTY_CARDS: EventCard[] = Array.from({ length: 14 }, (_, index) => ({
  id: index + 1,
  name: '',
  hindi: '',
  symbol: '',
  imageUrl: ''
}));

async function shrinkImage(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Could not read that picture.'));
      image.src = url;
    });
    const max = 480;
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not prepare that picture.');
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.72);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function EventsPage({ apiBase, showToast }: { apiBase: string; showToast: (msg: string) => void }) {
  const [events, setEvents] = useState<GameEvent[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [stake, setStake] = useState(10);
  const [multiplier, setMultiplier] = useState(10);
  const [intervalSec, setIntervalSec] = useState(120);
  const [cards, setCards] = useState<EventCard[]>(EMPTY_CARDS);
  const [saving, setSaving] = useState(false);

  const selected = events.find((event) => event.id === selectedId) || null;
  const houseReturn = Math.round((multiplier / 14) * 100);

  const load = async () => {
    const res = await fetch(`${apiBase}/api/v1/admin/events`);
    const json = await res.json();
    if (res.ok && Array.isArray(json.data)) setEvents(json.data);
  };

  useEffect(() => {
    load().catch(() => showToast('Could not load events.'));
  }, [apiBase]);

  const fill = (event: GameEvent) => {
    setSelectedId(event.id);
    setName(event.name);
    setStake(event.stake);
    setMultiplier(event.multiplier);
    setIntervalSec(event.intervalSec);
    setCards(event.cards.map((card) => ({ ...card })));
  };

  const payload = () => ({
    name,
    stake,
    multiplier,
    intervalSec,
    cards: cards.map((card) => ({
      position: card.id,
      name: card.name,
      hindi: card.hindi,
      imageUrl: card.imageUrl
    }))
  });

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(selectedId ? `${apiBase}/api/v1/admin/events/${selectedId}` : `${apiBase}/api/v1/admin/events`, {
        method: selectedId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload())
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        showToast(json.error || 'Could not save the event.');
        return;
      }
      showToast(selectedId ? 'Event saved. The next round uses these pictures and payout.' : 'Event created. It stays offline until you make it live.');
      setSelectedId(json.data.id);
      await load();
    } finally {
      setSaving(false);
    }
  };

  const setLive = async (live: boolean) => {
    if (!selectedId) return;
    const res = await fetch(`${apiBase}/api/v1/admin/events/${selectedId}/live`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ live })
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      showToast(json.error || 'Could not change the live switch.');
      return;
    }
    showToast(json.message);
    await load();
  };

  const remove = async () => {
    if (!selectedId) return;
    const res = await fetch(`${apiBase}/api/v1/admin/events/${selectedId}`, { method: 'DELETE' });
    const json = await res.json();
    if (!res.ok || !json.success) {
      showToast(json.error || 'Could not delete the event.');
      return;
    }
    setSelectedId(null);
    showToast('Event deleted.');
    await load();
  };

  return (
    <div className="space-y-4">
      <div className="p-5 rounded-2xl bg-[#111319] border border-white/[0.08]">
        <h3 className="text-white font-black text-lg">Events</h3>
        <p className="text-xs text-[#94A3B8] mt-1">
          Every game is listed here, including the ones already running. Create another, edit its pictures, stake, and payout from 1× to 20×, then make it live. Offline games leave the player lobby after the current round.
          A {multiplier}× payout on 14 pictures returns about {houseReturn}% of stakes over time. The winning card is still sealed when the round starts.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-4">
        <div className="space-y-2">
          <button
            onClick={() => {
              setSelectedId(null);
              setName('Sunday ₹10');
              setStake(10);
              setMultiplier(10);
              setIntervalSec(120);
              setCards(EMPTY_CARDS.map((card) => ({ ...card, name: `Picture ${card.id}` })));
            }}
            className="w-full py-2.5 rounded-xl bg-[#00F59B] text-black text-xs font-black"
          >
            New event
          </button>
          {events.map((event) => (
            <button
              key={event.id}
              onClick={() => fill(event)}
              className={`w-full text-left p-3 rounded-xl border ${selectedId === event.id ? 'border-[#00F59B] bg-[#111319]' : 'border-white/[0.08] bg-[#111319]/60'}`}
            >
              <span className="block text-sm font-bold text-white">{event.name}</span>
              <span className="block text-[10px] text-[#94A3B8] mt-0.5">₹{event.stake} · {event.multiplier}× · {event.isLive ? 'LIVE' : 'OFFLINE'}</span>
            </button>
          ))}
          {events.length === 0 && <p className="text-xs text-[#94A3B8] px-1">No events yet.</p>}
        </div>

        <div className="p-4 rounded-2xl bg-[#111319] border border-white/[0.08] space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <label className="text-[10px] font-bold text-[#94A3B8] col-span-2">
              Event name
              <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-white" />
            </label>
            <label className="text-[10px] font-bold text-[#94A3B8]">
              Stake ₹
              <input type="number" value={stake} min={10} max={5000} onChange={(e) => setStake(Number(e.target.value))} className="mt-1 w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-white" />
            </label>
            <label className="text-[10px] font-bold text-[#94A3B8]">
              Payout ×
              <input type="number" value={multiplier} min={1} max={20} onChange={(e) => setMultiplier(Number(e.target.value))} className="mt-1 w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-white" />
            </label>
            <label className="text-[10px] font-bold text-[#94A3B8]">
              Round seconds
              <input type="number" value={intervalSec} min={30} max={600} onChange={(e) => setIntervalSec(Number(e.target.value))} className="mt-1 w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-white" />
            </label>
          </div>
          <p className="text-xs text-[#94A3B8]">A winning ₹{stake || 0} stake pays ₹{(stake || 0) * (multiplier || 0)}.</p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {cards.map((card, index) => (
              <div key={card.id} className="p-2 rounded-xl bg-black/30 border border-white/[0.06] space-y-1.5">
                <div className="h-16 rounded-lg bg-black/40 overflow-hidden flex items-center justify-center">
                  {card.imageUrl ? <img src={card.imageUrl} alt={card.name} className="w-full h-full object-cover" /> : <span className="text-[10px] text-[#94A3B8]">#{card.id}</span>}
                </div>
                <input
                  value={card.name}
                  placeholder={`Name ${card.id}`}
                  onChange={(e) => setCards((prev) => prev.map((item, i) => i === index ? { ...item, name: e.target.value } : item))}
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-xs text-white"
                />
                <input
                  value={card.hindi}
                  placeholder="Local name"
                  onChange={(e) => setCards((prev) => prev.map((item, i) => i === index ? { ...item, hindi: e.target.value } : item))}
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-xs text-white"
                />
                <input
                  type="file"
                  accept="image/*"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    try {
                      const imageUrl = await shrinkImage(file);
                      setCards((prev) => prev.map((item, i) => i === index ? { ...item, imageUrl } : item));
                    } catch (err) {
                      showToast(err instanceof Error ? err.message : 'Could not read that picture.');
                    }
                  }}
                  className="text-[10px] text-[#94A3B8] w-full"
                />
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <button onClick={save} disabled={saving} className="px-4 py-2.5 rounded-xl bg-[#00F59B] text-black text-xs font-black disabled:opacity-50">
              {selectedId ? 'Save event' : 'Create event'}
            </button>
            {selected && (
              <button onClick={() => setLive(!selected.isLive)} className="px-4 py-2.5 rounded-xl bg-white text-black text-xs font-black">
                {selected.isLive ? 'Take offline' : 'Make live'}
              </button>
            )}
            {selected && !selected.isLive && (
              <button onClick={remove} className="px-4 py-2.5 rounded-xl border border-white/15 text-xs font-bold text-[#94A3B8]">
                Delete
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

import * as crypto from 'crypto';
import { PICTURE_CARDS } from '@arcade/shared-types';
import { DB, getPrisma } from '../db.js';

export interface EventCardInput {
  position: number;
  name: string;
  hindi?: string;
  imageUrl?: string;
}

export interface EventInput {
  name: string;
  stake: number;
  multiplier: number;
  intervalSec: number;
  cards?: EventCardInput[];
}

const COLORS = ['#f59e0b', '#ea580c', '#64748b', '#854d0e', '#0284c7', '#0d9488', '#eab308', '#06b6d4', '#dc2626', '#4f46e5', '#e11d48', '#d946ef', '#4ade80', '#fb7185'];

function defaultCards(): EventCardInput[] {
  return PICTURE_CARDS.map((card) => ({
    position: card.id,
    name: card.name,
    hindi: card.hindi,
    imageUrl: card.imageUrl
  }));
}

function cleanCards(input?: EventCardInput[]) {
  const source = input && input.length ? input : defaultCards();
  if (source.length !== 14) {
    throw new Error('An event needs all 14 pictures.');
  }
  const seen = new Set<number>();
  return source.map((card) => {
    const position = Number(card.position);
    if (!Number.isInteger(position) || position < 1 || position > 14 || seen.has(position)) {
      throw new Error('Picture positions must be 1 to 14, each used once.');
    }
    seen.add(position);
    const name = String(card.name || '').trim();
    if (name.length < 1 || name.length > 24) {
      throw new Error('Each picture name must be 1 to 24 characters.');
    }
    const hindi = String(card.hindi || '').trim().slice(0, 24);
    const imageUrl = String(card.imageUrl || '').trim();
    if (imageUrl.length > 400000) {
      throw new Error('Each picture must be under about 300 KB.');
    }
    if (imageUrl && !imageUrl.startsWith('data:image/') && !imageUrl.startsWith('/') && !imageUrl.startsWith('https://')) {
      throw new Error('A picture must be an uploaded image or an https link.');
    }
    const template = PICTURE_CARDS.find((item) => item.id === position);
    return {
      position,
      name,
      hindi,
      symbol: template?.symbol || '',
      imageUrl: imageUrl || template?.imageUrl || ''
    };
  }).sort((a, b) => a.position - b.position);
}

function readSettings(input: EventInput) {
  const name = String(input.name || '').trim();
  if (name.length < 2 || name.length > 40) {
    throw new Error('Event name must be 2 to 40 characters.');
  }
  const stake = Number(input.stake);
  if (!Number.isFinite(stake) || stake < 10 || stake > 5000) {
    throw new Error('Stake must be between ₹10 and ₹5,000.');
  }
  const multiplier = Number(input.multiplier);
  if (!Number.isInteger(multiplier) || multiplier < 1 || multiplier > 20) {
    throw new Error('Payout must be a whole number from 1× to 20×.');
  }
  const intervalSec = Number(input.intervalSec || 120);
  if (!Number.isInteger(intervalSec) || intervalSec < 30 || intervalSec > 600) {
    throw new Error('Round length must be 30 to 600 seconds.');
  }
  return { name, stake, multiplier, intervalSec, cards: cleanCards(input.cards) };
}

function toPublic(event: {
  id: string;
  name: string;
  stake: unknown;
  multiplier: unknown;
  intervalSec: number;
  isLive: boolean;
  fixedStake?: boolean;
  cards: Array<{ position: number; name: string; hindi: string; symbol: string; imageUrl: string }>;
}) {
  return {
    id: event.id,
    name: event.name,
    stake: Number(event.stake),
    multiplier: Number(event.multiplier),
    intervalSec: event.intervalSec,
    isLive: event.isLive,
    fixedStake: Boolean(event.fixedStake),
    cards: event.cards
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((card) => ({
        id: card.position,
        name: card.name,
        hindi: card.hindi,
        symbol: card.symbol,
        color: COLORS[card.position - 1] || '#94a3b8',
        imageUrl: card.imageUrl
      }))
  };
}

function memoryRoom(event: ReturnType<typeof toPublic>) {
  return {
    id: event.id,
    tierName: event.name,
    entryAmount: event.stake,
    intervalSec: event.intervalSec,
    isActive: event.isLive,
    multiplier: event.multiplier,
    fixedStake: event.fixedStake,
    cards: event.cards
  };
}

async function publishRoom(event: ReturnType<typeof toPublic>) {
  const room = memoryRoom(event);
  const { GameEngineService } = await import('./game-engine.service.js');
  GameEngineService.applyEventRoom(room);
}

export class EventService {
  static async listAll() {
    const prisma = getPrisma();
    const rows = await prisma.gameEvent.findMany({
      include: { cards: true },
      orderBy: { createdAt: 'desc' }
    });
    return rows.map(toPublic);
  }

  static async listLive() {
    const rows = await this.listAll();
    return rows.filter((event) => event.isLive);
  }

  static async create(input: EventInput) {
    const settings = readSettings(input);
    const id = crypto.randomUUID();
    const prisma = getPrisma();
    await prisma.gameRoom.create({
      data: {
        id,
        tierName: settings.name,
        entryAmount: settings.stake,
        intervalSec: settings.intervalSec,
        isActive: false
      }
    });
    const created = await prisma.gameEvent.create({
      data: {
        id,
        name: settings.name,
        stake: settings.stake,
        multiplier: settings.multiplier,
        intervalSec: settings.intervalSec,
        isLive: false,
        fixedStake: true,
        cards: { create: settings.cards }
      },
      include: { cards: true }
    });
    return toPublic(created);
  }

  static async update(id: string, input: EventInput) {
    const settings = readSettings(input);
    const prisma = getPrisma();
    const existing = await prisma.gameEvent.findUnique({ where: { id } });
    if (!existing) throw new Error('Event not found');
    await prisma.eventCard.deleteMany({ where: { eventId: id } });
    const updated = await prisma.gameEvent.update({
      where: { id },
      data: {
        name: settings.name,
        stake: settings.stake,
        multiplier: settings.multiplier,
        intervalSec: settings.intervalSec,
        cards: { create: settings.cards }
      },
      include: { cards: true }
    });
    await prisma.gameRoom.update({
      where: { id },
      data: {
        tierName: settings.name,
        entryAmount: settings.stake,
        intervalSec: settings.intervalSec
      }
    });
    const event = toPublic(updated);
    await publishRoom(event);
    return event;
  }

  static async setLive(id: string, live: boolean) {
    const prisma = getPrisma();
    const existing = await prisma.gameEvent.findUnique({ where: { id }, include: { cards: true } });
    if (!existing) throw new Error('Event not found');
    const updated = await prisma.gameEvent.update({
      where: { id },
      data: { isLive: live },
      include: { cards: true }
    });
    await prisma.gameRoom.update({
      where: { id },
      data: { isActive: live }
    });
    const event = toPublic(updated);
    await publishRoom(event);
    return event;
  }

  static async remove(id: string) {
    const prisma = getPrisma();
    const existing = await prisma.gameEvent.findUnique({ where: { id } });
    if (!existing) throw new Error('Event not found');
    if (existing.isLive) throw new Error('Take the event offline before deleting it.');
    const rounds = await prisma.gameRound.count({ where: { roomId: id } });
    await prisma.gameEvent.delete({ where: { id } });
    if (rounds === 0) {
      await prisma.gameRoom.delete({ where: { id } }).catch(() => undefined);
      DB.memory.gameRooms.delete(id);
    } else {
      await prisma.gameRoom.update({ where: { id }, data: { isActive: false } });
      const cached = DB.memory.gameRooms.get(id);
      if (cached) cached.isActive = false;
    }
  }

  static async ensureDefaults() {
    const defaults = [
      { id: 'room-tier-10', name: 'Blitz Arena', stake: 10, multiplier: 10, intervalSec: 120 },
      { id: 'room-tier-50', name: 'Classic Tier', stake: 50, multiplier: 10, intervalSec: 180 },
      { id: 'room-tier-100', name: 'High Roller', stake: 100, multiplier: 10, intervalSec: 240 }
    ];
    const prisma = getPrisma();
    for (const item of defaults) {
      const existing = await prisma.gameEvent.findUnique({ where: { id: item.id } });
      if (existing) continue;
      await prisma.gameRoom.upsert({
        where: { id: item.id },
        update: {},
        create: {
          id: item.id,
          tierName: item.name,
          entryAmount: item.stake,
          intervalSec: item.intervalSec,
          isActive: true
        }
      });
      await prisma.gameEvent.create({
        data: {
          id: item.id,
          name: item.name,
          stake: item.stake,
          multiplier: item.multiplier,
          intervalSec: item.intervalSec,
          isLive: true,
          fixedStake: false,
          cards: { create: cleanCards() }
        }
      });
    }
    const events = await prisma.gameEvent.findMany();
    for (const event of events) {
      await prisma.gameRoom.update({
        where: { id: event.id },
        data: { isActive: event.isLive, tierName: event.name, entryAmount: event.stake, intervalSec: event.intervalSec }
      }).catch(() => undefined);
    }
  }

  static async loadLiveIntoMemory() {
    const live = await this.listLive();
    for (const event of live) {
      DB.memory.gameRooms.set(event.id, memoryRoom(event));
    }
  }
}

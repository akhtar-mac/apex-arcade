import { DB } from '../db.js';
import { Ledger } from './ledger.service.js';
import { RoundStatus, PICTURE_CARDS, TxType, TxStatus } from '@arcade/shared-types';
import { calculateProvablyFairCard, generateRandomSeed, calculatePayout } from '@arcade/shared-utils';
import { RedisService } from './redis.service.js';
import { BetQueueService } from './bet-queue.service.js';
import { TurnoverService } from './turnover.service.js';
import * as crypto from 'crypto';

interface ActiveRoomState {
  roomId: string;
  tierName: string;
  entryAmount: number;
  intervalSec: number;
  multiplier: number;
  fixedStake: boolean;
  cards: Array<{ id: number; name: string; symbol: string; hindi?: string; imageUrl?: string; color?: string }>;
  currentRoundId: string;
  roundNumber: number;
  status: RoundStatus;
  startTime: number;
  endTime: number;
  secondsRemaining: number;
  serverSeed: string;
  clientSeed: string;
  nonce: number;
  resultCard: number | null;
  bets: Map<string, any>; // betId -> bet
  roundStats?: {
    totalPool: number;
    totalPayout: number;
    houseProfit: number;
    profitMarginPercent: number;
    optimizedCard: number;
  };
}

export class GameEngineService {
  private static roomsState: Map<string, ActiveRoomState> = new Map();
  private static ioInstance: any = null;
  private static tickerTimer: NodeJS.Timeout | null = null;
  private static workerId: string = 'worker-' + crypto.randomUUID().substring(0, 8);

  // House Edge Policy: Admin target 20% to 30% profit guarantee
  public static houseProfitConfig = {
    enabled: true,
    minProfitMargin: 0.20, // At least 20% profit for the house
    targetProfitMargin: 0.25, // Target 25% profit
    maxProfitMargin: 0.35  // Up to 35% profit
  };

  static setSocketIo(io: any) {
    this.ioInstance = io;
  }

  static getIo() {
    return this.ioInstance;
  }

  public static roundLogs: any[] = [];

  static initialize() {
    console.log('[GAME ENGINE] 🎰 Initializing 14-picture engine. The winning card is sealed when the round starts.');
    BetQueueService.initialize();
    for (const room of DB.memory.gameRooms.values()) {
      if (room.isActive) {
        this.startNewRoundForRoom(room.id, 1);
      }
    }

    // Start central high-precision 1-second synchronization tick
    if (!this.tickerTimer) {
      this.tickerTimer = setInterval(() => this.engineClockTick(), 1000);
    }
  }

  static applyEventRoom(room: { id: string; isActive?: boolean }) {
    DB.memory.gameRooms.set(room.id, room);
    if (room.isActive && !this.roomsState.has(room.id)) {
      this.startNewRoundForRoom(room.id, 1);
    }
  }

  private static cardOf(state: ActiveRoomState, cardId: number) {
    return state.cards.find((card) => card.id === cardId)
      || PICTURE_CARDS.find((card) => card.id === cardId)
      || PICTURE_CARDS[0];
  }

  static startNewRoundForRoom(roomId: string, roundNumber: number) {
    const room = DB.memory.gameRooms.get(roomId);
    if (!room || room.isActive === false) return;

    const roundId = crypto.randomUUID();
    const interval = room.intervalSec || 120;
    const now = Date.now();
    const endTime = now + interval * 1000;
    const serverSeed = generateRandomSeed();
    const clientSeed = 'apex_picture_client_seed_2026';
    const multiplier = Number(room.multiplier) || 10;
    const cards = Array.isArray(room.cards) && room.cards.length === 14 ? room.cards : PICTURE_CARDS;

    const state: ActiveRoomState = {
      roomId,
      tierName: room.tierName,
      entryAmount: Number(room.entryAmount),
      intervalSec: interval,
      multiplier,
      fixedStake: Boolean(room.fixedStake),
      cards,
      currentRoundId: roundId,
      roundNumber,
      status: RoundStatus.BETTING,
      startTime: now,
      endTime,
      secondsRemaining: interval,
      serverSeed,
      clientSeed,
      nonce: roundNumber,
      resultCard: null,
      bets: new Map()
    };

    const sealed = calculateProvablyFairCard(serverSeed, clientSeed, roundNumber);
    state.resultCard = sealed.card;

    this.roomsState.set(roomId, state);

    // Save round in DB
    DB.memory.gameRounds.set(roundId, {
      id: roundId,
      roomId,
      roundNumber,
      status: RoundStatus.BETTING,
      startTime: new Date(now),
      endTime: new Date(endTime),
      resultCard: null,
      multiplier,
      createdAt: new Date()
    });

    Ledger.openRound({
      id: roundId,
      roomId,
      roundNumber,
      multiplier,
      startTime: new Date(now),
      endTime: new Date(endTime)
    }).catch((err) => console.error('[DATABASE] Could not open round row:', err.message));

    console.log(`[GAME ENGINE] 🚀 Room [${room.tierName}] Round #${roundNumber} started. Interval: ${interval}s. Card sealed before bets.`);

    // Emit round start
    if (this.ioInstance) {
      this.ioInstance.to(roomId).emit('round:tick', {
        roomId,
        roundId,
        roundNumber,
        status: RoundStatus.BETTING,
        secondsRemaining: interval
      });
    }
  }

  /**
   * Central clock tick managing the 4-phase state cycle:
   * PHASE 1: BETTING (interval down to 10s) -> Open for bets
   * PHASE 2: LOCKED (last 10s) -> Bets frozen. The card was already sealed at round start.
   * PHASE 3: SETTLEMENT & ANIMATION (last 3s) -> Winner reveal, wallet credit
   * PHASE 4: NEXT ROUND GENERATION (at 0s)
   */
  private static async engineClockTick() {
    // Clustered Single-Leader Clock Election (Redlock pattern)
    // Ensures only 1 master node decrements countdown even with 10k CCU across 4-6 cluster workers
    if (RedisService.isConnected()) {
      const isLeader = await RedisService.acquireLock('game:engine:clock:leader', this.workerId, 2500)
        || await RedisService.renewLock('game:engine:clock:leader', this.workerId, 2500);
      if (!isLeader) {
        return; // Standby worker; leader ticks the clock
      }
    }

    for (const [roomId, state] of this.roomsState.entries()) {
      state.secondsRemaining -= 1;

      if (state.secondsRemaining === 10 && state.status === RoundStatus.BETTING) {
        state.status = RoundStatus.LOCKED;
        const card = state.resultCard || 1;
        const roundBets = Array.from(state.bets.values());
        const totalPool = roundBets.reduce((sum, b) => sum + b.amount, 0);
        const stakedOnWinner = roundBets.filter(b => b.chosenCard === card).reduce((sum, b) => sum + b.amount, 0);
        const totalPayout = stakedOnWinner * state.multiplier;
        const houseProfit = totalPool - totalPayout;
        state.roundStats = {
          totalPool,
          totalPayout,
          houseProfit,
          profitMarginPercent: totalPool > 0 ? Math.round((houseProfit / totalPool) * 10000) / 100 : 0,
          optimizedCard: card
        };
        console.log(`[GAME ENGINE] 🔒 Room [${state.tierName}] Round #${state.roundNumber} locked. Sealed card stays hidden until reveal.`);

        if (this.ioInstance) {
          this.ioInstance.to(roomId).emit('round:locked', {
            roomId,
            roundId: state.currentRoundId,
            roundNumber: state.roundNumber,
            message: 'Bets are locked for the last 10 seconds.'
          });
        }
      }

      // Phase 3: SETTLING & REVEAL (At 3s remaining)
      else if (state.secondsRemaining === 3 && state.status === RoundStatus.LOCKED) {
        state.status = RoundStatus.SETTLING;
        const winningCard = state.resultCard || 1;
        const symbolObj = this.cardOf(state, winningCard);

        console.log(`[GAME ENGINE] 🎯 Room [${state.tierName}] WINNING REVEAL: #${winningCard} ${symbolObj.name} (${symbolObj.symbol})`);

        // Settle all bets
        await this.settleRoundBets(state, winningCard);

        if (this.ioInstance) {
          this.ioInstance.to(roomId).emit('round:result', {
            roomId,
            roundId: state.currentRoundId,
            roundNumber: state.roundNumber,
            winningCard,
            winningSymbol: symbolObj,
            multiplier: state.multiplier,
            revealedAt: new Date().toISOString()
          });
        }
      }

      // Phase 4: NEXT ROUND GENERATION (At 0 seconds)
      else if (state.secondsRemaining <= 0) {
        state.status = RoundStatus.COMPLETED;
        const dbRound = DB.memory.gameRounds.get(state.currentRoundId);
        if (dbRound) {
          dbRound.status = RoundStatus.COMPLETED;
          dbRound.resultCard = state.resultCard;
        }

        const room = DB.memory.gameRooms.get(roomId);
        if (!room || room.isActive === false) {
          this.roomsState.delete(roomId);
          continue;
        }
        this.startNewRoundForRoom(roomId, state.roundNumber + 1);
        continue;
      }

      // Emit real-time tick to connected clients in room
      if (this.ioInstance && state.secondsRemaining >= 0) {
        this.ioInstance.to(roomId).emit('round:tick', {
          roomId,
          roundId: state.currentRoundId,
          roundNumber: state.roundNumber,
          status: state.status,
          secondsRemaining: state.secondsRemaining
        });
      }
    }
  }

  /**
   * Settle round bets: Winners get Stake × 10.0; losers finalized
   */
  private static async settleRoundBets(state: ActiveRoomState, winningCard: number) {
    const roundBets = Array.from(state.bets.values());
    let totalPaidOut = 0;
    let totalCollected = 0;

    for (const bet of roundBets) {
      totalCollected += bet.amount;
      const isWin = bet.chosenCard === winningCard;
      bet.isWin = isWin;

      if (isWin) {
        const payout = calculatePayout(bet.amount, state.multiplier);
        bet.payout = payout;
        totalPaidOut += payout;

        if (!bet.isBot) {
          // Credit winner's wallet atomically
          const creditRes = await DB.atomicWalletCredit(bet.userId, payout);

          // Record winning transaction
          const txId = crypto.randomUUID();
          DB.memory.transactions.set(txId, {
            id: txId,
            userId: bet.userId,
            type: TxType.BET_WON,
            status: TxStatus.SUCCESS,
            amount: payout,
            utrNumber: `WIN-${state.currentRoundId.substring(0, 6)}`,
            createdAt: new Date(),
            updatedAt: new Date()
          });

          // Notify user via socket
          if (this.ioInstance) {
            this.ioInstance.to(`user:${bet.userId}`).emit('wallet:update', {
              userId: bet.userId,
              balance: creditRes.newBalance,
              locked: DB.memory.wallets.get(bet.userId)?.locked ?? 0,
              delta: payout,
              reason: `Round #${state.roundNumber} WIN: ₹${payout.toFixed(2)}`
            });

            // Global broadcast for big wins
            const user = DB.memory.users.get(bet.userId);
            const phone = user ? user.phoneNumber : '9876543210';
            const cardObj = this.cardOf(state, winningCard);
            this.ioInstance.emit('global:winner', {
              userMasked: `${phone.substring(0, 2)}******${phone.substring(8)}`,
              amount: payout,
              cardName: cardObj ? cardObj.name : 'Symbol'
            });
          }
        }
      } else {
        bet.payout = 0;
      }
    }

    const netProfit = totalCollected - totalPaidOut;
    const profitMargin = totalCollected > 0 ? (netProfit / totalCollected) * 100 : 0;
    const winningSymbol = this.cardOf(state, winningCard);

    const betsList = roundBets.map(b => {
      const u = DB.memory.users.get(b.userId);
      const c = this.cardOf(state, b.chosenCard);
      return {
        userId: b.userId,
        phone: u ? u.phoneNumber : 'Unknown',
        chosenCard: b.chosenCard,
        chosenCardName: c.name,
        chosenCardSymbol: c.symbol,
        amount: b.amount,
        isWin: b.isWin,
        payout: b.payout || 0
      };
    });

    const winnersList = betsList.filter(b => b.isWin).map(w => ({
      userId: w.userId,
      phone: w.phone,
      card: w.chosenCard,
      amount: w.amount,
      payout: w.payout
    }));

    const now = new Date();
    const logEntry = {
      roundNumber: state.roundNumber,
      roundId: state.currentRoundId,
      roomId: state.roomId,
      roomName: state.tierName,
      timestamp: now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ', ' + now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
      totalPool: totalCollected,
      winningCard,
      winningCardName: winningSymbol.name,
      winningCardSymbol: winningSymbol.symbol,
      totalPayout: totalPaidOut,
      adminProfit: netProfit,
      marginPercent: Math.round(profitMargin * 10) / 10,
      betsCount: betsList.length,
      bets: betsList,
      winners: winnersList,
      engineReasoning: `Card sealed at round start. Pool ₹${totalCollected}, paid ₹${totalPaidOut}, house ₹${netProfit} (${profitMargin.toFixed(1)}%).`
    };

    GameEngineService.roundLogs.unshift(logEntry);
    if (GameEngineService.roundLogs.length > 100) {
      GameEngineService.roundLogs.pop();
    }

    // Persist permanently to PostgreSQL database
    DB.recordGameRound({
      id: state.currentRoundId,
      roomId: state.roomId,
      roundNumber: state.roundNumber,
      resultCard: winningCard,
      totalPool: totalCollected,
      houseProfit: netProfit,
      profitMargin: profitMargin,
      startTime: new Date(state.startTime),
      endTime: now
    }).catch(e => console.warn('[DATABASE] Async round persistence notice:', e.message));

    // The bet row is inserted at stake time. Write the result after the wallet credit.
    await BetQueueService.recordResults(roundBets.map(b => ({
      id: b.id,
      isWin: b.isWin,
      payout: b.payout ?? 0
    })));

    console.log(`[PROFIT SETTLED] Round #${state.roundNumber} Settled: Collected ₹${totalCollected}, Paid Out ₹${totalPaidOut}, Net Profit: ₹${netProfit} (${profitMargin.toFixed(1)}% Company Profit)`);
  }

  /**
   * Atomic Bet Placement with wallet deduction
   * Bets close in the last 10 seconds. The winning card is already sealed.
   */
  static async placeBet(userId: string, roomId: string, roundId: string, chosenCard: number, amount: number) {
    const roomState = this.roomsState.get(roomId);
    if (!roomState) {
      throw new Error('Game room not found or inactive');
    }
    const { AdminRiskService } = await import('./admin-risk.service.js');
    if (AdminRiskService.isBettingFrozen) {
      throw new Error('Betting is temporarily paused by administration');
    }
    if (roomState.currentRoundId !== roundId) {
      throw new Error('Round has already expired');
    }
    if (roomState.status !== RoundStatus.BETTING || roomState.secondsRemaining <= 10) {
      throw new Error('Bets are locked for the last 10 seconds.');
    }
    if (chosenCard < 1 || chosenCard > 14) {
      throw new Error('Chosen card must be between 1 and 14');
    }
    if (roomState.fixedStake && amount !== roomState.entryAmount) {
      throw new Error(`This event takes a ₹${roomState.entryAmount} bet.`);
    }
    if (amount > 5000) {
      throw new Error('Maximum bet is ₹5,000 per card');
    }
    const { ComplianceService } = await import('./compliance.service.js');
    await ComplianceService.assertCanUseAccount(userId);

    await Ledger.waitRound(roundId);

    // Atomic Balance Deduction
    const deductRes = await DB.atomicWalletDeduct(userId, amount);
    if (!deductRes.success) {
      throw new Error(deductRes.error || 'Insufficient wallet balance');
    }

    const betId = crypto.randomUUID();
    const newBet = {
      id: betId,
      userId,
      roundId,
      chosenCard,
      amount,
      isWin: null,
      payout: null,
      createdAt: new Date()
    };

    // Store in active room bets map & memory DB
    roomState.bets.set(betId, newBet);
    DB.memory.bets.set(betId, newBet);

    // Enqueue for asynchronous bulk micro-batching to PostgreSQL (500 records/batch)
    BetQueueService.enqueue(newBet);

    // Record wager against 1.0x deposit turnover requirement
    TurnoverService.recordBetTurnover(userId, amount).catch(() => {});

    // Record transaction
    const txId = crypto.randomUUID();
    DB.memory.transactions.set(txId, {
      id: txId,
      userId,
      type: TxType.BET_PLACED,
      status: TxStatus.SUCCESS,
      amount,
      utrNumber: `BET-${betId.substring(0, 8)}`,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    console.log(`[BET] 🎟️ User ${userId} placed ₹${amount} on Card #${chosenCard} in Room ${roomId}`);

    return {
      betId,
      roundId,
      chosenCard,
      amount,
      newBalance: deductRes.newBalance
    };
  }

  static getRoomsSummary() {
    return Array.from(this.roomsState.values()).map(s => ({
      roomId: s.roomId,
      tierName: s.tierName,
      entryAmount: s.entryAmount,
      intervalSec: s.intervalSec,
      roundId: s.currentRoundId,
      roundNumber: s.roundNumber,
      status: s.status,
      secondsRemaining: s.secondsRemaining,
      activeBetsCount: s.bets.size,
      currentPool: Array.from(s.bets.values()).reduce((sum, b) => sum + b.amount, 0),
      lastRoundStats: s.roundStats || null
    }));
  }

  static getRoomState(roomId: string) {
    return this.roomsState.get(roomId);
  }
}

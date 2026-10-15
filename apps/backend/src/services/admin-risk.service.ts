import { DB } from '../db.js';
import { WalletService } from './wallet.service.js';
import { GameEngineService } from './game-engine.service.js';
import { PICTURE_CARDS } from '@arcade/shared-types';

export class AdminRiskService {
  public static isBettingFrozen: boolean = false;
  public static arePayoutsHalted: boolean = false;

  /**
   * Kill Switch 1: Emergency Betting Freeze
   */
  static toggleFreezeBetting(freeze?: boolean): boolean {
    this.isBettingFrozen = freeze !== undefined ? freeze : !this.isBettingFrozen;
    console.log(`[KILL SWITCH] 🚨 BETTING FREEZE STATUS: ${this.isBettingFrozen ? 'FROZEN (ALL BETS BLOCKED)' : 'ACTIVE (OPEN)'}`);

    const io = GameEngineService.getIo();
    if (io) {
      io.emit('admin:betting-freeze', {
        isFrozen: this.isBettingFrozen,
        timestamp: new Date()
      });
    }
    return this.isBettingFrozen;
  }

  /**
   * Kill Switch 2: Emergency Payout Halt
   */
  static toggleHaltPayouts(halt?: boolean): boolean {
    this.arePayoutsHalted = halt !== undefined ? halt : !this.arePayoutsHalted;
    console.log(`[KILL SWITCH] 🚨 PAYOUT HALT STATUS: ${this.arePayoutsHalted ? 'HALTED (ALL PAYOUTS QUEUED FOR MANUAL REVIEW)' : 'ACTIVE (INSTANT DISPATCH ENABLED)'}`);
    return this.arePayoutsHalted;
  }

  /**
   * Kill Switch 3: Force Round Refund
   * Cancels current round and atomically returns all stakes to player wallets
   */
  static async forceRefundRound(roomId: string = 'room-tier-10'): Promise<{
    success: boolean;
    refundedBetsCount: number;
    totalAmountRefunded: number;
    message: string;
  }> {
    const state = GameEngineService.getRoomState(roomId);
    if (!state) {
      throw new Error(`Room ${roomId} not found`);
    }

    const bets = Array.from(state.bets.values());
    let totalRefunded = 0;
    let refundedCount = 0;

    for (const bet of bets) {
      if (!bet.isBot) {
        // Atomic refund credit (<1ms)
        await WalletService.credit(bet.userId, bet.amount);
        totalRefunded += bet.amount;
        refundedCount++;

        // Notify client via WebSocket
        const io = GameEngineService.getIo();
        if (io) {
          const w = await WalletService.getBalance(bet.userId);
          io.to(`user:${bet.userId}`).emit('wallet:update', {
            userId: bet.userId,
            balance: w.balance,
            locked: 0,
            delta: bet.amount,
            reason: `Emergency Refund: Round #${state.roundNumber} cancelled`
          });
        }
      }
    }

    // Clear bets and restart round
    state.bets.clear();
    console.log(`[KILL SWITCH] 🔄 Force Round #${state.roundNumber} Refund Executed! Refunded ₹${totalRefunded} across ${refundedCount} bets.`);

    const io = GameEngineService.getIo();
    if (io) {
      io.to(roomId).emit('round:cancelled', {
        roomId,
        roundId: state.currentRoundId,
        roundNumber: state.roundNumber,
        message: 'Round cancelled by administration. All stakes refunded.'
      });
    }

    return {
      success: true,
      refundedBetsCount: refundedCount,
      totalAmountRefunded: totalRefunded,
      message: `Successfully refunded ₹${totalRefunded.toFixed(2)} to ${refundedCount} players`
    };
  }

  /**
   * Kill Switch 4: Force Settle Winning Card (Admin Override)
   */
  static forceSettleCard(roomId: string, cardId: number) {
    if (cardId < 1 || cardId > 14) {
      throw new Error('Card ID must be between 1 and 14');
    }
    const state = GameEngineService.getRoomState(roomId);
    if (!state) {
      throw new Error(`Room ${roomId} not found`);
    }

    state.resultCard = cardId;
    console.log(`[KILL SWITCH] 🎯 Admin Override: Card #${cardId} forced for Round #${state.roundNumber}`);
    return { success: true, winningCard: cardId, roundNumber: state.roundNumber };
  }

  /**
   * Computes live liability exposure and margin metrics across all 14 cards
   */
  static getLiveRiskMetrics(roomId: string = 'room-tier-10') {
    const state = GameEngineService.getRoomState(roomId);
    const roundBets = state ? Array.from(state.bets.values()) : [];
    const totalPool = roundBets.reduce((sum, b) => sum + b.amount, 0);

    const cardLiabilities: { card: number; name: string; bets: number; payout: number; liabilityNet: number }[] = [];
    let maxLiability = 0;

    for (let c = 1; c <= 14; c++) {
      const betsOnCard = roundBets.filter(b => b.chosenCard === c).reduce((sum, b) => sum + b.amount, 0);
      const payout = betsOnCard * 10.0;
      const net = payout - totalPool;
      if (net > maxLiability) maxLiability = net;

      const cardObj = PICTURE_CARDS.find(p => p.id === c) || PICTURE_CARDS[0];
      cardLiabilities.push({
        card: c,
        name: cardObj.name,
        bets: betsOnCard,
        payout,
        liabilityNet: net
      });
    }

    return {
      roomId,
      roundNumber: state?.roundNumber || 0,
      secondsRemaining: state?.secondsRemaining || 0,
      totalPool,
      maxLiabilityExposure: Math.max(0, maxLiability),
      killSwitches: {
        isBettingFrozen: this.isBettingFrozen,
        arePayoutsHalted: this.arePayoutsHalted
      },
      cardLiabilities
    };
  }
}

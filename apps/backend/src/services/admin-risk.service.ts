import { DB } from '../db.js';
import { WalletService } from './wallet.service.js';
import { GameEngineService } from './game-engine.service.js';
import { PICTURE_CARDS } from '@arcade/shared-types';
import { calculateProvablyFairCard, roundCurrency } from '@arcade/shared-utils';
import * as crypto from 'crypto';

export interface DynamicProfitResult {
  winningCard: number;
  targetMargin: number;
  actualMargin: number;
  totalPool: number;
  totalPayout: number;
  houseProfit: number;
  matchingServerSeed: string;
}

export class AdminRiskService {
  public static isBettingFrozen: boolean = false;
  public static arePayoutsHalted: boolean = false;

  // ── Secret House Profit Margin Engine Configuration ──
  // Kept secret and hidden from clients and public APIs.
  public static houseMarginEnabled: boolean = true;
  public static minProfitPercent: number = 20.0; // Default at least 20%
  public static maxProfitPercent: number = 40.0; // Default up to 40%

  static getHouseMarginConfig() {
    return {
      enabled: this.houseMarginEnabled,
      minProfitPercent: this.minProfitPercent,
      maxProfitPercent: this.maxProfitPercent
    };
  }

  static setHouseMarginConfig(config: { enabled?: boolean; minProfitPercent?: number; maxProfitPercent?: number }) {
    if (config.enabled !== undefined) {
      this.houseMarginEnabled = Boolean(config.enabled);
    }
    if (config.minProfitPercent !== undefined) {
      const min = Math.max(0, Math.min(90, Number(config.minProfitPercent) || 0));
      this.minProfitPercent = min;
    }
    if (config.maxProfitPercent !== undefined) {
      const max = Math.max(this.minProfitPercent, Math.min(100, Number(config.maxProfitPercent) || 40));
      this.maxProfitPercent = max;
    }
    console.log(`[RISK & MARGIN] 🛡️ House Profit Target updated: ${this.houseMarginEnabled ? 'ACTIVE' : 'OFF'} [${this.minProfitPercent}% - ${this.maxProfitPercent}%]`);
    return this.getHouseMarginConfig();
  }

  /**
   * Secret Dynamic House Profit Outcome Optimizer:
   * Evaluates pool distribution across all 14 cards and selects the optimal winning card
   * that achieves a floating profit margin between minProfitPercent (20%) and maxProfitPercent (40%).
   * Not a fixed predictable profit, but dynamically variable within the range on every round.
   * Generates a matching cryptographic serverSeed ensuring provable fair consistency.
   */
  static calculateDynamicProfitOutcome(state: any): DynamicProfitResult {
    const bets = Array.from(state.bets.values()) as Array<{ chosenCard: number; amount: number }>;
    const totalPool = bets.reduce((sum, b) => sum + b.amount, 0);
    const multiplier = Number(state.multiplier) || 10;
    const cardsCount = Array.isArray(state.cards) && state.cards.length === 14 ? 14 : 14;

    // Pick a floating target profit percentage between min and max for this specific round
    // (e.g. between 20.0% and 40.0%, not a fixed predictable percentage)
    const span = Math.max(0, this.maxProfitPercent - this.minProfitPercent);
    const targetMargin = roundCurrency(this.minProfitPercent + Math.random() * span);

    let chosenCard = state.resultCard || 1;

    if (totalPool <= 0) {
      // No bets placed in this round; pick random card using provably fair seed
      chosenCard = Math.floor(Math.random() * cardsCount) + 1;
    } else {
      // Calculate house profit and margin for each card from 1 to cardsCount
      const cardEvaluations: Array<{
        card: number;
        betsOnCard: number;
        payout: number;
        houseProfit: number;
        marginPercent: number;
        diffFromTarget: number;
      }> = [];

      for (let c = 1; c <= cardsCount; c++) {
        const betsOnCard = bets.filter(b => b.chosenCard === c).reduce((sum, b) => sum + b.amount, 0);
        const payout = roundCurrency(betsOnCard * multiplier);
        const houseProfit = roundCurrency(totalPool - payout);
        const marginPercent = totalPool > 0 ? roundCurrency((houseProfit / totalPool) * 100) : 0;
        const diffFromTarget = Math.abs(marginPercent - targetMargin);

        cardEvaluations.push({
          card: c,
          betsOnCard,
          payout,
          houseProfit,
          marginPercent,
          diffFromTarget
        });
      }

      // Priority 1: Candidate cards that fall strictly in the target profit range [minProfitPercent, maxProfitPercent]
      const inRangeCandidates = cardEvaluations.filter(
        e => e.marginPercent >= this.minProfitPercent && e.marginPercent <= this.maxProfitPercent
      );

      if (inRangeCandidates.length > 0) {
        // Sort by closest to this round's randomly generated target margin
        inRangeCandidates.sort((a, b) => a.diffFromTarget - b.diffFromTarget);
        // If multiple cards are close, pick among top candidates to maintain natural variance
        const topBucket = inRangeCandidates.filter(c => Math.abs(c.diffFromTarget - inRangeCandidates[0].diffFromTarget) < 3.0);
        chosenCard = topBucket[Math.floor(Math.random() * topBucket.length)].card;
      } else {
        // Priority 2: If no card falls strictly inside [20%, 40%]:
        // Protect house against loss! Select candidate with positive profit closest to minProfitPercent
        const positiveCandidates = cardEvaluations.filter(e => e.houseProfit > 0);
        if (positiveCandidates.length > 0) {
          positiveCandidates.sort((a, b) => a.diffFromTarget - b.diffFromTarget);
          chosenCard = positiveCandidates[0].card;
        } else {
          // Fallback: Pick the card that minimizes payout (highest house return)
          cardEvaluations.sort((a, b) => b.houseProfit - a.houseProfit);
          chosenCard = cardEvaluations[0].card;
        }
      }
    }

    // Now find a matching serverSeed that deterministically yields chosenCard
    let matchingServerSeed = crypto.randomBytes(32).toString('hex');
    const clientSeed = state.clientSeed || state.currentRoundId;
    const nonce = state.nonce || state.roundNumber;

    for (let attempt = 0; attempt < 500; attempt++) {
      const candidateSeed = crypto.randomBytes(32).toString('hex');
      const calc = calculateProvablyFairCard(candidateSeed, clientSeed, nonce);
      if (calc.card === chosenCard) {
        matchingServerSeed = candidateSeed;
        break;
      }
    }

    const stakedOnWinner = bets.filter(b => b.chosenCard === chosenCard).reduce((sum, b) => sum + b.amount, 0);
    const totalPayout = roundCurrency(stakedOnWinner * multiplier);
    const houseProfit = roundCurrency(totalPool - totalPayout);
    const actualMargin = totalPool > 0 ? roundCurrency((houseProfit / totalPool) * 100) : 0;

    return {
      winningCard: chosenCard,
      targetMargin,
      actualMargin,
      totalPool,
      totalPayout,
      houseProfit,
      matchingServerSeed
    };
  }

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
    console.log(`[KILL SWITCH] PAYOUT REQUEST STATUS: ${this.arePayoutsHalted ? 'PAUSED' : 'OPEN FOR MANUAL DESK REVIEW'}`);
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

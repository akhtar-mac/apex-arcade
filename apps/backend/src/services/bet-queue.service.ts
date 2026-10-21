import { DB } from '../db.js';

export interface QueuedBet {
  id: string;
  userId: string;
  roundId: string;
  chosenCard: number;
  amount: number;
  isWin?: boolean | null;
  payout?: number | null;
  createdAt: Date;
}

export class BetQueueService {
  /**
   * Write settlement results onto bets that were committed with their wallet debit.
   */
  static async recordResults(bets: Array<{ id: string; isWin?: boolean | null; payout?: number | null }>) {
    const prisma = DB.getPrisma();
    await prisma.$transaction(
      bets
        .filter((bet) => bet.isWin !== undefined && bet.isWin !== null)
        .map((bet) => prisma.bet.update({
          where: { id: bet.id },
          data: {
            isWin: bet.isWin,
            payout: bet.payout ?? 0
          }
        }))
    );
  }
}

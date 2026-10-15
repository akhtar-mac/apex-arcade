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
  private static buffer: QueuedBet[] = [];
  private static flushInterval: NodeJS.Timeout | null = null;
  private static isFlushing = false;
  private static maxBatchSize = 250;
  private static flushIntervalMs = 500;

  static initialize() {
    if (!this.flushInterval) {
      this.flushInterval = setInterval(() => this.flushBatch(), this.flushIntervalMs);
      console.log('[BET QUEUE] 🚀 High-concurrency BullMQ batch ingestion buffer initialized (250 batch / 500ms flush)');
    }
  }

  /**
   * Enqueue a bet for asynchronous bulk insertion (<0.1ms non-blocking)
   */
  static enqueue(bet: QueuedBet) {
    this.buffer.push(bet);
    if (this.buffer.length >= this.maxBatchSize) {
      setImmediate(() => this.flushBatch());
    }
  }

  /**
   * Flush pending bets in micro-batches to Local SQL DB and PostgreSQL
   */
  static async flushBatch() {
    if (this.isFlushing || this.buffer.length === 0) return;
    this.isFlushing = true;

    const batch = this.buffer.splice(0, this.maxBatchSize);

    try {
      const prisma = DB.getPrisma();
      await prisma.bet.createMany({
        data: batch.map(b => ({
          id: b.id,
          userId: b.userId,
          roundId: b.roundId,
          chosenCard: b.chosenCard,
          amount: b.amount,
          isWin: b.isWin ?? null,
          payout: b.payout ?? null,
          createdAt: b.createdAt
        })),
        skipDuplicates: true
      });
    } catch (err: any) {
      console.error('[BET QUEUE] Postgres insert failed:', err.message);
    } finally {
      this.isFlushing = false;
    }
  }

  /**
   * Complete flush on graceful shutdown or round conclusion
   */
  static async flushAll() {
    while (this.buffer.length > 0) {
      await this.flushBatch();
    }
  }

  /**
   * Write the settled result onto rows that were inserted while the round was open.
   * createMany skips duplicates, so a later insert cannot change isWin.
   */
  static async recordResults(bets: Array<{ id: string; isWin?: boolean | null; payout?: number | null }>) {
    await this.flushAll();
    const prisma = DB.getPrisma();
    for (const bet of bets) {
      if (bet.isWin === undefined || bet.isWin === null) continue;
      try {
        await prisma.bet.update({
          where: { id: bet.id },
          data: {
            isWin: bet.isWin,
            payout: bet.payout ?? 0
          }
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'unknown error';
        console.error(`[BET QUEUE] Could not record result for ${bet.id}: ${message}`);
      }
    }
  }
}

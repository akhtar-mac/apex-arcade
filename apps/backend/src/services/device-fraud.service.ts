import { DB } from '../db.js';
import { RedisService } from './redis.service.js';

interface DeviceRecord {
  deviceId: string;
  firstRegisteredPhone: string;
  accountsCount: number;
  welcomeBonusClaimed: boolean;
  createdAt: Date;
}

interface BetAuditEntry {
  userId: string;
  ipAddress: string;
  deviceId?: string;
  roundId: string;
  chosenCard: number;
  amount: number;
}

export class DeviceFraudService {
  private static deviceRegistry = new Map<string, DeviceRecord>();
  private static recentBets = new Map<string, BetAuditEntry[]>(); // roundId -> bets

  /**
   * Evaluates if a device is eligible for the one-time welcome bonus (₹500)
   * Frictionless defense: Stops multi-accounting bonus farming without demanding user paperwork.
   */
  static async evaluateWelcomeBonusEligibility(deviceId: string, phoneNumber: string): Promise<{
    isEligible: boolean;
    bonusAmount: number;
    reason?: string;
  }> {
    if (!deviceId) {
      return { isEligible: true, bonusAmount: 500 };
    }

    // 1. Check Redis for device registration
    if (RedisService.isConnected()) {
      try {
        const redis = RedisService.getClient();
        const existingClaim = await redis.get(`device:${deviceId}:bonus_claimed`);
        if (existingClaim) {
          console.warn(`[ANTI-FRAUD] 🛡️ Device ${deviceId} already claimed welcome bonus on phone ${existingClaim}. Rejecting duplicate bonus.`);
          return {
            isEligible: false,
            bonusAmount: 0,
            reason: 'Welcome bonus already claimed on this device'
          };
        }
      } catch {}
    }

    // 2. In-memory check
    const record = this.deviceRegistry.get(deviceId);
    if (record && record.welcomeBonusClaimed) {
      console.warn(`[ANTI-FRAUD] 🛡️ Duplicate device bonus attempt: ${deviceId} (original: ${record.firstRegisteredPhone})`);
      return {
        isEligible: false,
        bonusAmount: 0,
        reason: 'Welcome bonus already claimed on this device'
      };
    }

    return { isEligible: true, bonusAmount: 500 };
  }

  /**
   * Registers device binding and marks welcome bonus as claimed
   */
  static async bindDeviceAndClaimBonus(deviceId: string, phoneNumber: string) {
    if (!deviceId) return;

    if (RedisService.isConnected()) {
      try {
        const redis = RedisService.getClient();
        await redis.set(`device:${deviceId}:bonus_claimed`, phoneNumber);
      } catch {}
    }

    const record = this.deviceRegistry.get(deviceId) || {
      deviceId,
      firstRegisteredPhone: phoneNumber,
      accountsCount: 0,
      welcomeBonusClaimed: true,
      createdAt: new Date()
    };

    record.accountsCount += 1;
    record.welcomeBonusClaimed = true;
    this.deviceRegistry.set(deviceId, record);
  }

  /**
   * Records bet placement for syndicate & hedge-betting audit
   */
  static recordBetForAudit(entry: BetAuditEntry) {
    let roundList = this.recentBets.get(entry.roundId);
    if (!roundList) {
      roundList = [];
      this.recentBets.set(entry.roundId, roundList);
    }
    roundList.push(entry);

    // Keep only last 10 rounds in memory
    if (this.recentBets.size > 10) {
      const oldestKey = this.recentBets.keys().next().value;
      if (oldestKey) this.recentBets.delete(oldestKey);
    }
  }

  /**
   * Detects if multiple accounts on the same IP or device are hedge-betting across cards
   */
  static detectSyndicateHedge(roundId: string): { flagged: boolean; details?: any } {
    const roundList = this.recentBets.get(roundId) || [];
    const ipGroups = new Map<string, Set<string>>(); // IP -> Set of UserIds

    for (const b of roundList) {
      if (!ipGroups.has(b.ipAddress)) {
        ipGroups.set(b.ipAddress, new Set());
      }
      ipGroups.get(b.ipAddress)!.add(b.userId);
    }

    for (const [ip, users] of ipGroups.entries()) {
      if (users.size >= 2) {
        console.warn(`[ANTI-FRAUD] ⚠️ Syndicate Alert: ${users.size} different accounts betting from same IP ${ip} in Round ${roundId}`);
        return {
          flagged: true,
          details: { ipAddress: ip, suspiciousUserCount: users.size, roundId }
        };
      }
    }

    return { flagged: false };
  }

  /**
   * Calculates automated risk score (0-100) without requesting user documents
   */
  static calculateUserRiskScore(userId: string): { riskScore: number; riskLevel: 'LOW' | 'MEDIUM' | 'HIGH'; flags: string[] } {
    let score = 0;
    const flags: string[] = [];

    // Analyze transaction velocity
    const userTxs = Array.from(DB.memory.transactions.values()).filter(t => t.userId === userId);
    const withdrawals = userTxs.filter(t => t.type === 'WITHDRAWAL');
    const deposits = userTxs.filter(t => t.type === 'DEPOSIT');

    const totalDeposited = deposits.reduce((s, t) => s + t.amount, 0);
    const totalWithdrawn = withdrawals.reduce((s, t) => s + t.amount, 0);

    // Flag: Rapid withdrawal without deposits
    if (withdrawals.length > 5 && totalDeposited < 500) {
      score += 35;
      flags.push('HIGH_WITHDRAWAL_LOW_DEPOSIT_RATIO');
    }

    // Flag: Multiple withdrawals within 10 minutes
    const now = Date.now();
    const recentWithdrawals = withdrawals.filter(w => now - w.createdAt.getTime() < 10 * 60 * 1000);
    if (recentWithdrawals.length >= 3) {
      score += 40;
      flags.push('RAPID_WITHDRAWAL_VELOCITY');
    }

    const riskLevel = score >= 60 ? 'HIGH' : score >= 30 ? 'MEDIUM' : 'LOW';
    return { riskScore: score, riskLevel, flags };
  }
}

import { Redis } from 'ioredis';
import { Config } from '../config.js';

let mainClient: Redis | null = null;
let pubClient: Redis | null = null;
let subClient: Redis | null = null;
let isRedisConnected = false;

// Lua scripts definition for atomic sub-millisecond wallet operations
const DEDUCT_LUA = `
local walletKey = KEYS[1]
local amount = tonumber(ARGV[1])
local now = ARGV[2]

local balanceStr = redis.call('HGET', walletKey, 'balance')
if not balanceStr then
  return { 0, "WALLET_NOT_FOUND", "0.00" }
end

local balance = tonumber(balanceStr)
if balance < amount then
  return { 0, "INSUFFICIENT_FUNDS", tostring(balance) }
end

local newBalance = math.floor((balance - amount + 0.0000001) * 100) / 100
redis.call('HSET', walletKey, 'balance', string.format("%.2f", newBalance), 'updatedAt', now)
return { 1, "SUCCESS", string.format("%.2f", newBalance) }
`;

const CREDIT_LUA = `
local walletKey = KEYS[1]
local amount = tonumber(ARGV[1])
local now = ARGV[2]

local balanceStr = redis.call('HGET', walletKey, 'balance')
local currentBalance = balanceStr and tonumber(balanceStr) or 0
local newBalance = math.floor((currentBalance + amount + 0.0000001) * 100) / 100

redis.call('HSET', walletKey, 'balance', string.format("%.2f", newBalance), 'updatedAt', now)
return { 1, "SUCCESS", string.format("%.2f", newBalance) }
`;

export class RedisService {
  static getClient(): Redis {
    if (!mainClient) {
      mainClient = new Redis(Config.redisUrl, {
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false,
        enableReadyCheck: false,
        connectTimeout: 500,
        lazyConnect: false,
        retryStrategy(times) {
          if (times > 1) return null;
          return 500;
        }
      });

      mainClient.on('connect', () => {
        isRedisConnected = true;
        console.log('[REDIS] ⚡ Connected to Redis Cluster / Server at:', Config.redisUrl.replace(/:[^:]*@/, ':****@'));
      });

      mainClient.on('ready', () => {
        isRedisConnected = true;
      });

      mainClient.on('close', () => {
        isRedisConnected = false;
      });

      mainClient.on('end', () => {
        isRedisConnected = false;
      });

      mainClient.on('error', (err) => {
        isRedisConnected = false;
      });
    }
    return mainClient;
  }

  static getPubSubClients(): { pubClient: Redis; subClient: Redis } {
    if (!pubClient || !subClient) {
      pubClient = new Redis(Config.redisUrl, {
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false,
        connectTimeout: 500,
        enableReadyCheck: false,
        lazyConnect: true,
        retryStrategy: () => null
      });
      subClient = pubClient.duplicate();

      pubClient.on('error', () => { isRedisConnected = false; });
      subClient.on('close', () => { isRedisConnected = false; });
      subClient.on('error', () => { isRedisConnected = false; });
      subClient.on('close', () => { isRedisConnected = false; });
    }
    return { pubClient, subClient };
  }

  static isConnected(): boolean {
    return isRedisConnected && (mainClient?.status === 'ready' || mainClient?.status === 'connect');
  }

  /**
   * Execute atomic wallet deduction Lua script
   */
  static async atomicDeduct(userId: string, amount: number): Promise<{ success: boolean; newBalance: number; error?: string }> {
    if (!isRedisConnected) {
      throw new Error('Redis offline - using in-memory atomic fallback');
    }
    try {
      const redis = this.getClient();
      const walletKey = `user:${userId}:wallet`;
      const res = await redis.eval(DEDUCT_LUA, 1, walletKey, amount.toString(), Date.now().toString()) as [number, string, string];
      
      const [status, code, balanceStr] = res;
      if (status === 1) {
        return { success: true, newBalance: parseFloat(balanceStr) };
      } else {
        return { success: false, newBalance: parseFloat(balanceStr || '0'), error: code };
      }
    } catch (err: any) {
      throw err;
    }
  }

  /**
   * Execute atomic wallet credit Lua script
   */
  static async atomicCredit(userId: string, amount: number): Promise<{ success: boolean; newBalance: number }> {
    if (!isRedisConnected) {
      throw new Error('Redis offline - using in-memory atomic fallback');
    }
    try {
      const redis = this.getClient();
      const walletKey = `user:${userId}:wallet`;
      const res = await redis.eval(CREDIT_LUA, 1, walletKey, amount.toString(), Date.now().toString()) as [number, string, string];
      
      const [status, , balanceStr] = res;
      return { success: status === 1, newBalance: parseFloat(balanceStr) };
    } catch (err: any) {
      throw err;
    }
  }

  /**
   * Sync/Hydrate wallet state into Redis Hash
   */
  static async setWalletBalance(userId: string, balance: number, locked: number = 0) {
    if (!isRedisConnected) return;
    try {
      const redis = this.getClient();
      const walletKey = `user:${userId}:wallet`;
      await redis.hset(walletKey, {
        balance: balance.toFixed(2),
        locked: locked.toFixed(2),
        updatedAt: Date.now().toString()
      });
    } catch (err: any) {
      // Redis offline
    }
  }

  /**
   * Read wallet balance from Redis
   */
  static async getWalletBalance(userId: string): Promise<{ balance: number; locked: number } | null> {
    if (!isRedisConnected) return null;
    try {
      const redis = this.getClient();
      const walletKey = `user:${userId}:wallet`;
      const data = await redis.hgetall(walletKey);
      if (!data || !data.balance) return null;
      return {
        balance: parseFloat(data.balance),
        locked: parseFloat(data.locked || '0')
      };
    } catch {
      return null;
    }
  }

  /**
   * Distributed Lock Helper for Single-Leader election (Redlock pattern)
   */
  static async acquireLock(lockKey: string, lockValue: string, ttlMs: number): Promise<boolean> {
    if (!this.isConnected()) return false;
    try {
      const redis = this.getClient();
      const res = await redis.set(lockKey, lockValue, 'PX', ttlMs, 'NX');
      return res === 'OK';
    } catch {
      return false;
    }
  }

  static async renewLock(lockKey: string, lockValue: string, ttlMs: number): Promise<boolean> {
    if (!this.isConnected()) return false;
    const LUA_RENEW = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("pexpire", KEYS[1], ARGV[2])
      else
        return 0
      end
    `;
    try {
      const redis = this.getClient();
      const res = await redis.eval(LUA_RENEW, 1, lockKey, lockValue, ttlMs.toString());
      return res === 1;
    } catch {
      return false;
    }
  }

  static async releaseLock(lockKey: string, lockValue: string): Promise<boolean> {
    if (!this.isConnected()) return false;
    const LUA_RELEASE = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;
    try {
      const redis = this.getClient();
      const res = await redis.eval(LUA_RELEASE, 1, lockKey, lockValue);
      return res === 1;
    } catch {
      return false;
    }
  }
}

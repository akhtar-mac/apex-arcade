import { Request, Response, NextFunction } from 'express';
import { RedisService } from '../services/redis.service.js';

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyPrefix: string;
  errorMessage?: string;
}

// In-memory sliding window fallback for local testing without active Redis
const memoryRateLimits = new Map<string, { count: number; resetAt: number }>();

export function createRateLimiter(config: RateLimitConfig) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Generate key based on IP or User ID or Phone Number
    const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const identifier = (req.body?.phoneNumber) || ((req as any).user?.userId) || ip;
    const key = `ratelimit:${config.keyPrefix}:${identifier}`;

    const now = Date.now();

    // 1. Try Redis Rate Limiting
    if (RedisService.isConnected()) {
      try {
        const redis = RedisService.getClient();
        const current = await redis.incr(key);
        if (current === 1) {
          await redis.pexpire(key, config.windowMs);
        }

        if (current > config.maxRequests) {
          const ttl = await redis.pttl(key);
          const waitSec = Math.ceil(ttl / 1000);
          return res.status(429).json({
            success: false,
            error: config.errorMessage || `Too many requests. Please wait ${waitSec} seconds before trying again.`,
            retryAfterSec: waitSec
          });
        }
        return next();
      } catch {
        // Fallback to in-memory on Redis error
      }
    }

    // 2. In-Memory Sliding Window Fallback
    let record = memoryRateLimits.get(key);
    if (!record || now > record.resetAt) {
      record = { count: 1, resetAt: now + config.windowMs };
      memoryRateLimits.set(key, record);
      return next();
    }

    record.count++;
    if (record.count > config.maxRequests) {
      const waitSec = Math.ceil((record.resetAt - now) / 1000);
      return res.status(429).json({
        success: false,
        error: config.errorMessage || `Too many requests. Please wait ${waitSec} seconds before trying again.`,
        retryAfterSec: waitSec
      });
    }

    return next();
  };
}

// Pre-configured rate limiters
export const otpRateLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000, // 5 minutes
  maxRequests: 3,          // Max 3 OTP requests / 5 mins
  keyPrefix: 'otp',
  errorMessage: 'OTP rate limit reached. Please wait 5 minutes before requesting a new verification code.'
});

export const authRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,     // 1 minute
  maxRequests: 10,         // Max 10 login attempts / min
  keyPrefix: 'auth',
  errorMessage: 'Too many authentication attempts. Please wait 1 minute.'
});

export const betRateLimiter = createRateLimiter({
  windowMs: 1000,          // 1 second
  maxRequests: 15,         // Max 15 bets / sec
  keyPrefix: 'bet',
  errorMessage: 'Betting speed limit exceeded. Maximum 15 bets per second.'
});

export const paymentRateLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000, // 5 minutes
  maxRequests: 10,         // Max 10 intents / 5 mins
  keyPrefix: 'payment',
  errorMessage: 'Payment request limit reached. Please complete your existing pending order.'
});

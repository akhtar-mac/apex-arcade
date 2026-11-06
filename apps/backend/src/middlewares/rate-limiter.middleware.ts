import { Request, Response, NextFunction } from 'express';
import { rateLimitMode } from '@arcade/shared-utils';
import { Config } from '../config.js';
import { RedisService } from '../services/redis.service.js';

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyPrefix: string;
  errorMessage?: string;
  failClosed?: boolean;
}

// Process-local fallback. It is not distributed protection and stays off unless a non-public process opts in.
const memoryRateLimits = new Map<string, { count: number; resetAt: number }>();
const memoryFallbackLogged = new Set<string>();
const memoryFallbackAllowed = !Config.isPublicDeployment && process.env.ALLOW_MEMORY_RATE_LIMIT === 'true';

export function createRateLimiter(config: RateLimitConfig) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const phone = String(req.body?.phoneNumber || '').replace(/\D/g, '').slice(-10);
    const userId = String((req as any).user?.userId || '');
    // Prefer granular identity (userId > phone > IP) for high-scale concurrency (5,000+ players)
    // Prevents cellular CGNAT / shared WiFi collisions while strictly enforcing per-player quotas
    const primaryId = userId ? `user:${userId}` : (phone ? `phone:${phone}` : `ip:${ip}`);
    const identifiers = [primaryId];
    const now = Date.now();
    const mode = rateLimitMode(RedisService.isConnected(), config.failClosed === true);

    if (mode === 'closed') {
      console.warn(JSON.stringify({ event: 'rate_limit_closed', prefix: config.keyPrefix, redis: false }));
      return res.status(503).json({ success: false, error: 'Sign-in protection is unavailable. Try again when the service recovers.' });
    }

    if (mode === 'redis') {
      try {
        const redis = RedisService.getClient();
        for (const identifier of identifiers) {
          const key = `ratelimit:${config.keyPrefix}:${identifier}`;
          const current = await redis.incr(key);
          if (current === 1) await redis.pexpire(key, config.windowMs);
          if (current > config.maxRequests) {
            const ttl = await redis.pttl(key);
            const waitSec = Math.max(1, Math.ceil(ttl / 1000));
            return res.status(429).json({
              success: false,
              error: config.errorMessage || `Too many requests. Please wait ${waitSec} seconds before trying again.`,
              retryAfterSec: waitSec
            });
          }
        }
        return next();
      } catch {
        if (config.failClosed) {
          console.warn(JSON.stringify({ event: 'rate_limit_closed', prefix: config.keyPrefix, redis: 'error' }));
          return res.status(503).json({ success: false, error: 'Sign-in protection is unavailable. Try again when the service recovers.' });
        }
      }
    }

    if (!memoryFallbackLogged.has(config.keyPrefix)) {
      memoryFallbackLogged.add(config.keyPrefix);
      console.warn(JSON.stringify({
        event: 'rate_limit_memory_fallback',
        prefix: config.keyPrefix,
        scope: 'process-local',
        note: 'Not distributed protection. Set Redis for shared limits.'
      }));
    }
    for (const identifier of identifiers) {
      const key = `ratelimit:${config.keyPrefix}:${identifier}`;
      let record = memoryRateLimits.get(key);
      if (!record || now > record.resetAt) {
        record = { count: 0, resetAt: now + config.windowMs };
      }
      record.count += 1;
      memoryRateLimits.set(key, record);
      if (record.count > config.maxRequests) {
        const waitSec = Math.max(1, Math.ceil((record.resetAt - now) / 1000));
        return res.status(429).json({
          success: false,
          error: config.errorMessage || `Too many requests. Please wait ${waitSec} seconds before trying again.`,
          retryAfterSec: waitSec
        });
      }
    }
    return next();
  };
}

// Pre-configured rate limiters
export const otpRateLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000, // 5 minutes
  maxRequests: 3,          // Max 3 OTP requests / 5 mins
  keyPrefix: 'otp',
  failClosed: !memoryFallbackAllowed,
  errorMessage: 'OTP rate limit reached. Please wait 5 minutes before requesting a new verification code.'
});

export const authRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,     // 1 minute
  maxRequests: 10,         // Max 10 login attempts / min
  keyPrefix: 'auth',
  failClosed: !memoryFallbackAllowed,
  errorMessage: 'Too many authentication attempts. Please wait 1 minute.'
});

export const betRateLimiter = createRateLimiter({
  windowMs: 1000,          // 1 second
  maxRequests: 15,         // Max 15 bets / sec
  keyPrefix: 'bet',
  failClosed: !memoryFallbackAllowed,
  errorMessage: 'Betting speed limit exceeded. Maximum 15 bets per second.'
});

export const paymentRateLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000, // 5 minutes
  maxRequests: 10,         // Max 10 intents / 5 mins
  keyPrefix: 'payment',
  failClosed: !memoryFallbackAllowed,
  errorMessage: 'Payment request limit reached. Please complete your existing pending order.'
});

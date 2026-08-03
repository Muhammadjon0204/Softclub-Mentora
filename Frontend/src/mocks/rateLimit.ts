import { db } from './db';

/**
 * Route rate limiting «по IP».
 *
 * В браузерном моке клиент один, поэтому счётчик общий на ключ маршрута.
 * Это отдельный от account lockout механизм: lockout защищает конкретную
 * учётную запись и отвечает 401, rate limit защищает маршрут и отвечает 429.
 */

export interface RateLimitRule {
  limit: number;
  windowMs: number;
}

const HOUR = 60 * 60 * 1000;
const MINUTE = 60 * 1000;

export const RATE_LIMIT_RULES = {
  login: { limit: 10, windowMs: MINUTE },
  forgotPassword: { limit: 5, windowMs: HOUR },
  resetPassword: { limit: 10, windowMs: HOUR },
  setPassword: { limit: 10, windowMs: HOUR },
} as const satisfies Record<string, RateLimitRule>;

export interface RateLimitResult {
  allowed: boolean;
  /** Сколько секунд ждать. Осмысленно только при `allowed === false`. */
  retryAfterSec: number;
}

export function consumeRateLimit(key: string, rule: RateLimitRule): RateLimitResult {
  const now = Date.now();
  const bucket = db.rateLimitBuckets[key];

  if (bucket === undefined || now - bucket.windowStartedAt >= rule.windowMs) {
    db.rateLimitBuckets[key] = { windowStartedAt: now, count: 1 };
    return { allowed: true, retryAfterSec: 0 };
  }

  if (bucket.count >= rule.limit) {
    const retryAfterSec = Math.max(
      1,
      Math.ceil((bucket.windowStartedAt + rule.windowMs - now) / 1000),
    );
    return { allowed: false, retryAfterSec };
  }

  bucket.count += 1;
  return { allowed: true, retryAfterSec: 0 };
}

export function clearRateLimits(): void {
  db.rateLimitBuckets = {};
}

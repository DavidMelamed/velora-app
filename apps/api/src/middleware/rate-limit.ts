import type { RequestHandler } from 'express'
import { rateLimit } from 'express-rate-limit'
import { RedisStore } from 'rate-limit-redis'
import { getRedis } from '../lib/redis'

/**
 * Create a rate limiter with optional Redis backing store.
 * Falls back to in-memory store if Redis is unavailable.
 */
function createLimiter(windowMs: number, max: number, message: string): RequestHandler {
  const redis = getRedis()
  const store = redis
    ? new RedisStore({
        sendCommand: (...args: string[]) => redis.call(...(args as [string, ...string[]])) as Promise<any>,
      })
    : undefined

  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: message },
    store,
  }) as unknown as RequestHandler
}

/** Auth endpoints: 5 requests per minute */
export const authLimiter = createLimiter(60_000, 5, 'Too many auth attempts, please try again later')

/** Write endpoints: 30 requests per minute */
export const writeLimiter = createLimiter(60_000, 30, 'Too many write requests, please try again later')

/** Read endpoints: 600 requests per minute */
export const readLimiter = createLimiter(60_000, 600, 'Too many requests, please try again later')

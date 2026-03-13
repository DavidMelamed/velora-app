/**
 * Redis-backed cache middleware for API responses.
 * Falls back gracefully if Redis is unavailable.
 *
 * Features:
 *   - Configurable TTL (default 5 minutes for reads)
 *   - stale-while-revalidate headers
 *   - Cache key derived from URL + query params
 *   - Bypass via Cache-Control: no-cache header
 */

import type { Request, Response, NextFunction } from 'express'
import { getRedis } from '../lib/redis'

export interface CacheOptions {
  /** TTL in seconds (default 300 = 5 minutes) */
  ttl?: number
  /** stale-while-revalidate window in seconds (default 60) */
  swr?: number
  /** Custom key generator. Defaults to req.originalUrl. */
  keyFn?: (req: Request) => string
}

/**
 * Generate a cache key from the request.
 */
function defaultKeyFn(req: Request): string {
  return `velora:cache:${req.originalUrl}`
}

/**
 * Cache middleware factory.
 * Caches JSON responses in Redis with TTL.
 * Adds Cache-Control and stale-while-revalidate headers.
 */
export function cacheMiddleware(options: CacheOptions = {}) {
  const { ttl = 300, swr = 60, keyFn = defaultKeyFn } = options

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      next()
      return
    }

    // Allow cache bypass
    if (req.headers['cache-control'] === 'no-cache') {
      next()
      return
    }

    const redis = getRedis()
    if (!redis) {
      // No Redis — just set cache headers and pass through
      res.set('Cache-Control', `public, max-age=${ttl}, stale-while-revalidate=${swr}`)
      next()
      return
    }

    const cacheKey = keyFn(req)

    try {
      const cached = await redis.get(cacheKey)
      if (cached) {
        const parsed = JSON.parse(cached) as { body: unknown; statusCode: number }
        res.set('Cache-Control', `public, max-age=${ttl}, stale-while-revalidate=${swr}`)
        res.set('X-Cache', 'HIT')
        res.status(parsed.statusCode).json(parsed.body)
        return
      }
    } catch {
      // Redis error — fall through to handler
    }

    // Intercept res.json to cache the response
    const originalJson = res.json.bind(res)
    res.json = function cacheJson(body: unknown): Response {
      // Cache in background — don't block response
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const toCache = JSON.stringify({ body, statusCode: res.statusCode })
        redis.setex(cacheKey, ttl, toCache).catch(() => {
          // Silently ignore cache write errors
        })
      }

      res.set('Cache-Control', `public, max-age=${ttl}, stale-while-revalidate=${swr}`)
      res.set('X-Cache', 'MISS')
      return originalJson(body)
    }

    next()
  }
}

/**
 * Invalidate a cache key or pattern.
 */
export async function invalidateCache(pattern: string): Promise<number> {
  const redis = getRedis()
  if (!redis) return 0

  try {
    const keys = await redis.keys(`velora:cache:${pattern}`)
    if (keys.length === 0) return 0
    return await redis.del(...keys)
  } catch {
    return 0
  }
}

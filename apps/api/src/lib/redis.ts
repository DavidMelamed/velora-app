import Redis from 'ioredis'

let redis: Redis | null = null

/**
 * Get Redis client singleton.
 * Returns null if REDIS_URL is not set (graceful fallback).
 */
export function getRedis(): Redis | null {
  if (!process.env.REDIS_URL) {
    return null
  }

  if (!redis) {
    redis = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times: number) => {
        if (times > 3) return null // stop retrying
        return Math.min(times * 200, 2000)
      },
      lazyConnect: true,
    })

    redis.on('error', (err) => {
      console.error('[Redis] Connection error:', err.message)
    })

    redis.on('connect', () => {
      console.log('[Redis] Connected')
    })
  }

  return redis
}

/**
 * Disconnect Redis client (for graceful shutdown).
 */
export async function disconnectRedis(): Promise<void> {
  if (redis) {
    await redis.quit()
    redis = null
  }
}

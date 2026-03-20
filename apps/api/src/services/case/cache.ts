/**
 * Case Data Cache
 * Redis-backed caching for frequently accessed case data.
 * Falls back to no-op when Redis is unavailable.
 */

let redis: import('ioredis').default | null = null

async function getRedis() {
  if (redis) return redis
  try {
    const Redis = (await import('ioredis')).default
    const url = process.env.REDIS_URL
    if (!url) return null
    redis = new Redis(url, { maxRetriesPerRequest: 1, lazyConnect: true })
    await redis.connect()
    return redis
  } catch {
    return null
  }
}

const CACHE_TTL = 300 // 5 minutes

/**
 * Get cached value or compute it.
 */
export async function cached<T>(
  key: string,
  compute: () => Promise<T>,
  ttl: number = CACHE_TTL
): Promise<T> {
  const client = await getRedis()

  if (client) {
    try {
      const raw = await client.get(key)
      if (raw) return JSON.parse(raw) as T
    } catch {
      // Cache miss or parse error — compute fresh
    }
  }

  const value = await compute()

  if (client) {
    try {
      await client.setex(key, ttl, JSON.stringify(value))
    } catch {
      // Cache write failed — non-critical
    }
  }

  return value
}

/**
 * Invalidate cache for a matter (call after writes).
 */
export async function invalidateMatterCache(matterId: string): Promise<void> {
  const client = await getRedis()
  if (!client) return

  try {
    const keys = await client.keys(`case:${matterId}:*`)
    if (keys.length > 0) {
      await client.del(...keys)
    }
  } catch {
    // Non-critical
  }
}

/**
 * Cache key builders
 */
export const cacheKeys = {
  matter: (id: string) => `case:${id}:matter`,
  timeline: (id: string) => `case:${id}:timeline`,
  entities: (id: string) => `case:${id}:entities`,
  facts: (id: string) => `case:${id}:facts`,
  confirmations: (id: string) => `case:${id}:confirmations`,
}

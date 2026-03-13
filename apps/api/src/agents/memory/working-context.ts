import { getRedis } from '../../lib/redis'

/**
 * Working Context — Short-term in-memory or Redis-backed memory for current agent tasks.
 * TTL: 1 hour. Used to track active agent tasks, intermediate results, and conversation state.
 */

const DEFAULT_TTL_SECONDS = 3600 // 1 hour

// In-memory fallback when Redis is unavailable
const memoryStore = new Map<string, { value: string; expiresAt: number }>()

function cleanExpired() {
  const now = Date.now()
  for (const [key, entry] of memoryStore) {
    if (entry.expiresAt < now) {
      memoryStore.delete(key)
    }
  }
}

function makeKey(agentId: string, contextKey: string): string {
  return `velora:agent:ctx:${agentId}:${contextKey}`
}

/**
 * Set a working context value for an agent.
 */
export async function setWorkingContext(
  agentId: string,
  key: string,
  value: unknown,
  ttlSeconds: number = DEFAULT_TTL_SECONDS
): Promise<void> {
  const fullKey = makeKey(agentId, key)
  const serialized = JSON.stringify(value)
  const redis = getRedis()

  if (redis) {
    await redis.setex(fullKey, ttlSeconds, serialized)
  } else {
    memoryStore.set(fullKey, {
      value: serialized,
      expiresAt: Date.now() + ttlSeconds * 1000,
    })
  }
}

/**
 * Get a working context value for an agent.
 */
export async function getWorkingContext<T = unknown>(agentId: string, key: string): Promise<T | null> {
  const fullKey = makeKey(agentId, key)
  const redis = getRedis()

  if (redis) {
    const value = await redis.get(fullKey)
    return value ? (JSON.parse(value) as T) : null
  }

  cleanExpired()
  const entry = memoryStore.get(fullKey)
  if (!entry || entry.expiresAt < Date.now()) {
    memoryStore.delete(fullKey)
    return null
  }
  return JSON.parse(entry.value) as T
}

/**
 * Delete a working context value.
 */
export async function deleteWorkingContext(agentId: string, key: string): Promise<void> {
  const fullKey = makeKey(agentId, key)
  const redis = getRedis()

  if (redis) {
    await redis.del(fullKey)
  } else {
    memoryStore.delete(fullKey)
  }
}

/**
 * Get all working context keys for an agent.
 */
export async function listWorkingContextKeys(agentId: string): Promise<string[]> {
  const prefix = makeKey(agentId, '')
  const redis = getRedis()

  if (redis) {
    const keys = await redis.keys(`${prefix}*`)
    return keys.map((k) => k.slice(prefix.length))
  }

  cleanExpired()
  return Array.from(memoryStore.keys())
    .filter((k) => k.startsWith(prefix))
    .map((k) => k.slice(prefix.length))
}

/**
 * Clear all working context for an agent.
 */
export async function clearWorkingContext(agentId: string): Promise<number> {
  const prefix = makeKey(agentId, '')
  const redis = getRedis()

  if (redis) {
    const keys = await redis.keys(`${prefix}*`)
    if (keys.length > 0) {
      await redis.del(...keys)
    }
    return keys.length
  }

  let count = 0
  for (const key of memoryStore.keys()) {
    if (key.startsWith(prefix)) {
      memoryStore.delete(key)
      count++
    }
  }
  return count
}

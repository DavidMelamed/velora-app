import { describe, it, expect, vi } from 'vitest'

// Mock the embedding generation (no real API call in tests)
vi.mock('../services/embedding-service', async () => {
  const actual = await vi.importActual('../services/embedding-service')
  return {
    ...actual,
    generateEmbedding: vi.fn().mockResolvedValue(new Array(1536).fill(0.1)),
  }
})

describe('embedding-service', () => {
  it('should export required functions', async () => {
    const mod = await import('../services/embedding-service')
    expect(mod.generateEmbedding).toBeDefined()
    expect(mod.storeCrashEmbedding).toBeDefined()
    expect(mod.findSimilarCrashes).toBeDefined()
    expect(mod.semanticSearchCrashes).toBeDefined()
  })
})

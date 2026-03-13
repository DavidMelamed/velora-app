import { describe, it, expect } from 'vitest'

describe('graph-service', () => {
  it('should export required functions', async () => {
    const mod = await import('../services/graph-service')
    expect(mod.isGraphAvailable).toBeDefined()
    expect(mod.cypher).toBeDefined()
    expect(mod.createCrashNode).toBeDefined()
    expect(mod.createIntersectionNode).toBeDefined()
    expect(mod.createOccurredAtEdge).toBeDefined()
    expect(mod.findCrashesAtIntersection).toBeDefined()
    expect(mod.findDangerousIntersections).toBeDefined()
  })
})

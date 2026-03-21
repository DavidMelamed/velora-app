import { describe, it, expect } from 'vitest'
import { getOrAssignVariant, type ExperimentVariant } from '../services/ab-testing'

const testVariants: ExperimentVariant[] = [
  { id: 'var_a', name: 'Control', weight: 0.5 },
  { id: 'var_b', name: 'Variant B', weight: 0.5 },
]

const threeVariants: ExperimentVariant[] = [
  { id: 'var_a', name: 'Control', weight: 0.34 },
  { id: 'var_b', name: 'Variant B', weight: 0.33 },
  { id: 'var_c', name: 'Variant C', weight: 0.33 },
]

describe('A/B Testing', () => {
  describe('getOrAssignVariant', () => {
    it('returns deterministic results for same experiment+session', () => {
      const result1 = getOrAssignVariant('exp-1', 'session-abc', testVariants)
      const result2 = getOrAssignVariant('exp-1', 'session-abc', testVariants)
      expect(result1.id).toBe(result2.id)
      expect(result1.name).toBe(result2.name)
    })

    it('returns different results for different sessions', () => {
      // With enough sessions, we should get both variants
      const assignments = new Set<string>()
      for (let i = 0; i < 100; i++) {
        const result = getOrAssignVariant('exp-1', `session-${i}`, testVariants)
        assignments.add(result.id)
      }
      // With 50/50 split and 100 sessions, we should see both variants
      expect(assignments.size).toBe(2)
    })

    it('distributes roughly according to weights', () => {
      const counts: Record<string, number> = { var_a: 0, var_b: 0 }
      const total = 1000

      for (let i = 0; i < total; i++) {
        const result = getOrAssignVariant('exp-dist', `sess-${i}`, testVariants)
        counts[result.id]!++
      }

      // With 50/50 weights, each should be ~500 (+/- 100 for hash distribution)
      expect(counts.var_a).toBeGreaterThan(200)
      expect(counts.var_b).toBeGreaterThan(200)
    })

    it('handles three variants', () => {
      const counts: Record<string, number> = { var_a: 0, var_b: 0, var_c: 0 }
      const total = 1000

      for (let i = 0; i < total; i++) {
        const result = getOrAssignVariant('exp-three', `sess-${i}`, threeVariants)
        counts[result.id]!++
      }

      // Each should get some assignments
      expect(counts.var_a).toBeGreaterThan(100)
      expect(counts.var_b).toBeGreaterThan(100)
      expect(counts.var_c).toBeGreaterThan(100)
    })

    it('throws on empty variants', () => {
      expect(() => getOrAssignVariant('exp-1', 'session-1', [])).toThrow(
        'Experiment has no variants',
      )
    })

    it('is stable across different experiment IDs', () => {
      const resultA = getOrAssignVariant('exp-A', 'same-session', testVariants)
      const resultB = getOrAssignVariant('exp-B', 'same-session', testVariants)
      // Different experiments may yield different variants for the same session
      // This is expected — just verifying stability within each experiment
      const resultA2 = getOrAssignVariant('exp-A', 'same-session', testVariants)
      expect(resultA.id).toBe(resultA2.id)
      // We can't assert resultA !== resultB since hash may collide, but we verify A is stable
      expect(resultB).toBeDefined()
    })
  })
})

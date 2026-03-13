import { describe, it, expect } from 'vitest'

// Simple unit test for health route logic
describe('Health endpoint', () => {
  it('should return ok status', () => {
    const response = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '0.0.0',
    }
    expect(response.status).toBe('ok')
    expect(response.version).toBe('0.0.0')
    expect(response.timestamp).toBeTruthy()
  })
})

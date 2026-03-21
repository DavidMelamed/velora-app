import { logAgentAction } from '../../agents/memory/session-records'

/**
 * Circuit Breaker — Tracks consecutive failures per check.
 * Stops dispatching after threshold consecutive failures.
 * Resets on success. Sends alert on circuit break.
 */

const CIRCUIT_BREAKER_THRESHOLD = 5

interface CircuitState {
  consecutiveFailures: number
  isOpen: boolean
  lastFailureAt: number | null
  openedAt: number | null
}

// In-memory circuit state per check
const circuitStates = new Map<string, CircuitState>()

function getState(checkName: string): CircuitState {
  let state = circuitStates.get(checkName)
  if (!state) {
    state = {
      consecutiveFailures: 0,
      isOpen: false,
      lastFailureAt: null,
      openedAt: null,
    }
    circuitStates.set(checkName, state)
  }
  return state
}

/**
 * Record a failure for a check. If threshold exceeded, opens the circuit.
 * Returns true if the circuit just opened (meaning we should send an alert).
 */
export async function recordFailure(checkName: string): Promise<boolean> {
  const state = getState(checkName)
  state.consecutiveFailures++
  state.lastFailureAt = Date.now()

  if (state.consecutiveFailures >= CIRCUIT_BREAKER_THRESHOLD && !state.isOpen) {
    state.isOpen = true
    state.openedAt = Date.now()

    // Log circuit break event
    await logAgentAction({
      agentId: 'healer',
      action: 'circuit_break',
      input: {
        checkName,
        consecutiveFailures: state.consecutiveFailures,
        threshold: CIRCUIT_BREAKER_THRESHOLD,
      },
      status: 'FAILED',
      error: `Circuit breaker opened for "${checkName}" after ${state.consecutiveFailures} consecutive failures`,
    })

    return true // Just opened
  }

  return false
}

/**
 * Record a success for a check. Resets the consecutive failure count
 * and closes the circuit if it was open.
 */
export async function recordSuccess(checkName: string): Promise<boolean> {
  const state = getState(checkName)
  const wasOpen = state.isOpen

  state.consecutiveFailures = 0
  state.isOpen = false
  state.openedAt = null

  if (wasOpen) {
    await logAgentAction({
      agentId: 'healer',
      action: 'circuit_recover',
      input: { checkName },
      status: 'SUCCESS',
    })
  }

  return wasOpen // true if circuit was open and just recovered
}

/**
 * Check if a circuit is open (should not dispatch).
 */
export function isCircuitOpen(checkName: string): boolean {
  return getState(checkName).isOpen
}

/**
 * Get the current state of all circuits.
 */
export function getAllCircuitStates(): Record<string, CircuitState> {
  const result: Record<string, CircuitState> = {}
  for (const [name, state] of circuitStates) {
    result[name] = { ...state }
  }
  return result
}

/**
 * Reset a specific circuit (manual recovery).
 */
export function resetCircuit(checkName: string): void {
  circuitStates.set(checkName, {
    consecutiveFailures: 0,
    isOpen: false,
    lastFailureAt: null,
    openedAt: null,
  })
}

/**
 * Get the circuit breaker threshold.
 */
export function getThreshold(): number {
  return CIRCUIT_BREAKER_THRESHOLD
}

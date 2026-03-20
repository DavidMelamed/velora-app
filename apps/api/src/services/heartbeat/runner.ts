import { heartbeatChecks, type HeartbeatCheckResult } from './checklist'
import { isCircuitOpen, recordFailure, recordSuccess, getAllCircuitStates } from './circuit-breaker'
import { logAgentAction } from '../../agents/memory/session-records'
import { expireStaleConfirmations } from '../case/confirmation'
import { runCheckins } from '../case/shepherd-checkin'

/**
 * Heartbeat Runner — Executes all health checks, dispatches to agents
 * on failure, tracks results in AgentSession table.
 */

export interface HeartbeatRunResult {
  timestamp: string
  totalChecks: number
  passed: number
  failed: number
  skipped: number
  results: HeartbeatCheckResult[]
  dispatched: Array<{ checkName: string; agentId: string }>
  circuitBreaks: string[]
  durationMs: number
}

/**
 * Run all heartbeat checks and dispatch failing checks to appropriate agents.
 */
export async function runHeartbeat(options: { dryRun?: boolean } = {}): Promise<HeartbeatRunResult> {
  const startTime = Date.now()
  const results: HeartbeatCheckResult[] = []
  const dispatched: Array<{ checkName: string; agentId: string }> = []
  const circuitBreaks: string[] = []
  let skipped = 0

  for (const check of heartbeatChecks) {
    // Skip if circuit is open
    if (isCircuitOpen(check.name)) {
      skipped++
      results.push({
        name: check.name,
        passed: false,
        value: 'CIRCUIT_OPEN',
        threshold: null,
        message: `Skipped: circuit breaker is open for ${check.name}`,
        severity: 'critical',
      })
      continue
    }

    try {
      const result = await check.check()
      results.push(result)

      if (result.passed) {
        // Record success (may close circuit)
        const recovered = await recordSuccess(check.name)
        if (recovered) {
          circuitBreaks.push(`${check.name}: RECOVERED`)
        }
      } else {
        // Record failure (may open circuit)
        const justOpened = await recordFailure(check.name)
        if (justOpened) {
          circuitBreaks.push(`${check.name}: CIRCUIT OPENED`)
        }

        // Dispatch to agent (unless dry run or circuit just opened)
        if (!options.dryRun && !justOpened) {
          dispatched.push({
            checkName: check.name,
            agentId: check.dispatchTo,
          })

          // Log the dispatch
          await logAgentAction({
            agentId: check.dispatchTo,
            action: `heartbeat_dispatch_${check.name}`,
            input: {
              checkName: check.name,
              checkResult: result,
            },
            status: 'IN_PROGRESS',
          })
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      results.push({
        name: check.name,
        passed: false,
        value: null,
        threshold: null,
        message: `Check error: ${errorMessage}`,
        severity: 'critical',
      })

      await recordFailure(check.name)
    }
  }

  const durationMs = Date.now() - startTime
  const passed = results.filter((r) => r.passed).length
  const failed = results.filter((r) => !r.passed).length - skipped

  // Run case memory maintenance tasks
  try {
    const expired = await expireStaleConfirmations()
    if (expired > 0) console.log(`[Heartbeat] Expired ${expired} stale confirmations`)
  } catch (err) {
    console.warn('[Heartbeat] Confirmation expiry failed:', err instanceof Error ? err.message : err)
  }

  try {
    const checkins = await runCheckins()
    if (checkins.triggered > 0) console.log(`[Heartbeat] Sent ${checkins.triggered} check-ins (${checkins.checked} matters checked)`)
  } catch (err) {
    console.warn('[Heartbeat] Check-in run failed:', err instanceof Error ? err.message : err)
  }

  // Log the overall heartbeat run
  await logAgentAction({
    agentId: 'coordinator',
    action: 'heartbeat_run',
    input: { dryRun: options.dryRun ?? false },
    output: {
      totalChecks: heartbeatChecks.length,
      passed,
      failed,
      skipped,
      dispatched: dispatched.length,
      circuitBreaks,
    },
    status: failed > 0 ? 'FAILED' : 'SUCCESS',
    durationMs,
  })

  return {
    timestamp: new Date().toISOString(),
    totalChecks: heartbeatChecks.length,
    passed,
    failed,
    skipped,
    results,
    dispatched,
    circuitBreaks,
    durationMs,
  }
}

/**
 * Get a summary of the heartbeat system state.
 */
export function getHeartbeatStatus() {
  return {
    checks: heartbeatChecks.map((c) => ({
      name: c.name,
      description: c.description,
      dispatchTo: c.dispatchTo,
      circuitOpen: isCircuitOpen(c.name),
    })),
    circuitStates: getAllCircuitStates(),
  }
}

// ─── Scheduled Heartbeat ────────────────────────────────────────────────────────

const HEARTBEAT_INTERVAL_MS = 30 * 60 * 1000 // 30 minutes
let heartbeatTimer: ReturnType<typeof setInterval> | null = null

/**
 * Start the heartbeat loop. Runs every 30 minutes.
 */
export function startHeartbeatLoop(): void {
  if (heartbeatTimer) {
    console.log('[Heartbeat] Loop already running')
    return
  }

  console.log(`[Heartbeat] Starting loop (every ${HEARTBEAT_INTERVAL_MS / 60000} minutes)`)

  // Run immediately on start
  runHeartbeat().then((result) => {
    console.log(
      `[Heartbeat] Initial run: ${result.passed}/${result.totalChecks} passed, ` +
        `${result.failed} failed, ${result.skipped} skipped (${result.durationMs}ms)`
    )
  }).catch((error) => {
    console.error('[Heartbeat] Initial run failed:', error)
  })

  // Schedule recurring
  heartbeatTimer = setInterval(async () => {
    try {
      const result = await runHeartbeat()
      console.log(
        `[Heartbeat] Run: ${result.passed}/${result.totalChecks} passed, ` +
          `${result.failed} failed, ${result.skipped} skipped (${result.durationMs}ms)`
      )
    } catch (error) {
      console.error('[Heartbeat] Scheduled run failed:', error)
    }
  }, HEARTBEAT_INTERVAL_MS)
}

/**
 * Stop the heartbeat loop.
 */
export function stopHeartbeatLoop(): void {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer)
    heartbeatTimer = null
    console.log('[Heartbeat] Loop stopped')
  }
}

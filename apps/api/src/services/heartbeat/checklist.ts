import { prisma } from '@velora/db'
import type { AgentId } from '../../agents/mastra-config'

/**
 * Heartbeat Checklist — Defines health checks for the system.
 * Each check returns a pass/fail status with details.
 */

export interface HeartbeatCheck {
  name: string
  description: string
  dispatchTo: AgentId
  check: () => Promise<HeartbeatCheckResult>
}

export interface HeartbeatCheckResult {
  name: string
  passed: boolean
  value: unknown
  threshold: unknown
  message: string
  severity: 'info' | 'warning' | 'critical'
}

// ─── Check Implementations ─────────────────────────────────────────────────────

async function checkPipelineHealth(): Promise<HeartbeatCheckResult> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const failedRuns = await prisma.pipelineRun.count({
    where: { status: 'FAILED', startedAt: { gte: since } },
  })

  return {
    name: 'pipeline_health',
    passed: failedRuns === 0,
    value: failedRuns,
    threshold: 0,
    message: failedRuns === 0
      ? 'No failed pipeline runs in last 24h'
      : `${failedRuns} failed pipeline run(s) in last 24h`,
    severity: failedRuns > 3 ? 'critical' : failedRuns > 0 ? 'warning' : 'info',
  }
}

async function checkDataFreshness(): Promise<HeartbeatCheckResult> {
  const latestCrash = await prisma.crash.findFirst({
    orderBy: { crashDate: 'desc' },
    select: { crashDate: true },
  })

  if (!latestCrash) {
    return {
      name: 'data_freshness',
      passed: false,
      value: null,
      threshold: '7 days',
      message: 'No crash data found',
      severity: 'critical',
    }
  }

  const daysSinceLatest = (Date.now() - latestCrash.crashDate.getTime()) / (1000 * 60 * 60 * 24)
  const threshold = 7

  return {
    name: 'data_freshness',
    passed: daysSinceLatest <= threshold,
    value: `${daysSinceLatest.toFixed(1)} days`,
    threshold: `${threshold} days`,
    message: daysSinceLatest <= threshold
      ? `Latest crash data is ${daysSinceLatest.toFixed(1)} days old`
      : `Stale data: latest crash is ${daysSinceLatest.toFixed(1)} days old (threshold: ${threshold}d)`,
    severity: daysSinceLatest > 14 ? 'critical' : daysSinceLatest > threshold ? 'warning' : 'info',
  }
}

async function checkNarrativeCoverage(): Promise<HeartbeatCheckResult> {
  const totalCrashes = await prisma.crash.count()
  const withNarratives = await prisma.crashNarrative.count()
  const coverage = totalCrashes > 0 ? withNarratives / totalCrashes : 0
  const threshold = 0.5 // 50%

  return {
    name: 'narrative_coverage',
    passed: coverage >= threshold,
    value: `${(coverage * 100).toFixed(1)}%`,
    threshold: `${(threshold * 100).toFixed(0)}%`,
    message: coverage >= threshold
      ? `Narrative coverage: ${(coverage * 100).toFixed(1)}% (${withNarratives}/${totalCrashes})`
      : `Low narrative coverage: ${(coverage * 100).toFixed(1)}% (${withNarratives}/${totalCrashes})`,
    severity: coverage < 0.25 ? 'critical' : coverage < threshold ? 'warning' : 'info',
  }
}

async function checkEqualizerCoverage(): Promise<HeartbeatCheckResult> {
  const totalCrashes = await prisma.crash.count()
  const withEqualizers = await prisma.crashEqualizer.count()
  const coverage = totalCrashes > 0 ? withEqualizers / totalCrashes : 0
  const threshold = 0.3 // 30%

  return {
    name: 'equalizer_coverage',
    passed: coverage >= threshold,
    value: `${(coverage * 100).toFixed(1)}%`,
    threshold: `${(threshold * 100).toFixed(0)}%`,
    message: coverage >= threshold
      ? `Equalizer coverage: ${(coverage * 100).toFixed(1)}% (${withEqualizers}/${totalCrashes})`
      : `Low equalizer coverage: ${(coverage * 100).toFixed(1)}% (${withEqualizers}/${totalCrashes})`,
    severity: coverage < 0.1 ? 'warning' : 'info',
  }
}

async function checkDeadLetterQueue(): Promise<HeartbeatCheckResult> {
  const unresolvedCount = await prisma.pipelineDeadLetter.count({
    where: { resolvedAt: null },
  })
  const threshold = 100

  return {
    name: 'dead_letter_queue',
    passed: unresolvedCount <= threshold,
    value: unresolvedCount,
    threshold,
    message: unresolvedCount <= threshold
      ? `Dead letter queue: ${unresolvedCount} unresolved`
      : `Dead letter queue overflow: ${unresolvedCount} unresolved (threshold: ${threshold})`,
    severity: unresolvedCount > 500 ? 'critical' : unresolvedCount > threshold ? 'warning' : 'info',
  }
}

async function checkApiHealth(): Promise<HeartbeatCheckResult> {
  // Check if there are recent agent sessions (proxy for API activity)
  const since = new Date(Date.now() - 60 * 60 * 1000) // 1 hour
  const recentSessions = await prisma.agentSession.count({
    where: { createdAt: { gte: since } },
  })

  return {
    name: 'api_health',
    passed: true, // API is responding if we got here
    value: { recentAgentSessions: recentSessions },
    threshold: 'responsive',
    message: `API responding. ${recentSessions} agent session(s) in last hour.`,
    severity: 'info',
  }
}

// ─── Content Skills (Phase 6) ───────────────────────────────────────────────────
import { contentHeartbeatChecks } from './content-skills'

// ─── Exported Checklist ─────────────────────────────────────────────────────────

export const heartbeatChecks: HeartbeatCheck[] = [
  {
    name: 'pipeline_health',
    description: 'Any failed pipeline runs in last 24h?',
    dispatchTo: 'ingestor',
    check: checkPipelineHealth,
  },
  {
    name: 'data_freshness',
    description: 'Latest crash date > 7 days ago?',
    dispatchTo: 'ingestor',
    check: checkDataFreshness,
  },
  {
    name: 'narrative_coverage',
    description: '% of crashes with narratives',
    dispatchTo: 'narrator',
    check: checkNarrativeCoverage,
  },
  {
    name: 'equalizer_coverage',
    description: '% of crashes with equalizers',
    dispatchTo: 'equalizer',
    check: checkEqualizerCoverage,
  },
  {
    name: 'dead_letter_queue',
    description: 'Dead letter queue size',
    dispatchTo: 'healer',
    check: checkDeadLetterQueue,
  },
  {
    name: 'api_health',
    description: 'API response health',
    dispatchTo: 'healer',
    check: checkApiHealth,
  },
  // Content generation skills (Phase 6)
  ...contentHeartbeatChecks,
]

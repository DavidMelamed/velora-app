import { Router } from 'express'
import { prisma } from '@velora/db'
import { getRedis } from '../lib/redis'
import { monitoring } from '../services/monitoring'

const router = Router()

router.get('/', async (_req, res) => {
  const checks: Record<string, { status: string; latencyMs?: number; error?: string; details?: unknown }> = {}

  // Database connectivity check
  const dbStart = Date.now()
  try {
    await prisma.$queryRaw`SELECT 1`
    checks.database = { status: 'ok', latencyMs: Date.now() - dbStart }
  } catch (error) {
    checks.database = {
      status: 'error',
      latencyMs: Date.now() - dbStart,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }

  // Redis connectivity check
  const redisStart = Date.now()
  const redis = getRedis()
  if (redis) {
    try {
      await redis.ping()
      checks.redis = { status: 'ok', latencyMs: Date.now() - redisStart }
    } catch (error) {
      checks.redis = {
        status: 'error',
        latencyMs: Date.now() - redisStart,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  } else {
    checks.redis = { status: 'unavailable', error: 'REDIS_URL not configured' }
  }

  // Last pipeline run status
  try {
    const lastRun = await prisma.pipelineRun.findFirst({
      orderBy: { startedAt: 'desc' },
      select: {
        id: true,
        status: true,
        stage: true,
        startedAt: true,
        completedAt: true,
        recordsIn: true,
        recordsOut: true,
        durationMs: true,
      },
    })

    if (lastRun) {
      checks.pipeline = {
        status: lastRun.status === 'COMPLETED' ? 'ok' : lastRun.status === 'RUNNING' ? 'running' : 'error',
        details: {
          lastRunId: lastRun.id,
          lastRunStatus: lastRun.status,
          lastRunStage: lastRun.stage,
          startedAt: lastRun.startedAt,
          completedAt: lastRun.completedAt,
          recordsIn: lastRun.recordsIn,
          recordsOut: lastRun.recordsOut,
          durationMs: lastRun.durationMs,
        },
      }
    } else {
      checks.pipeline = { status: 'no_runs', error: 'No pipeline runs recorded' }
    }
  } catch (error) {
    checks.pipeline = {
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }

  // Overall status: ok if database is ok, degraded if Redis/pipeline have issues
  const isHealthy = checks.database?.status === 'ok'
  const isDegraded = isHealthy && (checks.redis?.status === 'error' || checks.pipeline?.status === 'error')

  const overallStatus = isHealthy ? (isDegraded ? 'degraded' : 'ok') : 'error'

  // Get monitoring snapshot
  const monitoringSnapshot = monitoring.getSnapshot()

  const response = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    version: '0.1.0',
    uptime: monitoringSnapshot.uptime,
    checks,
    metrics: {
      totalRequests: monitoringSnapshot.totalRequests,
      totalErrors: monitoringSnapshot.totalErrors,
      errorRate: monitoringSnapshot.errorRate,
    },
  }

  // Structured JSON log
  console.log(JSON.stringify({
    level: overallStatus === 'ok' ? 'info' : 'warn',
    service: 'velora-api',
    event: 'health_check',
    status: overallStatus,
    checks: Object.fromEntries(Object.entries(checks).map(([k, v]) => [k, v.status])),
    timestamp: new Date().toISOString(),
  }))

  res.status(isHealthy ? 200 : 503).json(response)
})

export default router

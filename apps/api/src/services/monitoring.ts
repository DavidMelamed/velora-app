/**
 * Monitoring Service — Track API latency, error rates, pipeline status, AI model usage.
 * Outputs structured JSON logs for Railway logging.
 *
 * Features:
 *   - Request latency tracking (p50, p95, p99)
 *   - Error rate tracking per endpoint
 *   - Pipeline run status monitoring
 *   - AI model usage summary
 *   - Health check aggregation
 */

export interface LatencyStats {
  count: number
  p50: number
  p95: number
  p99: number
  avg: number
  min: number
  max: number
}

export interface EndpointStats {
  path: string
  method: string
  requestCount: number
  errorCount: number
  errorRate: number
  latency: LatencyStats
}

export interface MonitoringSnapshot {
  timestamp: string
  uptime: number
  totalRequests: number
  totalErrors: number
  errorRate: number
  endpoints: EndpointStats[]
  pipelineStatus: PipelineHealthStatus | null
  aiUsage: AIUsageSnapshot | null
}

export interface PipelineHealthStatus {
  lastRunAt: Date | null
  lastRunStatus: string | null
  totalRuns: number
  failedRuns: number
  totalCrashes: number
}

export interface AIUsageSnapshot {
  dailySpend: number
  dailyLimit: number
  requestCount: number
  isOverBudget: boolean
}

interface RequestRecord {
  path: string
  method: string
  statusCode: number
  durationMs: number
  timestamp: number
}

/** Sliding window duration (15 minutes) */
const WINDOW_MS = 15 * 60 * 1000
const MAX_RECORDS = 10000

class MonitoringService {
  private records: RequestRecord[] = []
  private startTime: number = Date.now()

  /**
   * Record a completed request.
   */
  recordRequest(req: { path: string; method: string }, statusCode: number, durationMs: number): void {
    const now = Date.now()

    this.records.push({
      path: req.path,
      method: req.method,
      statusCode,
      durationMs,
      timestamp: now,
    })

    // Prune old records
    if (this.records.length > MAX_RECORDS) {
      const cutoff = now - WINDOW_MS
      this.records = this.records.filter(r => r.timestamp >= cutoff)
    }

    // Structured log for each request
    console.log(JSON.stringify({
      level: statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info',
      service: 'velora-api',
      event: 'request_completed',
      method: req.method,
      path: req.path,
      statusCode,
      durationMs,
      timestamp: new Date(now).toISOString(),
    }))
  }

  /**
   * Calculate percentile from sorted array.
   */
  private percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0
    const index = Math.ceil(sorted.length * p) - 1
    return sorted[Math.max(0, index)]
  }

  /**
   * Get latency stats for a set of durations.
   */
  private getLatencyStats(durations: number[]): LatencyStats {
    if (durations.length === 0) {
      return { count: 0, p50: 0, p95: 0, p99: 0, avg: 0, min: 0, max: 0 }
    }

    const sorted = [...durations].sort((a, b) => a - b)
    const sum = sorted.reduce((a, b) => a + b, 0)

    return {
      count: sorted.length,
      p50: this.percentile(sorted, 0.5),
      p95: this.percentile(sorted, 0.95),
      p99: this.percentile(sorted, 0.99),
      avg: Math.round(sum / sorted.length),
      min: sorted[0],
      max: sorted[sorted.length - 1],
    }
  }

  /**
   * Get endpoint-level stats for the current window.
   */
  getEndpointStats(): EndpointStats[] {
    const cutoff = Date.now() - WINDOW_MS
    const recent = this.records.filter(r => r.timestamp >= cutoff)

    const groups = new Map<string, RequestRecord[]>()
    for (const r of recent) {
      const key = `${r.method}:${r.path}`
      const existing = groups.get(key) ?? []
      existing.push(r)
      groups.set(key, existing)
    }

    return Array.from(groups.entries()).map(([key, records]) => {
      const [method, path] = key.split(':')
      const errorCount = records.filter(r => r.statusCode >= 500).length
      const durations = records.map(r => r.durationMs)

      return {
        path,
        method,
        requestCount: records.length,
        errorCount,
        errorRate: records.length > 0 ? errorCount / records.length : 0,
        latency: this.getLatencyStats(durations),
      }
    }).sort((a, b) => b.requestCount - a.requestCount)
  }

  /**
   * Get a full monitoring snapshot.
   */
  getSnapshot(pipelineStatus?: PipelineHealthStatus, aiUsage?: AIUsageSnapshot): MonitoringSnapshot {
    const cutoff = Date.now() - WINDOW_MS
    const recent = this.records.filter(r => r.timestamp >= cutoff)
    const totalErrors = recent.filter(r => r.statusCode >= 500).length

    return {
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      totalRequests: recent.length,
      totalErrors,
      errorRate: recent.length > 0 ? totalErrors / recent.length : 0,
      endpoints: this.getEndpointStats(),
      pipelineStatus: pipelineStatus ?? null,
      aiUsage: aiUsage ?? null,
    }
  }

  /**
   * Reset all records (useful for testing).
   */
  reset(): void {
    this.records = []
    this.startTime = Date.now()
  }
}

/** Singleton monitoring service */
export const monitoring = new MonitoringService()

export { MonitoringService }

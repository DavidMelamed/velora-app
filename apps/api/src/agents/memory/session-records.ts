import { prisma, Prisma } from '@velora/db'
import type { AgentId } from '../mastra-config'

/**
 * Session Records — PostgreSQL-backed via AgentSession Prisma model.
 * Logs every agent action for auditing, debugging, and learning.
 */

export interface AgentActionLog {
  agentId: AgentId
  action: string
  input?: Record<string, unknown>
  output?: Record<string, unknown>
  status: 'SUCCESS' | 'FAILED' | 'SKIPPED' | 'IN_PROGRESS'
  durationMs?: number
  error?: string
}

/**
 * Log an agent action to the AgentSession table.
 */
export async function logAgentAction(log: AgentActionLog): Promise<string> {
  const session = await prisma.agentSession.create({
    data: {
      agentId: log.agentId,
      action: log.action,
      input: (log.input ?? Prisma.JsonNull) as Prisma.InputJsonValue,
      output: (log.output ?? Prisma.JsonNull) as Prisma.InputJsonValue,
      status: log.status,
      durationMs: log.durationMs ?? null,
      error: log.error ?? null,
    },
  })
  return session.id
}

/**
 * Update an existing agent session (e.g., when an IN_PROGRESS action completes).
 */
export async function updateAgentAction(
  sessionId: string,
  update: Partial<Pick<AgentActionLog, 'output' | 'status' | 'durationMs' | 'error'>>
): Promise<void> {
  const data: Record<string, unknown> = {}
  if (update.output !== undefined) data.output = update.output as Prisma.InputJsonValue
  if (update.status !== undefined) data.status = update.status
  if (update.durationMs !== undefined) data.durationMs = update.durationMs
  if (update.error !== undefined) data.error = update.error

  await prisma.agentSession.update({
    where: { id: sessionId },
    data: data as any,
  })
}

/**
 * Get recent actions for an agent.
 */
export async function getRecentActions(
  agentId: AgentId,
  options: { limit?: number; status?: string; action?: string } = {}
) {
  const { limit = 20, status, action } = options

  return prisma.agentSession.findMany({
    where: {
      agentId,
      ...(status ? { status } : {}),
      ...(action ? { action } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })
}

/**
 * Count actions by status for an agent within a time window.
 */
export async function countActionsByStatus(
  agentId: AgentId,
  windowHours: number = 24
): Promise<Record<string, number>> {
  const since = new Date(Date.now() - windowHours * 60 * 60 * 1000)

  const sessions = await prisma.agentSession.findMany({
    where: {
      agentId,
      createdAt: { gte: since },
    },
    select: { status: true },
  })

  const counts: Record<string, number> = {}
  for (const s of sessions) {
    counts[s.status] = (counts[s.status] || 0) + 1
  }
  return counts
}

/**
 * Get the last action of a specific type for an agent.
 */
export async function getLastAction(agentId: AgentId, action: string) {
  return prisma.agentSession.findFirst({
    where: { agentId, action },
    orderBy: { createdAt: 'desc' },
  })
}

/**
 * Count consecutive failures for an agent (for circuit breaker).
 */
export async function countConsecutiveFailures(agentId: AgentId, action: string): Promise<number> {
  const recent = await prisma.agentSession.findMany({
    where: { agentId, action },
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: { status: true },
  })

  let count = 0
  for (const s of recent) {
    if (s.status === 'FAILED') count++
    else break // Stop counting on first non-failure
  }
  return count
}

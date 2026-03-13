import { prisma } from '@velora/db'
import type { AgentId } from '../mastra-config'

/**
 * Semantic Memory — Keyword-based search over AgentSession records.
 *
 * In production with pgvector available, this would use embeddings for recall.
 * Currently implements simple keyword-based search over action names and
 * JSON input/output fields.
 */

export interface MemorySearchResult {
  sessionId: string
  agentId: string
  action: string
  status: string
  relevanceScore: number
  createdAt: Date
  summary: string
}

/**
 * Search agent memory for relevant past actions.
 * Uses keyword matching against action names and JSON input/output fields.
 */
export async function searchMemory(
  query: string,
  options: { agentId?: AgentId; limit?: number; windowDays?: number } = {}
): Promise<MemorySearchResult[]> {
  const { limit = 10, windowDays = 30 } = options
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000)

  // Tokenize query into keywords
  const keywords = query
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2)

  if (keywords.length === 0) return []

  // Fetch recent sessions
  const sessions = await prisma.agentSession.findMany({
    where: {
      createdAt: { gte: since },
      ...(options.agentId ? { agentId: options.agentId } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 200, // Fetch more than needed, then filter by relevance
  })

  // Score each session by keyword matches
  const scored = sessions
    .map((session) => {
      const searchable = [
        session.action,
        session.agentId,
        session.status,
        session.error || '',
        JSON.stringify(session.input || {}),
        JSON.stringify(session.output || {}),
      ]
        .join(' ')
        .toLowerCase()

      let score = 0
      for (const keyword of keywords) {
        if (searchable.includes(keyword)) {
          score += 1
          // Bonus for exact action match
          if (session.action.toLowerCase().includes(keyword)) {
            score += 2
          }
        }
      }

      // Recency boost: more recent = higher score
      const ageHours = (Date.now() - session.createdAt.getTime()) / (1000 * 60 * 60)
      const recencyBoost = Math.max(0, 1 - ageHours / (windowDays * 24))
      score += recencyBoost * 0.5

      return {
        session,
        score,
      }
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)

  return scored.map(({ session, score }) => ({
    sessionId: session.id,
    agentId: session.agentId,
    action: session.action,
    status: session.status,
    relevanceScore: Number(score.toFixed(2)),
    createdAt: session.createdAt,
    summary: summarizeSession(session),
  }))
}

/**
 * Get context for a specific agent — recent actions and their outcomes.
 * Used by agents to understand their own history.
 */
export async function getAgentContext(
  agentId: AgentId,
  options: { maxActions?: number; includeErrors?: boolean } = {}
): Promise<string> {
  const { maxActions = 5, includeErrors = true } = options

  const recent = await prisma.agentSession.findMany({
    where: {
      agentId,
      ...(includeErrors ? {} : { status: 'SUCCESS' }),
    },
    orderBy: { createdAt: 'desc' },
    take: maxActions,
  })

  if (recent.length === 0) {
    return `No recent actions found for agent ${agentId}.`
  }

  const lines = recent.map((s) => {
    const time = s.createdAt.toISOString()
    const duration = s.durationMs ? `${s.durationMs}ms` : 'unknown duration'
    const errorInfo = s.error ? ` Error: ${s.error}` : ''
    return `[${time}] ${s.action}: ${s.status} (${duration})${errorInfo}`
  })

  return `Recent actions for ${agentId}:\n${lines.join('\n')}`
}

function summarizeSession(session: {
  action: string
  status: string
  durationMs: number | null
  error: string | null
  input: unknown
}): string {
  const parts = [`${session.action}: ${session.status}`]
  if (session.durationMs) parts.push(`${session.durationMs}ms`)
  if (session.error) parts.push(`Error: ${session.error.slice(0, 100)}`)

  // Try to extract key info from input
  const input = session.input as Record<string, unknown> | null
  if (input) {
    if (input.crashId) parts.push(`crash=${input.crashId}`)
    if (input.stateCode) parts.push(`state=${input.stateCode}`)
    if (input.component) parts.push(`component=${input.component}`)
  }

  return parts.join(' | ')
}

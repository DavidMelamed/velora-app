import { prisma } from '@velora/db'
import { detectGaps } from './gap-detector'
import { getActiveFacts } from './fact-manager'
import { ingestEpisode } from './episode-ingest'
import { EpisodeType } from '@velora/shared'

const MS_PER_DAY = 24 * 60 * 60 * 1000

interface CheckinResult {
  checked: number
  triggered: number
}

/**
 * Run proactive check-ins on all active matters.
 * Call this on an interval (e.g., every 4 hours via heartbeat).
 */
export async function runCheckins(): Promise<CheckinResult> {
  const matters = await prisma.matter.findMany({
    where: {
      status: { in: ['ACTIVE', 'TREATING'] },
    },
    select: {
      id: true,
      clientName: true,
      lastActivityAt: true,
      statuteDeadline: true,
    },
  })

  let triggered = 0

  for (const matter of matters) {
    try {
      // Rate limit: check if we already sent a check-in today
      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)

      const recentCheckin = await prisma.episode.findFirst({
        where: {
          matterId: matter.id,
          type: 'SYSTEM_EVENT',
          occurredAt: { gte: todayStart },
          metadata: { path: ['checkinType'], not: undefined },
        },
      })

      if (recentCheckin) continue // Already checked in today

      const checkinMessage = await evaluateCheckinTriggers(matter)
      if (checkinMessage) {
        // Record the check-in as a system event
        await ingestEpisode(matter.id, {
          type: EpisodeType.SYSTEM_EVENT,
          title: 'Proactive check-in',
          textContent: checkinMessage.message,
          occurredAt: new Date().toISOString(),
          metadata: { checkinType: checkinMessage.type, role: 'assistant' },
        })

        triggered++
        // Push notification would be sent here via mobile notification service
      }
    } catch (error) {
      console.error(`Check-in failed for matter ${matter.id}:`, error)
    }
  }

  return { checked: matters.length, triggered }
}

interface CheckinMessage {
  type: 'inactivity' | 'treatment_gap' | 'statute_warning' | 'upcoming_appointment'
  message: string
}

async function evaluateCheckinTriggers(matter: {
  id: string
  clientName: string | null
  lastActivityAt: Date
  statuteDeadline: Date | null
}): Promise<CheckinMessage | null> {
  const now = new Date()
  const name = matter.clientName ? matter.clientName.split(' ')[0] : ''

  // Collect all triggers, return highest priority
  // Priority: statute_warning > treatment_gap > inactivity
  const triggers: CheckinMessage[] = []

  // 1. Statute warning (highest priority)
  if (matter.statuteDeadline) {
    const daysUntilDeadline = Math.round(
      (matter.statuteDeadline.getTime() - now.getTime()) / MS_PER_DAY
    )
    if (daysUntilDeadline > 0 && daysUntilDeadline <= 90) {
      triggers.push({
        type: 'statute_warning',
        message: `Important reminder: your filing deadline is in ${daysUntilDeadline} days. Have you spoken with your attorney about next steps?`,
      })
    }
  }

  // 2. Treatment gaps
  const gaps = await detectGaps(matter.id)
  if (gaps.length > 0) {
    const facts = await getActiveFacts(matter.id, { predicate: 'treating_at' })
    const lastProvider = facts[0]?.object || 'your doctor'
    triggers.push({
      type: 'treatment_gap',
      message: `I noticed it's been a while since your last treatment visit. Have you been able to see ${lastProvider}? Staying on top of your treatment really helps your case.`,
    })
  }

  // 3. Inactivity (>3 days)
  const daysSinceActivity = Math.round(
    (now.getTime() - matter.lastActivityAt.getTime()) / MS_PER_DAY
  )
  if (daysSinceActivity > 3) {
    triggers.push({
      type: 'inactivity',
      message: name
        ? `Hey ${name}! Just checking in — how are you feeling this week?`
        : `Hey! Just checking in — how are you feeling this week?`,
    })
  }

  // Return highest priority trigger
  const priority: CheckinMessage['type'][] = ['statute_warning', 'treatment_gap', 'inactivity']
  for (const p of priority) {
    const match = triggers.find((t) => t.type === p)
    if (match) return match
  }

  return null
}

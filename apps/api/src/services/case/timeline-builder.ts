import { prisma } from '@velora/db'
import type { CaseTimeline } from '@velora/db'
import type { TimelineFilter } from '@velora/shared'

const EPISODE_CATEGORY_MAP: Record<string, string> = {
  LOCATION_VISIT: 'medical',
  CALL_TRANSCRIPT: 'communication',
  VOICE_NOTE: 'communication',
  CHAT_MESSAGE: 'communication',
  PHOTO: 'evidence',
  DOCUMENT: 'legal',
  EMAIL_EXTRACT: 'communication',
  SYSTEM_EVENT: 'milestone',
  CONFIRMATION_RESPONSE: 'milestone',
}

/**
 * Build (or rebuild) the timeline for a matter from episodes and confirmed facts.
 */
export async function buildTimeline(
  matterId: string,
  filter?: TimelineFilter
): Promise<CaseTimeline[]> {
  // Load all episodes
  const episodeWhere: Record<string, unknown> = { matterId }
  if (filter?.dateFrom || filter?.dateTo) {
    episodeWhere.occurredAt = {
      ...(filter.dateFrom ? { gte: new Date(filter.dateFrom) } : {}),
      ...(filter.dateTo ? { lte: new Date(filter.dateTo) } : {}),
    }
  }

  const episodes = await prisma.episode.findMany({
    where: episodeWhere,
    orderBy: { occurredAt: 'desc' },
  })

  // Map episodes to timeline events
  const entries: Array<{
    matterId: string
    category: string
    title: string
    description: string | null
    occurredAt: Date
    duration: number | null
    episodeId: string
  }> = []

  for (const ep of episodes) {
    const category = EPISODE_CATEGORY_MAP[ep.type] || 'other'
    if (filter?.category && category !== filter.category) continue

    entries.push({
      matterId,
      category,
      title: ep.title || `${ep.type.replace(/_/g, ' ').toLowerCase()}`,
      description: ep.textContent?.slice(0, 200) || null,
      occurredAt: ep.occurredAt,
      duration: ep.duration,
      episodeId: ep.id,
    })
  }

  // Load confirmed milestone facts
  const facts = await prisma.caseFact.findMany({
    where: {
      matterId,
      status: 'CONFIRMED',
      predicate: {
        in: ['diagnosed_with', 'filed_claim', 'retained_attorney', 'surgery_scheduled', 'settlement_offered'],
      },
    },
    orderBy: { validFrom: 'desc' },
  })

  for (const fact of facts) {
    const category = 'milestone'
    if (filter?.category && category !== filter.category) continue

    entries.push({
      matterId,
      category,
      title: `${fact.subject} ${fact.predicate.replace(/_/g, ' ')} ${fact.object}`,
      description: null,
      occurredAt: fact.validFrom,
      duration: null,
      episodeId: fact.sourceEpisodeIds[0] || '',
    })
  }

  // Upsert timeline entries (use episodeId as dedup key)
  for (const entry of entries) {
    if (!entry.episodeId) continue

    const existingId = await findTimelineByEpisode(matterId, entry.episodeId)
    if (existingId) {
      await prisma.caseTimeline.update({
        where: { id: existingId },
        data: {
          title: entry.title,
          description: entry.description,
          category: entry.category,
        },
      })
    } else {
      await prisma.caseTimeline.create({
        data: {
          matterId: entry.matterId,
          category: entry.category,
          title: entry.title,
          description: entry.description,
          occurredAt: entry.occurredAt,
          duration: entry.duration,
          episodeId: entry.episodeId,
        },
      })
    }
  }

  // Return built timeline
  const timelineWhere: Record<string, unknown> = { matterId }
  if (filter?.category) timelineWhere.category = filter.category
  if (filter?.dateFrom || filter?.dateTo) {
    timelineWhere.occurredAt = {
      ...(filter.dateFrom ? { gte: new Date(filter.dateFrom) } : {}),
      ...(filter.dateTo ? { lte: new Date(filter.dateTo) } : {}),
    }
  }

  return prisma.caseTimeline.findMany({
    where: timelineWhere,
    orderBy: { occurredAt: 'desc' },
    take: 100,
  })
}

async function findTimelineByEpisode(
  matterId: string,
  episodeId: string
): Promise<string | null> {
  const existing = await prisma.caseTimeline.findFirst({
    where: { matterId, episodeId },
    select: { id: true },
  })
  return existing?.id ?? null
}

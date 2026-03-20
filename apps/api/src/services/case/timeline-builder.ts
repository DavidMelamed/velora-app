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

  // Load all existing timeline entries for this matter in one query
  const existingTimelines = await prisma.caseTimeline.findMany({
    where: { matterId },
    select: { id: true, episodeId: true },
  })
  const episodeToTimelineId = new Map<string, string>()
  for (const t of existingTimelines) {
    if (t.episodeId) episodeToTimelineId.set(t.episodeId, t.id)
  }

  // Separate entries into creates and updates
  const creates: typeof entries = []
  const updates: Array<{ id: string; title: string; description: string | null; category: string }> = []

  for (const entry of entries) {
    if (!entry.episodeId) continue

    const existingId = episodeToTimelineId.get(entry.episodeId)
    if (existingId) {
      updates.push({
        id: existingId,
        title: entry.title,
        description: entry.description,
        category: entry.category,
      })
    } else {
      creates.push(entry)
    }
  }

  // Batch creates and updates in a single transaction
  await prisma.$transaction([
    ...creates.map((entry) =>
      prisma.caseTimeline.create({
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
    ),
    ...updates.map((u) =>
      prisma.caseTimeline.update({
        where: { id: u.id },
        data: {
          title: u.title,
          description: u.description,
          category: u.category,
        },
      })
    ),
  ])

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


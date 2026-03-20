import { prisma } from '@velora/db'
import type { CaseEntityType as PrismaCaseEntityType } from '@velora/db'
import { extractEntities } from '@velora/ai'

/**
 * Process entity extraction on an episode's text content.
 * Creates/updates CaseEntity and CaseFact records.
 */
export async function processEpisodeExtraction(episodeId: string): Promise<void> {
  const episode = await prisma.episode.findUnique({
    where: { id: episodeId },
    include: {
      matter: {
        include: {
          entities: { select: { id: true, name: true, normalizedName: true, type: true } },
        },
      },
    },
  })

  if (!episode) throw new Error(`Episode not found: ${episodeId}`)
  if (episode.isProcessed) return
  if (!episode.textContent) {
    await prisma.episode.update({ where: { id: episodeId }, data: { isProcessed: true } })
    return
  }

  const knownEntities = episode.matter.entities.map((e) => e.name)
  const result = await extractEntities(episode.textContent, { knownEntities })

  // Process extracted entities
  for (const extracted of result.entities) {
    const normalizedName = extracted.name.toLowerCase().trim()

    const existing = await prisma.caseEntity.findFirst({
      where: {
        matterId: episode.matterId,
        normalizedName,
        type: extracted.type,
      },
    })

    if (existing) {
      // Update existing entity — merge attributes, add source episode
      const mergedAttributes: Record<string, unknown> = {
        ...((existing.attributes ?? {}) as Record<string, unknown>),
        ...extracted.attributes,
      }
      const sourceIds = existing.sourceEpisodeIds.includes(episodeId)
        ? existing.sourceEpisodeIds
        : [...existing.sourceEpisodeIds, episodeId]

      await prisma.caseEntity.update({
        where: { id: existing.id },
        data: {
          attributes: mergedAttributes as unknown as import('@velora/db').Prisma.InputJsonValue,
          sourceEpisodeIds: sourceIds,
          confidence: Math.min(1, Math.max(existing.confidence, extracted.confidence)),
        },
      })
    } else {
      // Create new entity
      await prisma.caseEntity.create({
        data: {
          matterId: episode.matterId,
          type: extracted.type as PrismaCaseEntityType,
          name: extracted.name,
          normalizedName,
          attributes: extracted.attributes as unknown as import('@velora/db').Prisma.InputJsonValue,
          confidence: extracted.confidence,
          sourceEpisodeIds: [episodeId],
        },
      })
    }
  }

  // Process extracted facts
  for (const fact of result.facts) {
    // Check for conflicting facts (same subject + predicate, different object)
    const existing = await prisma.caseFact.findFirst({
      where: {
        matterId: episode.matterId,
        subject: fact.subject,
        predicate: fact.predicate,
        status: { in: ['CANDIDATE', 'CONFIRMED'] },
      },
    })

    if (existing && existing.object !== fact.object) {
      // Supersede old fact
      const newFact = await prisma.caseFact.create({
        data: {
          matterId: episode.matterId,
          subject: fact.subject,
          predicate: fact.predicate,
          object: fact.object,
          validFrom: fact.validFrom ? new Date(fact.validFrom) : new Date(),
          status: 'CANDIDATE',
          confidence: fact.confidence,
          sourceEpisodeIds: [episodeId],
          sourceEpisodes: { connect: { id: episodeId } },
        },
      })

      await prisma.caseFact.update({
        where: { id: existing.id },
        data: {
          status: 'SUPERSEDED',
          validUntil: new Date(),
          supersededById: newFact.id,
        },
      })
    } else if (!existing) {
      // Create new fact
      await prisma.caseFact.create({
        data: {
          matterId: episode.matterId,
          subject: fact.subject,
          predicate: fact.predicate,
          object: fact.object,
          validFrom: fact.validFrom ? new Date(fact.validFrom) : new Date(),
          status: 'CANDIDATE',
          confidence: fact.confidence,
          sourceEpisodeIds: [episodeId],
          sourceEpisodes: { connect: { id: episodeId } },
        },
      })
    }
  }

  // Mark episode as processed
  await prisma.episode.update({
    where: { id: episodeId },
    data: {
      isProcessed: true,
      extractedEntities: result as unknown as unknown as import('@velora/db').Prisma.InputJsonValue,
    },
  })

  // Update matter activity
  await prisma.matter.update({
    where: { id: episode.matterId },
    data: { lastActivityAt: new Date() },
  })
}

/**
 * Process all unextracted episodes for a matter.
 */
export async function processUnextractedEpisodes(matterId: string): Promise<number> {
  const episodes = await prisma.episode.findMany({
    where: {
      matterId,
      isProcessed: false,
      textContent: { not: null },
    },
    orderBy: { occurredAt: 'asc' },
  })

  let processed = 0
  for (const episode of episodes) {
    try {
      await processEpisodeExtraction(episode.id)
      processed++
    } catch (error) {
      console.error(`Failed to extract from episode ${episode.id}:`, error)
    }
  }

  return processed
}

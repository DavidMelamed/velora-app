import { prisma } from '@velora/db'
import type { CaseFact } from '@velora/db'

interface FactInput {
  subject: string
  predicate: string
  object: string
  validFrom?: Date
  sourceEpisodeIds?: string[]
}

/**
 * Create a new temporal fact.
 */
export async function createFact(
  matterId: string,
  fact: FactInput
): Promise<CaseFact> {
  return prisma.caseFact.create({
    data: {
      matterId,
      subject: fact.subject,
      predicate: fact.predicate,
      object: fact.object,
      validFrom: fact.validFrom ?? new Date(),
      status: 'CANDIDATE',
      confidence: 0.5,
      sourceEpisodeIds: fact.sourceEpisodeIds ?? [],
    },
  })
}

/**
 * Supersede an existing fact with a new value.
 * Old fact gets status=SUPERSEDED and validUntil=now.
 */
export async function supersedeFact(
  factId: string,
  newFactData: { object: string; validFrom?: Date }
): Promise<CaseFact> {
  const oldFact = await prisma.caseFact.findUnique({ where: { id: factId } })
  if (!oldFact) throw new Error(`Fact not found: ${factId}`)

  const newFact = await prisma.caseFact.create({
    data: {
      matterId: oldFact.matterId,
      subject: oldFact.subject,
      predicate: oldFact.predicate,
      object: newFactData.object,
      validFrom: newFactData.validFrom ?? new Date(),
      status: 'CANDIDATE',
      confidence: 0.5,
      sourceEpisodeIds: oldFact.sourceEpisodeIds,
    },
  })

  await prisma.caseFact.update({
    where: { id: factId },
    data: {
      status: 'SUPERSEDED',
      validUntil: new Date(),
      supersededById: newFact.id,
    },
  })

  return newFact
}

/**
 * Confirm a fact (raise confidence, mark confirmed).
 */
export async function confirmFact(factId: string): Promise<CaseFact> {
  const fact = await prisma.caseFact.findUnique({ where: { id: factId } })
  if (!fact) throw new Error(`Fact not found: ${factId}`)

  return prisma.caseFact.update({
    where: { id: factId },
    data: {
      status: 'CONFIRMED',
      confidence: Math.min(1.0, Math.max(0.9, fact.confidence + 0.1)),
    },
  })
}

/**
 * Reject a fact.
 */
export async function rejectFact(factId: string): Promise<CaseFact> {
  return prisma.caseFact.update({
    where: { id: factId },
    data: {
      status: 'REJECTED',
      confidence: 0,
    },
  })
}

/**
 * Get active facts for a matter at a point in time.
 */
export async function getActiveFacts(
  matterId: string,
  options?: { asOf?: Date; predicate?: string; subject?: string }
): Promise<CaseFact[]> {
  const asOf = options?.asOf ?? new Date()

  const where: Record<string, unknown> = {
    matterId,
    status: { in: ['CONFIRMED', 'CANDIDATE'] },
    validFrom: { lte: asOf },
    OR: [
      { validUntil: null },
      { validUntil: { gt: asOf } },
    ],
  }

  if (options?.predicate) where.predicate = options.predicate
  if (options?.subject) where.subject = options.subject

  return prisma.caseFact.findMany({
    where,
    orderBy: { validFrom: 'desc' },
  })
}

/**
 * Get full temporal history of a specific relationship.
 */
export async function getFactHistory(
  matterId: string,
  subject: string,
  predicate: string
): Promise<CaseFact[]> {
  return prisma.caseFact.findMany({
    where: { matterId, subject, predicate },
    orderBy: { validFrom: 'asc' },
  })
}

import { prisma } from '@velora/db'
import type { Confirmation } from '@velora/db'
import { confirmFact, rejectFact } from './fact-manager'

interface ConfirmationInput {
  prompt: string
  episodeId?: string
  factId?: string
  entityId?: string
}

/**
 * Create a confirmation request for the user.
 */
export async function createConfirmation(
  matterId: string,
  input: ConfirmationInput
): Promise<Confirmation> {
  const expiresAt = new Date()
  expiresAt.setHours(expiresAt.getHours() + 48)

  return prisma.confirmation.create({
    data: {
      matterId,
      prompt: input.prompt,
      episodeId: input.episodeId ?? null,
      factId: input.factId ?? null,
      entityId: input.entityId ?? null,
      expiresAt,
    },
  })
}

/**
 * Handle a user's response to a confirmation.
 * Updates related facts, entities, and timeline based on the response.
 */
export async function respondToConfirmation(
  confirmationId: string,
  confirmed: boolean
): Promise<void> {
  const confirmation = await prisma.confirmation.findUnique({
    where: { id: confirmationId },
  })

  if (!confirmation) throw new Error(`Confirmation not found: ${confirmationId}`)

  // Update confirmation record
  await prisma.confirmation.update({
    where: { id: confirmationId },
    data: { confirmed, respondedAt: new Date() },
  })

  if (confirmed) {
    // Confirm related fact
    if (confirmation.factId) {
      await confirmFact(confirmation.factId)
    }

    // Raise entity confidence
    if (confirmation.entityId) {
      const entity = await prisma.caseEntity.findUnique({
        where: { id: confirmation.entityId },
      })
      if (entity) {
        await prisma.caseEntity.update({
          where: { id: confirmation.entityId },
          data: { confidence: Math.min(1.0, Math.max(0.9, entity.confidence + 0.1)) },
        })
      }
    }
  } else {
    // Reject related fact
    if (confirmation.factId) {
      await rejectFact(confirmation.factId)
    }

    // Lower entity confidence
    if (confirmation.entityId) {
      const entity = await prisma.caseEntity.findUnique({
        where: { id: confirmation.entityId },
      })
      if (entity) {
        await prisma.caseEntity.update({
          where: { id: confirmation.entityId },
          data: { confidence: Math.max(0, entity.confidence - 0.4) },
        })
      }
    }
  }

  // Update matter activity
  await prisma.matter.update({
    where: { id: confirmation.matterId },
    data: { lastActivityAt: new Date() },
  })
}

/**
 * Get pending confirmations for a matter.
 */
export async function getPendingConfirmations(
  matterId: string
): Promise<Confirmation[]> {
  return prisma.confirmation.findMany({
    where: {
      matterId,
      confirmed: null,
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } },
      ],
    },
    orderBy: { sentAt: 'desc' },
  })
}

/**
 * Expire stale confirmations (older than 48h without response).
 */
export async function expireStaleConfirmations(): Promise<number> {
  const result = await prisma.confirmation.updateMany({
    where: {
      confirmed: null,
      expiresAt: { lt: new Date() },
    },
    data: { confirmed: null }, // No-op but marks as expired via expiresAt
  })

  return result.count
}

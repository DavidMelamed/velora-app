/**
 * Prompt Lineage Tracking — Version tracking with parent/child relationships.
 */

import { prisma } from '@velora/db'
import type { Prisma } from '@velora/db'

export interface PromptVersionRecord {
  id: string
  signature: string
  version: number
  parentId: string | null
  archetypeId: string | null
  promptContent: Record<string, unknown>
  mutations: string[] | null
  scores: Record<string, number> | null
  compositeScore: number | null
  isActive: boolean
  createdAt: Date
}

/**
 * Create a new prompt version with lineage tracking.
 */
export async function createPromptVersion(params: {
  signature: string
  parentId?: string
  archetypeId?: string
  promptContent: Record<string, unknown>
  mutations?: string[]
}): Promise<PromptVersionRecord> {
  // Get next version number for this signature
  const latest = await prisma.promptVersion.findFirst({
    where: { signature: params.signature },
    orderBy: { version: 'desc' },
    select: { version: true },
  })

  const nextVersion = (latest?.version ?? 0) + 1

  const record = await prisma.promptVersion.create({
    data: {
      signature: params.signature,
      version: nextVersion,
      parentId: params.parentId,
      archetypeId: params.archetypeId,
      promptContent: params.promptContent as Prisma.InputJsonValue,
      mutations: params.mutations ? (params.mutations as unknown as Prisma.InputJsonValue) : undefined,
      isActive: false,
    },
  })

  return mapToRecord(record)
}

/**
 * Record scores for a prompt version.
 */
export async function recordScores(
  versionId: string,
  scores: Record<string, number>,
  compositeScore: number,
): Promise<PromptVersionRecord> {
  const record = await prisma.promptVersion.update({
    where: { id: versionId },
    data: {
      scores: scores as Prisma.InputJsonValue,
      compositeScore,
    },
  })

  return mapToRecord(record)
}

/**
 * Promote a version to active (deactivating all other versions for that signature).
 */
export async function promoteVersion(versionId: string): Promise<PromptVersionRecord> {
  const version = await prisma.promptVersion.findUniqueOrThrow({
    where: { id: versionId },
  })

  // Deactivate all versions for this signature
  await prisma.promptVersion.updateMany({
    where: { signature: version.signature, isActive: true },
    data: { isActive: false },
  })

  // Activate this version
  const record = await prisma.promptVersion.update({
    where: { id: versionId },
    data: { isActive: true },
  })

  return mapToRecord(record)
}

/**
 * Get the active prompt version for a signature.
 */
export async function getActiveVersion(
  signature: string,
  archetypeId?: string,
): Promise<PromptVersionRecord | null> {
  // Try archetype-specific first, then fall back to general
  if (archetypeId) {
    const specific = await prisma.promptVersion.findFirst({
      where: { signature, archetypeId, isActive: true },
    })
    if (specific) return mapToRecord(specific)
  }

  const general = await prisma.promptVersion.findFirst({
    where: { signature, isActive: true, archetypeId: null },
  })

  return general ? mapToRecord(general) : null
}

/**
 * Get the lineage tree for a prompt version (ancestors).
 */
export async function getLineage(versionId: string): Promise<PromptVersionRecord[]> {
  const lineage: PromptVersionRecord[] = []
  let currentId: string | null = versionId

  while (currentId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const found: any = await prisma.promptVersion.findUnique({
      where: { id: currentId },
    })
    if (!found) break
    lineage.push(mapToRecord(found))
    currentId = found.parentId as string | null
  }

  return lineage
}

/**
 * Get all versions for a signature, ordered by version number.
 */
export async function getVersionHistory(
  signature: string,
  limit = 50,
): Promise<PromptVersionRecord[]> {
  const versions = await prisma.promptVersion.findMany({
    where: { signature },
    orderBy: { version: 'desc' },
    take: limit,
  })

  return versions.map(mapToRecord)
}

/**
 * Rollback to a specific version (promote it back to active).
 */
export async function rollbackToVersion(versionId: string): Promise<PromptVersionRecord> {
  return promoteVersion(versionId)
}

// Internal helper
function mapToRecord(record: {
  id: string
  signature: string
  version: number
  parentId: string | null
  archetypeId: string | null
  promptContent: unknown
  mutations: unknown
  scores: unknown
  compositeScore: number | null
  isActive: boolean
  createdAt: Date
}): PromptVersionRecord {
  return {
    id: record.id,
    signature: record.signature,
    version: record.version,
    parentId: record.parentId,
    archetypeId: record.archetypeId,
    promptContent: record.promptContent as Record<string, unknown>,
    mutations: record.mutations as string[] | null,
    scores: record.scores as Record<string, number> | null,
    compositeScore: record.compositeScore,
    isActive: record.isActive,
    createdAt: record.createdAt,
  }
}

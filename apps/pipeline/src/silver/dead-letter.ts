/**
 * Dead letter queue for records that fail validation/mapping.
 * Failed records are stored in PipelineDeadLetter table for later inspection.
 */

import { prisma } from '@velora/db'

export interface DeadLetterEntry {
  rawRecord: Record<string, unknown>
  source: string
  stateCode: string
  error: string
  errorType: 'VALIDATION' | 'MAPPING' | 'DUPLICATE' | 'UNKNOWN'
  stage: 'BRONZE' | 'SILVER' | 'GOLD'
}

/**
 * Write failed records to the PipelineDeadLetter table.
 */
export async function writeDeadLetters(
  entries: DeadLetterEntry[],
  dataSourceId: string,
): Promise<number> {
  if (entries.length === 0) return 0

  const result = await prisma.pipelineDeadLetter.createMany({
    data: entries.map(entry => ({
      dataSourceId,
      stage: entry.stage,
      rawRecord: entry.rawRecord as object,
      error: entry.error,
      errorType: entry.errorType,
    })),
    skipDuplicates: true,
  })

  console.log(`[Dead Letter] Wrote ${result.count} failed records`)
  return result.count
}

/**
 * Get dead letter summary for a data source.
 */
export async function getDeadLetterSummary(dataSourceId?: string): Promise<{
  total: number
  byStage: Record<string, number>
  byErrorType: Record<string, number>
}> {
  const where = dataSourceId ? { dataSourceId } : {}

  const total = await prisma.pipelineDeadLetter.count({ where })

  const byStageRaw = await prisma.pipelineDeadLetter.groupBy({
    by: ['stage'],
    where,
    _count: true,
  })

  const byErrorTypeRaw = await prisma.pipelineDeadLetter.groupBy({
    by: ['errorType'],
    where,
    _count: true,
  })

  return {
    total,
    byStage: Object.fromEntries(byStageRaw.map(r => [r.stage, r._count])),
    byErrorType: Object.fromEntries(byErrorTypeRaw.map(r => [r.errorType, r._count])),
  }
}

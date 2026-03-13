import type { CrashSilver } from '../silver/schemas'

/**
 * Gold stage publisher — takes validated Silver records and writes to Prisma.
 * Handles deduplication, entity resolution, and cross-source merge.
 */

export interface PublishResult {
  created: number
  updated: number
  skipped: number
  errors: Array<{ record: CrashSilver; error: string }>
}

/**
 * Publish validated Silver records to the Gold (Prisma) database.
 * Stub implementation — will be connected to Prisma in Phase 0.
 */
export async function publishToGold(_records: CrashSilver[]): Promise<PublishResult> {
  console.log('[Gold Publisher] Not yet implemented — pending Phase 0')
  return {
    created: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  }
}

/**
 * Generate a fingerprint for deduplication.
 * hash(stateCode + crashDate + latitude.toFixed(4) + longitude.toFixed(4) + vehicleCount)
 */
export function generateCrashFingerprint(crash: CrashSilver): string {
  const parts = [
    crash.stateCode,
    crash.crashDate.toISOString().split('T')[0],
    crash.latitude?.toFixed(4) ?? 'null',
    crash.longitude?.toFixed(4) ?? 'null',
  ]
  return parts.join('|')
}

/**
 * Fingerprint-based deduplication for crash records.
 * hash(stateCode + crashDate + latitude.toFixed(4) + longitude.toFixed(4) + vehicleCount)
 */

import { createHash } from 'crypto'
import type { CrashSilver } from '../silver/schemas'

/**
 * Generate a fingerprint for deduplication.
 * Two crashes from different sources that match on these fields
 * are considered the same crash.
 */
export function generateCrashFingerprint(
  crash: CrashSilver,
  vehicleCount: number = 0,
): string {
  const parts = [
    crash.stateCode,
    crash.crashDate instanceof Date
      ? crash.crashDate.toISOString().split('T')[0]
      : String(crash.crashDate).split('T')[0],
    crash.latitude?.toFixed(4) ?? 'null',
    crash.longitude?.toFixed(4) ?? 'null',
    String(vehicleCount),
  ]
  return createHash('sha256').update(parts.join('|')).digest('hex').substring(0, 16)
}

/**
 * Check a batch of records for internal duplicates.
 * Returns indices of records to keep (first occurrence wins).
 */
export function deduplicateBatch(
  records: Array<{ crash: CrashSilver; vehicleCount: number }>,
): { keepIndices: number[]; dupIndices: number[] } {
  const seen = new Map<string, number>()
  const keepIndices: number[] = []
  const dupIndices: number[] = []

  for (let i = 0; i < records.length; i++) {
    const fp = generateCrashFingerprint(records[i].crash, records[i].vehicleCount)
    if (seen.has(fp)) {
      dupIndices.push(i)
    } else {
      seen.set(fp, i)
      keepIndices.push(i)
    }
  }

  return { keepIndices, dupIndices }
}

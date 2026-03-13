/**
 * FARS CrashAPI Adapter
 * Fetches fatal crash data from NHTSA's FARS API (public, no auth).
 * API: https://crashviewer.nhtsa.dot.gov/CrashAPI
 *
 * Flow:
 *   1. GetCaseList → list of ST_CASE numbers for state/year
 *   2. GetCaseDetails → full crash detail per case
 */

import { STATE_BY_CODE } from '@velora/shared'
import type { BronzeRecord } from '../types'

export interface FARSAdapterConfig {
  stateCode: string
  fromYear: number
  toYear: number
  batchSize: number  // concurrent fetches for details, default 5
  limit?: number     // max total records (for testing)
  rateLimitMs?: number // delay between batches, default 1000
}

const FARS_BASE = 'https://crashviewer.nhtsa.dot.gov/CrashAPI'

/** Chunk array into batches */
function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size))
  }
  return chunks
}

/** Sleep for rate limiting */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

interface FARSCaseListEntry {
  ST_CASE: number
  YEAR?: number
  CaseYear?: number
  STATE?: number
  TOTALVEHICLES?: number
  FATALS?: number
  CITY?: number
  COUNTY?: number
}

/**
 * Fetch case list from FARS for a given state and year range.
 * Returns array of case references.
 */
async function fetchCaseList(
  stateFips: string,
  fromYear: number,
  toYear: number,
): Promise<FARSCaseListEntry[]> {
  const url = `${FARS_BASE}/crashes/GetCaseList?states=${stateFips}&fromYear=${fromYear}&toYear=${toYear}&format=json`
  console.log(`[FARS] Fetching case list: state=${stateFips} years=${fromYear}-${toYear}`)

  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(30000),
  })

  if (!response.ok) {
    throw new Error(`FARS GetCaseList failed: ${response.status} ${response.statusText}`)
  }

  const data = await response.json() as { Results?: FARSCaseListEntry[][] }

  // FARS API returns Results as array of arrays
  if (!data.Results || !Array.isArray(data.Results)) {
    console.warn('[FARS] No Results array in response')
    return []
  }

  // Flatten results arrays
  const cases: FARSCaseListEntry[] = data.Results.flat()
  console.log(`[FARS] Got ${cases.length} cases`)
  return cases
}

/**
 * Fetch full case details from FARS for a single case.
 */
async function fetchCaseDetails(
  stCase: number,
  caseYear: number,
  stateFips: string,
): Promise<Record<string, unknown> | null> {
  const url = `${FARS_BASE}/crashes/GetCaseDetails?stateCase=${stCase}&caseYear=${caseYear}&state=${stateFips}&format=json`

  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(15000),
    })

    if (!response.ok) {
      console.warn(`[FARS] GetCaseDetails failed for ST_CASE=${stCase}: ${response.status}`)
      return null
    }

    const data = await response.json() as Record<string, unknown>
    return data
  } catch (error) {
    console.warn(`[FARS] Error fetching case ${stCase}:`, error instanceof Error ? error.message : error)
    return null
  }
}

/**
 * Async generator that yields BronzeRecord objects from FARS.
 * Rate-limited and batched to be kind to the FARS API.
 */
export async function* fetchFARSCrashes(config: FARSAdapterConfig): AsyncGenerator<BronzeRecord> {
  const state = STATE_BY_CODE[config.stateCode]
  if (!state) {
    throw new Error(`Unknown state code: ${config.stateCode}`)
  }

  const batchSize = config.batchSize || 5
  const rateLimitMs = config.rateLimitMs ?? 1000
  const limit = config.limit ?? Infinity

  // Step 1: Get case list
  const cases = await fetchCaseList(state.fips, config.fromYear, config.toYear)

  if (cases.length === 0) {
    console.log('[FARS] No cases found')
    return
  }

  // Limit cases if specified
  const limitedCases = cases.slice(0, limit)
  console.log(`[FARS] Processing ${limitedCases.length} cases (limit: ${limit === Infinity ? 'none' : limit})`)

  // Step 2: Fetch details in batches
  let yielded = 0
  const batches = chunk(limitedCases, batchSize)

  for (const batch of batches) {
    if (yielded >= limit) break

    const details = await Promise.all(
      batch.map(c => {
        const year = c.CaseYear ?? c.YEAR ?? config.fromYear
        return fetchCaseDetails(c.ST_CASE, year, state.fips)
      }),
    )

    for (let i = 0; i < details.length; i++) {
      if (yielded >= limit) break

      const detail = details[i]
      if (!detail) continue

      yield {
        source: 'fars',
        stateCode: config.stateCode,
        rawData: {
          ...detail,
          _caseRef: batch[i],
        },
        fetchedAt: new Date(),
      }
      yielded++
    }

    // Rate limit between batches
    if (rateLimitMs > 0 && batches.indexOf(batch) < batches.length - 1) {
      await sleep(rateLimitMs)
    }
  }

  console.log(`[FARS] Yielded ${yielded} records`)
}

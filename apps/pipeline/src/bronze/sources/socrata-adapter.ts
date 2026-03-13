/**
 * Socrata SODA API Adapter — Generic adapter for Socrata open data portals.
 * Supports pagination via $offset/$limit. Rate-limited.
 *
 * Socrata datasets used:
 *   - NYC: https://data.cityofnewyork.us/resource/h9gi-nx95.json
 *   - Chicago: https://data.cityofchicago.org/resource/85ca-t3if.json
 */

import type { BronzeRecord } from '../types'

export interface SocrataDatasetConfig {
  /** Short name for the dataset, e.g. "nyc", "chicago" */
  name: string
  /** State code for this dataset */
  stateCode: string
  /** Full domain, e.g. "data.cityofnewyork.us" */
  domain: string
  /** Dataset identifier, e.g. "h9gi-nx95" */
  datasetId: string
  /** Optional app token for higher rate limits */
  appToken?: string
  /** Max records per page (default 1000, max 50000) */
  pageSize?: number
  /** Optional SoQL $where clause */
  where?: string
  /** Max total records to fetch */
  limit?: number
  /** Rate limit between pages in ms */
  rateLimitMs?: number
}

/** Pre-configured Socrata datasets */
export const SOCRATA_DATASETS: SocrataDatasetConfig[] = [
  {
    name: 'nyc',
    stateCode: 'NY',
    domain: 'data.cityofnewyork.us',
    datasetId: 'h9gi-nx95',
    pageSize: 1000,
    rateLimitMs: 500,
  },
  {
    name: 'chicago',
    stateCode: 'IL',
    domain: 'data.cityofchicago.org',
    datasetId: '85ca-t3if',
    pageSize: 1000,
    rateLimitMs: 500,
  },
]

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Get a Socrata dataset config by name.
 */
export function getSocrataConfig(name: string): SocrataDatasetConfig | undefined {
  return SOCRATA_DATASETS.find(d => d.name === name)
}

/**
 * Async generator that yields BronzeRecord objects from a Socrata SODA API.
 * Handles pagination via $offset/$limit automatically.
 */
export async function* fetchSocrataCrashes(config: SocrataDatasetConfig): AsyncGenerator<BronzeRecord> {
  const {
    name,
    stateCode,
    domain,
    datasetId,
    appToken,
    pageSize = 1000,
    where,
    limit = Infinity,
    rateLimitMs = 500,
  } = config

  let offset = 0
  let totalYielded = 0
  let hasMore = true

  const baseUrl = `https://${domain}/resource/${datasetId}.json`

  console.log(`[Socrata] Starting fetch: dataset=${name} (${datasetId}) domain=${domain}`)

  while (hasMore && totalYielded < limit) {
    const recordCount = Math.min(pageSize, limit - totalYielded)

    const params = new URLSearchParams({
      $limit: String(recordCount),
      $offset: String(offset),
      $order: ':id',
    })

    if (where) {
      params.set('$where', where)
    }

    const url = `${baseUrl}?${params.toString()}`
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'User-Agent': 'Velora-Pipeline/1.0',
    }

    if (appToken) {
      headers['X-App-Token'] = appToken
    }

    console.log(`[Socrata] Fetching offset=${offset} limit=${recordCount}`)

    let records: Record<string, unknown>[]
    try {
      const response = await fetch(url, {
        headers,
        signal: AbortSignal.timeout(30000),
      })

      if (!response.ok) {
        const body = await response.text().catch(() => '')
        console.error(`[Socrata] HTTP ${response.status}: ${body.slice(0, 200)}`)
        break
      }

      records = await response.json() as Record<string, unknown>[]
    } catch (error) {
      console.error(`[Socrata] Error fetching offset=${offset}:`, error instanceof Error ? error.message : error)
      break
    }

    if (!Array.isArray(records) || records.length === 0) {
      console.log(`[Socrata] No more records at offset=${offset}`)
      break
    }

    for (const record of records) {
      if (totalYielded >= limit) break

      yield {
        source: `socrata-${name}`,
        stateCode,
        rawData: record,
        fetchedAt: new Date(),
      }
      totalYielded++
    }

    hasMore = records.length === recordCount
    offset += records.length

    if (hasMore && rateLimitMs > 0) {
      await sleep(rateLimitMs)
    }
  }

  console.log(`[Socrata] Yielded ${totalYielded} records for ${name}`)
}

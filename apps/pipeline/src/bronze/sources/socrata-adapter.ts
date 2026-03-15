/**
 * Socrata SODA API Adapter — Generic adapter for Socrata open data portals.
 * Supports pagination via $offset/$limit. Rate-limited.
 * Tracks cursor position so we only fetch NEW records each run.
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
  /** Max total records to fetch in this run */
  limit?: number
  /** Rate limit between pages in ms */
  rateLimitMs?: number
  /** Starting offset (for cursor-based resumption) */
  startOffset?: number
  /** Order field — defaults to ':id' */
  orderBy?: string
}

/** Pre-configured Socrata datasets */
export const SOCRATA_DATASETS: SocrataDatasetConfig[] = [
  // ── New York City — Motor Vehicle Collisions ──
  {
    name: 'nyc',
    stateCode: 'NY',
    domain: 'data.cityofnewyork.us',
    datasetId: 'h9gi-nx95',
    pageSize: 1000,
    rateLimitMs: 300,
  },
  // ── Chicago — Traffic Crashes ──
  {
    name: 'chicago',
    stateCode: 'IL',
    domain: 'data.cityofchicago.org',
    datasetId: '85ca-t3if',
    pageSize: 1000,
    rateLimitMs: 300,
  },
  // ── Denver / Colorado — Traffic Accidents ──
  {
    name: 'denver',
    stateCode: 'CO',
    domain: 'data.colorado.gov',
    datasetId: 'cpwf-cznk',
    pageSize: 1000,
    rateLimitMs: 300,
  },
  // ── Colorado Springs — Traffic Crashes ──
  {
    name: 'colorado-springs',
    stateCode: 'CO',
    domain: 'policedata.coloradosprings.gov',
    datasetId: 'bjpt-tkzq',
    pageSize: 1000,
    rateLimitMs: 300,
  },
  // ── Los Angeles — Traffic Collisions ──
  {
    name: 'los-angeles',
    stateCode: 'CA',
    domain: 'data.lacity.org',
    datasetId: 'd5tf-ez2w',
    pageSize: 1000,
    rateLimitMs: 300,
  },
  // ── San Francisco — Traffic Crashes ──
  {
    name: 'san-francisco',
    stateCode: 'CA',
    domain: 'data.sfgov.org',
    datasetId: 'ubvf-ztfx',
    pageSize: 1000,
    rateLimitMs: 300,
  },
  // ── Washington State — Crash Data ──
  {
    name: 'washington',
    stateCode: 'WA',
    domain: 'data.wa.gov',
    datasetId: 'qau6-fd9y',
    pageSize: 1000,
    rateLimitMs: 300,
  },
  // ── Colorado Statewide — Crash Reporting Incidents ──
  {
    name: 'colorado-statewide',
    stateCode: 'CO',
    domain: 'data.colorado.gov',
    datasetId: 'bhju-22kf',
    pageSize: 1000,
    rateLimitMs: 300,
  },
  // ── Austin, TX — Traffic Crashes ──
  {
    name: 'austin',
    stateCode: 'TX',
    domain: 'data.austintexas.gov',
    datasetId: 'y2wy-tgr5',
    pageSize: 1000,
    rateLimitMs: 300,
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
 * Supports startOffset for cursor-based resumption.
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
    rateLimitMs = 300,
    startOffset = 0,
    orderBy = ':id',
  } = config

  let offset = startOffset
  let totalYielded = 0
  let hasMore = true

  const baseUrl = `https://${domain}/resource/${datasetId}.json`

  console.log(`[Socrata] Starting fetch: dataset=${name} (${datasetId}) domain=${domain} startOffset=${startOffset}`)

  while (hasMore && totalYielded < limit) {
    const recordCount = Math.min(pageSize, limit - totalYielded)

    const params = new URLSearchParams({
      $limit: String(recordCount),
      $offset: String(offset),
      $order: orderBy,
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
      console.log(`[Socrata] No more records at offset=${offset} — dataset exhausted`)
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

  console.log(`[Socrata] Yielded ${totalYielded} records for ${name} (final offset: ${offset})`)
}

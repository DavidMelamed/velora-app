/**
 * Generic ArcGIS REST Feature Service Adapter.
 * Standard pagination via resultOffset.
 * Works with any state DOT ArcGIS endpoint.
 */

import type { BronzeRecord } from '../types'

export interface ArcGISAdapterConfig {
  stateCode: string
  endpoint: string          // e.g., "https://gis.penndot.pa.gov/arcgis/rest/services/..."
  layerId: number           // usually 0
  dateField: string         // varies: "CRASH_DATE", "date_of_crash", etc.
  batchSize: number         // max 2000 per ArcGIS
  fieldMapping: Record<string, string>  // source field → MMUCC field (optional hints)
  where?: string            // optional where clause filter
  limit?: number            // max total records
  rateLimitMs?: number      // delay between pages, default 500
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

interface ArcGISQueryResponse {
  features?: Array<{ attributes: Record<string, unknown>; geometry?: Record<string, unknown> }>
  exceededTransferLimit?: boolean
  error?: { code: number; message: string }
}

/**
 * Async generator that yields BronzeRecord objects from an ArcGIS Feature Service.
 * Handles pagination via resultOffset automatically.
 */
export async function* fetchArcGISCrashes(config: ArcGISAdapterConfig): AsyncGenerator<BronzeRecord> {
  const {
    stateCode,
    endpoint,
    layerId,
    batchSize,
    limit = Infinity,
    rateLimitMs = 500,
    where = '1=1',
  } = config

  let offset = 0
  let totalYielded = 0
  let hasMore = true

  console.log(`[ArcGIS] Starting fetch: state=${stateCode} endpoint=${endpoint} layerId=${layerId}`)

  while (hasMore && totalYielded < limit) {
    const recordCount = Math.min(batchSize, limit - totalYielded)
    const url = `${endpoint}/${layerId}/query?` +
      `where=${encodeURIComponent(where)}` +
      `&outFields=*` +
      `&resultOffset=${offset}` +
      `&resultRecordCount=${recordCount}` +
      `&f=json` +
      `&returnGeometry=true`

    console.log(`[ArcGIS] Fetching offset=${offset} count=${recordCount}`)

    let data: ArcGISQueryResponse
    try {
      const response = await fetch(url, {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'Velora-Pipeline/1.0',
        },
        signal: AbortSignal.timeout(30000),
      })

      if (!response.ok) {
        throw new Error(`ArcGIS query failed: ${response.status} ${response.statusText}`)
      }

      data = await response.json() as ArcGISQueryResponse
    } catch (error) {
      console.error(`[ArcGIS] Error fetching offset=${offset}:`, error instanceof Error ? error.message : error)
      break
    }

    if (data.error) {
      console.error(`[ArcGIS] API error: ${data.error.code} — ${data.error.message}`)
      break
    }

    const features = data.features ?? []
    if (features.length === 0) {
      console.log(`[ArcGIS] No more features at offset=${offset}`)
      break
    }

    for (const feature of features) {
      if (totalYielded >= limit) break

      // Merge geometry into attributes if present
      const rawData: Record<string, unknown> = { ...feature.attributes }
      if (feature.geometry) {
        rawData._geometry = feature.geometry
      }

      yield {
        source: `arcgis-${stateCode.toLowerCase()}`,
        stateCode,
        rawData,
        fetchedAt: new Date(),
      }
      totalYielded++
    }

    // Check if there are more results
    hasMore = data.exceededTransferLimit === true || features.length === batchSize
    offset += features.length

    // Rate limit between pages
    if (hasMore && rateLimitMs > 0) {
      await sleep(rateLimitMs)
    }
  }

  console.log(`[ArcGIS] Yielded ${totalYielded} records for ${stateCode}`)
}

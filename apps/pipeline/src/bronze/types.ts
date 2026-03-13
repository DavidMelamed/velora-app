/**
 * Bronze stage types — raw, untouched source data.
 * Append-only. Immutable. Never modify raw data.
 */

export interface BronzeRecord {
  source: string // "fars", "arcgis-co", "socrata-nyc"
  stateCode: string // 2-letter state code
  rawData: Record<string, unknown> // Untouched source data
  fetchedAt: Date
}

export interface BronzeBatch {
  source: string
  stateCode: string
  records: BronzeRecord[]
  fetchedAt: Date
  totalFetched: number
}

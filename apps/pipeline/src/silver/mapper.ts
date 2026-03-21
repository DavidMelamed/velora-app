/**
 * Silver stage mapper — takes BronzeRecord, applies source-specific
 * field mapping, validates through Zod, returns typed Silver record
 * or sends to dead letter queue.
 */

import { CrashSilverSchema, VehicleSilverSchema, PersonSilverSchema } from './schemas'
import type { CrashSilver, VehicleSilver, PersonSilver } from './schemas'
import type { BronzeRecord } from '../bronze/types'
import { parseFARSRecord } from './parsers/fars-parser'
import type { FARSParsedResult } from './parsers/fars-parser'
import { parseArcGISRecord } from './parsers/arcgis-parser'
import type { ArcGISParsedResult } from './parsers/arcgis-parser'
import { parseSocrataRecord } from './parsers/socrata-parser'
import type { SocrataParsedResult } from './parsers/socrata-parser'
import { getArcGISConfig } from '../config/arcgis-states'
import type { DeadLetterEntry } from './dead-letter'

export interface SilverMappedResult {
  crash: CrashSilver
  vehicles: VehicleSilver[]
  persons: PersonSilver[]
}

export interface MapperResult {
  success: SilverMappedResult[]
  deadLetters: DeadLetterEntry[]
  metrics: {
    total: number
    passed: number
    failed: number
    durationMs: number
  }
}

/**
 * Map a batch of BronzeRecords through the Silver pipeline.
 * Records that fail validation go to the dead letter queue.
 */
export function mapBronzeToSilver(records: BronzeRecord[]): MapperResult {
  const startTime = Date.now()
  const success: SilverMappedResult[] = []
  const deadLetters: DeadLetterEntry[] = []

  for (const bronze of records) {
    try {
      // Source-specific parsing
      let parsed: FARSParsedResult | ArcGISParsedResult | SocrataParsedResult | null = null

      if (bronze.source === 'fars') {
        parsed = parseFARSRecord(bronze)
      } else if (bronze.source.startsWith('socrata')) {
        parsed = parseSocrataRecord(bronze)
        if (!parsed) {
          deadLetters.push({
            rawRecord: bronze.rawData,
            source: bronze.source,
            stateCode: bronze.stateCode,
            error: `Socrata parser returned null for source ${bronze.source}`,
            errorType: 'MAPPING',
            stage: 'SILVER',
          })
          continue
        }
      } else if (bronze.source.startsWith('arcgis')) {
        const stateCode = bronze.stateCode
        const config = getArcGISConfig(stateCode)
        if (config) {
          parsed = parseArcGISRecord(bronze, config)
        } else {
          deadLetters.push({
            rawRecord: bronze.rawData,
            source: bronze.source,
            stateCode: bronze.stateCode,
            error: `No ArcGIS config found for state ${stateCode}`,
            errorType: 'MAPPING',
            stage: 'SILVER',
          })
          continue
        }
      } else {
        deadLetters.push({
          rawRecord: bronze.rawData,
          source: bronze.source,
          stateCode: bronze.stateCode,
          error: `Unknown source type: ${bronze.source}`,
          errorType: 'MAPPING',
          stage: 'SILVER',
        })
        continue
      }

      if (!parsed) {
        deadLetters.push({
          rawRecord: bronze.rawData,
          source: bronze.source,
          stateCode: bronze.stateCode,
          error: 'Parser returned null — could not extract crash data from raw record',
          errorType: 'MAPPING',
          stage: 'SILVER',
        })
        continue
      }

      // Validate crash through Zod
      const crashResult = CrashSilverSchema.safeParse(parsed.crash)
      if (!crashResult.success) {
        deadLetters.push({
          rawRecord: bronze.rawData,
          source: bronze.source,
          stateCode: bronze.stateCode,
          error: `Crash validation failed: ${crashResult.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ')}`,
          errorType: 'VALIDATION',
          stage: 'SILVER',
        })
        continue
      }

      // Validate vehicles
      const validVehicles: VehicleSilver[] = []
      for (const v of parsed.vehicles) {
        const vResult = VehicleSilverSchema.safeParse(v)
        if (vResult.success) {
          validVehicles.push(vResult.data)
        }
        // Silently skip invalid vehicles (don't dead letter the whole crash)
      }

      // Validate persons
      const validPersons: PersonSilver[] = []
      for (const p of parsed.persons) {
        const pResult = PersonSilverSchema.safeParse(p)
        if (pResult.success) {
          validPersons.push(pResult.data)
        }
      }

      success.push({
        crash: crashResult.data,
        vehicles: validVehicles,
        persons: validPersons,
      })
    } catch (error) {
      deadLetters.push({
        rawRecord: bronze.rawData,
        source: bronze.source,
        stateCode: bronze.stateCode,
        error: `Unexpected error: ${error instanceof Error ? error.message : String(error)}`,
        errorType: 'UNKNOWN',
        stage: 'SILVER',
      })
    }
  }

  return {
    success,
    deadLetters,
    metrics: {
      total: records.length,
      passed: success.length,
      failed: deadLetters.length,
      durationMs: Date.now() - startTime,
    },
  }
}

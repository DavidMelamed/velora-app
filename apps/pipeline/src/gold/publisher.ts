/**
 * Gold stage publisher — upserts validated Silver records into Prisma.
 * Handles crash, vehicle, driver, and person creation.
 * Idempotent via stateUniqueId upsert.
 */

import { prisma, Prisma } from '@velora/db'
import type { CrashSilver, VehicleSilver, PersonSilver } from '../silver/schemas'
import { generateCrashFingerprint } from './dedup'

type JsonValue = Prisma.InputJsonValue

export interface PublishResult {
  created: number
  updated: number
  skipped: number
  errors: Array<{ stateUniqueId: string; error: string }>
}

export interface PublishableRecord {
  crash: CrashSilver
  vehicles: VehicleSilver[]
  persons: PersonSilver[]
  rawData?: Record<string, unknown>
}

/**
 * Publish validated Silver records to the Gold (Prisma) database.
 * Uses upsert on stateUniqueId for idempotency.
 */
export async function publishToGold(records: PublishableRecord[]): Promise<PublishResult> {
  const result: PublishResult = {
    created: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  }

  for (const record of records) {
    try {
      const { crash, vehicles, persons, rawData } = record

      // Upsert the crash record
      const existing = await prisma.crash.findUnique({
        where: { stateUniqueId: crash.stateUniqueId },
      })

      if (existing) {
        // Update existing record
        await prisma.crash.update({
          where: { stateUniqueId: crash.stateUniqueId },
          data: {
            crashDate: crash.crashDate,
            crashTime: crash.crashTime,
            county: crash.county,
            cityName: crash.cityName,
            latitude: crash.latitude,
            longitude: crash.longitude,
            mannerOfCollision: crash.mannerOfCollision,
            atmosphericCondition: crash.atmosphericCondition,
            lightCondition: crash.lightCondition,
            crashSeverity: crash.crashSeverity,
            stateCode: crash.stateCode,
            dataSource: crash.dataSource,
            rawData: (rawData as JsonValue) ?? undefined,
          },
        })
        result.updated++
      } else {
        // Create new crash with related records
        await prisma.crash.create({
          data: {
            stateUniqueId: crash.stateUniqueId,
            crashDate: crash.crashDate,
            crashTime: crash.crashTime,
            county: crash.county,
            cityName: crash.cityName,
            latitude: crash.latitude,
            longitude: crash.longitude,
            mannerOfCollision: crash.mannerOfCollision,
            atmosphericCondition: crash.atmosphericCondition,
            lightCondition: crash.lightCondition,
            crashSeverity: crash.crashSeverity,
            stateCode: crash.stateCode,
            dataSource: crash.dataSource,
            rawData: (rawData as JsonValue) ?? undefined,
            // Create vehicles
            vehicles: {
              create: vehicles.map(v => ({
                make: v.make,
                modelYear: v.modelYear,
                model: v.model,
                bodyType: v.bodyType,
                speedLimit: v.speedLimit,
                hitAndRun: v.hitAndRun,
              })),
            },
          },
        })

        // Create persons linked to the crash
        if (persons.length > 0) {
          const createdCrash = await prisma.crash.findUnique({
            where: { stateUniqueId: crash.stateUniqueId },
            select: { id: true },
          })

          if (createdCrash) {
            await prisma.person.createMany({
              data: persons.map(p => ({
                crashId: createdCrash.id,
                personType: p.personType,
                injuryStatus: p.injuryStatus,
                sex: p.sex,
                seatingPosition: p.seatingPosition,
              })),
            })
          }
        }

        result.created++
      }
    } catch (error) {
      result.errors.push({
        stateUniqueId: record.crash.stateUniqueId,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  console.log(
    `[Gold Publisher] Created: ${result.created}, Updated: ${result.updated}, ` +
    `Skipped: ${result.skipped}, Errors: ${result.errors.length}`,
  )

  return result
}

export { generateCrashFingerprint }

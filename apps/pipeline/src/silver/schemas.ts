import { z } from 'zod'

/**
 * Silver stage Zod schemas — validated, MMUCC-mapped records.
 * These schemas enforce type safety at the pipeline boundary.
 */

export const CrashSilverSchema = z.object({
  stateUniqueId: z.string().min(1),
  crashDate: z.coerce.date(),
  crashTime: z.string().optional(),
  county: z.string().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  mannerOfCollision: z
    .enum([
      'NOT_COLLISION_WITH_MV',
      'FRONT_TO_REAR',
      'FRONT_TO_FRONT',
      'ANGLE',
      'SIDESWIPE_SAME_DIRECTION',
      'SIDESWIPE_OPPOSITE_DIRECTION',
      'REAR_TO_SIDE',
      'REAR_TO_REAR',
      'OTHER',
      'UNKNOWN',
    ])
    .optional(),
  atmosphericCondition: z
    .enum([
      'CLEAR',
      'CLOUDY',
      'RAIN',
      'SNOW',
      'SLEET_HAIL_FREEZING_RAIN',
      'FOG_SMOG_SMOKE',
      'BLOWING_SNOW',
      'BLOWING_SAND_SOIL_DIRT',
      'SEVERE_CROSSWINDS',
      'OTHER',
      'UNKNOWN',
    ])
    .optional(),
  lightCondition: z
    .enum(['DAYLIGHT', 'DAWN', 'DUSK', 'DARK_LIGHTED', 'DARK_NOT_LIGHTED', 'DARK_UNKNOWN_LIGHTING', 'OTHER', 'UNKNOWN'])
    .optional(),
  crashSeverity: z
    .enum(['FATAL', 'SUSPECTED_SERIOUS_INJURY', 'SUSPECTED_MINOR_INJURY', 'POSSIBLE_INJURY', 'PROPERTY_DAMAGE_ONLY'])
    .optional(),
  stateCode: z.string().length(2),
  dataSource: z.string(),
  cityName: z.string().optional(),
})

export const VehicleSilverSchema = z.object({
  vin: z.string().optional(),
  make: z.string().optional(),
  modelYear: z.number().int().min(1900).max(2030).optional(),
  model: z.string().optional(),
  bodyType: z
    .enum([
      'PASSENGER_CAR',
      'SUV',
      'PICKUP',
      'VAN',
      'LIGHT_TRUCK',
      'MEDIUM_HEAVY_TRUCK',
      'TRUCK_TRACTOR',
      'MOTOR_HOME',
      'BUS_SMALL',
      'BUS_LARGE',
      'MOTORCYCLE',
      'MOPED',
      'ATV',
      'SNOWMOBILE',
      'OTHER',
      'UNKNOWN',
    ])
    .optional(),
  speedLimit: z.number().int().min(0).max(100).optional(),
  hitAndRun: z.boolean().default(false),
})

export const PersonSilverSchema = z.object({
  personType: z.enum(['DRIVER', 'PASSENGER', 'PEDESTRIAN', 'PEDALCYCLIST', 'OCCUPANT_OF_NON_MV', 'OTHER', 'UNKNOWN']),
  injuryStatus: z.enum(['FATAL', 'SUSPECTED_SERIOUS', 'SUSPECTED_MINOR', 'POSSIBLE', 'NO_APPARENT_INJURY']).optional(),
  sex: z.enum(['MALE', 'FEMALE', 'NOT_REPORTED', 'UNKNOWN']).optional(),
  seatingPosition: z.string().optional(),
})

export type CrashSilver = z.infer<typeof CrashSilverSchema>
export type VehicleSilver = z.infer<typeof VehicleSilverSchema>
export type PersonSilver = z.infer<typeof PersonSilverSchema>

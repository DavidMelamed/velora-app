// MMUCC 6th Edition aligned enums — mirrors Prisma schema enums

export const CrashSeverity = {
  FATAL: 'FATAL',
  SUSPECTED_SERIOUS_INJURY: 'SUSPECTED_SERIOUS_INJURY',
  SUSPECTED_MINOR_INJURY: 'SUSPECTED_MINOR_INJURY',
  POSSIBLE_INJURY: 'POSSIBLE_INJURY',
  PROPERTY_DAMAGE_ONLY: 'PROPERTY_DAMAGE_ONLY',
} as const;
export type CrashSeverity = (typeof CrashSeverity)[keyof typeof CrashSeverity];

export const InjuryStatus = {
  FATAL: 'FATAL',
  SUSPECTED_SERIOUS: 'SUSPECTED_SERIOUS',
  SUSPECTED_MINOR: 'SUSPECTED_MINOR',
  POSSIBLE: 'POSSIBLE',
  NO_APPARENT_INJURY: 'NO_APPARENT_INJURY',
} as const;
export type InjuryStatus = (typeof InjuryStatus)[keyof typeof InjuryStatus];

export const MannerOfCollision = {
  NOT_COLLISION_WITH_MV: 'NOT_COLLISION_WITH_MV',
  FRONT_TO_REAR: 'FRONT_TO_REAR',
  FRONT_TO_FRONT: 'FRONT_TO_FRONT',
  ANGLE: 'ANGLE',
  SIDESWIPE_SAME_DIRECTION: 'SIDESWIPE_SAME_DIRECTION',
  SIDESWIPE_OPPOSITE_DIRECTION: 'SIDESWIPE_OPPOSITE_DIRECTION',
  REAR_TO_SIDE: 'REAR_TO_SIDE',
  REAR_TO_REAR: 'REAR_TO_REAR',
  OTHER: 'OTHER',
  UNKNOWN: 'UNKNOWN',
} as const;
export type MannerOfCollision = (typeof MannerOfCollision)[keyof typeof MannerOfCollision];

export const AtmosphericCondition = {
  CLEAR: 'CLEAR',
  CLOUDY: 'CLOUDY',
  RAIN: 'RAIN',
  SNOW: 'SNOW',
  SLEET_HAIL_FREEZING_RAIN: 'SLEET_HAIL_FREEZING_RAIN',
  FOG_SMOG_SMOKE: 'FOG_SMOG_SMOKE',
  BLOWING_SNOW: 'BLOWING_SNOW',
  BLOWING_SAND_SOIL_DIRT: 'BLOWING_SAND_SOIL_DIRT',
  SEVERE_CROSSWINDS: 'SEVERE_CROSSWINDS',
  OTHER: 'OTHER',
  UNKNOWN: 'UNKNOWN',
} as const;
export type AtmosphericCondition = (typeof AtmosphericCondition)[keyof typeof AtmosphericCondition];

export const LightCondition = {
  DAYLIGHT: 'DAYLIGHT',
  DAWN: 'DAWN',
  DUSK: 'DUSK',
  DARK_LIGHTED: 'DARK_LIGHTED',
  DARK_NOT_LIGHTED: 'DARK_NOT_LIGHTED',
  DARK_UNKNOWN_LIGHTING: 'DARK_UNKNOWN_LIGHTING',
  OTHER: 'OTHER',
  UNKNOWN: 'UNKNOWN',
} as const;
export type LightCondition = (typeof LightCondition)[keyof typeof LightCondition];

export const PersonType = {
  DRIVER: 'DRIVER',
  PASSENGER: 'PASSENGER',
  PEDESTRIAN: 'PEDESTRIAN',
  PEDALCYCLIST: 'PEDALCYCLIST',
  OCCUPANT_OF_NON_MV: 'OCCUPANT_OF_NON_MV',
  OTHER: 'OTHER',
  UNKNOWN: 'UNKNOWN',
} as const;
export type PersonType = (typeof PersonType)[keyof typeof PersonType];

export const Sex = {
  MALE: 'MALE',
  FEMALE: 'FEMALE',
  NOT_REPORTED: 'NOT_REPORTED',
  UNKNOWN: 'UNKNOWN',
} as const;
export type Sex = (typeof Sex)[keyof typeof Sex];

export const BodyTypeCategory = {
  PASSENGER_CAR: 'PASSENGER_CAR',
  SUV: 'SUV',
  PICKUP: 'PICKUP',
  VAN: 'VAN',
  LIGHT_TRUCK: 'LIGHT_TRUCK',
  MEDIUM_HEAVY_TRUCK: 'MEDIUM_HEAVY_TRUCK',
  TRUCK_TRACTOR: 'TRUCK_TRACTOR',
  MOTOR_HOME: 'MOTOR_HOME',
  BUS_SMALL: 'BUS_SMALL',
  BUS_LARGE: 'BUS_LARGE',
  MOTORCYCLE: 'MOTORCYCLE',
  MOPED: 'MOPED',
  ATV: 'ATV',
  SNOWMOBILE: 'SNOWMOBILE',
  OTHER: 'OTHER',
  UNKNOWN: 'UNKNOWN',
} as const;
export type BodyTypeCategory = (typeof BodyTypeCategory)[keyof typeof BodyTypeCategory];

export const GeoEntityType = {
  STATE: 'STATE',
  COUNTY: 'COUNTY',
  CITY: 'CITY',
  TRACT: 'TRACT',
} as const;
export type GeoEntityType = (typeof GeoEntityType)[keyof typeof GeoEntityType];

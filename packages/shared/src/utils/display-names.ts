/**
 * Human-readable display names for enum values.
 * Converts SCREAMING_SNAKE_CASE and snake_case to Title Case,
 * with overrides for domain-specific terms.
 */

const OVERRIDES: Record<string, string> = {
  // Collision types
  NOT_COLLISION_WITH_MV: 'Not a Collision with Motor Vehicle',
  FRONT_TO_REAR: 'Rear-End Collision',
  FRONT_TO_FRONT: 'Head-On Collision',
  SIDESWIPE_SAME_DIRECTION: 'Sideswipe (Same Direction)',
  SIDESWIPE_OPPOSITE_DIRECTION: 'Sideswipe (Opposite Direction)',
  REAR_TO_SIDE: 'Rear-to-Side',
  REAR_TO_REAR: 'Rear-to-Rear',

  // Severity
  FATAL: 'Fatal',
  SUSPECTED_SERIOUS_INJURY: 'Serious Injury',
  SUSPECTED_MINOR_INJURY: 'Minor Injury',
  POSSIBLE_INJURY: 'Possible Injury',
  PROPERTY_DAMAGE_ONLY: 'Property Damage Only',
  NO_APPARENT_INJURY: 'No Apparent Injury',
  SUSPECTED_SERIOUS: 'Serious Injury',
  SUSPECTED_MINOR: 'Minor Injury',

  // Practice areas
  personal_injury: 'Personal Injury',
  car_accident: 'Car Accident',
  truck_accident: 'Truck Accident',
  motorcycle_accident: 'Motorcycle Accident',
  wrongful_death: 'Wrongful Death',
  medical_malpractice: 'Medical Malpractice',
  workers_compensation: "Workers' Compensation",
  slip_and_fall: 'Slip and Fall',
  product_liability: 'Product Liability',

  // Person types
  PEDALCYCLIST: 'Cyclist',
  OCCUPANT_OF_NON_MV: 'Non-Motorist Occupant',

  // Body types
  PASSENGER_CAR: 'Passenger Car',
  LIGHT_TRUCK: 'Light Truck',
  MEDIUM_HEAVY_TRUCK: 'Medium/Heavy Truck',
  TRUCK_TRACTOR: 'Truck Tractor',
  MOTOR_HOME: 'Motor Home',
  BUS_SMALL: 'Small Bus',
  BUS_LARGE: 'Large Bus',

  // Atmospheric
  SLEET_HAIL_FREEZING_RAIN: 'Sleet/Hail/Freezing Rain',
  FOG_SMOG_SMOKE: 'Fog/Smog/Smoke',
  BLOWING_SAND_SOIL_DIRT: 'Blowing Sand/Soil/Dirt',
  SEVERE_CROSSWINDS: 'Severe Crosswinds',
  BLOWING_SNOW: 'Blowing Snow',

  // Light
  DARK_LIGHTED: 'Dark (Lighted)',
  DARK_NOT_LIGHTED: 'Dark (Not Lighted)',
  DARK_UNKNOWN_LIGHTING: 'Dark (Unknown Lighting)',

  // Geo
  TRACT: 'Census Tract',

  // Matter status
  INTAKE: 'Intake',
  ACTIVE: 'Active',
  TREATING: 'Treating',
  DEMAND_PREP: 'Demand Preparation',
  LITIGATION: 'Litigation',
  SETTLED: 'Settled',
  CLOSED: 'Closed',
}

/**
 * Convert an enum value to a human-readable display name.
 * Checks overrides first, then falls back to title-casing the value.
 */
export function displayName(value: string | null | undefined): string {
  if (!value) return ''
  if (OVERRIDES[value]) return OVERRIDES[value]

  // Convert SCREAMING_SNAKE_CASE or snake_case to Title Case
  return value
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

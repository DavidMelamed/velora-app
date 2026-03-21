import { prisma } from '@velora/db'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { kmeans } = require('ml-kmeans') as { kmeans: (data: number[][], k: number, options?: Record<string, unknown>) => { clusters: number[]; centroids: { centroid: number[] }[] } }
import { generateText } from 'ai'
import { getModel } from '@velora/ai'
import {
  MannerOfCollision,
  CrashSeverity,
  AtmosphericCondition,
  LightCondition,
} from '@velora/shared'

// ─── 9-Dimension Feature Vector ───

export interface CrashFeatureVector {
  crashId: string
  features: number[] // 9 dimensions, each 0-1 normalized
}

export interface CrashArchetypeResult {
  id: string
  name: string
  stateCode: string | null
  centroid: number[]
  crashCount: number
  avgSeverity: number
  injuryRate: number
  fatalityRate: number
  seasonalPattern: Record<string, number>
  definingAttributes: Record<string, string>
}

// Ordinal mappings for categorical fields

const MANNER_OF_COLLISION_ORDINAL: Record<string, number> = {
  [MannerOfCollision.NOT_COLLISION_WITH_MV]: 0,
  [MannerOfCollision.FRONT_TO_REAR]: 1,
  [MannerOfCollision.FRONT_TO_FRONT]: 2,
  [MannerOfCollision.ANGLE]: 3,
  [MannerOfCollision.SIDESWIPE_SAME_DIRECTION]: 4,
  [MannerOfCollision.SIDESWIPE_OPPOSITE_DIRECTION]: 5,
  [MannerOfCollision.REAR_TO_SIDE]: 6,
  [MannerOfCollision.REAR_TO_REAR]: 7,
  [MannerOfCollision.OTHER]: 8,
  [MannerOfCollision.UNKNOWN]: 9,
}

const SEVERITY_ORDINAL: Record<string, number> = {
  [CrashSeverity.PROPERTY_DAMAGE_ONLY]: 0,
  [CrashSeverity.POSSIBLE_INJURY]: 1,
  [CrashSeverity.SUSPECTED_MINOR_INJURY]: 2,
  [CrashSeverity.SUSPECTED_SERIOUS_INJURY]: 3,
  [CrashSeverity.FATAL]: 4,
}

const WEATHER_ORDINAL: Record<string, number> = {
  [AtmosphericCondition.CLEAR]: 0,
  [AtmosphericCondition.CLOUDY]: 1,
  [AtmosphericCondition.RAIN]: 2,
  [AtmosphericCondition.SNOW]: 3,
  [AtmosphericCondition.SLEET_HAIL_FREEZING_RAIN]: 4,
  [AtmosphericCondition.FOG_SMOG_SMOKE]: 5,
  [AtmosphericCondition.BLOWING_SNOW]: 6,
  [AtmosphericCondition.BLOWING_SAND_SOIL_DIRT]: 7,
  [AtmosphericCondition.SEVERE_CROSSWINDS]: 8,
  [AtmosphericCondition.OTHER]: 9,
  [AtmosphericCondition.UNKNOWN]: 10,
}

const LIGHT_ORDINAL: Record<string, number> = {
  [LightCondition.DAYLIGHT]: 0,
  [LightCondition.DAWN]: 1,
  [LightCondition.DUSK]: 2,
  [LightCondition.DARK_LIGHTED]: 3,
  [LightCondition.DARK_NOT_LIGHTED]: 4,
  [LightCondition.DARK_UNKNOWN_LIGHTING]: 5,
  [LightCondition.OTHER]: 6,
  [LightCondition.UNKNOWN]: 7,
}

// Road surface mapping (not in schema directly, derived from rawData)
const ROAD_SURFACE_MAP: Record<string, number> = {
  dry: 0,
  wet: 1,
  icy: 2,
  snow: 3,
}

// Intersection type ordinal
const INTERSECTION_TYPE_MAP: Record<string, number> = {
  'not_intersection': 0,
  'four_way': 1,
  'four-way': 1,
  't_intersection': 2,
  't-intersection': 2,
  'y_intersection': 3,
  'y-intersection': 3,
  'roundabout': 4,
  'traffic_circle': 4,
  'five_point_or_more': 5,
  'other': 6,
}

// ─── Feature Extraction ───

interface CrashRow {
  id: string
  mannerOfCollision: string | null
  crashSeverity: string | null
  crashDate: Date
  atmosphericCondition: string | null
  lightCondition: string | null
  intersectionType: string | null
  rawData: unknown
  _count: { vehicles: number }
}

/**
 * Extract raw (unnormalized) feature vector from a crash record.
 * Returns [crashType, severity, hourOfDay, dayOfWeek, weatherCode, lightCondition, roadSurface, vehicleCount, intersectionType]
 */
function extractRawFeatures(crash: CrashRow): number[] {
  const crashType = MANNER_OF_COLLISION_ORDINAL[crash.mannerOfCollision ?? ''] ?? 9
  const severity = SEVERITY_ORDINAL[crash.crashSeverity ?? ''] ?? 0
  const hourOfDay = crash.crashDate.getHours()
  const dayOfWeek = crash.crashDate.getDay()
  const weatherCode = WEATHER_ORDINAL[crash.atmosphericCondition ?? ''] ?? 10
  const lightCond = LIGHT_ORDINAL[crash.lightCondition ?? ''] ?? 7

  // Road surface: try to extract from rawData
  let roadSurface = 0
  if (crash.rawData && typeof crash.rawData === 'object') {
    const raw = crash.rawData as Record<string, unknown>
    const surfaceStr = String(raw.roadSurface ?? raw.road_surface ?? raw.surfaceCondition ?? 'dry').toLowerCase()
    roadSurface = ROAD_SURFACE_MAP[surfaceStr] ?? 0
  }

  const vehicleCount = crash._count.vehicles
  const intersectionOrd = INTERSECTION_TYPE_MAP[
    (crash.intersectionType ?? 'not_intersection').toLowerCase().replace(/\s+/g, '_')
  ] ?? 0

  return [crashType, severity, hourOfDay, dayOfWeek, weatherCode, lightCond, roadSurface, vehicleCount, intersectionOrd]
}

/**
 * Normalize feature vectors to 0-1 range using min-max normalization.
 */
function normalizeFeatures(vectors: number[][]): number[][] {
  if (vectors.length === 0) return []

  const numDims = vectors[0].length
  const mins = new Array(numDims).fill(Infinity)
  const maxs = new Array(numDims).fill(-Infinity)

  for (const vec of vectors) {
    for (let d = 0; d < numDims; d++) {
      if (vec[d] < mins[d]) mins[d] = vec[d]
      if (vec[d] > maxs[d]) maxs[d] = vec[d]
    }
  }

  return vectors.map((vec) =>
    vec.map((val, d) => {
      const range = maxs[d] - mins[d]
      return range === 0 ? 0 : (val - mins[d]) / range
    })
  )
}

// ─── Archetype Naming ───

const DIMENSION_NAMES = [
  'crashType',
  'severity',
  'hourOfDay',
  'dayOfWeek',
  'weatherCode',
  'lightCondition',
  'roadSurface',
  'vehicleCount',
  'intersectionType',
]

function centroidToAttributes(centroid: number[]): Record<string, string> {
  const attrs: Record<string, string> = {}

  // Reverse-map centroids to human-readable attributes
  const severityNames = ['Property Damage Only', 'Possible Injury', 'Minor Injury', 'Serious Injury', 'Fatal']
  const severityIdx = Math.round(centroid[1] * 4)
  attrs.severity = severityNames[severityIdx] ?? 'Unknown'

  const hour = Math.round(centroid[2] * 23)
  if (hour >= 6 && hour < 12) attrs.timeOfDay = 'Morning'
  else if (hour >= 12 && hour < 17) attrs.timeOfDay = 'Afternoon'
  else if (hour >= 17 && hour < 21) attrs.timeOfDay = 'Evening'
  else attrs.timeOfDay = 'Night'

  const dayIdx = Math.round(centroid[3] * 6)
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  attrs.dayOfWeek = dayNames[dayIdx] ?? 'Unknown'

  const weatherIdx = Math.round(centroid[4] * 10)
  if (weatherIdx <= 1) attrs.weather = 'Clear/Cloudy'
  else if (weatherIdx === 2) attrs.weather = 'Rain'
  else if (weatherIdx >= 3 && weatherIdx <= 6) attrs.weather = 'Winter Weather'
  else attrs.weather = 'Adverse'

  const lightIdx = Math.round(centroid[5] * 7)
  if (lightIdx === 0) attrs.lighting = 'Daylight'
  else if (lightIdx <= 2) attrs.lighting = 'Twilight'
  else attrs.lighting = 'Dark'

  return attrs
}

/**
 * Generate a descriptive name for a crash archetype from its centroid using AI.
 * Falls back to attribute-based naming if AI is unavailable.
 */
async function nameArchetype(centroid: number[], clusterIndex: number): Promise<string> {
  const attrs = centroidToAttributes(centroid)

  try {
    const model = getModel('budget')
    const { text } = await generateText({
      model,
      prompt: `Generate a short descriptive name (3-5 words) for this crash archetype based on these attributes:
${JSON.stringify(attrs)}
Return ONLY the name, nothing else.`,
      maxTokens: 30,
      temperature: 0.3,
    })
    return text.trim().replace(/['"]/g, '') || `Archetype ${clusterIndex + 1}`
  } catch {
    // Fallback: generate name from attributes
    return `${attrs.timeOfDay} ${attrs.weather} ${attrs.severity}`.trim() || `Archetype ${clusterIndex + 1}`
  }
}

// ─── Main Clustering Function ───

/**
 * Cluster all crashes into archetypes using k-means on 9-dimension feature vectors.
 */
export async function clusterCrashArchetypes(
  stateCode?: string,
  k: number = 25
): Promise<CrashArchetypeResult[]> {
  // 1. Fetch crashes with vehicle counts
  const where = stateCode ? { stateCode } : {}
  const crashes = await prisma.crash.findMany({
    where,
    select: {
      id: true,
      mannerOfCollision: true,
      crashSeverity: true,
      crashDate: true,
      atmosphericCondition: true,
      lightCondition: true,
      intersectionType: true,
      rawData: true,
      _count: { select: { vehicles: true } },
    },
  })

  if (crashes.length < k) {
    console.warn(`[Archetype] Only ${crashes.length} crashes found, adjusting k from ${k} to ${Math.max(1, Math.floor(crashes.length / 3))}`)
    k = Math.max(1, Math.floor(crashes.length / 3))
  }

  if (crashes.length === 0) {
    return []
  }

  // 2. Extract feature vectors
  const crashIds: string[] = []
  const rawVectors: number[][] = []

  for (const crash of crashes) {
    crashIds.push(crash.id)
    rawVectors.push(extractRawFeatures(crash as CrashRow))
  }

  // 3. Normalize to 0-1 range
  const normalizedVectors = normalizeFeatures(rawVectors)

  // 4. Run k-means
  const result = kmeans(normalizedVectors, k, {
    maxIterations: 100,
    tolerance: 1e-4,
  })

  // 5. Build archetype data from clusters
  const archetypes: CrashArchetypeResult[] = []

  for (let clusterIdx = 0; clusterIdx < k; clusterIdx++) {
    // Find crash indices in this cluster
    const memberIndices = result.clusters
      .map((c: number, i: number) => (c === clusterIdx ? i : -1))
      .filter((i: number) => i !== -1)

    if (memberIndices.length === 0) continue

    const centroid = result.centroids[clusterIdx].centroid

    // Compute severity stats for this cluster
    const memberCrashes = memberIndices.map((i: number) => crashes[i]!)
    const fatalCount = memberCrashes.filter(
      (c: typeof crashes[number]) => c.crashSeverity === CrashSeverity.FATAL
    ).length
    const injuryCount = memberCrashes.filter(
      (c: typeof crashes[number]) =>
        c.crashSeverity === CrashSeverity.SUSPECTED_SERIOUS_INJURY ||
        c.crashSeverity === CrashSeverity.SUSPECTED_MINOR_INJURY ||
        c.crashSeverity === CrashSeverity.POSSIBLE_INJURY
    ).length

    const severityValues = memberCrashes.map(
      (c: typeof crashes[number]) => SEVERITY_ORDINAL[c.crashSeverity ?? ''] ?? 0
    )
    const avgSeverity =
      severityValues.reduce((a: number, b: number) => a + b, 0) / severityValues.length

    // Seasonal pattern: count by month
    const seasonalPattern: Record<string, number> = {}
    for (let m = 1; m <= 12; m++) {
      seasonalPattern[String(m)] = 0
    }
    for (const c of memberCrashes) {
      const month = String(c.crashDate.getMonth() + 1)
      seasonalPattern[month] = (seasonalPattern[month] || 0) + 1
    }

    const definingAttributes = centroidToAttributes(centroid)

    // Name the archetype
    const name = await nameArchetype(centroid, clusterIdx)

    // 6. Store in CrashArchetype table
    const archetype = await prisma.crashArchetype.create({
      data: {
        name,
        stateCode: stateCode ?? null,
        centroid: centroid as unknown as Record<string, number>,
        crashCount: memberIndices.length,
        avgSeverity,
        injuryRate: memberIndices.length > 0 ? injuryCount / memberIndices.length : 0,
        fatalityRate: memberIndices.length > 0 ? fatalCount / memberIndices.length : 0,
        seasonalPattern: seasonalPattern as unknown as Record<string, number>,
        definingAttributes: definingAttributes as unknown as Record<string, string>,
      },
    })

    // 7. Update Crash.archetypeId for all assigned crashes
    const crashIdsInCluster = memberIndices.map((i: number) => crashIds[i])
    await prisma.crash.updateMany({
      where: { id: { in: crashIdsInCluster } },
      data: { archetypeId: archetype.id },
    })

    archetypes.push({
      id: archetype.id,
      name,
      stateCode: stateCode ?? null,
      centroid,
      crashCount: memberIndices.length,
      avgSeverity,
      injuryRate: memberIndices.length > 0 ? injuryCount / memberIndices.length : 0,
      fatalityRate: memberIndices.length > 0 ? fatalCount / memberIndices.length : 0,
      seasonalPattern,
      definingAttributes,
    })
  }

  return archetypes
}

/**
 * Assign a single crash to its nearest existing archetype.
 * Returns the archetype ID.
 */
export async function assignToArchetype(crashId: string): Promise<string | null> {
  const crash = await prisma.crash.findUnique({
    where: { id: crashId },
    select: {
      id: true,
      mannerOfCollision: true,
      crashSeverity: true,
      crashDate: true,
      atmosphericCondition: true,
      lightCondition: true,
      intersectionType: true,
      rawData: true,
      stateCode: true,
      _count: { select: { vehicles: true } },
    },
  })

  if (!crash) return null

  // Get all archetypes for this state (or global)
  const archetypes = await prisma.crashArchetype.findMany({
    where: {
      OR: [
        { stateCode: crash.stateCode },
        { stateCode: null },
      ],
    },
  })

  if (archetypes.length === 0) return null

  // Extract and normalize feature vector (approximate: use raw values scaled to 0-1)
  const rawFeatures = extractRawFeatures(crash as CrashRow)
  // Simple normalization using known max values
  const maxValues = [9, 4, 23, 6, 10, 7, 3, 10, 6]
  const normalized = rawFeatures.map((v, i) =>
    maxValues[i] === 0 ? 0 : Math.min(1, v / maxValues[i])
  )

  // Find nearest centroid
  let bestArchetypeId: string | null = null
  let bestDistance = Infinity

  for (const archetype of archetypes) {
    const centroid = archetype.centroid as unknown as number[]
    if (!Array.isArray(centroid)) continue

    const distance = euclideanDistance(normalized, centroid)
    if (distance < bestDistance) {
      bestDistance = distance
      bestArchetypeId = archetype.id
    }
  }

  if (bestArchetypeId) {
    await prisma.crash.update({
      where: { id: crashId },
      data: { archetypeId: bestArchetypeId },
    })
  }

  return bestArchetypeId
}

function euclideanDistance(a: number[], b: number[]): number {
  let sum = 0
  const len = Math.min(a.length, b.length)
  for (let i = 0; i < len; i++) {
    sum += (a[i] - b[i]) ** 2
  }
  return Math.sqrt(sum)
}

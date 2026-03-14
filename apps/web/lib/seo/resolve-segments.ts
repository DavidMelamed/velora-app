/**
 * URL Segment Resolver — Maps catch-all URL segments to page tiers.
 *
 * Tier 1: /crashes/colorado → state page
 * Tier 2: /crashes/colorado/denver → city page
 * Tier 3: /crashes/colorado/rear-end → attribute combo (state × crash type)
 * Tier 4: /crashes/colorado/denver/rear-end → city × attribute combo
 * Tier 5: /crashes/colorado/2025/01 → temporal (year/month)
 */

import { STATE_CATALOG, type StateConfig } from '@velora/shared'

export type PageTier =
  | 'state'
  | 'city'
  | 'state-attribute'
  | 'city-attribute'
  | 'temporal'

export interface ResolvedSegments {
  tier: PageTier
  stateCode: string
  stateName: string
  city?: string
  attribute?: string
  year?: number
  month?: number
}

// Crash type attributes for SEO pages
export const CRASH_ATTRIBUTES = [
  'rear-end',
  'head-on',
  'sideswipe',
  't-bone',
  'rollover',
  'pedestrian',
  'bicycle',
  'motorcycle',
  'hit-and-run',
  'dui',
  'fatal',
  'multi-vehicle',
  'single-vehicle',
  'intersection',
  'highway',
] as const

export type CrashAttribute = (typeof CRASH_ATTRIBUTES)[number]

// Map attribute slugs to display names
export const ATTRIBUTE_DISPLAY_NAMES: Record<CrashAttribute, string> = {
  'rear-end': 'Rear-End Collisions',
  'head-on': 'Head-On Collisions',
  'sideswipe': 'Sideswipe Accidents',
  't-bone': 'T-Bone Crashes',
  'rollover': 'Rollover Accidents',
  'pedestrian': 'Pedestrian Accidents',
  'bicycle': 'Bicycle Accidents',
  'motorcycle': 'Motorcycle Crashes',
  'hit-and-run': 'Hit and Run Crashes',
  'dui': 'DUI/DWI Crashes',
  'fatal': 'Fatal Crashes',
  'multi-vehicle': 'Multi-Vehicle Crashes',
  'single-vehicle': 'Single Vehicle Crashes',
  'intersection': 'Intersection Crashes',
  'highway': 'Highway Crashes',
}

// Map attribute slugs to Prisma where clause filters
// Uses correct enum values from the Prisma schema
export const ATTRIBUTE_FILTERS: Record<CrashAttribute, Record<string, unknown>> = {
  'rear-end': { mannerOfCollision: 'FRONT_TO_REAR' },
  'head-on': { mannerOfCollision: 'FRONT_TO_FRONT' },
  'sideswipe': { mannerOfCollision: 'SIDESWIPE_SAME_DIRECTION' },
  't-bone': { mannerOfCollision: 'ANGLE' },
  'rollover': { firstHarmfulEvent: { contains: 'ROLLOVER' } },
  'pedestrian': { persons: { some: { personType: 'PEDESTRIAN' } } },
  'bicycle': { persons: { some: { personType: 'PEDALCYCLIST' } } },
  'motorcycle': { vehicles: { some: { bodyType: 'MOTORCYCLE' } } },
  'hit-and-run': { vehicles: { some: { hitAndRun: true } } },
  'dui': { vehicles: { some: { driver: { suspectedAlcoholDrug: true } } } },
  'fatal': { crashSeverity: 'FATAL' },
  'multi-vehicle': { vehicles: { some: {} } },
  'single-vehicle': { vehicles: { some: {} } },
  'intersection': { NOT: { intersectionType: null } },
  'highway': { firstHarmfulEvent: { contains: 'HIGHWAY' } },
}

/**
 * Build a state slug lookup from the catalog (name -> code).
 * e.g., "colorado" -> "CO"
 */
function buildStateLookup(): Map<string, StateConfig> {
  const lookup = new Map<string, StateConfig>()
  for (const entry of STATE_CATALOG) {
    lookup.set(entry.name.toLowerCase().replace(/\s+/g, '-'), entry)
  }
  return lookup
}

const stateLookup = buildStateLookup()

/**
 * Check if a segment is a year (4-digit number, 2000-2099)
 */
function isYear(segment: string): boolean {
  const n = parseInt(segment, 10)
  return !isNaN(n) && n >= 2000 && n <= 2099 && segment.length === 4
}

/**
 * Check if a segment is a month (01-12)
 */
function isMonth(segment: string): boolean {
  const n = parseInt(segment, 10)
  return !isNaN(n) && n >= 1 && n <= 12 && segment.length <= 2
}

/**
 * Check if a segment is a known crash attribute
 */
function isCrashAttribute(segment: string): segment is CrashAttribute {
  return CRASH_ATTRIBUTES.includes(segment as CrashAttribute)
}

/**
 * Resolve URL segments into structured page data.
 * Returns null if the URL doesn't match any known pattern.
 */
export function resolveSegments(segments: string[]): ResolvedSegments | null {
  // Must start with "crashes" prefix
  if (segments.length === 0 || segments[0] !== 'crashes') {
    return null
  }

  const parts = segments.slice(1)

  if (parts.length === 0) {
    return null
  }

  // First segment must be a state
  const stateSlug = parts[0]!.toLowerCase()
  const stateEntry = stateLookup.get(stateSlug)

  if (!stateEntry) {
    return null
  }

  const base: Pick<ResolvedSegments, 'stateCode' | 'stateName'> = {
    stateCode: stateEntry.code,
    stateName: stateEntry.name,
  }

  // Tier 1: /crashes/colorado → state page
  if (parts.length === 1) {
    return { tier: 'state', ...base }
  }

  // Check second segment
  const second = parts[1]!.toLowerCase()

  // Tier 5: /crashes/colorado/2025 or /crashes/colorado/2025/01
  if (isYear(second)) {
    const result: ResolvedSegments = {
      tier: 'temporal',
      ...base,
      year: parseInt(second, 10),
    }
    if (parts.length >= 3 && isMonth(parts[2]!)) {
      result.month = parseInt(parts[2]!, 10)
    }
    return result
  }

  // Tier 3: /crashes/colorado/rear-end → state × attribute
  if (isCrashAttribute(second)) {
    return { tier: 'state-attribute', ...base, attribute: second }
  }

  // Second segment is a city name
  const city = second.replace(/-/g, ' ')

  // Tier 2: /crashes/colorado/denver → city page
  if (parts.length === 2) {
    return { tier: 'city', ...base, city }
  }

  // Tier 4: /crashes/colorado/denver/rear-end → city × attribute
  const third = parts[2]!.toLowerCase()
  if (isCrashAttribute(third)) {
    return { tier: 'city-attribute', ...base, city, attribute: third }
  }

  // Temporal from city level: /crashes/colorado/denver/2025
  if (isYear(third)) {
    const result: ResolvedSegments = {
      tier: 'temporal',
      ...base,
      city,
      year: parseInt(third, 10),
    }
    if (parts.length >= 4 && isMonth(parts[3]!)) {
      result.month = parseInt(parts[3]!, 10)
    }
    return result
  }

  return null
}

/**
 * Generate a canonical URL for a resolved segment.
 */
export function buildCanonicalUrl(resolved: ResolvedSegments): string {
  const stateSlug = resolved.stateName.toLowerCase().replace(/\s+/g, '-')
  const base = `/crashes/${stateSlug}`

  switch (resolved.tier) {
    case 'state':
      return base
    case 'city':
      return `${base}/${resolved.city!.replace(/\s+/g, '-')}`
    case 'state-attribute':
      return `${base}/${resolved.attribute}`
    case 'city-attribute':
      return `${base}/${resolved.city!.replace(/\s+/g, '-')}/${resolved.attribute}`
    case 'temporal': {
      const cityPart = resolved.city ? `/${resolved.city.replace(/\s+/g, '-')}` : ''
      const monthPart = resolved.month ? `/${String(resolved.month).padStart(2, '0')}` : ''
      return `${base}${cityPart}/${resolved.year}${monthPart}`
    }
  }
}

/**
 * Generate page title for SEO
 */
export function generatePageTitle(resolved: ResolvedSegments): string {
  const state = resolved.stateName
  const city = resolved.city
    ? resolved.city.split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
    : null

  switch (resolved.tier) {
    case 'state':
      return `Car Crashes in ${state} — Crash Data & Statistics | Velora`
    case 'city':
      return `Car Crashes in ${city}, ${state} — Local Crash Data | Velora`
    case 'state-attribute':
      return `${ATTRIBUTE_DISPLAY_NAMES[resolved.attribute as CrashAttribute]} in ${state} | Velora`
    case 'city-attribute':
      return `${ATTRIBUTE_DISPLAY_NAMES[resolved.attribute as CrashAttribute]} in ${city}, ${state} | Velora`
    case 'temporal': {
      const location = city ? `${city}, ${state}` : state
      const monthName = resolved.month
        ? new Date(2000, resolved.month - 1).toLocaleString('en-US', { month: 'long' })
        : null
      const timePeriod = monthName ? `${monthName} ${resolved.year}` : `${resolved.year}`
      return `Car Crashes in ${location} — ${timePeriod} | Velora`
    }
  }
}

/**
 * Generate page description for SEO
 */
export function generatePageDescription(resolved: ResolvedSegments): string {
  const state = resolved.stateName
  const city = resolved.city
    ? resolved.city.split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
    : null

  switch (resolved.tier) {
    case 'state':
      return `Explore crash data and statistics for ${state}. View crash types, severity breakdown, and trends. Find top-rated personal injury attorneys in ${state}.`
    case 'city':
      return `Local crash data for ${city}, ${state}. See recent crashes, dangerous intersections, and crash patterns. Connect with top attorneys near you.`
    case 'state-attribute':
      return `${ATTRIBUTE_DISPLAY_NAMES[resolved.attribute as CrashAttribute]} data for ${state}. Understand patterns, severity, and find qualified attorneys for your case.`
    case 'city-attribute':
      return `${ATTRIBUTE_DISPLAY_NAMES[resolved.attribute as CrashAttribute]} in ${city}, ${state}. Local crash patterns, statistics, and attorney recommendations.`
    case 'temporal': {
      const location = city ? `${city}, ${state}` : state
      const monthName = resolved.month
        ? new Date(2000, resolved.month - 1).toLocaleString('en-US', { month: 'long' })
        : null
      const timePeriod = monthName ? `${monthName} ${resolved.year}` : `${resolved.year}`
      return `Crash data for ${location} in ${timePeriod}. Monthly and yearly breakdown of crashes by type and severity.`
    }
  }
}

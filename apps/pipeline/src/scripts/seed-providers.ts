/**
 * Seed medical providers for geofencing.
 * Sources provider data from Google Places API or manual list.
 * Run: npx tsx apps/pipeline/src/scripts/seed-providers.ts
 */

import { prisma } from '@velora/db'

// Common provider types for PI cases
const PROVIDER_TYPES = [
  'PT',
  'CHIROPRACTOR',
  'ER',
  'IMAGING',
  'ORTHOPEDIC',
  'PRIMARY_CARE',
  'URGENT_CARE',
  'HOSPITAL',
  'PHARMACY',
] as const

// Seed data for major metro areas (expandable)
const SEED_PROVIDERS = [
  // Denver, CO
  { name: 'Denver Health Medical Center', type: 'ER', latitude: 39.7272, longitude: -104.9917, city: 'Denver', stateCode: 'CO' },
  { name: 'UCHealth University of Colorado Hospital', type: 'HOSPITAL', latitude: 39.7451, longitude: -104.8386, city: 'Aurora', stateCode: 'CO' },
  { name: 'Colorado Spine & Rehab', type: 'PT', latitude: 39.7392, longitude: -104.9849, city: 'Denver', stateCode: 'CO' },
  { name: 'Denver Chiropractic Center', type: 'CHIROPRACTOR', latitude: 39.7508, longitude: -104.9996, city: 'Denver', stateCode: 'CO' },
  { name: 'Touchstone Imaging Denver', type: 'IMAGING', latitude: 39.7106, longitude: -104.9421, city: 'Denver', stateCode: 'CO' },
  { name: 'Colorado Orthopedic Consultants', type: 'ORTHOPEDIC', latitude: 39.6836, longitude: -104.9619, city: 'Englewood', stateCode: 'CO' },
  { name: 'AFC Urgent Care Denver', type: 'URGENT_CARE', latitude: 39.7316, longitude: -104.9588, city: 'Denver', stateCode: 'CO' },

  // Austin, TX
  { name: 'Dell Seton Medical Center', type: 'ER', latitude: 30.2753, longitude: -97.7317, city: 'Austin', stateCode: 'TX' },
  { name: 'St. David\'s Medical Center', type: 'HOSPITAL', latitude: 30.2900, longitude: -97.7238, city: 'Austin', stateCode: 'TX' },
  { name: 'Austin Physical Therapy', type: 'PT', latitude: 30.2672, longitude: -97.7431, city: 'Austin', stateCode: 'TX' },
  { name: 'Austin Chiropractic', type: 'CHIROPRACTOR', latitude: 30.3074, longitude: -97.7520, city: 'Austin', stateCode: 'TX' },
  { name: 'Austin Radiological Association', type: 'IMAGING', latitude: 30.2945, longitude: -97.7353, city: 'Austin', stateCode: 'TX' },

  // Philadelphia, PA
  { name: 'Thomas Jefferson University Hospital', type: 'HOSPITAL', latitude: 39.9485, longitude: -75.1579, city: 'Philadelphia', stateCode: 'PA' },
  { name: 'Temple University Hospital', type: 'ER', latitude: 39.9792, longitude: -75.1520, city: 'Philadelphia', stateCode: 'PA' },
  { name: 'Philadelphia PT & Wellness', type: 'PT', latitude: 39.9527, longitude: -75.1635, city: 'Philadelphia', stateCode: 'PA' },

  // Spokane, WA
  { name: 'Providence Sacred Heart Medical Center', type: 'HOSPITAL', latitude: 47.6618, longitude: -117.4027, city: 'Spokane', stateCode: 'WA' },
  { name: 'MultiCare Deaconess Hospital', type: 'ER', latitude: 47.6525, longitude: -117.4060, city: 'Spokane', stateCode: 'WA' },
  { name: 'Spokane Physical Therapy', type: 'PT', latitude: 47.6588, longitude: -117.4256, city: 'Spokane', stateCode: 'WA' },

  // San Francisco, CA
  { name: 'UCSF Medical Center', type: 'HOSPITAL', latitude: 37.7631, longitude: -122.4574, city: 'San Francisco', stateCode: 'CA' },
  { name: 'Zuckerberg SF General Hospital', type: 'ER', latitude: 37.7555, longitude: -122.4046, city: 'San Francisco', stateCode: 'CA' },
  { name: 'Bay Area Physical Therapy', type: 'PT', latitude: 37.7850, longitude: -122.4064, city: 'San Francisco', stateCode: 'CA' },
]

async function seedProviders() {
  console.log(`Seeding ${SEED_PROVIDERS.length} providers...`)

  let created = 0
  let skipped = 0

  for (const provider of SEED_PROVIDERS) {
    // Check for existing provider at same coordinates
    const existing = await prisma.provider.findFirst({
      where: {
        latitude: { gte: provider.latitude - 0.001, lte: provider.latitude + 0.001 },
        longitude: { gte: provider.longitude - 0.001, lte: provider.longitude + 0.001 },
      },
    })

    if (existing) {
      skipped++
      continue
    }

    await prisma.provider.create({
      data: {
        name: provider.name,
        type: provider.type,
        latitude: provider.latitude,
        longitude: provider.longitude,
        city: provider.city,
        stateCode: provider.stateCode,
        geofenceRadius: provider.type === 'HOSPITAL' || provider.type === 'ER' ? 200 : 100,
      },
    })
    created++
  }

  console.log(`Done. Created: ${created}, Skipped (existing): ${skipped}`)
}

seedProviders()
  .catch(console.error)
  .finally(() => prisma.$disconnect())

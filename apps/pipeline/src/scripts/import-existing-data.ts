#!/usr/bin/env tsx
/**
 * Import Existing Attorney Data from CrashStory Platform
 *
 * Reads local JSON files from the crashstory-platform repo and upserts
 * attorneys + reviews into the Velora database.
 *
 * Data sources:
 *   1. pi_lawyers_raw.json           – 763 DataForSEO SERP records (attorney profiles)
 *   2. firm-intelligence-index.json  – 639 firms indexed (for slug matching)
 *   3. firm-reviews/*.json           – 639 individual firm review files (reviews)
 *   4. firm-intelligence.json        – LLM-enriched intelligence per firm
 *
 * Usage:
 *   DATABASE_URL="..." pnpm tsx apps/pipeline/src/scripts/import-existing-data.ts
 */

import { prisma } from '@velora/db'
import * as fs from 'fs'
import * as path from 'path'

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const CRASHSTORY_ROOT = path.resolve(__dirname, '..', '..', '..', '..', '..', 'crashstory-platform')

const PATHS = {
  piLawyersRaw: path.join(CRASHSTORY_ROOT, 'api', 'prisma', 'pi_lawyers_raw.json'),
  firmIntelligenceIndex: path.join(CRASHSTORY_ROOT, 'web', 'public', 'data', 'review-intelligence', 'firm-intelligence-index.json'),
  firmReviewsDir: path.join(CRASHSTORY_ROOT, 'web', 'public', 'data', 'review-intelligence', 'firm-reviews'),
  firmIntelligence: path.join(CRASHSTORY_ROOT, 'web', 'public', 'data', 'review-intelligence', 'firm-intelligence.json'),
}

// ---------------------------------------------------------------------------
// Types for raw data
// ---------------------------------------------------------------------------

interface RawLawyer {
  title: string
  description: string | null
  category: string | null
  category_ids: string[] | null
  cid: string | null
  feature_id: string | null
  address_info: {
    borough?: string
    address?: string
    city?: string
    zip?: string
    region?: string
    country_code?: string
  } | null
  url: string | null
  domain: string | null
  rating: {
    rating_type?: string
    value: number | null
    votes_count: number | null
    rating_max?: number | null
  } | null
  rating_distribution: Record<string, number> | null
  work_time: Record<string, unknown> | null
  check_url: string | null
  last_updated_time?: string | null
}

interface FirmIntelligenceIndexEntry {
  firmSlug: string
  firmName: string
  totalReviews: number
  averageRating: number
  textReviews: number
  piReviews: number
  city: string
}

interface RawReview {
  id: string
  lawyerId: string
  rating: number
  content: string | null
  reviewerName: string | null
  isStarOnly?: boolean
  reviewTimestamp: string | null
  reviewDate?: string | null
  timeAgo?: string | null
  caseType: string | null
  isPiCase: boolean
  sentimentOverall: string | null
  sentimentIntensity?: number | null
  dimensions: Record<string, unknown>[] | Record<string, unknown> | null
  additionalThemes?: string[] | null
  isHighlightWorthy: boolean
  highlightReason: string | null
  hasOwnerResponse: boolean
  ownerResponseType?: string | null
  ownerResponseLength?: number | null
  ownerResponseTone?: string | null
  reviewerCrossCount?: number | null
  reviewerTotalReviews?: number | null
  isPeerEndorsement?: boolean
  isPreClientReview?: boolean
  usefulnessScore?: number | null
  reviewDepthCategory?: string | null
  reviewStage?: string | null
  caseExperienceSummary?: string | null
  mentionedStaff?: string[] | null
  classificationTags?: string[] | null
  scorecardSignals?: Record<string, boolean> | null
  reviewYear?: number | null
  reviewMonth?: number | null
  [key: string]: unknown
}

interface FirmReviewFile {
  firmSlug: string
  firmName: string
  reviewCount: number
  textReviewCount: number
  piReviewCount: number
  reviews: RawReview[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readJsonFile<T>(filePath: string): T | null {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8')
    return JSON.parse(raw) as T
  } catch (err) {
    console.error(`  [WARN] Could not read ${filePath}: ${err instanceof Error ? err.message : err}`)
    return null
  }
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[''`]/g, '')
    .replace(/[&]/g, 'and')
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .trim()
}

function lawyerSlugFromTitle(title: string, city?: string): string {
  // Remove trailing location like "- Denver, Colorado"
  const cleanTitle = title.replace(/\s*[-–]\s*[A-Z][a-z]+(?:,?\s*[A-Z][a-z]+)?\s*$/i, '').trim()
  const slug = slugify(cleanTitle)
  return city ? `${slug}-${slugify(city)}` : slug
}

function safeDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null
  try {
    const d = new Date(dateStr)
    return isNaN(d.getTime()) ? null : d
  } catch {
    return null
  }
}

function extractDomain(url: string | null): string | null {
  if (!url) return null
  try {
    const u = new URL(url)
    return u.hostname
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Step 1: Import Attorneys from pi_lawyers_raw.json
// ---------------------------------------------------------------------------

async function importAttorneys(lawyers: RawLawyer[]): Promise<number> {
  console.log('\n========================================')
  console.log('STEP 1: Import attorneys from pi_lawyers_raw.json')
  console.log(`  Processing ${lawyers.length} records...`)
  console.log('========================================')

  // Deduplicate by feature_id (googlePlaceId) — keep first occurrence
  const seenPlaceIds = new Set<string>()
  const seenCids = new Set<string>()
  const seenSlugs = new Set<string>()
  const deduped: RawLawyer[] = []

  for (const raw of lawyers) {
    const featureId = raw.feature_id || null
    const cid = raw.cid || null
    const cityName = raw.address_info?.city?.trim() || ''
    const slug = lawyerSlugFromTitle(raw.title, cityName)

    // Skip if we've already seen this placeId, cid, or slug
    if (featureId && seenPlaceIds.has(featureId)) continue
    if (cid && seenCids.has(cid)) continue
    if (seenSlugs.has(slug)) continue

    if (featureId) seenPlaceIds.add(featureId)
    if (cid) seenCids.add(cid)
    seenSlugs.add(slug)
    deduped.push(raw)
  }

  console.log(`  Deduplicated: ${lawyers.length} -> ${deduped.length} unique records`)

  let created = 0
  let updated = 0
  let failed = 0

  for (let i = 0; i < deduped.length; i++) {
    const raw = deduped[i]
    try {
      const cityName = raw.address_info?.city?.trim() || ''
      const slug = lawyerSlugFromTitle(raw.title, cityName)
      const featureId = raw.feature_id || null
      const cid = raw.cid || null
      const domain = raw.domain || extractDomain(raw.url)

      // Build full address string
      const addrParts = []
      if (raw.address_info?.address) addrParts.push(raw.address_info.address)
      if (cityName) addrParts.push(cityName)
      if (raw.address_info?.region) addrParts.push(raw.address_info.region)
      if (raw.address_info?.zip) addrParts.push(raw.address_info.zip)
      const fullAddress = addrParts.length > 0 ? addrParts.join(', ') : null

      const stateCode = raw.address_info?.region
        ? stateNameToCode(raw.address_info.region)
        : null

      const data = {
        slug,
        name: raw.title,
        phone: null as string | null,
        website: raw.url || null,
        domain: domain || null,
        googlePlaceId: featureId,
        googleCid: cid,
        address: fullAddress,
        addressInfo: raw.address_info ?? undefined,
        city: cityName || null,
        stateCode: stateCode || null,
        zipCode: raw.address_info?.zip || null,
        description: raw.description || null,
        category: raw.category || null,
        categoryIds: raw.category_ids || [],
        additionalCategories: [] as string[],
        googleRating: raw.rating?.value ?? null,
        googleReviewCount: raw.rating?.votes_count ?? 0,
        ratingDistribution: raw.rating_distribution ?? undefined,
        workHours: raw.work_time ?? undefined,
        googleMapsUrl: raw.check_url || null,
        practiceAreas: buildPracticeAreas(raw.category, raw.category_ids),
      }

      // Try to find existing attorney by placeId, CID, or slug
      let existing = featureId
        ? await prisma.attorney.findUnique({ where: { googlePlaceId: featureId } })
        : null

      if (!existing && cid) {
        existing = await prisma.attorney.findUnique({ where: { googleCid: cid } })
      }

      if (!existing) {
        existing = await prisma.attorney.findUnique({ where: { slug } })
      }

      if (existing) {
        await prisma.attorney.update({
          where: { id: existing.id },
          data: {
            name: data.name,
            website: data.website,
            domain: data.domain,
            googlePlaceId: data.googlePlaceId,
            googleCid: data.googleCid,
            address: data.address,
            addressInfo: data.addressInfo,
            city: data.city,
            stateCode: data.stateCode,
            zipCode: data.zipCode,
            description: data.description,
            category: data.category,
            categoryIds: data.categoryIds,
            googleRating: data.googleRating,
            googleReviewCount: data.googleReviewCount,
            ratingDistribution: data.ratingDistribution,
            workHours: data.workHours,
            googleMapsUrl: data.googleMapsUrl,
            practiceAreas: data.practiceAreas,
          },
        })
        updated++
      } else {
        await prisma.attorney.create({ data })
        created++
      }

      if ((i + 1) % 100 === 0) {
        console.log(`  ... processed ${i + 1}/${deduped.length} (${created} created, ${updated} updated, ${failed} failed)`)
      }
    } catch (err) {
      failed++
      if (failed <= 10) {
        console.error(`  [ERROR] Attorney "${raw.title}": ${err instanceof Error ? err.message : err}`)
      }
    }
  }

  console.log(`  Done: ${created} created, ${updated} updated, ${failed} failed`)
  return created + updated
}

// ---------------------------------------------------------------------------
// Step 2: Import Reviews from firm-reviews/*.json (batch insert)
// ---------------------------------------------------------------------------

async function importReviews(
  firmReviewsDir: string,
  firmIndex: FirmIntelligenceIndexEntry[],
): Promise<{ reviewCount: number; firmCount: number }> {
  console.log('\n========================================')
  console.log('STEP 2: Import reviews from firm-reviews/*.json')
  console.log('========================================')

  // Build slug -> attorney DB id mapping
  const allAttorneys = await prisma.attorney.findMany({
    select: { id: true, slug: true, googlePlaceId: true, name: true },
  })
  console.log(`  Loaded ${allAttorneys.length} attorneys from DB`)

  const slugToAttorneyId = new Map<string, string>()
  for (const a of allAttorneys) {
    slugToAttorneyId.set(a.slug, a.id)
  }

  // Get all existing review googleReviewIds to skip duplicates
  const existingReviews = await prisma.attorneyReview.findMany({
    select: { googleReviewId: true },
    where: { googleReviewId: { not: null } },
  })
  const existingReviewIds = new Set(existingReviews.map(r => r.googleReviewId).filter(Boolean))
  console.log(`  Existing reviews in DB: ${existingReviewIds.size}`)

  let reviewFiles: string[]
  try {
    reviewFiles = fs.readdirSync(firmReviewsDir).filter(f => f.endsWith('.json'))
  } catch (err) {
    console.error(`  [ERROR] Cannot read firm-reviews directory: ${err}`)
    return { reviewCount: 0, firmCount: 0 }
  }

  console.log(`  Found ${reviewFiles.length} firm review files`)

  let totalReviews = 0
  let totalFirms = 0
  let skippedFirms = 0
  let skippedReviews = 0
  let failedReviews = 0

  for (let fi = 0; fi < reviewFiles.length; fi++) {
    const file = reviewFiles[fi]
    const filePath = path.join(firmReviewsDir, file)
    const firmData = readJsonFile<FirmReviewFile>(filePath)
    if (!firmData || !firmData.reviews || firmData.reviews.length === 0) continue

    const firmSlug = firmData.firmSlug

    // Match firm to attorney
    let attorneyId = slugToAttorneyId.get(firmSlug)

    if (!attorneyId) {
      for (const [slug, id] of slugToAttorneyId.entries()) {
        if (slug === firmSlug || slug.startsWith(firmSlug + '-') || firmSlug.startsWith(slug + '-')) {
          attorneyId = id
          break
        }
      }
    }

    if (!attorneyId) {
      const firmNameLower = firmData.firmName.toLowerCase()
      for (const a of allAttorneys) {
        const aNameLower = a.name.toLowerCase()
        if (aNameLower.includes(firmNameLower) || firmNameLower.includes(aNameLower)) {
          attorneyId = a.id
          break
        }
      }
    }

    if (!attorneyId) {
      skippedFirms++
      continue
    }

    totalFirms++

    // Filter out already-imported reviews and batch create new ones
    const newReviews = firmData.reviews.filter(r => !existingReviewIds.has(r.id))
    skippedReviews += firmData.reviews.length - newReviews.length

    if (newReviews.length === 0) continue

    // Process in batches of 200
    const BATCH_SIZE = 200
    for (let bi = 0; bi < newReviews.length; bi += BATCH_SIZE) {
      const batch = newReviews.slice(bi, bi + BATCH_SIZE)
      const records = batch.map(review => ({
        attorneyId,
        googleReviewId: review.id,
        authorName: review.reviewerName || null,
        rating: review.rating,
        text: review.content || null,
        publishedAt: safeDate(review.reviewTimestamp),
        timeAgo: review.timeAgo || null,
        language: 'en',
        isLocalGuide: false,
        photosCount: 0,
        dimensions: buildReviewDimensions(review),
      }))

      try {
        const result = await prisma.attorneyReview.createMany({
          data: records,
          skipDuplicates: true,
        })
        totalReviews += result.count
        // Track inserted IDs
        for (const r of batch) existingReviewIds.add(r.id)
      } catch (err) {
        // Fall back to individual inserts on batch failure
        for (const record of records) {
          try {
            await prisma.attorneyReview.create({ data: record })
            totalReviews++
          } catch {
            failedReviews++
          }
        }
      }
    }

    if ((fi + 1) % 50 === 0) {
      console.log(`  ... processed ${fi + 1}/${reviewFiles.length} files, ${totalReviews} reviews imported, ${skippedReviews} skipped (existing)`)
    }
  }

  console.log(`  Done: ${totalFirms} firms matched, ${skippedFirms} firms skipped (no attorney match)`)
  console.log(`  Reviews: ${totalReviews} imported, ${skippedReviews} skipped (existing), ${failedReviews} failed`)
  return { reviewCount: totalReviews, firmCount: totalFirms }
}

// ---------------------------------------------------------------------------
// Helpers for field mapping
// ---------------------------------------------------------------------------

function stateNameToCode(stateName: string): string | null {
  const map: Record<string, string> = {
    'alabama': 'AL', 'alaska': 'AK', 'arizona': 'AZ', 'arkansas': 'AR',
    'california': 'CA', 'colorado': 'CO', 'connecticut': 'CT', 'delaware': 'DE',
    'florida': 'FL', 'georgia': 'GA', 'hawaii': 'HI', 'idaho': 'ID',
    'illinois': 'IL', 'indiana': 'IN', 'iowa': 'IA', 'kansas': 'KS',
    'kentucky': 'KY', 'louisiana': 'LA', 'maine': 'ME', 'maryland': 'MD',
    'massachusetts': 'MA', 'michigan': 'MI', 'minnesota': 'MN', 'mississippi': 'MS',
    'missouri': 'MO', 'montana': 'MT', 'nebraska': 'NE', 'nevada': 'NV',
    'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY',
    'north carolina': 'NC', 'north dakota': 'ND', 'ohio': 'OH', 'oklahoma': 'OK',
    'oregon': 'OR', 'pennsylvania': 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
    'south dakota': 'SD', 'tennessee': 'TN', 'texas': 'TX', 'utah': 'UT',
    'vermont': 'VT', 'virginia': 'VA', 'washington': 'WA', 'west virginia': 'WV',
    'wisconsin': 'WI', 'wyoming': 'WY', 'district of columbia': 'DC',
  }
  return map[stateName.toLowerCase()] || null
}

function buildPracticeAreas(category: string | null, categoryIds: string[] | null): string[] {
  const areas: string[] = []
  if (category) areas.push(category)
  if (categoryIds) {
    for (const id of categoryIds) {
      const readable = id.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
      if (!areas.includes(readable) && !areas.includes(category || '')) {
        areas.push(readable)
      }
    }
  }
  return areas
}

function buildReviewDimensions(review: RawReview): Record<string, unknown> | undefined {
  const dims: Record<string, unknown> = {}

  if (review.dimensions) dims.dimensions = review.dimensions
  if (review.caseType) dims.caseType = review.caseType
  if (review.isPiCase) dims.isPiCase = review.isPiCase
  if (review.sentimentOverall) dims.sentimentOverall = review.sentimentOverall
  if (review.sentimentIntensity) dims.sentimentIntensity = review.sentimentIntensity
  if (review.additionalThemes && review.additionalThemes.length > 0) dims.additionalThemes = review.additionalThemes
  if (review.isHighlightWorthy) dims.isHighlightWorthy = review.isHighlightWorthy
  if (review.highlightReason) dims.highlightReason = review.highlightReason
  if (review.outcomeType) dims.outcomeType = review.outcomeType
  if (review.settlementRange) dims.settlementRange = review.settlementRange
  if (review.usefulnessScore) dims.usefulnessScore = review.usefulnessScore
  if (review.reviewDepthCategory) dims.reviewDepthCategory = review.reviewDepthCategory
  if (review.reviewStage) dims.reviewStage = review.reviewStage
  if (review.caseExperienceSummary) dims.caseExperienceSummary = review.caseExperienceSummary
  if (review.scorecardSignals) dims.scorecardSignals = review.scorecardSignals
  if (review.classificationTags && review.classificationTags.length > 0) dims.classificationTags = review.classificationTags
  if (review.isPeerEndorsement) dims.isPeerEndorsement = review.isPeerEndorsement
  if (review.mentionedStaff && review.mentionedStaff.length > 0) dims.mentionedStaff = review.mentionedStaff

  return Object.keys(dims).length > 0 ? dims : undefined
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗')
  console.log('║  Velora — Import Existing Attorney Data from CrashStory     ║')
  console.log('╚══════════════════════════════════════════════════════════════╝')

  // Verify source files exist
  for (const [key, filepath] of Object.entries(PATHS)) {
    const exists = fs.existsSync(filepath)
    console.log(`  ${exists ? 'OK' : 'MISSING'}: ${key} → ${filepath}`)
    if (!exists && key !== 'firmIntelligence') {
      console.error(`\n  FATAL: Required file missing: ${filepath}`)
      process.exit(1)
    }
  }

  // Step 1: Load and import attorneys
  const rawLawyers = readJsonFile<RawLawyer[]>(PATHS.piLawyersRaw)
  if (!rawLawyers || rawLawyers.length === 0) {
    console.error('FATAL: No lawyers found in pi_lawyers_raw.json')
    process.exit(1)
  }

  const attorneyCount = await importAttorneys(rawLawyers)

  // Step 2: Load firm intelligence index and import reviews
  const firmIndex = readJsonFile<FirmIntelligenceIndexEntry[]>(PATHS.firmIntelligenceIndex)
  if (!firmIndex) {
    console.error('WARN: No firm intelligence index found')
  }

  const reviewResult = await importReviews(PATHS.firmReviewsDir, firmIndex || [])

  // Final summary
  const dbAttorneyCount = await prisma.attorney.count()
  const dbReviewCount = await prisma.attorneyReview.count()

  console.log('\n╔══════════════════════════════════════════════════════════════╗')
  console.log('║  Import Complete                                             ║')
  console.log('╠══════════════════════════════════════════════════════════════╣')
  console.log(`║  Attorneys processed: ${attorneyCount.toString().padEnd(10)}                            ║`)
  console.log(`║  Firm review files:   ${reviewResult.firmCount.toString().padEnd(10)}                            ║`)
  console.log(`║  Reviews imported:    ${reviewResult.reviewCount.toString().padEnd(10)}                            ║`)
  console.log('╠══════════════════════════════════════════════════════════════╣')
  console.log(`║  Total attorneys in DB:  ${dbAttorneyCount.toString().padEnd(10)}                         ║`)
  console.log(`║  Total reviews in DB:    ${dbReviewCount.toString().padEnd(10)}                         ║`)
  console.log('╚══════════════════════════════════════════════════════════════╝')

  await prisma.$disconnect()
}

main().catch(async (err) => {
  console.error('Fatal error:', err)
  await prisma.$disconnect()
  process.exit(1)
})

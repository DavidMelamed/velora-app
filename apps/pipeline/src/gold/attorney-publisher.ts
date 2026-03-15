/**
 * Attorney Gold Publisher — upserts attorney listings and reviews into Prisma.
 * Idempotent via googlePlaceId upsert.
 */

import { prisma } from '@velora/db'
import type { GoogleMapsListing, GoogleReviewItem, AttorneySearchResult } from '../bronze/sources/dataforseo-adapter'

export interface AttorneyPublishResult {
  created: number
  updated: number
  reviewsAdded: number
  errors: Array<{ placeId: string; error: string }>
}

function slugify(name: string, city: string | null, stateCode: string): string {
  const base = [name, city, stateCode]
    .filter(Boolean)
    .join('-')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
  return base
}

function parseAddress(address: string | null): {
  city: string | null
  stateCode: string | null
  zipCode: string | null
} {
  if (!address) return { city: null, stateCode: null, zipCode: null }

  // Try to parse "123 Main St, City, ST 12345" format
  const parts = address.split(',').map((s) => s.trim())
  if (parts.length >= 2) {
    const lastPart = parts[parts.length - 1]!
    const stateZipMatch = lastPart.match(/([A-Z]{2})\s*(\d{5})?/)
    const city = parts.length >= 3 ? parts[parts.length - 2]! : null

    return {
      city: city,
      stateCode: stateZipMatch?.[1] ?? null,
      zipCode: stateZipMatch?.[2] ?? null,
    }
  }

  return { city: null, stateCode: null, zipCode: null }
}

function inferPracticeAreas(title: string, category: string | null): string[] {
  const text = `${title} ${category ?? ''}`.toLowerCase()
  const areas: string[] = []

  if (text.includes('personal injury')) areas.push('personal_injury')
  if (text.includes('car accident') || text.includes('auto accident') || text.includes('motor vehicle'))
    areas.push('car_accident')
  if (text.includes('truck')) areas.push('truck_accident')
  if (text.includes('motorcycle')) areas.push('motorcycle_accident')
  if (text.includes('wrongful death')) areas.push('wrongful_death')
  if (text.includes('slip') || text.includes('premises')) areas.push('premises_liability')
  if (text.includes('medical malpractice') || text.includes('med mal')) areas.push('medical_malpractice')
  if (text.includes('workers') || text.includes('work comp')) areas.push('workers_compensation')

  // Default to personal_injury if we found nothing specific
  if (areas.length === 0) areas.push('personal_injury')

  return areas
}

/**
 * Publish attorney search results to the database.
 * Upserts by googlePlaceId for idempotency.
 */
export async function publishAttorneys(
  results: AttorneySearchResult[],
  locationOverride?: { city: string; stateCode: string }
): Promise<AttorneyPublishResult> {
  const stats: AttorneyPublishResult = {
    created: 0,
    updated: 0,
    reviewsAdded: 0,
    errors: [],
  }

  for (const { listing, reviews } of results) {
    try {
      const parsed = parseAddress(listing.address)
      const city = locationOverride?.city ?? parsed.city
      const stateCode = locationOverride?.stateCode ?? parsed.stateCode
      const practiceAreas = inferPracticeAreas(listing.title, listing.category)

      // Check if attorney already exists
      const existing = listing.placeId
        ? await prisma.attorney.findUnique({
            where: { googlePlaceId: listing.placeId },
            select: { id: true },
          })
        : null

      let attorneyId: string

      if (existing) {
        // Update
        await prisma.attorney.update({
          where: { id: existing.id },
          data: {
            name: listing.title,
            phone: listing.phone,
            website: listing.website,
            address: listing.address,
            city,
            stateCode,
            zipCode: parsed.zipCode,
            latitude: listing.latitude,
            longitude: listing.longitude,
            practiceAreas,
          },
        })
        attorneyId = existing.id
        stats.updated++
      } else {
        // Create
        const slug = slugify(listing.title, city, stateCode ?? 'US')

        // Handle slug collision by appending a hash
        let finalSlug = slug
        const slugExists = await prisma.attorney.findUnique({
          where: { slug: finalSlug },
          select: { id: true },
        })
        if (slugExists) {
          finalSlug = `${slug}-${listing.placeId.slice(-6)}`
        }

        const created = await prisma.attorney.create({
          data: {
            slug: finalSlug,
            name: listing.title,
            googlePlaceId: listing.placeId,
            phone: listing.phone,
            website: listing.website,
            address: listing.address,
            city,
            stateCode,
            zipCode: parsed.zipCode,
            latitude: listing.latitude,
            longitude: listing.longitude,
            practiceAreas,
          },
        })
        attorneyId = created.id
        stats.created++
      }

      // Upsert reviews
      if (reviews.length > 0) {
        for (const review of reviews) {
          try {
            await prisma.attorneyReview.upsert({
              where: {
                googleReviewId: review.reviewId,
              },
              update: {
                rating: review.rating,
                text: review.text,
              },
              create: {
                attorneyId,
                googleReviewId: review.reviewId,
                authorName: review.authorName,
                rating: review.rating,
                text: review.text,
                publishedAt: review.publishedAt,
                language: review.language,
              },
            })
            stats.reviewsAdded++
          } catch (reviewErr) {
            // Skip individual review errors (e.g. duplicate constraint)
          }
        }
      }
    } catch (error) {
      stats.errors.push({
        placeId: listing.placeId,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  console.log(
    `[Attorney Publisher] Created: ${stats.created}, Updated: ${stats.updated}, ` +
    `Reviews: ${stats.reviewsAdded}, Errors: ${stats.errors.length}`
  )

  return stats
}

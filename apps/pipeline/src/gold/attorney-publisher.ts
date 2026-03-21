/**
 * Attorney Gold Publisher — upserts attorney profiles and reviews into Prisma.
 * Idempotent via googlePlaceId upsert.
 * Captures ALL business profile and review fields from DataForSEO.
 */

import { prisma, type Prisma } from '@velora/db'
import type { GoogleBusinessProfile, GoogleReviewFull, AttorneySearchResult } from '../bronze/sources/dataforseo-adapter'

type JsonValue = Prisma.InputJsonValue

export interface AttorneyPublishResult {
  created: number
  updated: number
  reviewsAdded: number
  errors: Array<{ placeId: string; error: string }>
}

function slugify(name: string, city: string | null, stateCode: string): string {
  return [name, city, stateCode]
    .filter(Boolean)
    .join('-')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

function inferPracticeAreas(title: string, category: string | null, additionalCategories: string[]): string[] {
  const text = `${title} ${category ?? ''} ${additionalCategories.join(' ')}`.toLowerCase()
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
  if (text.includes('dog bite') || text.includes('animal')) areas.push('dog_bite')
  if (text.includes('product liability') || text.includes('defective')) areas.push('product_liability')

  if (areas.length === 0) areas.push('personal_injury')
  return areas
}

function parseAddressForZip(address: string | null, addressInfo: Record<string, string> | null): string | null {
  if (addressInfo?.zip || addressInfo?.postal_code) return addressInfo.zip ?? addressInfo.postal_code ?? null
  if (!address) return null
  const zipMatch = address.match(/\b(\d{5}(?:-\d{4})?)\b/)
  return zipMatch?.[1] ?? null
}

/**
 * Publish attorney search results to the database.
 * Full upsert of all business profile fields + all review fields.
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

  for (const { profile, reviews } of results) {
    try {
      const city = locationOverride?.city ?? (profile.addressInfo as Record<string, string> | null)?.city ?? null
      const stateCode = locationOverride?.stateCode ?? (profile.addressInfo as Record<string, string> | null)?.region ?? null
      const zipCode = parseAddressForZip(profile.address, profile.addressInfo as Record<string, string> | null)
      const practiceAreas = inferPracticeAreas(profile.title, profile.category, profile.additionalCategories)

      // Common data for create/update
      const profileData = {
        name: profile.title,
        phone: profile.phone,
        website: profile.website,
        domain: profile.domain,
        address: profile.address,
        addressInfo: (profile.addressInfo as JsonValue) ?? undefined,
        city,
        stateCode,
        zipCode,
        latitude: profile.latitude,
        longitude: profile.longitude,
        description: profile.description,
        category: profile.category,
        categoryIds: profile.categoryIds,
        additionalCategories: profile.additionalCategories,
        logoUrl: profile.logoUrl,
        mainImageUrl: profile.mainImageUrl,
        totalPhotos: profile.totalPhotos,
        isClaimed: profile.isClaimed,
        googleRating: profile.rating,
        googleReviewCount: profile.reviewCount,
        ratingDistribution: (profile.ratingDistribution as JsonValue) ?? undefined,
        workHours: (profile.workHours as JsonValue) ?? undefined,
        attributes: (profile.attributes as JsonValue) ?? undefined,
        peopleAlsoSearch: (profile.peopleAlsoSearch as JsonValue) ?? undefined,
        googleMapsUrl: profile.googleMapsUrl,
        contactInfo: (profile.contactInfo as JsonValue) ?? undefined,
        practiceAreas,
      }

      // Upsert attorney by placeId (single query instead of find+create/update)
      let attorneyId: string

      if (profile.placeId) {
        const baseSlug = slugify(profile.title, city, stateCode ?? 'US')
        const uniqueSlug = `${baseSlug}-${profile.placeId.slice(-6)}`

        const result = await prisma.attorney.upsert({
          where: { googlePlaceId: profile.placeId },
          update: {
            ...profileData,
            googleCid: profile.cid ?? undefined,
          },
          create: {
            slug: uniqueSlug,
            googlePlaceId: profile.placeId,
            googleCid: profile.cid ?? undefined,
            ...profileData,
          },
          select: { id: true, createdAt: true, updatedAt: true },
        })
        attorneyId = result.id
        // If createdAt and updatedAt are very close, it was just created
        if (Math.abs(result.createdAt.getTime() - result.updatedAt.getTime()) < 1000) {
          stats.created++
        } else {
          stats.updated++
        }
      } else {
        const baseSlug = slugify(profile.title, city, stateCode ?? 'US')
        const created = await prisma.attorney.create({
          data: {
            slug: `${baseSlug}-${Date.now().toString(36)}`,
            googleCid: profile.cid ?? undefined,
            ...profileData,
          },
        })
        attorneyId = created.id
        stats.created++
      }

      // Batch insert reviews with skipDuplicates (much faster than individual upserts)
      if (reviews.length > 0) {
        const reviewData = reviews.map(review => ({
          attorneyId,
          googleReviewId: review.reviewId,
          authorName: review.authorName,
          authorImageUrl: review.authorImageUrl,
          authorProfileUrl: review.authorProfileUrl,
          rating: review.rating,
          text: review.text,
          reviewUrl: review.reviewUrl,
          publishedAt: review.publishedAt,
          timeAgo: review.timeAgo,
          language: review.language,
          isLocalGuide: review.isLocalGuide,
          photosCount: review.photosCount,
          images: (review.images as JsonValue) ?? undefined,
          ownerResponse: review.ownerResponse,
          ownerResponseAt: review.ownerResponseTimestamp,
        }))

        try {
          const result = await prisma.attorneyReview.createMany({
            data: reviewData,
            skipDuplicates: true,
          })
          stats.reviewsAdded += result.count
        } catch {
          // Fallback: try individual inserts if batch fails
          for (const data of reviewData) {
            try {
              await prisma.attorneyReview.create({ data })
              stats.reviewsAdded++
            } catch {
              // Skip duplicate/constraint errors
            }
          }
        }
      }
    } catch (error) {
      stats.errors.push({
        placeId: profile.placeId,
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

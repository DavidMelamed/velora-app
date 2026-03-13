import { Router } from 'express'
import { prisma } from '@velora/db'
import { analyzeReviews } from '../services/review-intelligence'
import { computeAttorneyIndex } from '../services/attorney-index'
import { fetchAttorneyReviews } from '../services/google-places'
import type { AttorneyReview } from '../services/review-intelligence'

const router = Router()

/**
 * GET /api/attorneys — List attorneys with index scores
 * Query params: state, city, page, limit, sort
 */
router.get('/', async (req, res) => {
  try {
    const { state, city, page = '1', limit = '20', sort = 'score' } = req.query

    const pageNum = Math.max(1, parseInt(page as string, 10) || 1)
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10) || 20))
    const skip = (pageNum - 1) * limitNum

    // Build where clause
    const where: Record<string, unknown> = {}
    if (state && typeof state === 'string') {
      where.stateCode = state.toUpperCase()
    }
    if (city && typeof city === 'string') {
      where.city = { contains: city, mode: 'insensitive' }
    }

    const [attorneys, total] = await Promise.all([
      prisma.attorney.findMany({
        where,
        include: {
          attorneyIndex: true,
          reviewIntelligence: true,
          _count: { select: { reviews: true } },
        },
        skip,
        take: limitNum,
        orderBy:
          sort === 'score'
            ? { attorneyIndex: { score: 'desc' } }
            : sort === 'name'
              ? { name: 'asc' }
              : { createdAt: 'desc' },
      }),
      prisma.attorney.count({ where }),
    ])

    const data = attorneys.map((attorney) => ({
      id: attorney.id,
      slug: attorney.slug,
      name: attorney.name,
      firmName: attorney.firmName,
      city: attorney.city,
      stateCode: attorney.stateCode,
      practiceAreas: attorney.practiceAreas,
      yearsExperience: attorney.yearsExperience,
      indexScore: attorney.attorneyIndex?.score ?? null,
      dataQuality: attorney.attorneyIndex?.dataQuality ?? null,
      reviewCount: attorney._count.reviews,
      dimensions: attorney.reviewIntelligence
        ? {
            communication: attorney.reviewIntelligence.communication,
            outcome: attorney.reviewIntelligence.outcome,
            responsiveness: attorney.reviewIntelligence.responsiveness,
            empathy: attorney.reviewIntelligence.empathy,
            expertise: attorney.reviewIntelligence.expertise,
            feeTransparency: attorney.reviewIntelligence.feeTransparency,
            trialExperience: attorney.reviewIntelligence.trialExperience,
            satisfaction: attorney.reviewIntelligence.satisfaction,
          }
        : null,
      trend: attorney.reviewIntelligence?.trend ?? null,
    }))

    res.json({
      data,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    })
  } catch (error) {
    console.error('[Attorneys] List error:', error)
    res.status(500).json({ error: 'Failed to fetch attorneys' })
  }
})

/**
 * GET /api/attorneys/:slug — Full attorney profile with review intelligence
 */
router.get('/:slug', async (req, res) => {
  try {
    const attorney = await prisma.attorney.findUnique({
      where: { slug: req.params.slug },
      include: {
        reviews: {
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
        reviewIntelligence: true,
        attorneyIndex: true,
      },
    })

    if (!attorney) {
      res.status(404).json({ error: 'Attorney not found' })
      return
    }

    // If no review intelligence exists yet, compute it on-the-fly
    let intelligence = attorney.reviewIntelligence
    let indexScore = attorney.attorneyIndex

    if (!intelligence && attorney.reviews.length > 0) {
      const reviewData: AttorneyReview[] = attorney.reviews.map((r) => ({
        id: r.id,
        text: r.text,
        rating: r.rating,
        publishedAt: r.createdAt,
        authorName: r.authorName,
      }))

      const analyzed = await analyzeReviews(reviewData)
      const computed = computeAttorneyIndex(analyzed, attorney.practiceAreas)

      // Persist the computed intelligence
      try {
        intelligence = await prisma.reviewIntelligence.upsert({
          where: { attorneyId: attorney.id },
          create: {
            attorneyId: attorney.id,
            ...analyzed.dimensions,
            trend: analyzed.trend,
            trendPeriodMonths: 12,
            bestQuotes: JSON.parse(JSON.stringify(analyzed.bestQuotes)),
            reviewCount: analyzed.reviewCount,
          },
          update: {
            ...analyzed.dimensions,
            trend: analyzed.trend,
            bestQuotes: JSON.parse(JSON.stringify(analyzed.bestQuotes)),
            reviewCount: analyzed.reviewCount,
            analyzedAt: new Date(),
          },
        })

        indexScore = await prisma.attorneyIndex.upsert({
          where: { attorneyId: attorney.id },
          create: {
            attorneyId: attorney.id,
            score: computed.score,
            communicationScore: computed.components.communication,
            responsivenessScore: computed.components.responsiveness,
            outcomeScore: computed.components.outcome,
            reviewCountScore: computed.components.reviewCount,
            specialtyScore: computed.components.specialty,
            reviewCount: analyzed.reviewCount,
            dataQuality: computed.dataQuality,
          },
          update: {
            score: computed.score,
            communicationScore: computed.components.communication,
            responsivenessScore: computed.components.responsiveness,
            outcomeScore: computed.components.outcome,
            reviewCountScore: computed.components.reviewCount,
            specialtyScore: computed.components.specialty,
            reviewCount: analyzed.reviewCount,
            dataQuality: computed.dataQuality,
            computedAt: new Date(),
          },
        })
      } catch (persistError) {
        console.warn('[Attorneys] Failed to persist intelligence:', persistError)
      }
    }

    // If attorney has a Google Place ID but no reviews, try fetching
    if (attorney.googlePlaceId && attorney.reviews.length === 0) {
      const googleReviews = await fetchAttorneyReviews(attorney.googlePlaceId)
      if (googleReviews.length > 0) {
        // Store reviews and recompute
        try {
          for (const review of googleReviews) {
            await prisma.attorneyReview.create({
              data: {
                attorneyId: attorney.id,
                googleReviewId: review.id,
                authorName: review.authorName,
                rating: review.rating,
                text: review.text,
                publishedAt: review.publishedAt,
              },
            })
          }
        } catch {
          // Duplicates or other issues — non-fatal
        }
      }
    }

    res.json({
      data: {
        id: attorney.id,
        slug: attorney.slug,
        name: attorney.name,
        firmName: attorney.firmName,
        phone: attorney.phone,
        email: attorney.email,
        website: attorney.website,
        address: attorney.address,
        city: attorney.city,
        stateCode: attorney.stateCode,
        zipCode: attorney.zipCode,
        latitude: attorney.latitude,
        longitude: attorney.longitude,
        practiceAreas: attorney.practiceAreas,
        yearsExperience: attorney.yearsExperience,
        barNumber: attorney.barNumber,
        indexScore: indexScore
          ? {
              score: indexScore.score,
              components: {
                communication: { score: indexScore.communicationScore, weight: 0.25 },
                responsiveness: { score: indexScore.responsivenessScore, weight: 0.20 },
                outcome: { score: indexScore.outcomeScore, weight: 0.30 },
                reviewCount: { score: indexScore.reviewCountScore, weight: 0.15 },
                specialty: { score: indexScore.specialtyScore, weight: 0.10 },
              },
              dataQuality: indexScore.dataQuality,
              reviewCount: indexScore.reviewCount,
            }
          : null,
        reviewIntelligence: intelligence
          ? {
              dimensions: {
                communication: intelligence.communication,
                outcome: intelligence.outcome,
                responsiveness: intelligence.responsiveness,
                empathy: intelligence.empathy,
                expertise: intelligence.expertise,
                feeTransparency: intelligence.feeTransparency,
                trialExperience: intelligence.trialExperience,
                satisfaction: intelligence.satisfaction,
              },
              trend: intelligence.trend,
              reviewCount: intelligence.reviewCount,
              bestQuotes: intelligence.bestQuotes,
            }
          : null,
        recentReviews: attorney.reviews.slice(0, 10).map((r) => ({
          id: r.id,
          authorName: r.authorName,
          rating: r.rating,
          text: r.text,
          publishedAt: r.publishedAt,
        })),
      },
    })
  } catch (error) {
    console.error('[Attorneys] Profile error:', error)
    res.status(500).json({ error: 'Failed to fetch attorney profile' })
  }
})

export default router

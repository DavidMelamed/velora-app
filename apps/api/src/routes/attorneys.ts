import { Router } from 'express'
import { prisma } from '@velora/db'

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
    // When sorting by score, only show attorneys that have been scored
    if (sort === 'score') {
      where.attorneyIndex = { isNot: null }
    }
    // When sorting by rating, only show attorneys with a rating
    if (sort === 'rating') {
      where.googleRating = { not: null }
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
            ? [{ attorneyIndex: { score: 'desc' } }, { googleRating: 'desc' }]
            : sort === 'reviews'
              ? { googleReviewCount: 'desc' }
              : sort === 'name'
                ? { name: 'asc' }
                : { googleRating: 'desc' },
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
      website: attorney.website,
      phone: attorney.phone,
      googleRating: attorney.googleRating,
      googleReviewCount: attorney.googleReviewCount,
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

    // Use pre-computed intelligence (from batch script) — no on-the-fly AI calls
    const intelligence = attorney.reviewIntelligence
    const indexScore = attorney.attorneyIndex

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
        googleRating: attorney.googleRating,
        googleReviewCount: attorney.googleReviewCount,
        description: attorney.description,
        category: attorney.category,
        logoUrl: attorney.logoUrl,
        mainImageUrl: attorney.mainImageUrl,
        isClaimed: attorney.isClaimed,
        googleMapsUrl: attorney.googleMapsUrl,
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

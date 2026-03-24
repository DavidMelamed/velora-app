import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { prisma } from '@velora/db'
import { displayName } from '@velora/shared'
import { AttorneyProfile } from '@/components/attorney/AttorneyProfileV2'
import type { DimensionScores } from '@/components/attorney/ReviewDimensions'
import type { ReviewStats, ReviewSnippet } from '@/components/attorney/ReviewInsights'
import { TrackProfileView } from '@/components/attorney/TrackProfileView'
import { legalServiceSchema, jsonLdScript } from '@/lib/seo/schema-markup'

interface AttorneyPageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: AttorneyPageProps): Promise<Metadata> {
  const { slug } = await params
  const attorney = await prisma.attorney.findUnique({
    where: { slug },
    select: { name: true, firmName: true, city: true, stateCode: true, practiceAreas: true },
  })

  if (!attorney) return { title: 'Attorney Not Found' }

  const location = [attorney.city, attorney.stateCode].filter(Boolean).join(', ')
  const practiceAreas = attorney.practiceAreas.slice(0, 3).map(displayName).join(', ')
  const title = `${attorney.name}${attorney.firmName ? ` - ${attorney.firmName}` : ''} | Velora`
  const description = `${attorney.name} in ${location}. ${practiceAreas}. View Attorney Index score, Review Intelligence, and client reviews on Velora.`

  return {
    title,
    description,
    openGraph: { title, description, type: 'profile' },
  }
}

export default async function AttorneyPage({ params }: AttorneyPageProps) {
  const { slug } = await params

  let attorney
  try {
    attorney = await prisma.attorney.findUnique({
      where: { slug },
      include: {
        reviewIntelligence: true,
        attorneyIndex: true,
        _count: { select: { reviews: true } },
      },
    })
  } catch {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-gray-900">Unable to Load Attorney Profile</h1>
        <p className="mt-2 text-gray-500">Please try again later.</p>
        <a href="/attorneys" className="mt-4 inline-block text-blue-600 hover:underline">Back to Directory</a>
      </main>
    )
  }

  if (!attorney) notFound()

  // Fetch recent reviews for display and stats computation
  const ninetyDaysAgo = new Date()
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)

  const [recentReviewCount, reviews] = await Promise.all([
    prisma.attorneyReview.count({
      where: { attorneyId: attorney.id, publishedAt: { gte: ninetyDaysAgo } },
    }),
    prisma.attorneyReview.findMany({
      where: { attorneyId: attorney.id },
      orderBy: { publishedAt: 'desc' },
      take: 20,
      select: {
        id: true,
        authorName: true,
        rating: true,
        text: true,
        publishedAt: true,
        isLocalGuide: true,
        ownerResponse: true,
        ownerResponseAt: true,
        photosCount: true,
        dimensions: true,
      },
    }),
  ])

  // Compute response rate from the fetched batch (representative sample)
  const reviewsWithResponse = reviews.filter((r) => r.ownerResponse).length
  const responseRate = reviews.length > 0 ? Math.round((reviewsWithResponse / reviews.length) * 100) : 0

  // Compute per-dimension consistency (std deviation) from individual review dimensions
  const reviewDimArrays: Record<string, number[]> = {}
  for (const review of reviews) {
    if (review.dimensions && typeof review.dimensions === 'object') {
      const dims = review.dimensions as Record<string, number>
      for (const [key, value] of Object.entries(dims)) {
        if (typeof value === 'number') {
          if (!reviewDimArrays[key]) reviewDimArrays[key] = []
          reviewDimArrays[key].push(value)
        }
      }
    }
  }
  const dimensionConsistency: Partial<DimensionScores> = {}
  for (const [key, values] of Object.entries(reviewDimArrays)) {
    if (values.length >= 3) {
      const mean = values.reduce((a, b) => a + b, 0) / values.length
      const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length
      ;(dimensionConsistency as Record<string, number>)[key] = Math.round(Math.sqrt(variance))
    }
  }

  const totalReviews = attorney._count.reviews || attorney.googleReviewCount || 0
  const dataQuality: 'HIGH' | 'MEDIUM' | 'LOW' =
    totalReviews >= 30 ? 'HIGH' : totalReviews >= 10 ? 'MEDIUM' : 'LOW'

  const reviewStats: ReviewStats = {
    totalReviews,
    recentReviewCount,
    responseRate,
    trend: (attorney.reviewIntelligence?.trend as ReviewStats['trend']) ?? null,
    dataQuality,
    dimensionConsistency: Object.keys(dimensionConsistency).length > 0 ? dimensionConsistency as DimensionScores : null,
  }

  const reviewSnippets: ReviewSnippet[] = reviews.map((r) => ({
    id: r.id,
    authorName: r.authorName,
    rating: r.rating,
    text: r.text,
    publishedAt: r.publishedAt?.toISOString() ?? null,
    isLocalGuide: r.isLocalGuide ?? false,
    ownerResponse: r.ownerResponse,
    ownerResponseAt: r.ownerResponseAt,
    photosCount: r.photosCount ?? 0,
  }))

  const dimensions: DimensionScores | null = attorney.reviewIntelligence
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
    : null

  let bestQuotes: string[] = []
  try {
    const rawQuotes = attorney.reviewIntelligence?.bestQuotes
    if (Array.isArray(rawQuotes)) {
      bestQuotes = rawQuotes
        .map((q: unknown) =>
          typeof q === 'string'
            ? q
            : typeof q === 'object' && q !== null && 'text' in q
              ? String((q as Record<string, unknown>).text)
              : '',
        )
        .filter(Boolean)
      bestQuotes = JSON.parse(JSON.stringify(bestQuotes))
    }
  } catch {
    bestQuotes = []
  }

  const schemaData = legalServiceSchema({
    name: attorney.name,
    slug: attorney.slug,
    firmName: attorney.firmName,
    city: attorney.city,
    stateCode: attorney.stateCode,
    phone: attorney.phone,
    website: attorney.website,
    indexScore: attorney.attorneyIndex?.score,
    reviewCount: attorney._count.reviews,
    practiceAreas: attorney.practiceAreas,
  })

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(schemaData) }}
      />
      <TrackProfileView
        slug={attorney.slug}
        name={attorney.name}
        firmName={attorney.firmName}
        city={attorney.city}
        stateCode={attorney.stateCode}
        indexScore={attorney.attorneyIndex?.score ?? null}
        reviewCount={totalReviews}
      />
      <AttorneyProfile
        attorney={attorney}
        indexScore={attorney.attorneyIndex?.score ?? null}
        reviewCount={totalReviews}
        dimensions={dimensions}
        bestQuotes={bestQuotes ?? undefined}
        reviewStats={reviewStats}
        reviewSnippets={reviewSnippets}
      />
    </>
  )
}

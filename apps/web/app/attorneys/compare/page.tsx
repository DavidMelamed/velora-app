import type { Metadata } from 'next'
import { prisma } from '@velora/db'
import { CompareView, type CompareAttorney } from '@/components/attorney/CompareView'
import type { DimensionScores } from '@/components/attorney/ReviewDimensions'
import { getAttorneyReviewData, buildReviewStats } from '@/lib/attorney-data'

export const metadata: Metadata = {
  title: 'Compare Attorneys — Side by Side | Velora',
  description:
    'Compare personal injury attorneys side by side. Review dimensions, client feedback, response rates, and Attorney Index scores.',
}

interface ComparePageProps {
  searchParams: Promise<{ slugs?: string }>
}

export default async function ComparePage({ searchParams }: ComparePageProps) {
  const sp = await searchParams
  const slugList = (sp.slugs ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 4)

  if (slugList.length < 2) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Compare Attorneys</h1>
        <p className="mt-3 text-gray-500">
          Select at least 2 attorneys from the{' '}
          <a href="/attorneys" className="text-blue-600 hover:underline">
            directory
          </a>{' '}
          to compare them side by side.
        </p>
        <a
          href="/attorneys"
          className="mt-6 inline-block rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          Browse Attorneys
        </a>
      </main>
    )
  }

  const attorneys = await prisma.attorney.findMany({
    where: { slug: { in: slugList } },
    include: {
      reviewIntelligence: true,
      attorneyIndex: true,
      _count: { select: { reviews: true } },
    },
  })

  if (attorneys.length < 2) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Compare Attorneys</h1>
        <p className="mt-3 text-gray-500">
          Could not find enough attorneys to compare. Some profiles may no longer exist.
        </p>
        <a
          href="/attorneys"
          className="mt-6 inline-block rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          Browse Attorneys
        </a>
      </main>
    )
  }

  // Preserve the order from the URL
  const orderedAttorneys = slugList
    .map((slug) => attorneys.find((a) => a.slug === slug))
    .filter(Boolean) as typeof attorneys

  // Fetch review data in parallel
  const enriched: CompareAttorney[] = await Promise.all(
    orderedAttorneys.map(async (attorney) => {
      const totalReviews = attorney._count.reviews || attorney.googleReviewCount || 0
      const reviewData = await getAttorneyReviewData(attorney.id, totalReviews)

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

      const reviewStats = buildReviewStats(
        totalReviews,
        reviewData.recentReviewCount,
        reviewData.responseRate,
        attorney.reviewIntelligence?.trend,
        reviewData.dataQuality,
        reviewData.dimensionConsistency,
      )

      return {
        slug: attorney.slug,
        name: attorney.name,
        firmName: attorney.firmName,
        city: attorney.city,
        stateCode: attorney.stateCode,
        phone: attorney.phone,
        website: attorney.website,
        indexScore: attorney.attorneyIndex?.score ?? null,
        dimensions,
        reviewStats,
        bestQuotes,
      }
    }),
  )

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <nav className="mb-6 text-sm text-gray-500">
        <a href="/" className="hover:text-blue-600">Home</a>
        <span className="mx-2">/</span>
        <a href="/attorneys" className="hover:text-blue-600">Attorneys</a>
        <span className="mx-2">/</span>
        <span>Compare</span>
      </nav>

      <h1 className="mb-2 text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
        Attorney Comparison
      </h1>
      <p className="mb-8 text-gray-500">
        Side-by-side analysis of {enriched.length} attorneys across review dimensions, client feedback, and responsiveness.
      </p>

      <CompareView attorneys={enriched} />
    </main>
  )
}

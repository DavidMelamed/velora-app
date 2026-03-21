import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { prisma } from '@velora/db'
import { AttorneyProfile } from '@/components/attorney/AttorneyProfile'
import type { DimensionScores } from '@/components/attorney/ReviewDimensions'
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
  const title = `${attorney.name}${attorney.firmName ? ` — ${attorney.firmName}` : ''} | Velora`
  const description = `${attorney.name} in ${location}. ${attorney.practiceAreas.slice(0, 3).join(', ')}. View Attorney Index score, Review Intelligence, and client reviews on Velora.`

  return {
    title,
    description,
    openGraph: { title, description, type: 'profile' },
  }
}

export default async function AttorneyPage({ params }: AttorneyPageProps) {
  const { slug } = await params

  const attorney = await prisma.attorney.findUnique({
    where: { slug },
    include: {
      reviewIntelligence: true,
      attorneyIndex: true,
      _count: { select: { reviews: true } },
    },
  })

  if (!attorney) notFound()

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

  // bestQuotes may be string[] or {text, rating, dimension, sentiment}[] depending on data source
  // JSON round-trip to break RSC deduplication references
  const rawQuotes = attorney.reviewIntelligence?.bestQuotes
  const bestQuotes: string[] = rawQuotes
    ? JSON.parse(JSON.stringify(
        (rawQuotes as unknown[]).map((q) =>
          typeof q === 'string' ? q : (q as { text?: string })?.text ?? ''
        ).filter(Boolean)
      ))
    : []

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
      <AttorneyProfile
        attorney={attorney}
        indexScore={attorney.attorneyIndex?.score ?? null}
        reviewCount={attorney._count.reviews}
        dimensions={dimensions}
        bestQuotes={bestQuotes ?? undefined}
      />
    </>
  )
}

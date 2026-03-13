import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { prisma } from '@velora/db'
import type { CrashNarrativeContent, EqualizerBriefing, ComparableCohort, LiabilitySignal, SettlementContext, AttorneyMatch } from '@velora/shared'
import { CrashHeader } from '@/components/crash/CrashHeader'
import { CrashNarrative } from '@/components/crash/CrashNarrative'
import { CrashMap } from '@/components/crash/CrashMap'
import { CrashEqualizer } from '@/components/crash/CrashEqualizer'
import { GenerateEqualizerButton } from '@/components/crash/GenerateEqualizerButton'
import { CopilotProvider } from '@/components/copilot/CopilotProvider'
import { CrashPageSidebar } from '@/components/copilot/CrashPageSidebar'
import { IWasInThisCrash } from '@/components/crash/IWasInThisCrash'
import { NarrativeThumbsFeedback } from '@/components/feedback/NarrativeThumbsFeedback'
import { EqualizerUseful } from '@/components/feedback/EqualizerUseful'
import { CrashPageFeedbackTracker } from '@/components/feedback/CrashPageFeedbackTracker'
import { crashEventSchema, jsonLdScript } from '@/lib/seo/schema-markup'

interface CrashPageProps {
  params: Promise<{ id: string }>
}

async function getCrash(id: string) {
  const crash = await prisma.crash.findUnique({
    where: { id },
    include: {
      vehicles: {
        include: { driver: true },
      },
      persons: {
        select: {
          id: true,
          personType: true,
          injuryStatus: true,
          sex: true,
          seatingPosition: true,
        },
      },
      narratives: {
        take: 1,
        orderBy: { generatedAt: 'desc' },
      },
      equalizer: true,
    },
  })

  return crash
}

export async function generateMetadata({ params }: CrashPageProps): Promise<Metadata> {
  const { id } = await params
  const crash = await getCrash(id)

  if (!crash) {
    return { title: 'Crash Not Found' }
  }

  const location = [crash.cityName, crash.county, crash.stateCode].filter(Boolean).join(', ')
  const date = crash.crashDate.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
  const severity = (crash.crashSeverity || 'Unknown').replace(/_/g, ' ').toLowerCase()

  const narrative = crash.narratives[0]
  const narrativeContent = narrative?.content as unknown as CrashNarrativeContent | undefined
  const description = narrativeContent?.summary ||
    `${severity} crash reported on ${date} in ${location}. ${crash.vehicles.length} vehicle(s), ${crash.persons.length} person(s) involved.`

  const title = narrativeContent?.headline || `Crash Report: ${location} - ${date}`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'article',
      publishedTime: crash.crashDate.toISOString(),
      siteName: 'Velora',
    },
  }
}

export default async function CrashPage({ params }: CrashPageProps) {
  const { id } = await params
  const crash = await getCrash(id)

  if (!crash) {
    notFound()
  }

  const narrative = crash.narratives[0]
  const narrativeContent = narrative?.content as unknown as CrashNarrativeContent | undefined
  const location = [crash.streetAddress, crash.cityName, crash.county].filter(Boolean).join(', ')

  // Build equalizer briefing from DB data if available
  const equalizerData = crash.equalizer
  const equalizerBriefing: EqualizerBriefing | null = equalizerData
    ? {
        comparable: equalizerData.comparableCohort as unknown as ComparableCohort,
        liability: equalizerData.liabilitySignals as unknown as LiabilitySignal[],
        settlement: equalizerData.settlementContext as unknown as SettlementContext,
        attorneyMatches: equalizerData.attorneyMatches as unknown as AttorneyMatch[],
        sections: equalizerData.briefingSections as unknown as EqualizerBriefing['sections'],
      }
    : null

  const crashContext = {
    id: crash.id,
    crashDate: crash.crashDate.toISOString(),
    location,
    severity: crash.crashSeverity,
    stateCode: crash.stateCode,
    county: crash.county,
    mannerOfCollision: crash.mannerOfCollision,
    vehicleCount: crash.vehicles.length,
    personCount: crash.persons.length,
    latitude: crash.latitude,
    longitude: crash.longitude,
  }

  const schemaData = crashEventSchema({
    id: crash.id,
    crashDate: crash.crashDate.toISOString(),
    location,
    stateCode: crash.stateCode,
    latitude: crash.latitude,
    longitude: crash.longitude,
    severity: crash.crashSeverity,
    vehicleCount: crash.vehicles.length,
    personCount: crash.persons.length,
    description: narrativeContent?.summary,
  })

  return (
    <CopilotProvider>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(schemaData) }}
      />
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <CrashHeader
          crashDate={crash.crashDate}
          location={location}
          severity={crash.crashSeverity}
          vehicleCount={crash.vehicles.length}
          personCount={crash.persons.length}
          stateCode={crash.stateCode}
          county={crash.county}
        />

        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          {/* Narrative — main content */}
          <div className="lg:col-span-2">
            {narrativeContent ? (
              <>
                <CrashNarrative content={narrativeContent} severity={crash.crashSeverity} />
                <NarrativeThumbsFeedback crashId={crash.id} sessionId={crash.id} />
              </>
            ) : (
              <div className="rounded-lg border border-gray-200 bg-white p-6">
                <h2 className="text-lg font-semibold text-gray-900">Crash Details</h2>
                <p className="mt-2 text-sm text-gray-600">
                  AI-generated narrative is not yet available for this crash.
                  Basic crash data is shown below.
                </p>

                <dl className="mt-4 space-y-3">
                  {crash.mannerOfCollision && (
                    <DetailItem
                      label="Collision Type"
                      value={crash.mannerOfCollision.replace(/_/g, ' ')}
                    />
                  )}
                  {crash.atmosphericCondition && (
                    <DetailItem
                      label="Weather"
                      value={crash.atmosphericCondition.replace(/_/g, ' ')}
                    />
                  )}
                  {crash.lightCondition && (
                    <DetailItem
                      label="Lighting"
                      value={crash.lightCondition.replace(/_/g, ' ')}
                    />
                  )}
                  {crash.vehicles.length > 0 && (
                    <DetailItem
                      label="Vehicles"
                      value={crash.vehicles
                        .map((v) => [v.modelYear, v.make, v.model].filter(Boolean).join(' ') || 'Unknown vehicle')
                        .join('; ')}
                    />
                  )}
                </dl>
              </div>
            )}
          </div>

          {/* Sidebar — map and metadata */}
          <div className="space-y-6">
            <CrashMap latitude={crash.latitude} longitude={crash.longitude} />

            {/* Quick facts */}
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500">
                Quick Facts
              </h3>
              <dl className="mt-3 space-y-2">
                <DetailItem label="Report ID" value={crash.stateUniqueId} />
                <DetailItem label="Data Source" value={crash.dataSource} />
                {crash.crashTime && <DetailItem label="Time" value={crash.crashTime} />}
                {crash.intersectionType && (
                  <DetailItem
                    label="Intersection"
                    value={crash.intersectionType.replace(/_/g, ' ')}
                  />
                )}
              </dl>
            </div>
          </div>
        </div>

        {/* I Was In This Crash */}
        <div className="mt-6">
          <IWasInThisCrash crashId={crash.id} isVerified={crash.isVerified} />
        </div>

        {/* Equalizer Section */}
        <div className="mt-8">
          {equalizerBriefing ? (
            <>
              <CrashEqualizer
                briefing={equalizerBriefing}
                stateCode={crash.stateCode}
              />
              <EqualizerUseful crashId={crash.id} sessionId={crash.id} />
            </>
          ) : (
            <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
              <h2 className="text-lg font-semibold text-gray-900">Crash Equalizer</h2>
              <p className="mt-2 text-sm text-gray-500">
                Get a personalized briefing with comparable crashes, liability signals,
                settlement estimates, and attorney recommendations.
              </p>
              <div className="mt-4">
                <GenerateEqualizerButton crashId={crash.id} />
              </div>
            </div>
          )}
        </div>
      </main>

      <CrashPageSidebar crash={crashContext} />
      <CrashPageFeedbackTracker crashId={crash.id} />
    </CopilotProvider>
  )
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium text-gray-400">{label}</dt>
      <dd className="text-sm text-gray-700">{value}</dd>
    </div>
  )
}

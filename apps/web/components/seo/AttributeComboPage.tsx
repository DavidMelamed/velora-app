'use client'

import type { ResolvedSegments } from '@/lib/seo/resolve-segments'
import { ATTRIBUTE_DISPLAY_NAMES, type CrashAttribute } from '@/lib/seo/resolve-segments'

interface AttributeStats {
  totalCrashes: number
  fatalCount: number
  injuryCount: number
  avgVehicles: number
  topContributingFactors: Array<{ factor: string; count: number }>
  recentCrashes: Array<{
    id: string
    date: string
    severity: string
    location: string
  }>
  relatedAttributes: CrashAttribute[]
}

interface AttributeComboPageProps {
  resolved: ResolvedSegments
  stats: AttributeStats
}

export function AttributeComboPage({ resolved, stats }: AttributeComboPageProps) {
  const city = resolved.city
    ? resolved.city.split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
    : null
  const location = city ? `${city}, ${resolved.stateName}` : resolved.stateName
  const attributeName = ATTRIBUTE_DISPLAY_NAMES[resolved.attribute as CrashAttribute] ?? resolved.attribute

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {/* Header */}
      <header className="mb-8">
        <nav className="mb-4 text-sm text-gray-500">
          <a href="/" className="hover:text-blue-600">Home</a>
          <span className="mx-2">/</span>
          <a href={`/crashes/${resolved.stateName.toLowerCase().replace(/\s+/g, '-')}`} className="hover:text-blue-600">
            {resolved.stateName}
          </a>
          {city && (
            <>
              <span className="mx-2">/</span>
              <a href={`/crashes/${resolved.stateName.toLowerCase().replace(/\s+/g, '-')}/${resolved.city!.replace(/\s+/g, '-')}`} className="hover:text-blue-600">
                {city}
              </a>
            </>
          )}
          <span className="mx-2">/</span>
          <span>{attributeName}</span>
        </nav>

        <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-4xl">
          {attributeName} in {location}
        </h1>
        <p className="mt-3 text-lg text-gray-600 dark:text-gray-400">
          {stats.totalCrashes > 0
            ? `${stats.totalCrashes.toLocaleString()} ${attributeName?.toLowerCase()} recorded in ${location}.`
            : `No ${attributeName?.toLowerCase()} data available yet for ${location}.`}
        </p>
      </header>

      {/* Key Stats */}
      <div className="mb-8 grid gap-4 sm:grid-cols-4">
        <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {stats.totalCrashes.toLocaleString()}
          </div>
          <div className="text-sm text-gray-500">Total</div>
        </div>
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
          <div className="text-2xl font-bold text-red-700 dark:text-red-300">
            {stats.fatalCount.toLocaleString()}
          </div>
          <div className="text-sm text-red-600 dark:text-red-400">Fatal</div>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20">
          <div className="text-2xl font-bold text-amber-700 dark:text-amber-300">
            {stats.injuryCount.toLocaleString()}
          </div>
          <div className="text-sm text-amber-600 dark:text-amber-400">Injuries</div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {stats.avgVehicles.toFixed(1)}
          </div>
          <div className="text-sm text-gray-500">Avg Vehicles</div>
        </div>
      </div>

      {/* Contributing Factors */}
      {stats.topContributingFactors.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-4 text-xl font-semibold text-gray-900 dark:text-white">
            Common Contributing Factors
          </h2>
          <div className="rounded-lg border border-gray-200 dark:border-gray-700">
            <ul className="divide-y divide-gray-200 dark:divide-gray-700">
              {stats.topContributingFactors.map((f) => (
                <li key={f.factor} className="flex items-center justify-between px-4 py-3">
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    {f.factor.replace(/_/g, ' ')}
                  </span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {f.count.toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* Recent Crashes */}
      {stats.recentCrashes.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-4 text-xl font-semibold text-gray-900 dark:text-white">
            Recent {attributeName}
          </h2>
          <div className="space-y-3">
            {stats.recentCrashes.map((crash) => (
              <a
                key={crash.id}
                href={`/crash/${crash.id}`}
                className="block rounded-lg border border-gray-200 p-4 transition-colors hover:border-blue-300 hover:bg-blue-50/50 dark:border-gray-700 dark:hover:border-blue-700 dark:hover:bg-blue-900/10"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-900 dark:text-white">{crash.date}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      crash.severity === 'FATAL'
                        ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                        : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                    }`}
                  >
                    {crash.severity.replace(/_/g, ' ')}
                  </span>
                </div>
                <div className="mt-1 text-sm text-gray-500">{crash.location}</div>
              </a>
            ))}
          </div>
        </section>
      )}

      {/* Related Crash Types */}
      {stats.relatedAttributes.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-4 text-xl font-semibold text-gray-900 dark:text-white">
            Related Crash Types in {location}
          </h2>
          <div className="flex flex-wrap gap-2">
            {stats.relatedAttributes
              .filter((a) => a !== resolved.attribute)
              .slice(0, 8)
              .map((attr) => {
                const stateSlug = resolved.stateName.toLowerCase().replace(/\s+/g, '-')
                const citySlug = resolved.city?.replace(/\s+/g, '-')
                const href = citySlug
                  ? `/crashes/${stateSlug}/${citySlug}/${attr}`
                  : `/crashes/${stateSlug}/${attr}`
                return (
                  <a
                    key={attr}
                    href={href}
                    className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 transition-colors hover:border-blue-300 hover:text-blue-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:border-blue-600"
                  >
                    {ATTRIBUTE_DISPLAY_NAMES[attr]}
                  </a>
                )
              })}
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="rounded-xl border border-gray-200 bg-gray-50 p-8 text-center dark:border-gray-700 dark:bg-gray-900">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          Involved in {attributeName?.toLowerCase().replace(/s$/, '')}?
        </h2>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Get your free Crash Equalizer report and connect with top-rated attorneys.
        </p>
        <a
          href="/search"
          className="mt-4 inline-block rounded-full bg-blue-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          Find Your Crash
        </a>
      </section>
    </div>
  )
}

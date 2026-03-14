'use client'

import type { ResolvedSegments } from '@/lib/seo/resolve-segments'
import { ATTRIBUTE_DISPLAY_NAMES, type CrashAttribute } from '@/lib/seo/resolve-segments'
import {
  datasetSchema,
  faqPageSchema,
  jsonLdScript,
} from '@/lib/seo/schema-markup'

interface CrashStats {
  totalCrashes: number
  fatalCrashes: number
  injuryCrashes: number
  topCrashTypes: Array<{ type: string; count: number }>
  recentCrashes: Array<{
    id: string
    date: string
    severity: string
    location: string
    vehicles: number
  }>
  monthlyCounts: Array<{ month: string; count: number }>
}

interface LocationPageProps {
  resolved: ResolvedSegments
  stats: CrashStats
}

export function LocationPage({ resolved, stats }: LocationPageProps) {
  const city = resolved.city
    ? resolved.city.split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
    : null
  const location = city ? `${city}, ${resolved.stateName}` : resolved.stateName
  const attribute = resolved.attribute
    ? ATTRIBUTE_DISPLAY_NAMES[resolved.attribute as CrashAttribute]
    : null

  const faqs = [
    {
      question: `How many car crashes have been reported in ${location}?`,
      answer: `Velora has recorded ${stats.totalCrashes.toLocaleString()} crashes in ${location}, including ${stats.fatalCrashes.toLocaleString()} fatal crashes. Data is updated regularly from official state sources.`,
    },
    {
      question: `What is the Crash Equalizer and how does it help after an accident in ${location}?`,
      answer: `The Crash Equalizer is Velora's free tool that analyzes your crash against similar incidents in ${location}. It provides settlement range estimates, liability signals, and connects you with top-rated local attorneys.`,
    },
    {
      question: `How do I find a good personal injury attorney in ${location}?`,
      answer: `Velora's Attorney Index ranks attorneys based on 8 dimensions of client review analysis including communication, outcomes, and responsiveness. Search our attorney directory to find top-rated attorneys near you.`,
    },
    {
      question: `What should I do after a car accident in ${location}?`,
      answer: `After a crash, ensure everyone's safety and call 911. Document the scene, exchange information, and seek medical attention. Then use Velora to search your crash report, get your Crash Equalizer briefing, and connect with a qualified attorney.`,
    },
  ]
  const faqSchemaData = faqPageSchema(faqs)
  const dsSchema = datasetSchema({
    name: `Car Crash Data for ${location}`,
    description: `Comprehensive crash statistics and records for ${location}.`,
    url: `/crashes/${resolved.stateName.toLowerCase().replace(/\s+/g, '-')}${resolved.city ? `/${resolved.city.replace(/\s+/g, '-')}` : ''}`,
    spatialCoverage: location,
  })

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(faqSchemaData) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(dsSchema) }}
      />
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
              <span>{city}</span>
            </>
          )}
          {attribute && (
            <>
              <span className="mx-2">/</span>
              <span>{attribute}</span>
            </>
          )}
        </nav>

        <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-4xl">
          {attribute ? `${attribute} in ${location}` : `Car Crashes in ${location}`}
        </h1>
        <p className="mt-3 text-lg text-gray-600 dark:text-gray-400">
          Comprehensive crash data and statistics.{' '}
          {stats.totalCrashes > 0
            ? `${stats.totalCrashes.toLocaleString()} crashes recorded.`
            : 'Data is being collected for this area.'}
        </p>
      </header>

      {/* Stats Cards */}
      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <StatCard label="Total Crashes" value={stats.totalCrashes.toLocaleString()} />
        <StatCard
          label="Fatal Crashes"
          value={stats.fatalCrashes.toLocaleString()}
          variant="danger"
        />
        <StatCard
          label="Injury Crashes"
          value={stats.injuryCrashes.toLocaleString()}
          variant="warning"
        />
      </div>

      {/* Top Crash Types */}
      {stats.topCrashTypes.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-4 text-xl font-semibold text-gray-900 dark:text-white">
            Top Crash Types
          </h2>
          <div className="space-y-3">
            {stats.topCrashTypes.map((ct) => {
              const pct = stats.totalCrashes > 0 ? (ct.count / stats.totalCrashes) * 100 : 0
              return (
                <div key={ct.type}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="font-medium text-gray-700 dark:text-gray-300">
                      {ct.type.replace(/_/g, ' ')}
                    </span>
                    <span className="text-gray-500">
                      {ct.count.toLocaleString()} ({pct.toFixed(1)}%)
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-700">
                    <div
                      className="h-2 rounded-full bg-blue-600"
                      style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Recent Crashes */}
      {stats.recentCrashes.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-4 text-xl font-semibold text-gray-900 dark:text-white">
            Recent Crashes
          </h2>
          <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Date</th>
                  <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-400">
                    Severity
                  </th>
                  <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-400">
                    Location
                  </th>
                  <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-400">
                    Vehicles
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {stats.recentCrashes.map((crash) => (
                  <tr key={crash.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-4 py-3">
                      <a
                        href={`/crash/${crash.id}`}
                        className="text-blue-600 hover:underline dark:text-blue-400"
                      >
                        {crash.date}
                      </a>
                    </td>
                    <td className="px-4 py-3">
                      <SeverityBadge severity={crash.severity} />
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{crash.location}</td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{crash.vehicles}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Monthly Trend (simple text-based) */}
      {stats.monthlyCounts.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-4 text-xl font-semibold text-gray-900 dark:text-white">
            Monthly Trend
          </h2>
          <div className="space-y-2">
            {stats.monthlyCounts.map((m) => {
              const maxCount = Math.max(...stats.monthlyCounts.map((mc) => mc.count))
              const pct = maxCount > 0 ? (m.count / maxCount) * 100 : 0
              return (
                <div key={m.month} className="flex items-center gap-3">
                  <span className="w-20 text-sm text-gray-500">{m.month}</span>
                  <div className="flex-1">
                    <div className="h-4 rounded bg-gray-200 dark:bg-gray-700">
                      <div
                        className="h-4 rounded bg-blue-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                  <span className="w-12 text-right text-sm text-gray-600 dark:text-gray-400">
                    {m.count}
                  </span>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* FAQ Section */}
      <section className="mb-8">
        <h2 className="mb-4 text-xl font-semibold text-gray-900 dark:text-white">
          Frequently Asked Questions
        </h2>
        <div className="space-y-4">
          {faqs.map((faq, i) => (
            <details
              key={i}
              className="group rounded-lg border border-gray-200 dark:border-gray-700"
            >
              <summary className="cursor-pointer px-4 py-3 font-medium text-gray-900 dark:text-white">
                {faq.question}
              </summary>
              <p className="px-4 pb-4 text-sm text-gray-600 dark:text-gray-400">
                {faq.answer}
              </p>
            </details>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="rounded-xl border border-gray-200 bg-gray-50 p-8 text-center dark:border-gray-700 dark:bg-gray-900">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          Were you in a crash in {location}?
        </h2>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Get your free Crash Equalizer report — see what the insurance company knows about your
          crash.
        </p>
        <a
          href="/search"
          className="mt-4 inline-block rounded-full bg-blue-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          Search Your Crash
        </a>
      </section>
    </div>
  )
}

function StatCard({
  label,
  value,
  variant = 'default',
}: {
  label: string
  value: string
  variant?: 'default' | 'danger' | 'warning'
}) {
  const colors = {
    default: 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700',
    danger: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
    warning: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800',
  }

  return (
    <div className={`rounded-lg border p-4 ${colors[variant]}`}>
      <div className="text-2xl font-bold text-gray-900 dark:text-white">{value}</div>
      <div className="text-sm text-gray-500 dark:text-gray-400">{label}</div>
    </div>
  )
}

function SeverityBadge({ severity }: { severity: string }) {
  const s = severity.toUpperCase()
  const colors =
    s === 'FATAL'
      ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
      : s.includes('INJURY')
        ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
        : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'

  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${colors}`}>
      {severity.replace(/_/g, ' ')}
    </span>
  )
}

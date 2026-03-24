'use client'

import type { DimensionScores } from './ReviewDimensions'
import type { ReviewStats } from './ReviewInsights'
import { CompareRadarChart } from './CompareRadarChart'

const COLORS = ['text-blue-600', 'text-emerald-600', 'text-purple-600', 'text-amber-600']
const BAR_COLORS = ['bg-blue-500', 'bg-emerald-500', 'bg-purple-500', 'bg-amber-500']
const BG_COLORS = [
  'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20',
  'border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/20',
  'border-purple-200 bg-purple-50 dark:border-purple-800 dark:bg-purple-900/20',
  'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20',
]

const DIMENSION_LABELS: Record<keyof DimensionScores, string> = {
  communication: 'Communication',
  outcome: 'Outcome',
  responsiveness: 'Responsiveness',
  empathy: 'Empathy',
  expertise: 'Expertise',
  feeTransparency: 'Fee Transparency',
  trialExperience: 'Trial Experience',
  satisfaction: 'Satisfaction',
}

export interface CompareAttorney {
  slug: string
  name: string
  firmName: string | null
  city: string | null
  stateCode: string | null
  phone: string | null
  website: string | null
  indexScore: number | null
  dimensions: DimensionScores | null
  reviewStats: ReviewStats
  bestQuotes: string[]
}

interface CompareViewProps {
  attorneys: CompareAttorney[]
}

export function CompareView({ attorneys }: CompareViewProps) {
  const count = attorneys.length

  return (
    <div className="space-y-8">
      {/* ── Header cards ── */}
      <div className={`grid gap-4 ${count === 2 ? 'grid-cols-2' : count === 3 ? 'grid-cols-3' : 'grid-cols-2 lg:grid-cols-4'}`}>
        {attorneys.map((atty, i) => (
          <a
            key={atty.slug}
            href={`/attorneys/${atty.slug}`}
            className={`rounded-xl border p-4 transition-shadow hover:shadow-md ${BG_COLORS[i]}`}
          >
            <h2 className={`text-lg font-bold ${COLORS[i]} dark:opacity-90`}>{atty.name}</h2>
            {atty.firmName && (
              <p className="text-sm text-gray-600 dark:text-gray-400">{atty.firmName}</p>
            )}
            <p className="text-sm text-gray-500">
              {[atty.city, atty.stateCode].filter(Boolean).join(', ')}
            </p>
            {atty.indexScore != null && (
              <div className="mt-3">
                <span className={`text-3xl font-bold ${COLORS[i]}`}>
                  {Math.round(atty.indexScore)}
                </span>
                <span className="ml-1 text-xs text-gray-500">Attorney Index</span>
              </div>
            )}
          </a>
        ))}
      </div>

      {/* ── Overlaid radar chart ── */}
      {attorneys.some((a) => a.dimensions) && (
        <section className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
          <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
            Review Dimensions Overlay
          </h3>
          <div className="flex justify-center">
            <CompareRadarChart
              entries={attorneys
                .filter((a) => a.dimensions)
                .map((a) => ({ name: a.name.split(' ')[0], scores: a.dimensions! }))}
              size={300}
            />
          </div>
        </section>
      )}

      {/* ── Dimension-by-dimension bars ── */}
      {attorneys.some((a) => a.dimensions) && (
        <section className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
          <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
            Score Breakdown
          </h3>
          <div className="space-y-5">
            {(Object.keys(DIMENSION_LABELS) as (keyof DimensionScores)[]).map((dim) => (
              <div key={dim}>
                <p className="mb-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">
                  {DIMENSION_LABELS[dim]}
                </p>
                <div className="space-y-1.5">
                  {attorneys.map((atty, i) => {
                    const value = atty.dimensions?.[dim] ?? 0
                    return (
                      <div key={atty.slug} className="flex items-center gap-2">
                        <span className={`w-16 shrink-0 truncate text-xs font-medium ${COLORS[i]}`}>
                          {atty.name.split(' ')[0]}
                        </span>
                        <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
                          <div
                            className={`h-full rounded-full ${BAR_COLORS[i]}`}
                            style={{ width: `${Math.min(value, 100)}%` }}
                          />
                        </div>
                        <span className="w-8 shrink-0 text-right text-xs font-semibold text-gray-600 dark:text-gray-400">
                          {Math.round(value)}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Review stats comparison ── */}
      <section className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
          Review Stats
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="pb-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Metric
                </th>
                {attorneys.map((atty, i) => (
                  <th key={atty.slug} className={`pb-2 text-center text-xs font-medium uppercase tracking-wider ${COLORS[i]}`}>
                    {atty.name.split(' ')[0]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              <StatsRow
                label="Total Reviews"
                values={attorneys.map((a) => String(a.reviewStats.totalReviews))}
                highlight={(v) => Math.max(...attorneys.map((a) => a.reviewStats.totalReviews)) === parseInt(v)}
              />
              <StatsRow
                label="Last 90 Days"
                values={attorneys.map((a) => String(a.reviewStats.recentReviewCount))}
                highlight={(v) => Math.max(...attorneys.map((a) => a.reviewStats.recentReviewCount)) === parseInt(v)}
              />
              <StatsRow
                label="Response Rate"
                values={attorneys.map((a) => `${a.reviewStats.responseRate}%`)}
                highlight={(v) => Math.max(...attorneys.map((a) => a.reviewStats.responseRate)) === parseInt(v)}
              />
              <StatsRow
                label="Data Confidence"
                values={attorneys.map((a) => a.reviewStats.dataQuality)}
                badges={attorneys.map((a) => {
                  const tier = a.reviewStats.dataQuality
                  return tier === 'HIGH'
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    : tier === 'MEDIUM'
                      ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                      : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                })}
              />
              <StatsRow
                label="12-Month Trend"
                values={attorneys.map((a) => a.reviewStats.trend ?? '—')}
                badges={attorneys.map((a) => {
                  const t = a.reviewStats.trend
                  return t === 'IMPROVING'
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    : t === 'DECLINING'
                      ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                      : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                })}
              />
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Best quotes ── */}
      {attorneys.some((a) => a.bestQuotes.length > 0) && (
        <section className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
          <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
            What Clients Say
          </h3>
          <div className={`grid gap-4 ${count === 2 ? 'grid-cols-2' : count === 3 ? 'grid-cols-3' : 'grid-cols-2 lg:grid-cols-4'}`}>
            {attorneys.map((atty, i) => (
              <div key={atty.slug}>
                <p className={`mb-2 text-sm font-semibold ${COLORS[i]}`}>{atty.name.split(' ')[0]}</p>
                {atty.bestQuotes.slice(0, 2).map((quote, qi) => (
                  <blockquote
                    key={qi}
                    className="mb-2 rounded-lg border-l-4 border-gray-200 bg-gray-50 p-3 text-xs italic text-gray-600 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-400"
                  >
                    &ldquo;{quote}&rdquo;
                  </blockquote>
                ))}
                {atty.bestQuotes.length === 0 && (
                  <p className="text-xs text-gray-400">No review quotes available</p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Contact info ── */}
      <section className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
          Contact Information
        </h3>
        <div className={`grid gap-4 ${count === 2 ? 'grid-cols-2' : count === 3 ? 'grid-cols-3' : 'grid-cols-2 lg:grid-cols-4'}`}>
          {attorneys.map((atty, i) => (
            <div key={atty.slug} className={`rounded-lg border p-4 ${BG_COLORS[i]}`}>
              <p className={`mb-2 text-sm font-semibold ${COLORS[i]}`}>{atty.name}</p>
              <dl className="space-y-1.5 text-sm">
                {atty.phone && (
                  <div>
                    <dt className="text-xs text-gray-400">Phone</dt>
                    <dd>
                      <a href={`tel:${atty.phone}`} className="text-blue-600 hover:underline dark:text-blue-400">
                        {atty.phone}
                      </a>
                    </dd>
                  </div>
                )}
                {atty.website && (
                  <div>
                    <dt className="text-xs text-gray-400">Website</dt>
                    <dd>
                      <a
                        href={atty.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline dark:text-blue-400"
                      >
                        Visit
                      </a>
                    </dd>
                  </div>
                )}
                {!atty.phone && !atty.website && (
                  <p className="text-xs text-gray-400">No contact info available</p>
                )}
              </dl>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

function StatsRow({
  label,
  values,
  highlight,
  badges,
}: {
  label: string
  values: string[]
  highlight?: (value: string) => boolean
  badges?: string[]
}) {
  return (
    <tr>
      <td className="py-2.5 text-sm text-gray-600 dark:text-gray-400">{label}</td>
      {values.map((value, i) => (
        <td key={i} className="py-2.5 text-center">
          {badges ? (
            <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${badges[i]}`}>
              {value.charAt(0) + value.slice(1).toLowerCase()}
            </span>
          ) : (
            <span
              className={`text-sm font-semibold ${
                highlight?.(value) ? 'text-green-600 dark:text-green-400' : 'text-gray-700 dark:text-gray-300'
              }`}
            >
              {value}
            </span>
          )}
        </td>
      ))}
    </tr>
  )
}

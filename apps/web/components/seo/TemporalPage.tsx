'use client'

import type { ResolvedSegments } from '@/lib/seo/resolve-segments'

interface TemporalStats {
  totalCrashes: number
  fatalCrashes: number
  injuryCrashes: number
  byMonth: Array<{ month: string; count: number; fatal: number }>
  bySeverity: Array<{ severity: string; count: number }>
  byType: Array<{ type: string; count: number }>
  previousPeriodCount: number
}

interface TemporalPageProps {
  resolved: ResolvedSegments
  stats: TemporalStats
}

export function TemporalPage({ resolved, stats }: TemporalPageProps) {
  const city = resolved.city
    ? resolved.city.split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
    : null
  const location = city ? `${city}, ${resolved.stateName}` : resolved.stateName
  const monthName = resolved.month
    ? new Date(2000, resolved.month - 1).toLocaleString('en-US', { month: 'long' })
    : null
  const timePeriod = monthName ? `${monthName} ${resolved.year}` : `${resolved.year}`

  const changePercent =
    stats.previousPeriodCount > 0
      ? ((stats.totalCrashes - stats.previousPeriodCount) / stats.previousPeriodCount) * 100
      : null

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
          <span>{timePeriod}</span>
        </nav>

        <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-4xl">
          Crash Data for {location} — {timePeriod}
        </h1>
        <p className="mt-3 text-lg text-gray-600 dark:text-gray-400">
          {stats.totalCrashes > 0
            ? `${stats.totalCrashes.toLocaleString()} crashes recorded during ${timePeriod}.`
            : `No crash data available for ${timePeriod}.`}
          {changePercent !== null && (
            <span
              className={
                changePercent > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'
              }
            >
              {' '}
              ({changePercent > 0 ? '+' : ''}
              {changePercent.toFixed(1)}% vs previous period)
            </span>
          )}
        </p>
      </header>

      {/* Summary Cards */}
      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {stats.totalCrashes.toLocaleString()}
          </div>
          <div className="text-sm text-gray-500">Total Crashes</div>
        </div>
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
          <div className="text-2xl font-bold text-red-700 dark:text-red-300">
            {stats.fatalCrashes.toLocaleString()}
          </div>
          <div className="text-sm text-red-600 dark:text-red-400">Fatal</div>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20">
          <div className="text-2xl font-bold text-amber-700 dark:text-amber-300">
            {stats.injuryCrashes.toLocaleString()}
          </div>
          <div className="text-sm text-amber-600 dark:text-amber-400">Injury Crashes</div>
        </div>
      </div>

      {/* Monthly Breakdown (for year views) */}
      {stats.byMonth.length > 1 && (
        <section className="mb-8">
          <h2 className="mb-4 text-xl font-semibold text-gray-900 dark:text-white">
            Monthly Breakdown
          </h2>
          <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Month</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600 dark:text-gray-400">
                    Crashes
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600 dark:text-gray-400">
                    Fatal
                  </th>
                  <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-400">
                    Distribution
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {stats.byMonth.map((m) => {
                  const maxCount = Math.max(...stats.byMonth.map((mc) => mc.count))
                  const pct = maxCount > 0 ? (m.count / maxCount) * 100 : 0
                  return (
                    <tr key={m.month}>
                      <td className="px-4 py-2 font-medium text-gray-700 dark:text-gray-300">
                        {m.month}
                      </td>
                      <td className="px-4 py-2 text-right text-gray-700 dark:text-gray-300">
                        {m.count.toLocaleString()}
                      </td>
                      <td className="px-4 py-2 text-right text-red-600 dark:text-red-400">
                        {m.fatal}
                      </td>
                      <td className="px-4 py-2">
                        <div className="h-3 w-full rounded-full bg-gray-200 dark:bg-gray-700">
                          <div
                            className="h-3 rounded-full bg-blue-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Severity Distribution */}
      {stats.bySeverity.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-4 text-xl font-semibold text-gray-900 dark:text-white">
            Severity Distribution
          </h2>
          <div className="space-y-3">
            {stats.bySeverity.map((s) => {
              const pct = stats.totalCrashes > 0 ? (s.count / stats.totalCrashes) * 100 : 0
              return (
                <div key={s.severity}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="font-medium text-gray-700 dark:text-gray-300">
                      {s.severity.replace(/_/g, ' ')}
                    </span>
                    <span className="text-gray-500">{pct.toFixed(1)}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-700">
                    <div
                      className={`h-2 rounded-full ${
                        s.severity === 'FATAL'
                          ? 'bg-red-500'
                          : s.severity.includes('INJURY')
                            ? 'bg-amber-500'
                            : 'bg-blue-500'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Crash Types */}
      {stats.byType.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-4 text-xl font-semibold text-gray-900 dark:text-white">
            Crash Types
          </h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {stats.byType.map((t) => (
              <div
                key={t.type}
                className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3 dark:border-gray-700"
              >
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  {t.type.replace(/_/g, ' ')}
                </span>
                <span className="text-sm font-semibold text-gray-900 dark:text-white">
                  {t.count.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Navigation links */}
      <section className="mb-8">
        <h2 className="mb-4 text-xl font-semibold text-gray-900 dark:text-white">
          Other Time Periods
        </h2>
        <div className="flex flex-wrap gap-2">
          {[resolved.year! - 1, resolved.year!, resolved.year! + 1].map((year) => {
            if (year > new Date().getFullYear()) return null
            const stateSlug = resolved.stateName.toLowerCase().replace(/\s+/g, '-')
            const citySlug = resolved.city?.replace(/\s+/g, '-')
            const href = citySlug
              ? `/crashes/${stateSlug}/${citySlug}/${year}`
              : `/crashes/${stateSlug}/${year}`
            return (
              <a
                key={year}
                href={href}
                className={`rounded-full border px-4 py-1.5 text-sm ${
                  year === resolved.year
                    ? 'border-blue-600 bg-blue-600 text-white'
                    : 'border-gray-200 text-gray-700 hover:border-blue-300 dark:border-gray-700 dark:text-gray-300'
                }`}
              >
                {year}
              </a>
            )
          })}
        </div>
      </section>
    </div>
  )
}

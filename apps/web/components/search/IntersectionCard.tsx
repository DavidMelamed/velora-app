'use client'

// Plain HTML/Tailwind instead of @velora/ui to avoid React types version mismatch

interface IntersectionStatsResult {
  intersectionName: string
  latitude: number
  longitude: number
  radiusMeters: number
  totalCrashes: number
  severityDistribution: Record<string, number>
  topCrashTypes: Array<{ type: string; count: number }>
  dangerScore: number
  dateRange: { earliest: string; latest: string } | null
}

function getDangerLabel(score: number): { label: string; color: string } {
  if (score >= 80) return { label: 'Very High Risk', color: 'text-red-600' }
  if (score >= 60) return { label: 'High Risk', color: 'text-orange-500' }
  if (score >= 40) return { label: 'Moderate Risk', color: 'text-yellow-600' }
  if (score >= 20) return { label: 'Low Risk', color: 'text-blue-500' }
  return { label: 'Very Low Risk', color: 'text-green-500' }
}

function formatType(type: string): string {
  return type.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())
}

export function IntersectionCard({ data }: { data: IntersectionStatsResult }) {
  const danger = getDangerLabel(data.dangerScore)

  return (
    <div className="my-3 rounded-lg bg-white shadow-md dark:bg-gray-900">
      <div className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">{data.intersectionName}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {data.radiusMeters}m radius
              {data.dateRange
                ? ` | ${data.dateRange.earliest} to ${data.dateRange.latest}`
                : ''}
            </p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold">{data.dangerScore}</div>
            <div className={`text-sm font-medium ${danger.color}`}>{danger.label}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <div className="text-2xl font-bold">{data.totalCrashes}</div>
            <div className="text-xs text-gray-500">Total Crashes</div>
          </div>
          {Object.entries(data.severityDistribution)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 3)
            .map(([severity, count]) => (
              <div key={severity}>
                <div className="text-2xl font-bold">{count}</div>
                <div className="text-xs text-gray-500">{formatType(severity)}</div>
              </div>
            ))}
        </div>

        {data.topCrashTypes.length > 0 && (
          <div className="mt-4">
            <h4 className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
              Top Crash Types
            </h4>
            <div className="flex flex-wrap gap-2">
              {data.topCrashTypes.map((t) => (
                <span
                  key={t.type}
                  className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700 dark:bg-gray-700 dark:text-gray-300"
                >
                  {formatType(t.type)} ({t.count})
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

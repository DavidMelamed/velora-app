'use client'

// Plain HTML/Tailwind instead of @velora/ui to avoid React types version mismatch

interface DataPoint {
  label: string
  total: number
  fatal: number
  injury: number
  propertyOnly: number
}

interface TrendData {
  period: string
  totalRecords: number
  dataPoints: DataPoint[]
}

export function TrendChart({ data }: { data: TrendData }) {
  if (data.dataPoints.length === 0) {
    return (
      <div className="my-3 rounded-lg border-2 border-gray-300 bg-transparent">
        <div className="p-4 text-center text-gray-500">
          No trend data available for the selected filters.
        </div>
      </div>
    )
  }

  const maxTotal = Math.max(...data.dataPoints.map((d) => d.total), 1)

  return (
    <div className="my-3 rounded-lg bg-white shadow-md dark:bg-gray-900">
      <div className="p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-semibold">
            Crash Trends by {data.period === 'dayOfWeek' ? 'Day of Week' : data.period === 'hourOfDay' ? 'Hour' : data.period}
          </h3>
          <span className="text-sm text-gray-500">{data.totalRecords.toLocaleString()} total records</span>
        </div>

        {/* Simple bar chart */}
        <div className="space-y-2">
          {data.dataPoints.map((point) => {
            const pct = (point.total / maxTotal) * 100
            const fatalPct = point.total > 0 ? (point.fatal / point.total) * 100 : 0
            const injuryPct = point.total > 0 ? (point.injury / point.total) * 100 : 0

            return (
              <div key={point.label} className="flex items-center gap-3">
                <span className="w-20 shrink-0 text-right text-xs text-gray-500">{point.label}</span>
                <div className="h-6 flex-1 overflow-hidden rounded bg-gray-100 dark:bg-gray-700">
                  <div className="flex h-full" style={{ width: `${pct}%` }}>
                    {fatalPct > 0 && (
                      <div
                        className="h-full bg-red-500"
                        style={{ width: `${fatalPct}%` }}
                        title={`Fatal: ${point.fatal}`}
                      />
                    )}
                    {injuryPct > 0 && (
                      <div
                        className="h-full bg-orange-400"
                        style={{ width: `${injuryPct}%` }}
                        title={`Injury: ${point.injury}`}
                      />
                    )}
                    <div
                      className="h-full flex-1 bg-blue-400"
                      title={`Property only: ${point.propertyOnly}`}
                    />
                  </div>
                </div>
                <span className="w-12 shrink-0 text-right text-xs font-medium">
                  {point.total.toLocaleString()}
                </span>
              </div>
            )
          })}
        </div>

        {/* Legend */}
        <div className="mt-4 flex gap-4 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-500" /> Fatal
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-orange-400" /> Injury
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-blue-400" /> Property Only
          </span>
        </div>
      </div>
    </div>
  )
}

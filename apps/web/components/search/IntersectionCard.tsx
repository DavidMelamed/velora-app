'use client'

import { cn } from '@/lib/utils'

export interface IntersectionData {
  name: string
  dangerScore: number
  totalCrashes: number
  severityBreakdown: {
    fatal: number
    serious: number
    minor: number
    possible: number
    pdo: number
  }
  topCrashTypes: { type: string; count: number }[]
}

interface IntersectionCardProps {
  data: IntersectionData
  className?: string
}

function getDangerLevel(score: number): { label: string; color: string; bgColor: string } {
  if (score >= 80) return { label: 'Very High', color: 'text-red-700', bgColor: 'bg-red-500' }
  if (score >= 60) return { label: 'High', color: 'text-orange-700', bgColor: 'bg-orange-500' }
  if (score >= 40) return { label: 'Moderate', color: 'text-yellow-700', bgColor: 'bg-yellow-500' }
  if (score >= 20) return { label: 'Low', color: 'text-green-700', bgColor: 'bg-green-500' }
  return { label: 'Very Low', color: 'text-green-600', bgColor: 'bg-green-400' }
}

export function IntersectionCard({ data, className }: IntersectionCardProps) {
  const danger = getDangerLevel(data.dangerScore)

  const severityBars = [
    { label: 'Fatal', count: data.severityBreakdown.fatal, color: 'bg-slate-700' },
    { label: 'Serious', count: data.severityBreakdown.serious, color: 'bg-red-500' },
    { label: 'Minor', count: data.severityBreakdown.minor, color: 'bg-amber-500' },
    { label: 'Possible', count: data.severityBreakdown.possible, color: 'bg-yellow-500' },
    { label: 'PDO', count: data.severityBreakdown.pdo, color: 'bg-green-500' },
  ]

  const maxCount = Math.max(...severityBars.map((b) => b.count), 1)

  return (
    <div className={cn('rounded-lg border border-gray-200 bg-white p-5', className)}>
      <h3 className="text-base font-semibold text-gray-900">{data.name}</h3>

      {/* Danger Score Meter */}
      <div className="mt-4">
        <div className="flex items-baseline justify-between">
          <span className="text-xs font-medium uppercase tracking-wider text-gray-500">
            Danger Score
          </span>
          <span className={cn('text-lg font-bold', danger.color)}>{data.dangerScore}</span>
        </div>
        <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-gray-200">
          <div
            className={cn('h-full rounded-full transition-all', danger.bgColor)}
            style={{ width: `${data.dangerScore}%` }}
          />
        </div>
        <p className={cn('mt-1 text-xs font-medium', danger.color)}>{danger.label} Risk</p>
      </div>

      {/* Stats */}
      <div className="mt-4 border-t border-gray-100 pt-4">
        <p className="text-xs font-medium uppercase tracking-wider text-gray-500">
          Total Crashes
        </p>
        <p className="mt-0.5 text-2xl font-bold text-gray-900">{data.totalCrashes}</p>
      </div>

      {/* Severity Breakdown */}
      <div className="mt-4 border-t border-gray-100 pt-4">
        <p className="text-xs font-medium uppercase tracking-wider text-gray-500">
          Severity Breakdown
        </p>
        <div className="mt-2 space-y-1.5">
          {severityBars.map((bar) => (
            <div key={bar.label} className="flex items-center gap-2">
              <span className="w-14 text-xs text-gray-600">{bar.label}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                <div
                  className={cn('h-full rounded-full', bar.color)}
                  style={{ width: `${(bar.count / maxCount) * 100}%` }}
                />
              </div>
              <span className="w-8 text-right text-xs font-medium text-gray-700">{bar.count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Top Crash Types */}
      {data.topCrashTypes.length > 0 && (
        <div className="mt-4 border-t border-gray-100 pt-4">
          <p className="text-xs font-medium uppercase tracking-wider text-gray-500">
            Top Crash Types
          </p>
          <ul className="mt-2 space-y-1">
            {data.topCrashTypes.slice(0, 5).map((ct) => (
              <li key={ct.type} className="flex items-center justify-between text-sm">
                <span className="text-gray-700">{ct.type.replace(/_/g, ' ')}</span>
                <span className="font-medium text-gray-900">{ct.count}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

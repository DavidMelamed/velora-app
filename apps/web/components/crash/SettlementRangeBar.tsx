'use client'

import { cn } from '@/lib/utils'

interface SettlementRangeBarProps {
  low: number
  mid: number
  high: number
  className?: string
}

function formatDollars(amount: number): string {
  if (amount >= 1_000_000) {
    return `$${(amount / 1_000_000).toFixed(1)}M`
  }
  if (amount >= 1_000) {
    return `$${(amount / 1_000).toFixed(0)}K`
  }
  return `$${amount.toLocaleString()}`
}

export function SettlementRangeBar({ low, mid, high, className }: SettlementRangeBarProps) {
  const total = high || 1
  const lowPct = Math.min((low / total) * 100, 100)
  const midPct = Math.min(((mid - low) / total) * 100, 100)
  const highPct = Math.max(100 - lowPct - midPct, 0)

  return (
    <div className={cn('rounded-lg border border-gray-200 bg-white p-5', className)}>
      <h4 className="text-sm font-semibold text-gray-900">
        Typical range for crashes like yours
      </h4>
      <p className="mt-1 text-xs text-gray-500">
        Based on comparable crash outcomes in your area
      </p>

      {/* Bar */}
      <div className="mt-4 flex h-8 w-full overflow-hidden rounded-lg">
        <div
          className="flex items-center justify-center bg-blue-200 text-xs font-medium text-blue-800"
          style={{ width: `${lowPct}%` }}
        >
          {lowPct > 15 && 'Low'}
        </div>
        <div
          className="flex items-center justify-center bg-blue-400 text-xs font-medium text-white"
          style={{ width: `${midPct}%` }}
        >
          {midPct > 15 && 'Typical'}
        </div>
        <div
          className="flex items-center justify-center bg-blue-600 text-xs font-medium text-white"
          style={{ width: `${highPct}%` }}
        >
          {highPct > 15 && 'High'}
        </div>
      </div>

      {/* Labels */}
      <div className="mt-2 flex justify-between text-xs">
        <span className="font-medium text-blue-700">{formatDollars(low)}</span>
        <span className="font-medium text-blue-500">{formatDollars(mid)}</span>
        <span className="font-medium text-blue-800">{formatDollars(high)}</span>
      </div>
    </div>
  )
}

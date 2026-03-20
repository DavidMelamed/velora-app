'use client'

import { cn } from '@/lib/utils'
import { displayName } from '@velora/shared'

interface LiabilityCardProps {
  signal: {
    rule: string
    indicator: 'STRONG_LIABILITY' | 'PARTIAL_LIABILITY' | 'LOW_LIABILITY' | 'UNCLEAR'
    confidence: number
    explanation: string
    evidence: string[]
  }
  className?: string
}

const INDICATOR_CONFIG: Record<string, { label: string; badgeClass: string }> = {
  STRONG_LIABILITY: { label: 'Fault', badgeClass: 'bg-red-100 text-red-800 border-red-200' },
  PARTIAL_LIABILITY: { label: 'Shared', badgeClass: 'bg-amber-100 text-amber-800 border-amber-200' },
  LOW_LIABILITY: { label: 'Infrastructure', badgeClass: 'bg-blue-100 text-blue-800 border-blue-200' },
  UNCLEAR: { label: 'Environmental', badgeClass: 'bg-gray-100 text-gray-700 border-gray-200' },
}

export function LiabilityCard({ signal, className }: LiabilityCardProps) {
  const config = INDICATOR_CONFIG[signal.indicator] || INDICATOR_CONFIG.UNCLEAR

  return (
    <div className={cn('rounded-lg border border-gray-200 bg-white p-4', className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h4 className="text-sm font-semibold text-gray-900">
            {displayName(signal.rule)}
          </h4>
          <p className="mt-1 text-sm text-gray-600">{signal.explanation}</p>
        </div>

        {/* Type Badge */}
        <span
          className={cn(
            'inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-xs font-medium',
            config.badgeClass
          )}
        >
          {config.label}
        </span>
      </div>

      {/* Confidence Meter */}
      <div className="mt-3">
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-500">Confidence</span>
          <span className="font-medium text-gray-700">{Math.round(signal.confidence * 100)}%</span>
        </div>
        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
          <div
            className={cn(
              'h-full rounded-full transition-all',
              signal.confidence >= 0.7 ? 'bg-green-500' :
              signal.confidence >= 0.4 ? 'bg-amber-500' : 'bg-gray-400'
            )}
            style={{ width: `${signal.confidence * 100}%` }}
          />
        </div>
      </div>

      {/* Evidence */}
      {signal.evidence.length > 0 && (
        <div className="mt-3 border-t border-gray-100 pt-2">
          <p className="text-xs font-medium text-gray-500">Evidence from crash report:</p>
          <ul className="mt-1 space-y-0.5">
            {signal.evidence.map((e, i) => (
              <li key={i} className="text-xs text-gray-600">
                &bull; {e}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

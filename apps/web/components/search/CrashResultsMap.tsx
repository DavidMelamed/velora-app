'use client'

import Link from 'next/link'
import { cn } from '@/lib/utils'

const SEVERITY_COLORS: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  FATAL: { bg: 'bg-slate-100', text: 'text-slate-800', dot: 'bg-slate-700', label: 'Fatal' },
  SUSPECTED_SERIOUS_INJURY: { bg: 'bg-red-50', text: 'text-red-800', dot: 'bg-red-500', label: 'Serious' },
  SUSPECTED_MINOR_INJURY: { bg: 'bg-amber-50', text: 'text-amber-800', dot: 'bg-amber-500', label: 'Minor' },
  POSSIBLE_INJURY: { bg: 'bg-yellow-50', text: 'text-yellow-800', dot: 'bg-yellow-500', label: 'Possible' },
  PROPERTY_DAMAGE_ONLY: { bg: 'bg-green-50', text: 'text-green-800', dot: 'bg-green-500', label: 'PDO' },
}

export interface CrashResult {
  id: string
  crashDate: string
  location: string
  severity: string | null
  latitude: number | null
  longitude: number | null
  vehicleCount: number
  personCount: number
}

interface CrashResultsMapProps {
  results: CrashResult[]
  className?: string
}

export function CrashResultsMap({ results, className }: CrashResultsMapProps) {
  if (results.length === 0) {
    return (
      <div className={cn('rounded-lg border border-gray-200 bg-white p-8 text-center', className)}>
        <p className="text-sm text-gray-500">No crash results found.</p>
      </div>
    )
  }

  return (
    <div className={cn('rounded-lg border border-gray-200 bg-white', className)}>
      <div className="border-b border-gray-200 px-4 py-3">
        <h3 className="text-sm font-semibold text-gray-900">
          {results.length} Crash{results.length !== 1 ? 'es' : ''} Found
        </h3>
        <div className="mt-2 flex flex-wrap gap-3">
          {Object.entries(SEVERITY_COLORS).map(([key, config]) => (
            <span key={key} className="flex items-center gap-1.5 text-xs text-gray-500">
              <span className={cn('inline-block h-2 w-2 rounded-full', config.dot)} />
              {config.label}
            </span>
          ))}
        </div>
      </div>

      <ul className="divide-y divide-gray-100">
        {results.map((crash) => {
          const severityConfig = SEVERITY_COLORS[crash.severity || ''] || {
            bg: 'bg-gray-50',
            text: 'text-gray-700',
            dot: 'bg-gray-400',
            label: 'Unknown',
          }

          return (
            <li key={crash.id}>
              <Link
                href={`/crashes/${crash.id}`}
                className={cn(
                  'flex items-center gap-4 px-4 py-3 transition-colors hover:bg-gray-50',
                  severityConfig.bg
                )}
              >
                <span className={cn('h-3 w-3 flex-shrink-0 rounded-full', severityConfig.dot)} />

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-900">{crash.location}</p>
                  <p className="text-xs text-gray-500">
                    {new Date(crash.crashDate).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                    {' \u00b7 '}
                    {crash.vehicleCount} vehicle{crash.vehicleCount !== 1 ? 's' : ''}
                    {' \u00b7 '}
                    {crash.personCount} person{crash.personCount !== 1 ? 's' : ''}
                  </p>
                </div>

                <span
                  className={cn(
                    'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium',
                    severityConfig.text
                  )}
                >
                  {severityConfig.label}
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

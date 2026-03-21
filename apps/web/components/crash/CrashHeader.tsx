'use client'

import { SeverityBadge } from './SeverityBadge'
import { cn } from '@/lib/utils'

interface CrashHeaderProps {
  crashDate: string | Date
  location: string
  severity: string | null | undefined
  vehicleCount: number
  personCount: number
  stateCode: string
  county?: string | null
}

export function CrashHeader({
  crashDate,
  location,
  severity,
  vehicleCount,
  personCount,
  stateCode,
  county,
}: CrashHeaderProps) {
  const isFatal = severity === 'FATAL'
  const date = new Date(crashDate)
  const formattedDate = date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <header
      className={cn(
        'rounded-lg border p-6',
        isFatal
          ? 'border-slate-300 bg-slate-50'
          : 'border-gray-200 bg-white'
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1
            className={cn(
              'text-2xl font-bold',
              isFatal ? 'text-slate-700' : 'text-gray-900'
            )}
          >
            Crash Report
          </h1>
          <p className="mt-1 text-sm text-gray-500">{formattedDate}</p>
        </div>
        <SeverityBadge severity={severity} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Location" value={location || 'Unknown'} />
        <Stat label="State" value={stateCode} />
        {county && <Stat label="County" value={county} />}
        <Stat label="Vehicles" value={String(vehicleCount)} />
        <Stat label="Persons" value={String(personCount)} />
      </div>
    </header>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wider text-gray-400">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-gray-900">{value}</dd>
    </div>
  )
}

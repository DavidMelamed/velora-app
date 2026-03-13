'use client'

import { cn } from '@/lib/utils'

const SEVERITY_CONFIG: Record<string, { label: string; className: string }> = {
  FATAL: {
    label: 'Fatal',
    className: 'bg-slate-700 text-slate-100 border-slate-600',
  },
  SUSPECTED_SERIOUS_INJURY: {
    label: 'Serious Injury',
    className: 'bg-red-100 text-red-800 border-red-200',
  },
  SUSPECTED_MINOR_INJURY: {
    label: 'Minor Injury',
    className: 'bg-amber-100 text-amber-800 border-amber-200',
  },
  POSSIBLE_INJURY: {
    label: 'Possible Injury',
    className: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  },
  PROPERTY_DAMAGE_ONLY: {
    label: 'Property Damage',
    className: 'bg-green-100 text-green-800 border-green-200',
  },
}

interface SeverityBadgeProps {
  severity: string | null | undefined
  className?: string
}

export function SeverityBadge({ severity, className }: SeverityBadgeProps) {
  const config = SEVERITY_CONFIG[severity || ''] || {
    label: 'Unknown',
    className: 'bg-gray-100 text-gray-700 border-gray-200',
  }

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium',
        config.className,
        className
      )}
      role="status"
      aria-label={`Crash severity: ${config.label}`}
    >
      {config.label}
    </span>
  )
}

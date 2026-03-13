'use client'

import { useState } from 'react'
import { getGuidanceForSeverity } from '@velora/shared'
import type { GuidanceStep } from '@velora/shared'

interface WhatToDoNextProps {
  severity: string | null | undefined
}

const priorityStyles: Record<string, { bg: string; border: string; text: string; badge: string }> = {
  critical: {
    bg: 'bg-red-50',
    border: 'border-red-200',
    text: 'text-red-800',
    badge: 'bg-red-600 text-white',
  },
  important: {
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-800',
    badge: 'bg-amber-500 text-white',
  },
  recommended: {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    text: 'text-blue-800',
    badge: 'bg-blue-500 text-white',
  },
}

export function WhatToDoNext({ severity }: WhatToDoNextProps) {
  const guidance = getGuidanceForSeverity(severity)
  const [expandedIndex, setExpandedIndex] = useState<number | null>(0)

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6">
      <h2 className="text-lg font-semibold text-gray-900">What To Do Next</h2>
      <p className="mt-1 text-sm text-gray-500">{guidance.urgencyMessage}</p>

      <div className="mt-4 space-y-3">
        {guidance.steps.map((step, index) => (
          <StepCard
            key={index}
            step={step}
            index={index}
            isExpanded={expandedIndex === index}
            onToggle={() =>
              setExpandedIndex(expandedIndex === index ? null : index)
            }
          />
        ))}
      </div>
    </div>
  )
}

function StepCard({
  step,
  index,
  isExpanded,
  onToggle,
}: {
  step: GuidanceStep
  index: number
  isExpanded: boolean
  onToggle: () => void
}) {
  const style = priorityStyles[step.priority] || priorityStyles.recommended

  return (
    <button
      onClick={onToggle}
      className={`w-full rounded-lg border text-left transition-all ${style.border} ${style.bg} p-4`}
    >
      <div className="flex items-start gap-3">
        <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-gray-200 text-xs font-bold text-gray-600">
          {index + 1}
        </span>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className={`text-sm font-semibold ${style.text}`}>
              {step.title}
            </h3>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${style.badge}`}
            >
              {step.priority}
            </span>
          </div>
          {isExpanded && (
            <div className="mt-2">
              <p className="text-sm text-gray-600">{step.description}</p>
              <p className="mt-1 text-xs font-medium text-gray-400">
                {step.timeframe}
              </p>
            </div>
          )}
        </div>
      </div>
    </button>
  )
}

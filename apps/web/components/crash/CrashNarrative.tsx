'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import type { CrashNarrativeContent } from '@velora/shared'

interface CrashNarrativeProps {
  content: CrashNarrativeContent
  severity: string | null | undefined
}

interface SectionConfig {
  key: keyof CrashNarrativeContent
  title: string
  defaultOpen: boolean
  hasContentWarning?: boolean
}

const SECTIONS: SectionConfig[] = [
  { key: 'incidentSection', title: 'What Happened', defaultOpen: true },
  { key: 'vehiclesSection', title: 'Vehicles Involved', defaultOpen: true },
  { key: 'conditionsSection', title: 'Conditions', defaultOpen: false },
  { key: 'factorsSection', title: 'Contributing Factors', defaultOpen: false },
  { key: 'injurySection', title: 'Injuries', defaultOpen: false, hasContentWarning: true },
  { key: 'locationSection', title: 'Location Details', defaultOpen: false },
  { key: 'impactSection', title: 'Impact & Context', defaultOpen: false },
  { key: 'whatToDoNext', title: 'What to Do Next', defaultOpen: true },
]

export function CrashNarrative({ content, severity }: CrashNarrativeProps) {
  const isFatal = severity === 'FATAL'
  const isSerious = severity === 'SUSPECTED_SERIOUS_INJURY'

  return (
    <div
      className={cn(
        'rounded-lg border',
        isFatal ? 'border-slate-300 bg-slate-50' : 'border-gray-200 bg-white'
      )}
    >
      {/* Headline */}
      <div className="border-b p-6">
        <h2
          className={cn(
            'text-xl font-semibold',
            isFatal ? 'text-slate-700' : 'text-gray-900'
          )}
        >
          {content.headline}
        </h2>
        <p className="mt-2 text-gray-600">{content.summary}</p>
      </div>

      {/* Content Warning for Fatal/Serious */}
      {(isFatal || isSerious) && (
        <div
          className={cn(
            'mx-6 mt-4 rounded-md border p-3 text-sm',
            isFatal
              ? 'border-slate-400 bg-slate-100 text-slate-700'
              : 'border-red-200 bg-red-50 text-red-700'
          )}
          role="alert"
        >
          <strong>Content Notice:</strong> This report contains details about{' '}
          {isFatal ? 'a fatal crash' : 'serious injuries'}. Reader discretion is advised.
        </div>
      )}

      {/* Sections with progressive disclosure */}
      <div className="divide-y">
        {SECTIONS.map((section) => {
          const sectionContent = content[section.key]
          if (!sectionContent) return null

          return (
            <CollapsibleSection
              key={section.key}
              title={section.title}
              content={sectionContent}
              defaultOpen={section.defaultOpen}
              hasContentWarning={section.hasContentWarning && (isFatal || isSerious)}
              isFatal={isFatal}
            />
          )
        })}
      </div>

      {/* Disclaimer */}
      <div className="border-t p-4">
        <p className="text-xs text-gray-400">
          This narrative is generated from public crash data and is not a legal document.
          Data sourced from state crash databases.
        </p>
      </div>
    </div>
  )
}

function CollapsibleSection({
  title,
  content,
  defaultOpen,
  hasContentWarning,
  isFatal,
}: {
  title: string
  content: string
  defaultOpen: boolean
  hasContentWarning?: boolean
  isFatal?: boolean
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <div className="px-6 py-4">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between text-left"
        aria-expanded={isOpen}
      >
        <h3
          className={cn(
            'text-sm font-semibold uppercase tracking-wider',
            isFatal ? 'text-slate-600' : 'text-gray-700'
          )}
        >
          {title}
        </h3>
        <svg
          className={cn(
            'h-4 w-4 transform text-gray-400 transition-transform',
            isOpen && 'rotate-180'
          )}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="mt-3">
          {hasContentWarning && (
            <p className="mb-2 text-xs text-gray-400 italic">
              This section contains sensitive content.
            </p>
          )}
          <p className="text-sm leading-relaxed text-gray-700 whitespace-pre-line">{content}</p>
        </div>
      )}
    </div>
  )
}

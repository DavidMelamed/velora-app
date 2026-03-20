'use client'

import { useState } from 'react'

export interface TimelineEvent {
  id: string
  category: 'medical' | 'legal' | 'communication' | 'financial' | 'milestone'
  title: string
  description: string
  occurredAt: string
  duration?: number
  isGap?: boolean
  gapDays?: number
  episodeId?: string
  metadata?: Record<string, unknown>
}

interface TimelineWebProps {
  events: TimelineEvent[]
  matterId: string
}

const CATEGORY_COLORS: Record<string, string> = {
  medical: 'bg-blue-500',
  legal: 'bg-purple-500',
  communication: 'bg-emerald-500',
  financial: 'bg-amber-500',
  milestone: 'bg-yellow-500',
}

const CATEGORY_TEXT: Record<string, string> = {
  medical: 'text-blue-500',
  legal: 'text-purple-500',
  communication: 'text-emerald-500',
  financial: 'text-amber-500',
  milestone: 'text-yellow-500',
}

const FILTERS = ['All', 'Medical', 'Legal', 'Communication', 'Financial'] as const
type Filter = (typeof FILTERS)[number]

function relativeTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 30) return `${diffDays}d ago`
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function TimelineWeb({ events, matterId }: TimelineWebProps) {
  const [filter, setFilter] = useState<Filter>('All')
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  const filtered = filter === 'All'
    ? events
    : events.filter(e => e.category === filter.toLowerCase() || e.isGap)

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Filter tabs */}
      <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
        {FILTERS.map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              filter === f
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Timeline */}
      <div className="relative">
        {filtered.map((event, idx) => {
          const isExpanded = expandedIds.has(event.id)
          const isLast = idx === filtered.length - 1

          if (event.isGap) {
            return (
              <div key={event.id} className="relative flex gap-4 pb-6">
                {/* Time column */}
                <div className="w-20 shrink-0 pt-1 text-right text-xs text-red-400">
                  {event.gapDays}d gap
                </div>

                {/* Center dot + line */}
                <div className="relative flex flex-col items-center">
                  <div className="z-10 flex h-6 w-6 items-center justify-center rounded-full border-2 border-dashed border-red-400 bg-white">
                    <svg className="h-3 w-3 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.345 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                    </svg>
                  </div>
                  {!isLast && <div className="w-px grow border-l-2 border-dashed border-red-300" />}
                </div>

                {/* Content */}
                <div className="min-w-0 flex-1 rounded-lg border-2 border-dashed border-red-300 bg-red-50 px-3 py-2">
                  <p className="text-sm font-medium text-red-700">{event.title}</p>
                  <p className="text-xs text-red-500">{event.description}</p>
                </div>
              </div>
            )
          }

          return (
            <div key={event.id} className="relative flex gap-4 pb-6">
              {/* Time column */}
              <div className="w-20 shrink-0 pt-1 text-right">
                <span className="text-xs text-gray-500">{relativeTime(event.occurredAt)}</span>
              </div>

              {/* Center dot + line */}
              <div className="relative flex flex-col items-center">
                <div className={`z-10 h-3 w-3 rounded-full ${CATEGORY_COLORS[event.category]} ring-4 ring-white`} />
                {!isLast && <div className="w-px grow bg-gray-200" />}
              </div>

              {/* Content */}
              <button
                onClick={() => toggleExpand(event.id)}
                className="min-w-0 flex-1 cursor-pointer rounded-lg border border-gray-200 bg-white px-3 py-2 text-left transition-shadow hover:shadow-sm"
              >
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-medium uppercase ${CATEGORY_TEXT[event.category]}`}>
                    {event.category}
                  </span>
                  {event.episodeId && (
                    <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-400">
                      EP-{event.episodeId.slice(0, 6)}
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-sm font-medium text-gray-900">{event.title}</p>
                {isExpanded && event.description && (
                  <p className="mt-1 text-sm text-gray-600">{event.description}</p>
                )}
                {isExpanded && event.duration != null && (
                  <p className="mt-1 text-xs text-gray-400">Duration: {event.duration} min</p>
                )}
              </button>
            </div>
          )
        })}

        {filtered.length === 0 && (
          <p className="py-8 text-center text-sm text-gray-400">No timeline events found.</p>
        )}
      </div>
    </div>
  )
}

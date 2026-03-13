'use client'

import Link from 'next/link'
import { cn } from '@/lib/utils'

export interface AttorneyCardData {
  id: string
  slug: string
  name: string
  firmName: string | null
  city: string | null
  stateCode: string | null
  indexScore: number
  practiceAreas: string[]
}

interface AttorneyGridProps {
  attorneys: AttorneyCardData[]
  className?: string
}

function getScoreColor(score: number): string {
  if (score >= 80) return 'text-green-700 bg-green-50 border-green-200'
  if (score >= 60) return 'text-blue-700 bg-blue-50 border-blue-200'
  if (score >= 40) return 'text-amber-700 bg-amber-50 border-amber-200'
  return 'text-gray-700 bg-gray-50 border-gray-200'
}

function getScoreRingColor(score: number): string {
  if (score >= 80) return 'stroke-green-500'
  if (score >= 60) return 'stroke-blue-500'
  if (score >= 40) return 'stroke-amber-500'
  return 'stroke-gray-400'
}

function ScoreRing({ score }: { score: number }) {
  const circumference = 2 * Math.PI * 18
  const offset = circumference - (score / 100) * circumference

  return (
    <div className="relative flex h-14 w-14 items-center justify-center">
      <svg className="h-14 w-14 -rotate-90" viewBox="0 0 40 40">
        <circle cx="20" cy="20" r="18" fill="none" stroke="#e5e7eb" strokeWidth="3" />
        <circle
          cx="20"
          cy="20"
          r="18"
          fill="none"
          className={getScoreRingColor(score)}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <span className="absolute text-sm font-bold text-gray-900">{score}</span>
    </div>
  )
}

export function AttorneyGrid({ attorneys, className }: AttorneyGridProps) {
  if (attorneys.length === 0) {
    return (
      <div className={cn('rounded-lg border border-gray-200 bg-white p-8 text-center', className)}>
        <p className="text-sm text-gray-500">No attorneys found.</p>
      </div>
    )
  }

  return (
    <div className={cn('grid gap-4 sm:grid-cols-2 lg:grid-cols-3', className)}>
      {attorneys.map((attorney) => {
        const location = [attorney.city, attorney.stateCode].filter(Boolean).join(', ')

        return (
          <Link
            key={attorney.id}
            href={`/attorneys/${attorney.slug}`}
            className="group rounded-lg border border-gray-200 bg-white p-4 transition-shadow hover:shadow-md"
          >
            <div className="flex items-start gap-3">
              <ScoreRing score={attorney.indexScore} />

              <div className="min-w-0 flex-1">
                <h4 className="truncate text-sm font-semibold text-gray-900 group-hover:text-blue-600">
                  {attorney.name}
                </h4>
                {attorney.firmName && (
                  <p className="truncate text-xs text-gray-500">{attorney.firmName}</p>
                )}
                {location && <p className="text-xs text-gray-400">{location}</p>}
              </div>
            </div>

            {/* Attorney Index Score label */}
            <div className="mt-3">
              <span
                className={cn(
                  'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium',
                  getScoreColor(attorney.indexScore)
                )}
              >
                Attorney Index: {attorney.indexScore}
              </span>
            </div>

            {/* Practice Areas */}
            {attorney.practiceAreas.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {attorney.practiceAreas.slice(0, 3).map((area) => (
                  <span
                    key={area}
                    className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600"
                  >
                    {area}
                  </span>
                ))}
                {attorney.practiceAreas.length > 3 && (
                  <span className="text-xs text-gray-400">
                    +{attorney.practiceAreas.length - 3} more
                  </span>
                )}
              </div>
            )}
          </Link>
        )
      })}
    </div>
  )
}

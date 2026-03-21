'use client'

// Plain HTML/Tailwind instead of @velora/ui to avoid React types version mismatch

interface AttorneyResult {
  id: string
  name: string
  firmName: string | null
  city: string | null
  stateCode: string | null
  practiceAreas: string[]
  yearsExperience: number | null
  website: string | null
  indexScore: number | null
  reviewCount: number
  dimensions: {
    communication: number
    outcome: number
    responsiveness: number
    empathy: number
    expertise: number
    satisfaction: number
  } | null
  trend: string | null
}

interface AttorneyGridProps {
  attorneys: AttorneyResult[]
  total: number
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-24 shrink-0 text-xs text-gray-500">{label}</span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
        <div
          className="h-full rounded-full bg-blue-500"
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="w-8 shrink-0 text-right text-xs font-medium">{Math.round(value)}</span>
    </div>
  )
}

export function AttorneyGrid({ attorneys, total }: AttorneyGridProps) {
  return (
    <div className="my-3">
      <div className="mb-2 text-sm text-gray-500 dark:text-gray-400">
        {total} attorney{total !== 1 ? 's' : ''} found
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {attorneys.map((atty) => (
          <div key={atty.id} className="rounded-lg border-2 border-gray-300 bg-transparent transition-shadow hover:shadow-md">
            <div className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold">{atty.name}</h3>
                  {atty.firmName && (
                    <p className="text-sm text-gray-500 dark:text-gray-400">{atty.firmName}</p>
                  )}
                  <p className="text-sm text-gray-500">
                    {[atty.city, atty.stateCode].filter(Boolean).join(', ')}
                  </p>
                </div>
                {atty.indexScore != null && (
                  <div className="text-right">
                    <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {Math.round(atty.indexScore)}
                    </div>
                    <div className="text-xs text-gray-500">Index Score</div>
                  </div>
                )}
              </div>

              {atty.practiceAreas.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {atty.practiceAreas.slice(0, 3).map((area) => (
                    <span
                      key={area}
                      className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700 dark:bg-blue-900 dark:text-blue-200"
                    >
                      {area}
                    </span>
                  ))}
                </div>
              )}

              {atty.dimensions && (
                <div className="mt-3 space-y-1">
                  <ScoreBar label="Communication" value={atty.dimensions.communication} />
                  <ScoreBar label="Outcome" value={atty.dimensions.outcome} />
                  <ScoreBar label="Responsiveness" value={atty.dimensions.responsiveness} />
                  <ScoreBar label="Expertise" value={atty.dimensions.expertise} />
                </div>
              )}

              <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
                <span>{atty.reviewCount} review{atty.reviewCount !== 1 ? 's' : ''}</span>
                {atty.yearsExperience && <span>{atty.yearsExperience} years experience</span>}
                {atty.trend && (
                  <span
                    className={
                      atty.trend === 'IMPROVING'
                        ? 'text-green-600'
                        : atty.trend === 'DECLINING'
                          ? 'text-red-500'
                          : 'text-gray-500'
                    }
                  >
                    {atty.trend.toLowerCase()}
                  </span>
                )}
              </div>

              {atty.website && (
                <a
                  href={atty.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-block text-sm text-blue-600 hover:underline dark:text-blue-400"
                >
                  Visit website
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

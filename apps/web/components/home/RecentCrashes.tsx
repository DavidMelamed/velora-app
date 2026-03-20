import { prisma } from '@velora/db'
import { displayName } from '@velora/shared'

const SEVERITY_STYLES: Record<string, { border: string; dot: string; bg: string }> = {
  FATAL: { border: 'border-l-red-500', dot: 'bg-red-500', bg: 'hover:bg-red-50 dark:hover:bg-red-900/10' },
  SUSPECTED_SERIOUS_INJURY: { border: 'border-l-orange-500', dot: 'bg-orange-500', bg: 'hover:bg-orange-50 dark:hover:bg-orange-900/10' },
  SUSPECTED_MINOR_INJURY: { border: 'border-l-yellow-500', dot: 'bg-yellow-500', bg: 'hover:bg-yellow-50 dark:hover:bg-yellow-900/10' },
  POSSIBLE_INJURY: { border: 'border-l-blue-400', dot: 'bg-blue-400', bg: 'hover:bg-blue-50 dark:hover:bg-blue-900/10' },
  PROPERTY_DAMAGE_ONLY: { border: 'border-l-gray-300', dot: 'bg-gray-300', bg: 'hover:bg-gray-50 dark:hover:bg-gray-800/50' },
}

const DEFAULT_STYLE = { border: 'border-l-gray-200', dot: 'bg-gray-300', bg: 'hover:bg-gray-50' }

export async function RecentCrashes() {
  let crashes: Array<{
    id: string
    crashDate: Date
    cityName: string | null
    stateCode: string
    crashSeverity: string | null
  }> = []

  try {
    crashes = await prisma.crash.findMany({
      select: {
        id: true,
        crashDate: true,
        cityName: true,
        stateCode: true,
        crashSeverity: true,
      },
      orderBy: { crashDate: 'desc' },
      take: 8,
    })
  } catch {
    // DB may not be available during build
  }

  if (crashes.length === 0) return null

  return (
    <div className="mx-auto max-w-5xl px-6">
      <div className="mb-4 text-center text-sm font-medium uppercase tracking-widest text-gray-400">
        Latest Data
      </div>
      <h2 className="mb-10 text-center text-3xl font-bold tracking-tight">Recent Crashes</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {crashes.map((crash) => {
          const style = SEVERITY_STYLES[crash.crashSeverity ?? ''] ?? DEFAULT_STYLE
          return (
            <a
              key={crash.id}
              href={`/crash/${crash.id}`}
              className={`group rounded-xl border border-gray-200/80 border-l-4 ${style.border} bg-white p-4 transition-all ${style.bg} hover:shadow-md dark:border-gray-800 dark:bg-gray-900`}
            >
              <div className="flex items-center gap-2">
                <span className={`inline-block h-2 w-2 rounded-full ${style.dot}`} />
                <span className="text-xs font-medium text-gray-500">
                  {crash.crashDate.toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>
              </div>
              <div className="mt-2 text-sm font-semibold text-gray-900 group-hover:text-blue-600 dark:text-white dark:group-hover:text-blue-400">
                {crash.cityName ? `${crash.cityName}, ` : ''}
                {crash.stateCode}
              </div>
              {crash.crashSeverity && (
                <div className="mt-1 text-xs text-gray-400">
                  {displayName(crash.crashSeverity)}
                </div>
              )}
            </a>
          )
        })}
      </div>
    </div>
  )
}

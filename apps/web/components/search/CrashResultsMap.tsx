'use client'

// Using plain HTML/Tailwind to avoid React types version mismatch with @velora/ui forwardRef

interface CrashResult {
  id: string
  date: string
  location: string
  severity: string | null
  type: string | null
  latitude: number | null
  longitude: number | null
  vehicleCount: number
  personCount: number
}

interface CrashResultsMapProps {
  results: CrashResult[]
  total: number
  showing: number
}

const severityColors: Record<string, string> = {
  FATAL: 'bg-red-600 text-white',
  SUSPECTED_SERIOUS_INJURY: 'bg-orange-500 text-white',
  SUSPECTED_MINOR_INJURY: 'bg-yellow-500 text-gray-900',
  POSSIBLE_INJURY: 'bg-blue-400 text-white',
  PROPERTY_DAMAGE_ONLY: 'bg-gray-400 text-white',
}

function formatSeverity(sev: string | null): string {
  if (!sev) return 'Unknown'
  return sev
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

export function CrashResultsMap({ results, total, showing }: CrashResultsMapProps) {
  const geoResults = results.filter((r) => r.latitude != null && r.longitude != null)

  return (
    <div className="my-3">
      <div className="mb-2 text-sm text-gray-500 dark:text-gray-400">
        Showing {showing} of {total.toLocaleString()} crashes
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {results.map((crash) => (
          <div key={crash.id} className="rounded-lg border-2 border-gray-300 bg-transparent transition-shadow hover:shadow-md">
            <div className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <a
                    href={`/crash/${crash.id}`}
                    className="font-medium text-blue-600 hover:underline dark:text-blue-400"
                  >
                    {crash.date}
                  </a>
                  <p className="mt-1 truncate text-sm text-gray-600 dark:text-gray-300">
                    {crash.location || 'Unknown location'}
                  </p>
                  <div className="mt-2 flex gap-3 text-xs text-gray-500">
                    <span>
                      {crash.vehicleCount} vehicle{crash.vehicleCount !== 1 ? 's' : ''}
                    </span>
                    <span>
                      {crash.personCount} person{crash.personCount !== 1 ? 's' : ''}
                    </span>
                    {crash.type && <span>{crash.type.replace(/_/g, ' ').toLowerCase()}</span>}
                  </div>
                </div>
                {crash.severity && (
                  <span
                    className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium ${severityColors[crash.severity] ?? 'bg-gray-200'}`}
                  >
                    {formatSeverity(crash.severity)}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
      {geoResults.length > 0 && (
        <div className="mt-3 overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
          <iframe
            title="Crash locations"
            className="h-64 w-full"
            src={`https://www.openstreetmap.org/export/embed.html?bbox=${Math.min(...geoResults.map((r) => r.longitude!)) - 0.02},${Math.min(...geoResults.map((r) => r.latitude!)) - 0.02},${Math.max(...geoResults.map((r) => r.longitude!)) + 0.02},${Math.max(...geoResults.map((r) => r.latitude!)) + 0.02}&layer=mapnik`}
            loading="lazy"
          />
        </div>
      )}
    </div>
  )
}

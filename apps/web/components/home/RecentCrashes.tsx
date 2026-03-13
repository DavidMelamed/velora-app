import { prisma } from '@velora/db'

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
      take: 10,
    })
  } catch {
    // DB may not be available during build
  }

  if (crashes.length === 0) {
    return null
  }

  return (
    <section className="mx-auto max-w-4xl px-4 py-12">
      <h2 className="mb-6 text-center text-2xl font-bold tracking-tight">Recent Crashes</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {crashes.map((crash) => (
          <a
            key={crash.id}
            href={`/crashes/${crash.id}`}
            className="rounded-lg border border-gray-200 p-3 transition-shadow hover:shadow-md dark:border-gray-700"
          >
            <div className="text-sm font-medium">
              {crash.crashDate.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </div>
            <div className="mt-1 text-xs text-gray-500">
              {crash.cityName ? `${crash.cityName}, ` : ''}
              {crash.stateCode}
            </div>
            {crash.crashSeverity && (
              <div className="mt-1 text-xs text-gray-400">
                {crash.crashSeverity.replace(/_/g, ' ').toLowerCase()}
              </div>
            )}
          </a>
        ))}
      </div>
    </section>
  )
}

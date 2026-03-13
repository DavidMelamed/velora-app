import { prisma } from '@velora/db'

interface StatItem {
  label: string
  value: string
}

export async function StatsBar() {
  let stats: StatItem[] = []

  try {
    const [crashCount, stateCount, attorneyCount] = await Promise.all([
      prisma.crash.count(),
      prisma.crash.groupBy({ by: ['stateCode'] }).then((r) => r.length),
      prisma.attorney.count(),
    ])

    stats = [
      { label: 'Crashes Indexed', value: crashCount.toLocaleString() },
      { label: 'States Covered', value: stateCount.toString() },
      { label: 'Attorneys Indexed', value: attorneyCount.toLocaleString() },
    ]
  } catch {
    // Fallback stats when DB is unavailable
    stats = [
      { label: 'Crashes Indexed', value: '---' },
      { label: 'States Covered', value: '51' },
      { label: 'Attorneys Indexed', value: '---' },
    ]
  }

  return (
    <section className="border-y border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900">
      <div className="mx-auto flex max-w-4xl items-center justify-around px-4 py-8">
        {stats.map((stat) => (
          <div key={stat.label} className="text-center">
            <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">{stat.value}</div>
            <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">{stat.label}</div>
          </div>
        ))}
      </div>
    </section>
  )
}

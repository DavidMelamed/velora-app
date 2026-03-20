import { prisma } from '@velora/db'
import { displayName } from '@velora/shared'

interface StatItem {
  label: string
  value: string
  subtitle?: string
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
      { label: 'Crashes Indexed', value: crashCount.toLocaleString(), subtitle: 'Public records' },
      { label: 'States Covered', value: stateCount.toString(), subtitle: 'And growing' },
      { label: 'Attorneys Indexed', value: attorneyCount.toLocaleString(), subtitle: 'Ranked by AI' },
    ]
  } catch {
    stats = [
      { label: 'Crashes Indexed', value: '---', subtitle: 'Public records' },
      { label: 'States Covered', value: '51', subtitle: 'And growing' },
      { label: 'Attorneys Indexed', value: '---', subtitle: 'Ranked by AI' },
    ]
  }

  return (
    <section className="mx-auto max-w-4xl px-6 py-4">
      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-2xl border border-gray-200/80 bg-white px-6 py-5 text-center transition-colors hover:border-gray-300 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-gray-700"
          >
            <div className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
              {stat.value}
            </div>
            <div className="mt-1 text-sm font-medium text-gray-600 dark:text-gray-400">{stat.label}</div>
            {stat.subtitle && (
              <div className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">{stat.subtitle}</div>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}

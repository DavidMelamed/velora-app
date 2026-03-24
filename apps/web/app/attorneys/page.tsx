import type { Metadata } from 'next'
import { Prisma, prisma } from '@velora/db'
import { displayName } from '@velora/shared'
import { CompareButton } from '@/components/attorney/CompareButton'

export const metadata: Metadata = {
  title: 'Attorney Directory — Find Top Personal Injury Attorneys | Velora',
  description:
    'Search and compare personal injury attorneys ranked by Velora\'s Attorney Index. 8-dimension review analysis, verified ratings, and client reviews.',
}

interface SearchParams {
  q?: string
  state?: string
  sort?: string
  page?: string
}

const attorneyCardInclude = {
  attorneyIndex: { select: { score: true, reviewCount: true } },
  _count: { select: { reviews: true } },
} satisfies Prisma.AttorneyInclude

type DirectoryAttorney = Prisma.AttorneyGetPayload<{ include: typeof attorneyCardInclude }>

export default async function AttorneyDirectoryPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const sp = await searchParams
  const query = sp.q ?? ''
  const stateFilter = sp.state ?? ''
  const sortBy = sp.sort ?? 'score'
  const page = Math.max(1, parseInt(sp.page ?? '1', 10))
  const pageSize = 20

  const where: Prisma.AttorneyWhereInput = {}
  if (query) {
    where.OR = [
      { name: { contains: query, mode: 'insensitive' } },
      { firmName: { contains: query, mode: 'insensitive' } },
      { city: { contains: query, mode: 'insensitive' } },
    ]
  }
  if (stateFilter) {
    where.stateCode = stateFilter.toUpperCase()
  }

  let attorneys: DirectoryAttorney[] = []
  let totalCount = 0

  if (sortBy === 'score') {
    const [rankedAttorneys, rankedCount] = await Promise.all([
      prisma.attorneyIndex.findMany({
        where: { attorney: where },
        orderBy: [
          { score: 'desc' },
          { reviewCount: 'desc' },
        ],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          attorney: {
            include: attorneyCardInclude,
          },
        },
      }),
      prisma.attorneyIndex.count({
        where: { attorney: where },
      }),
    ])

    attorneys = rankedAttorneys.map((entry) => entry.attorney)
    totalCount = rankedCount
  } else {
    const orderBy =
      sortBy === 'name'
        ? { name: 'asc' as const }
        : { reviews: { _count: 'desc' as const } }

    ;[attorneys, totalCount] = await Promise.all([
      prisma.attorney.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: attorneyCardInclude,
      }),
      prisma.attorney.count({ where }),
    ])
  }

  const totalPages = Math.ceil(totalCount / pageSize)
  const resultLabel =
    sortBy === 'score'
      ? 'ranked attorneys with an Attorney Index'
      : 'attorneys'

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
        Attorney Directory
      </h1>
      <p className="mt-2 text-gray-600 dark:text-gray-400">
        {totalCount.toLocaleString()} {resultLabel}
      </p>

      {/* Search & Filter */}
      <form className="mt-6 flex flex-col gap-3 sm:flex-row" method="GET">
        <input
          type="text"
          name="q"
          defaultValue={query}
          placeholder="Search by name, firm, or city..."
          className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
        />
        <select
          name="state"
          defaultValue={stateFilter}
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
        >
          <option value="">All States</option>
          {['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC'].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select
          name="sort"
          defaultValue={sortBy}
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
        >
          <option value="score">Highest Rated</option>
          <option value="reviews">Most Reviews</option>
          <option value="name">Name (A-Z)</option>
        </select>
        <button
          type="submit"
          className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Search
        </button>
      </form>

      {/* Results */}
      <div className="mt-8 space-y-4">
        {attorneys.length === 0 && (
          <p className="py-12 text-center text-gray-500">
            No attorneys found matching your criteria.
          </p>
        )}

        {attorneys.map((attorney) => (
          <div
            key={attorney.id}
            className="relative rounded-lg border border-gray-200 bg-white p-5 transition-colors hover:border-blue-300 hover:shadow-sm dark:border-gray-700 dark:bg-gray-800 dark:hover:border-blue-600"
          >
            <a
              href={`/attorneys/${attorney.slug}`}
              className="absolute inset-0 z-0"
              aria-label={`View ${attorney.name} profile`}
            />
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {attorney.name}
                </h2>
                {attorney.firmName && (
                  <p className="text-sm text-gray-600 dark:text-gray-400">{attorney.firmName}</p>
                )}
                <p className="mt-1 text-sm text-gray-500">
                  {[attorney.city, attorney.stateCode].filter(Boolean).join(', ')}
                </p>
                {attorney.practiceAreas.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {attorney.practiceAreas.slice(0, 4).map((area) => (
                      <span
                        key={area}
                        className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-700 dark:text-gray-300"
                      >
                        {displayName(area)}
                      </span>
                    ))}
                    {attorney.practiceAreas.length > 4 && (
                      <span className="text-xs text-gray-400">
                        +{attorney.practiceAreas.length - 4}
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div className="flex flex-col items-end gap-2">
                {attorney.attorneyIndex && (
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {Math.round(attorney.attorneyIndex.score)}
                  </div>
                )}
                {(() => {
                  const reviewCount = attorney._count.reviews || attorney.googleReviewCount || 0
                  return reviewCount > 0 ? (
                    <div className="text-xs text-gray-500">
                      {reviewCount.toLocaleString()} review{reviewCount !== 1 ? 's' : ''}
                    </div>
                  ) : null
                })()}
                <div className="relative z-10">
                  <CompareButton slug={attorney.slug} />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <nav className="mt-8 flex justify-center gap-2">
          {page > 1 && (
            <a
              href={`/attorneys?${buildQuery({ q: query, state: stateFilter, sort: sortBy, page: String(page - 1) })}`}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
            >
              Previous
            </a>
          )}
          <span className="px-4 py-2 text-sm text-gray-500">
            Page {page} of {totalPages}
          </span>
          {page < totalPages && (
            <a
              href={`/attorneys?${buildQuery({ q: query, state: stateFilter, sort: sortBy, page: String(page + 1) })}`}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
            >
              Next
            </a>
          )}
        </nav>
      )}
    </main>
  )
}

function buildQuery(params: Record<string, string>): string {
  return Object.entries(params)
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&')
}

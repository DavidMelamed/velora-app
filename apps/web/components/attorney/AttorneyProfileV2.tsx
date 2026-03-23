'use client'

import { displayName } from '@velora/shared'
import { ReviewDimensions, type DimensionScores } from './ReviewDimensions'
import { ConsultationCTA } from './ConsultationCTA'

interface AttorneyProfileProps {
  attorney: {
    id: string
    name: string
    slug: string
    firmName?: string | null
    phone?: string | null
    email?: string | null
    website?: string | null
    address?: string | null
    city?: string | null
    stateCode?: string | null
    zipCode?: string | null
    description?: string | null
    category?: string | null
    additionalCategories?: string[]
    mainImageUrl?: string | null
    totalPhotos?: number | null
    isClaimed?: boolean | null
    googleRating?: number | null
    googleReviewCount?: number | null
    workHours?: unknown
    practiceAreas: string[]
    yearsExperience?: number | null
    barNumber?: string | null
  }
  indexScore?: number | null
  reviewCount: number
  dimensions?: DimensionScores | null
  bestQuotes?: string[]
}

export function AttorneyProfile({
  attorney,
  indexScore,
  reviewCount,
  dimensions,
  bestQuotes,
}: AttorneyProfileProps) {
  const location = [attorney.city, attorney.stateCode].filter(Boolean).join(', ')
  const aboutText = normalizeAboutText(attorney.description, attorney.address)
  const businessStatus = getBusinessStatus(attorney.workHours)
  const categories = [attorney.category, ...(attorney.additionalCategories ?? [])].filter(Boolean)
  const hasGoogleProfile =
    attorney.googleRating != null ||
    (attorney.googleReviewCount ?? 0) > 0 ||
    businessStatus !== null ||
    attorney.isClaimed != null ||
    (attorney.totalPhotos ?? 0) > 0
  const hasDetails = !!attorney.yearsExperience || !!attorney.barNumber

  const normalizedQuotes = (bestQuotes || [])
    .map((q: unknown) => (typeof q === 'string' ? q : (q as { text?: string })?.text ?? ''))
    .filter(Boolean)

  return (
    <div className="mx-auto max-w-5xl px-4 py-8" data-v="2">
      <header className="mb-8">
        <nav className="mb-4 text-sm text-gray-500">
          <a href="/" className="hover:text-blue-600">Home</a>
          <span className="mx-2">/</span>
          <a href="/attorneys" className="hover:text-blue-600">Attorneys</a>
          <span className="mx-2">/</span>
          <span>{attorney.name}</span>
        </nav>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{attorney.name}</h1>
            {attorney.firmName && (
              <p className="mt-1 text-lg text-gray-600 dark:text-gray-400">{attorney.firmName}</p>
            )}
            {location && <p className="mt-1 text-sm text-gray-500">{location}</p>}
          </div>

          <div className="flex flex-wrap gap-3">
            {indexScore !== undefined && indexScore !== null && (
              <div className="rounded-xl border border-blue-200 bg-blue-50 px-6 py-4 text-center dark:border-blue-800 dark:bg-blue-900/20">
                <div className="text-3xl font-bold text-blue-700 dark:text-blue-300">
                  {Math.round(indexScore)}
                </div>
                <div className="text-xs font-medium uppercase tracking-wider text-blue-600 dark:text-blue-400">
                  Attorney Index
                </div>
                <div className="mt-1 text-xs text-gray-500">
                  {reviewCount} review{reviewCount !== 1 ? 's' : ''}
                </div>
              </div>
            )}

            {(attorney.googleRating || (attorney.googleReviewCount ?? 0) > 0) && (
              <div className="rounded-xl border border-gray-200 bg-white px-6 py-4 text-center dark:border-gray-700 dark:bg-gray-900">
                <div className="text-3xl font-bold text-gray-900 dark:text-white">
                  {attorney.googleRating ? attorney.googleRating.toFixed(1) : '-'}
                </div>
                <div className="text-xs font-medium uppercase tracking-wider text-gray-500">
                  Google Rating
                </div>
                <div className="mt-1 text-xs text-gray-500">
                  {(attorney.googleReviewCount ?? 0).toLocaleString()} review{(attorney.googleReviewCount ?? 0) !== 1 ? 's' : ''}
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="space-y-8 lg:col-span-2">
          {attorney.mainImageUrl && (
            <section className="overflow-hidden rounded-2xl border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900">
              <img
                src={attorney.mainImageUrl}
                alt={attorney.firmName ?? attorney.name}
                className="h-72 w-full object-cover"
              />
            </section>
          )}

          {aboutText && (
            <section>
              <h2 className="mb-3 text-lg font-semibold text-gray-900 dark:text-white">
                About
              </h2>
              <p className="whitespace-pre-line text-sm leading-7 text-gray-700 dark:text-gray-300">
                {aboutText}
              </p>
            </section>
          )}

          {attorney.practiceAreas.length > 0 && (
            <section>
              <h2 className="mb-3 text-lg font-semibold text-gray-900 dark:text-white">
                Practice Areas
              </h2>
              <div className="flex flex-wrap gap-2">
                {attorney.practiceAreas.map((area) => (
                  <span
                    key={area}
                    className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
                  >
                    {displayName(area)}
                  </span>
                ))}
              </div>
            </section>
          )}

          {categories.length > 0 && (
            <section>
              <h2 className="mb-3 text-lg font-semibold text-gray-900 dark:text-white">
                Business Profile
              </h2>
              <div className="flex flex-wrap gap-2">
                {categories.map((category) => (
                  <span
                    key={category}
                    className="rounded-full border border-gray-200 bg-white px-3 py-1 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
                  >
                    {category}
                  </span>
                ))}
              </div>
            </section>
          )}

          {dimensions && <ReviewDimensions scores={dimensions} />}

          {normalizedQuotes.length > 0 && (
            <section>
              <h2 className="mb-3 text-lg font-semibold text-gray-900 dark:text-white">
                Client Reviews
              </h2>
              <div className="space-y-3">
                {normalizedQuotes.map((text: string, i: number) => (
                  <blockquote
                    key={i}
                    className="rounded-lg border-l-4 border-blue-500 bg-gray-50 p-4 text-sm italic text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                  >
                    &ldquo;{text}&rdquo;
                  </blockquote>
                ))}
              </div>
            </section>
          )}
        </div>

        <div className="space-y-6">
          <ConsultationCTA attorneyId={attorney.id} attorneyName={attorney.name} />

          <div className="rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500">
              Contact
            </h3>
            <dl className="space-y-3">
              {attorney.phone && (
                <div>
                  <dt className="text-xs text-gray-400">Phone</dt>
                  <dd>
                    <a
                      href={`tel:${attorney.phone}`}
                      className="text-sm text-blue-600 hover:underline dark:text-blue-400"
                    >
                      {attorney.phone}
                    </a>
                  </dd>
                </div>
              )}
              {attorney.email && (
                <div>
                  <dt className="text-xs text-gray-400">Email</dt>
                  <dd>
                    <a
                      href={`mailto:${attorney.email}`}
                      className="text-sm text-blue-600 hover:underline dark:text-blue-400"
                    >
                      {attorney.email}
                    </a>
                  </dd>
                </div>
              )}
              {attorney.website && (
                <div>
                  <dt className="text-xs text-gray-400">Website</dt>
                  <dd>
                    <a
                      href={attorney.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:underline dark:text-blue-400"
                    >
                      Visit Website
                    </a>
                  </dd>
                </div>
              )}
              {attorney.address && (
                <div>
                  <dt className="text-xs text-gray-400">Address</dt>
                  <dd className="text-sm text-gray-700 dark:text-gray-300">{attorney.address}</dd>
                </div>
              )}
            </dl>
          </div>

          {hasGoogleProfile && (
            <div className="rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500">
                Google Profile
              </h3>
              <dl className="space-y-3">
                {attorney.googleRating && (
                  <div>
                    <dt className="text-xs text-gray-400">Rating</dt>
                    <dd className="text-sm text-gray-700 dark:text-gray-300">
                      {attorney.googleRating.toFixed(1)} / 5
                    </dd>
                  </div>
                )}
                {(attorney.googleReviewCount ?? 0) > 0 && (
                  <div>
                    <dt className="text-xs text-gray-400">Reviews</dt>
                    <dd className="text-sm text-gray-700 dark:text-gray-300">
                      {(attorney.googleReviewCount ?? 0).toLocaleString()}
                    </dd>
                  </div>
                )}
                {businessStatus && (
                  <div>
                    <dt className="text-xs text-gray-400">Status</dt>
                    <dd className="text-sm text-gray-700 dark:text-gray-300">{businessStatus}</dd>
                  </div>
                )}
                {attorney.isClaimed != null && (
                  <div>
                    <dt className="text-xs text-gray-400">Claimed</dt>
                    <dd className="text-sm text-gray-700 dark:text-gray-300">
                      {attorney.isClaimed ? 'Yes' : 'No'}
                    </dd>
                  </div>
                )}
                {(attorney.totalPhotos ?? 0) > 0 && (
                  <div>
                    <dt className="text-xs text-gray-400">Photos</dt>
                    <dd className="text-sm text-gray-700 dark:text-gray-300">
                      {(attorney.totalPhotos ?? 0).toLocaleString()}
                    </dd>
                  </div>
                )}
              </dl>
            </div>
          )}

          {hasDetails && (
            <div className="rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500">
                Details
              </h3>
              <dl className="space-y-3">
                {attorney.yearsExperience && (
                  <div>
                    <dt className="text-xs text-gray-400">Experience</dt>
                    <dd className="text-sm text-gray-700 dark:text-gray-300">
                      {attorney.yearsExperience} years
                    </dd>
                  </div>
                )}
                {attorney.barNumber && (
                  <div>
                    <dt className="text-xs text-gray-400">Bar Number</dt>
                    <dd className="text-sm text-gray-700 dark:text-gray-300">{attorney.barNumber}</dd>
                  </div>
                )}
              </dl>
            </div>
          )}

          <div className="rounded-lg border border-gray-200 bg-gray-50 p-5 text-center dark:border-gray-700 dark:bg-gray-900">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Add this badge to your website
            </p>
            <a
              href={`/attorneys/${attorney.slug}/badge`}
              className="mt-2 inline-block text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
            >
              Get embed code
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}

function normalizeAboutText(description?: string | null, address?: string | null): string | null {
  const value = description?.trim()
  if (!value) return null

  const normalizedAddress = address?.trim().toLowerCase()
  if (normalizedAddress && value.toLowerCase() === normalizedAddress) {
    return null
  }

  return value
}

function getBusinessStatus(workHours: unknown): string | null {
  if (!workHours || typeof workHours !== 'object') return null

  const record = workHours as {
    current_status?: unknown
    work_hours?: { current_status?: unknown }
  }

  const rawStatus =
    typeof record.current_status === 'string'
      ? record.current_status
      : typeof record.work_hours?.current_status === 'string'
        ? record.work_hours.current_status
        : null

  if (!rawStatus) return null

  return rawStatus
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

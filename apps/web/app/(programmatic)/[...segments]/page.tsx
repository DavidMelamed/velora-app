export const revalidate = 3600 // Revalidate programmatic pages every hour

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { prisma } from '@velora/db'
import {
  resolveSegments,
  generatePageTitle,
  generatePageDescription,
  buildCanonicalUrl,
  ATTRIBUTE_FILTERS,
  type CrashAttribute,
} from '@/lib/seo/resolve-segments'
import { LocationPage } from '@/components/seo/LocationPage'
import { AttributeComboPage } from '@/components/seo/AttributeComboPage'
import { TemporalPage } from '@/components/seo/TemporalPage'

interface ProgrammaticPageProps {
  params: Promise<{ segments: string[] }>
}

export async function generateMetadata({ params }: ProgrammaticPageProps): Promise<Metadata> {
  const { segments } = await params
  const resolved = resolveSegments(segments)

  if (!resolved) {
    return { title: 'Page Not Found' }
  }

  const title = generatePageTitle(resolved)
  const description = generatePageDescription(resolved)
  const canonical = buildCanonicalUrl(resolved)

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      type: 'website',
      siteName: 'Velora',
      url: canonical,
    },
  }
}

/**
 * Build Prisma where clause from resolved segments.
 */
function buildWhereClause(resolved: ReturnType<typeof resolveSegments>) {
  if (!resolved) return {}

  const where: Record<string, unknown> = {
    stateCode: resolved.stateCode,
  }

  if (resolved.city) {
    where.cityName = {
      equals: resolved.city,
      mode: 'insensitive',
    }
  }

  if (resolved.attribute) {
    const filter = ATTRIBUTE_FILTERS[resolved.attribute as CrashAttribute]
    if (filter) {
      Object.assign(where, filter)
    }
  }

  if (resolved.year) {
    const start = new Date(resolved.year, (resolved.month ?? 1) - 1, 1)
    const end = resolved.month
      ? new Date(resolved.year, resolved.month, 1)
      : new Date(resolved.year + 1, 0, 1)
    where.crashDate = { gte: start, lt: end }
  }

  return where
}

export default async function ProgrammaticPage({ params }: ProgrammaticPageProps) {
  const { segments } = await params
  const resolved = resolveSegments(segments)

  if (!resolved) {
    notFound()
  }

  const where = buildWhereClause(resolved)

  // Fetch common stats
  const [totalCrashes, fatalCrashes, injuryCrashes] = await Promise.all([
    prisma.crash.count({ where }),
    prisma.crash.count({ where: { ...where, crashSeverity: 'FATAL' } }),
    prisma.crash.count({
      where: {
        ...where,
        crashSeverity: { in: ['SUSPECTED_SERIOUS_INJURY', 'SUSPECTED_MINOR_INJURY', 'POSSIBLE_INJURY'] },
      },
    }),
  ])

  const recentCrashes = await prisma.crash.findMany({
    where,
    orderBy: { crashDate: 'desc' },
    take: 10,
    select: {
      id: true,
      crashDate: true,
      crashSeverity: true,
      cityName: true,
      county: true,
      stateCode: true,
      _count: { select: { vehicles: true } },
    },
  })

  const formattedRecent = recentCrashes.map((c) => ({
    id: c.id,
    date: c.crashDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
    severity: c.crashSeverity ?? 'UNKNOWN',
    location: [c.cityName, c.county].filter(Boolean).join(', '),
    vehicles: c._count.vehicles,
  }))

  // Render based on tier
  switch (resolved.tier) {
    case 'state':
    case 'city': {
      // Get top crash types via groupBy
      const crashTypeGroups = await prisma.crash.groupBy({
        by: ['mannerOfCollision'],
        where,
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 8,
      })

      const topCrashTypes = crashTypeGroups
        .filter((g) => g.mannerOfCollision)
        .map((g) => ({
          type: g.mannerOfCollision!,
          count: g._count.id,
        }))

      // Monthly counts for last 12 months
      const twelveMonthsAgo = new Date()
      twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12)
      const monthlyRaw = await prisma.crash.groupBy({
        by: ['crashDate'],
        where: { ...where, crashDate: { gte: twelveMonthsAgo } },
        _count: { id: true },
      })

      // Aggregate by month
      const monthlyMap = new Map<string, number>()
      for (const r of monthlyRaw) {
        const key = `${r.crashDate.getFullYear()}-${String(r.crashDate.getMonth() + 1).padStart(2, '0')}`
        monthlyMap.set(key, (monthlyMap.get(key) ?? 0) + r._count.id)
      }
      const monthlyCounts = Array.from(monthlyMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, count]) => ({ month, count }))

      return (
        <LocationPage
          resolved={resolved}
          stats={{
            totalCrashes,
            fatalCrashes,
            injuryCrashes,
            topCrashTypes,
            recentCrashes: formattedRecent,
            monthlyCounts,
          }}
        />
      )
    }

    case 'state-attribute':
    case 'city-attribute': {
      // Count total vehicles for average
      const vehicleCount = await prisma.vehicle.count({
        where: { crash: where },
      })
      const avgVehicles = totalCrashes > 0 ? vehicleCount / totalCrashes : 0

      // Related attributes: just list a few that aren't the current one
      const { CRASH_ATTRIBUTES } = await import('@/lib/seo/resolve-segments')
      const relatedAttributes = CRASH_ATTRIBUTES.filter((a) => a !== resolved.attribute).slice(0, 6) as CrashAttribute[]

      return (
        <AttributeComboPage
          resolved={resolved}
          stats={{
            totalCrashes,
            fatalCount: fatalCrashes,
            injuryCount: injuryCrashes,
            avgVehicles,
            topContributingFactors: [],
            recentCrashes: formattedRecent.map((c) => ({
              id: c.id,
              date: c.date,
              severity: c.severity,
              location: c.location,
            })),
            relatedAttributes,
          }}
        />
      )
    }

    case 'temporal': {
      // Monthly breakdown within the time period
      const monthlyRaw = await prisma.crash.groupBy({
        by: ['crashDate'],
        where,
        _count: { id: true },
      })

      // Aggregate by month
      const monthlyMap = new Map<string, { count: number; fatal: number }>()
      for (const r of monthlyRaw) {
        const key = new Date(r.crashDate).toLocaleString('en-US', { month: 'short' })
        const existing = monthlyMap.get(key) ?? { count: 0, fatal: 0 }
        existing.count += r._count.id
        monthlyMap.set(key, existing)
      }

      const byMonth = Array.from(monthlyMap.entries()).map(([month, data]) => ({
        month,
        count: data.count,
        fatal: data.fatal,
      }))

      // Severity breakdown
      const severityGroups = await prisma.crash.groupBy({
        by: ['crashSeverity'],
        where,
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
      })
      const bySeverity = severityGroups
        .filter((g) => g.crashSeverity)
        .map((g) => ({ severity: g.crashSeverity!, count: g._count.id }))

      // Type breakdown
      const typeGroups = await prisma.crash.groupBy({
        by: ['mannerOfCollision'],
        where,
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 8,
      })
      const byType = typeGroups
        .filter((g) => g.mannerOfCollision)
        .map((g) => ({ type: g.mannerOfCollision!, count: g._count.id }))

      // Previous period comparison
      let previousWhere: Record<string, unknown>
      if (resolved.month) {
        const prevMonth = resolved.month === 1 ? 12 : resolved.month - 1
        const prevYear = resolved.month === 1 ? resolved.year! - 1 : resolved.year!
        previousWhere = {
          ...where,
          crashDate: {
            gte: new Date(prevYear, prevMonth - 1, 1),
            lt: new Date(prevYear, prevMonth, 1),
          },
        }
      } else {
        previousWhere = {
          ...where,
          crashDate: {
            gte: new Date(resolved.year! - 1, 0, 1),
            lt: new Date(resolved.year!, 0, 1),
          },
        }
      }
      const previousPeriodCount = await prisma.crash.count({ where: previousWhere })

      return (
        <TemporalPage
          resolved={resolved}
          stats={{
            totalCrashes,
            fatalCrashes,
            injuryCrashes,
            byMonth,
            bySeverity,
            byType,
            previousPeriodCount,
          }}
        />
      )
    }
  }
}

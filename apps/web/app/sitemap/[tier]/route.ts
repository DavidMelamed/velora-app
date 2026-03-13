import { NextResponse } from 'next/server'
import { prisma } from '@velora/db'
import { STATE_CATALOG } from '@velora/shared'
import { CRASH_ATTRIBUTES } from '@/lib/seo/resolve-segments'

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://velora.com'
const MAX_URLS_PER_SITEMAP = 50_000

interface SitemapEntry {
  loc: string
  lastmod?: string
  changefreq?: string
  priority?: number
}

function buildSitemapXml(entries: SitemapEntry[]): string {
  const urls = entries
    .slice(0, MAX_URLS_PER_SITEMAP)
    .map(
      (e) =>
        `  <url>
    <loc>${escapeXml(e.loc)}</loc>${e.lastmod ? `\n    <lastmod>${e.lastmod}</lastmod>` : ''}${e.changefreq ? `\n    <changefreq>${e.changefreq}</changefreq>` : ''}${e.priority !== undefined ? `\n    <priority>${e.priority}</priority>` : ''}
  </url>`
    )
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`
}

function escapeXml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function stateSlug(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '-')
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ tier: string }> }
) {
  const { tier } = await params
  const now = new Date().toISOString().split('T')[0]!

  let entries: SitemapEntry[] = []

  switch (tier) {
    case 'core': {
      entries = [
        { loc: BASE_URL, changefreq: 'daily', priority: 1.0, lastmod: now },
        { loc: `${BASE_URL}/search`, changefreq: 'daily', priority: 0.9, lastmod: now },
        { loc: `${BASE_URL}/attorneys`, changefreq: 'weekly', priority: 0.8, lastmod: now },
      ]
      break
    }

    case 'states': {
      entries = STATE_CATALOG.map((s) => ({
        loc: `${BASE_URL}/crashes/${stateSlug(s.name)}`,
        changefreq: 'weekly' as const,
        priority: 0.8,
        lastmod: now,
      }))
      break
    }

    case 'cities': {
      const cities = await prisma.crash.findMany({
        where: { cityName: { not: null } },
        select: { cityName: true, stateCode: true },
        distinct: ['cityName', 'stateCode'],
        take: MAX_URLS_PER_SITEMAP,
      })

      const stateByCode = new Map(STATE_CATALOG.map((s) => [s.code, s.name]))

      entries = cities
        .filter((c) => c.cityName)
        .map((c) => {
          const stateName = stateByCode.get(c.stateCode) ?? c.stateCode
          const citySlug = c.cityName!.toLowerCase().replace(/\s+/g, '-')
          return {
            loc: `${BASE_URL}/crashes/${stateSlug(stateName)}/${citySlug}`,
            changefreq: 'weekly' as const,
            priority: 0.7,
            lastmod: now,
          }
        })
      break
    }

    case 'attributes': {
      entries = STATE_CATALOG.flatMap((s) =>
        CRASH_ATTRIBUTES.map((attr) => ({
          loc: `${BASE_URL}/crashes/${stateSlug(s.name)}/${attr}`,
          changefreq: 'monthly' as const,
          priority: 0.6,
          lastmod: now,
        }))
      ).slice(0, MAX_URLS_PER_SITEMAP)
      break
    }

    case 'temporal': {
      const currentYear = new Date().getFullYear()
      const years = Array.from({ length: 5 }, (_, i) => currentYear - i)

      entries = STATE_CATALOG.flatMap((s) =>
        years.map((year) => ({
          loc: `${BASE_URL}/crashes/${stateSlug(s.name)}/${year}`,
          changefreq: 'monthly' as const,
          priority: 0.5,
          lastmod: now,
        }))
      ).slice(0, MAX_URLS_PER_SITEMAP)
      break
    }

    case 'attorneys': {
      const attorneys = await prisma.attorney.findMany({
        select: { slug: true, updatedAt: true },
        take: MAX_URLS_PER_SITEMAP,
      })

      entries = attorneys.map((a) => ({
        loc: `${BASE_URL}/attorneys/${a.slug}`,
        changefreq: 'weekly' as const,
        priority: 0.7,
        lastmod: a.updatedAt.toISOString().split('T')[0],
      }))
      break
    }

    case 'crashes': {
      const crashes = await prisma.crash.findMany({
        select: { id: true, updatedAt: true },
        orderBy: { crashDate: 'desc' },
        take: MAX_URLS_PER_SITEMAP,
      })

      entries = crashes.map((c) => ({
        loc: `${BASE_URL}/crashes/${c.id}`,
        changefreq: 'monthly' as const,
        priority: 0.6,
        lastmod: c.updatedAt.toISOString().split('T')[0],
      }))
      break
    }

    default: {
      return NextResponse.json({ error: 'Unknown sitemap tier' }, { status: 404 })
    }
  }

  const xml = buildSitemapXml(entries)

  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400',
    },
  })
}

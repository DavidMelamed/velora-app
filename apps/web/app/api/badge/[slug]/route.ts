import { NextResponse } from 'next/server'
import { prisma } from '@velora/db'

/**
 * Dynamic SVG badge for attorneys.
 * GET /api/badge/:slug → Returns an SVG image with attorney name and Index score.
 */

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params

  const attorney = await prisma.attorney.findUnique({
    where: { slug },
    select: {
      name: true,
      attorneyIndex: { select: { score: true } },
      _count: { select: { reviews: true } },
    },
  })

  if (!attorney) {
    return NextResponse.json({ error: 'Attorney not found' }, { status: 404 })
  }

  const rawScore = attorney.attorneyIndex?.score
  const score = rawScore != null ? Math.round(rawScore) : '--'
  const name = attorney.name.length > 25 ? attorney.name.substring(0, 22) + '...' : attorney.name
  const reviewCount = attorney._count.reviews
  const reviewText = reviewCount > 0 ? `${reviewCount} reviews` : ''

  // Score color gradient
  const scoreNum = typeof score === 'number' ? score : 0
  const scoreColor =
    scoreNum >= 80 ? '#22c55e' : scoreNum >= 60 ? '#3b82f6' : scoreNum >= 40 ? '#f59e0b' : '#ef4444'

  const badgeWidth = 280
  const badgeHeight = 60

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${badgeWidth}" height="${badgeHeight}" viewBox="0 0 ${badgeWidth} ${badgeHeight}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#1e293b"/>
      <stop offset="100%" stop-color="#334155"/>
    </linearGradient>
    <linearGradient id="sc" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${scoreColor}"/>
      <stop offset="100%" stop-color="${scoreColor}88"/>
    </linearGradient>
  </defs>
  <rect width="${badgeWidth}" height="${badgeHeight}" rx="8" fill="url(#bg)"/>
  <circle cx="30" cy="30" r="20" fill="url(#sc)"/>
  <text x="30" y="35" text-anchor="middle" fill="white" font-size="14" font-weight="700" font-family="system-ui,sans-serif">${score}</text>
  <text x="60" y="24" fill="white" font-size="13" font-weight="600" font-family="system-ui,sans-serif">${escapeXml(name)}</text>
  <text x="60" y="40" fill="#94a3b8" font-size="11" font-family="system-ui,sans-serif">Attorney Index${reviewText ? ' · ' + escapeXml(reviewText) : ''}</text>
  <text x="${badgeWidth - 10}" y="52" text-anchor="end" fill="#64748b" font-size="8" font-family="system-ui,sans-serif">velora.com</text>
</svg>`

  return new NextResponse(svg, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400',
    },
  })
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

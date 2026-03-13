import { NextResponse } from 'next/server'
import { prisma } from '@velora/db'

/**
 * Dynamic OG Image for Equalizer Reports.
 * GET /api/og/equalizer/:crashId → Returns an SVG image for social sharing.
 */

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ crashId: string }> }
) {
  const { crashId } = await params

  const crash = await prisma.crash.findUnique({
    where: { id: crashId },
    select: {
      crashDate: true,
      cityName: true,
      county: true,
      stateCode: true,
      crashSeverity: true,
      _count: { select: { vehicles: true, persons: true } },
    },
  })

  if (!crash) {
    return NextResponse.json({ error: 'Crash not found' }, { status: 404 })
  }

  const location = [crash.cityName, crash.county, crash.stateCode].filter(Boolean).join(', ')
  const date = crash.crashDate.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
  const severity = (crash.crashSeverity ?? 'Unknown').replace(/_/g, ' ')

  const width = 1200
  const height = 630

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0f172a"/>
      <stop offset="100%" stop-color="#1e293b"/>
    </linearGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#bg)"/>

  <!-- Velora branding -->
  <text x="60" y="80" fill="#3b82f6" font-size="28" font-weight="700" font-family="system-ui,sans-serif">VELORA</text>
  <text x="60" y="110" fill="#64748b" font-size="16" font-family="system-ui,sans-serif">Crash Equalizer Report</text>

  <!-- Crash info -->
  <text x="60" y="200" fill="white" font-size="42" font-weight="700" font-family="system-ui,sans-serif">${escapeXml(location)}</text>
  <text x="60" y="260" fill="#94a3b8" font-size="24" font-family="system-ui,sans-serif">${escapeXml(date)}</text>

  <!-- Stats boxes -->
  <rect x="60" y="320" width="240" height="100" rx="12" fill="#1e3a5f"/>
  <text x="180" y="360" text-anchor="middle" fill="#93c5fd" font-size="14" font-family="system-ui,sans-serif">SEVERITY</text>
  <text x="180" y="400" text-anchor="middle" fill="white" font-size="22" font-weight="700" font-family="system-ui,sans-serif">${escapeXml(severity)}</text>

  <rect x="340" y="320" width="240" height="100" rx="12" fill="#1e3a5f"/>
  <text x="460" y="360" text-anchor="middle" fill="#93c5fd" font-size="14" font-family="system-ui,sans-serif">VEHICLES</text>
  <text x="460" y="400" text-anchor="middle" fill="white" font-size="28" font-weight="700" font-family="system-ui,sans-serif">${crash._count.vehicles}</text>

  <rect x="620" y="320" width="240" height="100" rx="12" fill="#1e3a5f"/>
  <text x="740" y="360" text-anchor="middle" fill="#93c5fd" font-size="14" font-family="system-ui,sans-serif">PERSONS</text>
  <text x="740" y="400" text-anchor="middle" fill="white" font-size="28" font-weight="700" font-family="system-ui,sans-serif">${crash._count.persons}</text>

  <!-- CTA -->
  <rect x="60" y="480" width="340" height="50" rx="8" fill="#2563eb"/>
  <text x="230" y="512" text-anchor="middle" fill="white" font-size="18" font-weight="600" font-family="system-ui,sans-serif">View Full Report on Velora</text>

  <!-- Footer -->
  <text x="${width - 60}" y="${height - 30}" text-anchor="end" fill="#475569" font-size="14" font-family="system-ui,sans-serif">velora.com</text>
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

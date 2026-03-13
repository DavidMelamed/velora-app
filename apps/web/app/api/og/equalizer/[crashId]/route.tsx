import { ImageResponse } from 'next/og'
import { prisma } from '@velora/db'

export const runtime = 'nodejs'

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
      equalizer: {
        select: {
          settlementContext: true,
        },
      },
    },
  })

  const location = crash
    ? [crash.cityName, crash.county, crash.stateCode].filter(Boolean).join(', ')
    : 'Unknown Location'

  const date = crash
    ? crash.crashDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : ''

  const severity = crash?.crashSeverity?.replace(/_/g, ' ') ?? 'Unknown'
  const settlement = crash?.equalizer?.settlementContext as Record<string, unknown> | null

  const lowEst = settlement?.lowEstimate as number | undefined
  const highEst = settlement?.highEstimate as number | undefined
  const hasSettlement = lowEst !== undefined && highEst !== undefined

  return new ImageResponse(
    (
      <div
        style={{
          width: '1200px',
          height: '630px',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#0f172a',
          color: '#ffffff',
          fontFamily: 'sans-serif',
          padding: '60px',
        }}
      >
        {/* Top bar */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '40px',
          }}
        >
          <div style={{ fontSize: '28px', fontWeight: 700, color: '#3b82f6', display: 'flex' }}>
            VELORA
          </div>
          <div style={{ fontSize: '18px', color: '#94a3b8', display: 'flex' }}>
            Crash Equalizer Report
          </div>
        </div>

        {/* Main content */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ fontSize: '42px', fontWeight: 700, marginBottom: '16px', display: 'flex' }}>
            {location}
          </div>
          <div style={{ fontSize: '24px', color: '#94a3b8', marginBottom: '32px', display: 'flex' }}>
            {date} — {severity}
          </div>

          {hasSettlement && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                backgroundColor: '#1e293b',
                borderRadius: '16px',
                padding: '24px 32px',
              }}
            >
              <div style={{ fontSize: '18px', color: '#94a3b8', display: 'flex' }}>
                Settlement Range:
              </div>
              <div style={{ fontSize: '32px', fontWeight: 700, color: '#22c55e', display: 'flex' }}>
                ${lowEst!.toLocaleString()} — ${highEst!.toLocaleString()}
              </div>
            </div>
          )}
        </div>

        {/* Bottom */}
        <div style={{ fontSize: '16px', color: '#64748b', display: 'flex' }}>
          velora.com — Know what the insurance company knows.
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  )
}

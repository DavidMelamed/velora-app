import { prisma } from '@velora/db'
import type { CaseTimeline } from '@velora/db'

const MS_PER_DAY = 24 * 60 * 60 * 1000

/**
 * Detect treatment gaps in a case timeline.
 * A gap is any period > gapThresholdDays between medical timeline events.
 */
export async function detectGaps(
  matterId: string,
  gapThresholdDays: number = 14
): Promise<CaseTimeline[]> {
  // Get all medical timeline events sorted chronologically
  const medicalEvents = await prisma.caseTimeline.findMany({
    where: {
      matterId,
      category: 'medical',
      isGap: false,
    },
    orderBy: { occurredAt: 'asc' },
  })

  if (medicalEvents.length < 2) return []

  const gaps: CaseTimeline[] = []

  for (let i = 0; i < medicalEvents.length - 1; i++) {
    const current = medicalEvents[i]
    const next = medicalEvents[i + 1]
    if (!current || !next) continue

    const daysBetween = Math.round(
      (next.occurredAt.getTime() - current.occurredAt.getTime()) / MS_PER_DAY
    )

    if (daysBetween > gapThresholdDays) {
      // Check if we already have a gap entry for this period
      const midpoint = new Date(
        current.occurredAt.getTime() + (next.occurredAt.getTime() - current.occurredAt.getTime()) / 2
      )

      const existingGap = await prisma.caseTimeline.findFirst({
        where: {
          matterId,
          isGap: true,
          occurredAt: {
            gte: current.occurredAt,
            lte: next.occurredAt,
          },
        },
      })

      if (!existingGap) {
        const currentDate = current.occurredAt.toLocaleDateString()
        const nextDate = next.occurredAt.toLocaleDateString()

        const gap = await prisma.caseTimeline.create({
          data: {
            matterId,
            category: 'medical',
            isGap: true,
            gapDays: daysBetween,
            title: `No treatment activity for ${daysBetween} days`,
            description: `Gap between "${current.title}" on ${currentDate} and "${next.title}" on ${nextDate}. Treatment gaps can affect your case value.`,
            occurredAt: midpoint,
          },
        })

        gaps.push(gap)
      } else {
        gaps.push(existingGap)
      }
    }
  }

  return gaps
}

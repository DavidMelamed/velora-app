import { prisma } from '@velora/db'
import type { Matter, MatterStatus } from '@velora/db'
import { STATE_CATALOG } from '@velora/shared'
import type { MatterCreateInput } from '@velora/shared'

/**
 * Create a new Matter (case).
 * If crashId provided, auto-fills accidentDate, stateCode, and computeStatuteDeadline.
 */
export async function createMatter(input: MatterCreateInput): Promise<Matter> {
  let accidentDate = input.accidentDate ? new Date(input.accidentDate) : undefined
  let stateCode = input.stateCode
  let statuteDeadline: Date | null = null

  // Auto-fill from linked crash
  if (input.crashId) {
    const crash = await prisma.crash.findUnique({
      where: { id: input.crashId },
      select: { crashDate: true, stateCode: true },
    })
    if (crash) {
      accidentDate = accidentDate ?? crash.crashDate
      stateCode = stateCode ?? crash.stateCode
    }
  }

  if (accidentDate && stateCode) {
    statuteDeadline = computeStatuteDeadline(accidentDate, stateCode)
  }

  return prisma.matter.create({
    data: {
      clientName: input.clientName ?? null,
      clientPhone: input.clientPhone ?? null,
      clientEmail: input.clientEmail ?? null,
      crashId: input.crashId ?? null,
      accidentDate: accidentDate ?? null,
      stateCode: stateCode ?? null,
      statuteDeadline,
      status: 'INTAKE',
    },
  })
}

/**
 * Get a matter with related data.
 */
export async function getMatter(id: string) {
  return prisma.matter.findUnique({
    where: { id },
    include: {
      episodes: {
        take: 20,
        orderBy: { occurredAt: 'desc' },
      },
      entities: {
        orderBy: { confidence: 'desc' },
      },
      facts: {
        where: { status: { in: ['CONFIRMED', 'CANDIDATE'] } },
        orderBy: { validFrom: 'desc' },
      },
      timelineEvents: {
        take: 50,
        orderBy: { occurredAt: 'desc' },
      },
      confirmations: {
        where: { confirmed: null },
        orderBy: { sentAt: 'desc' },
      },
      crash: {
        select: {
          id: true,
          crashDate: true,
          stateCode: true,
          crashSeverity: true,
          cityName: true,
          county: true,
        },
      },
      attorney: {
        select: {
          id: true,
          name: true,
          firmName: true,
          phone: true,
          slug: true,
        },
      },
    },
  })
}

/**
 * Update matter status.
 */
export async function updateMatterStatus(
  id: string,
  status: MatterStatus
): Promise<Matter> {
  return prisma.matter.update({
    where: { id },
    data: { status, lastActivityAt: new Date() },
  })
}

/**
 * Link a crash record to an existing matter.
 * Also auto-fills accidentDate, stateCode, and recomputes statuteDeadline.
 */
export async function linkCrashToMatter(
  matterId: string,
  crashId: string
): Promise<Matter> {
  const crash = await prisma.crash.findUnique({
    where: { id: crashId },
    select: { crashDate: true, stateCode: true },
  })

  if (!crash) {
    throw new Error(`Crash not found: ${crashId}`)
  }

  const statuteDeadline = computeStatuteDeadline(crash.crashDate, crash.stateCode)

  return prisma.matter.update({
    where: { id: matterId },
    data: {
      crashId,
      accidentDate: crash.crashDate,
      stateCode: crash.stateCode,
      statuteDeadline,
      lastActivityAt: new Date(),
    },
  })
}

/**
 * Compute statute of limitations deadline from accident date and state code.
 * Uses STATE_CATALOG as source of truth.
 */
export function computeStatuteDeadline(
  accidentDate: Date,
  stateCode: string
): Date | null {
  const state = STATE_CATALOG.find((s) => s.code === stateCode.toUpperCase())
  if (!state) return null

  const deadline = new Date(accidentDate)
  deadline.setFullYear(deadline.getFullYear() + state.statuteOfLimitationsYears)
  return deadline
}

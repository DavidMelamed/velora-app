/**
 * Case Sharing Service
 * Generates secure, time-limited share links for case views.
 * Allows clients to share their case timeline with their attorney.
 */

import { createHash, randomBytes } from 'crypto'
import { prisma } from '@velora/db'

const SHARE_LINK_EXPIRY_DAYS = 30
const SHARE_SECRET = process.env.SHARE_LINK_SECRET || 'velora-default-share-secret'

/**
 * Generate a secure share token for a matter.
 * Token = HMAC(matterId + expiry, secret) + metadata
 */
export function generateShareToken(matterId: string): {
  token: string
  expiresAt: Date
} {
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + SHARE_LINK_EXPIRY_DAYS)

  const payload = `${matterId}:${expiresAt.getTime()}`
  const signature = createHash('sha256')
    .update(`${payload}:${SHARE_SECRET}`)
    .digest('hex')
    .slice(0, 16)

  // Token format: base64(matterId:expiry:signature)
  const token = Buffer.from(`${matterId}:${expiresAt.getTime()}:${signature}`).toString('base64url')

  return { token, expiresAt }
}

/**
 * Validate a share token and return the matterId if valid.
 */
export function validateShareToken(token: string): {
  valid: boolean
  matterId?: string
  expired?: boolean
} {
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf-8')
    const [matterId, expiryStr, signature] = decoded.split(':')

    if (!matterId || !expiryStr || !signature) {
      return { valid: false }
    }

    const expiry = parseInt(expiryStr, 10)
    if (isNaN(expiry)) return { valid: false }

    // Check expiry
    if (Date.now() > expiry) {
      return { valid: false, expired: true, matterId }
    }

    // Verify signature
    const payload = `${matterId}:${expiryStr}`
    const expectedSig = createHash('sha256')
      .update(`${payload}:${SHARE_SECRET}`)
      .digest('hex')
      .slice(0, 16)

    if (signature !== expectedSig) {
      return { valid: false }
    }

    return { valid: true, matterId }
  } catch {
    return { valid: false }
  }
}

/**
 * Get a read-only case view for sharing (no PII, no raw episodes).
 */
export async function getSharedCaseView(matterId: string) {
  const matter = await prisma.matter.findUnique({
    where: { id: matterId },
    select: {
      id: true,
      status: true,
      accidentDate: true,
      stateCode: true,
      statuteDeadline: true,
      // Intentionally exclude: clientName, clientPhone, clientEmail, userId
    },
  })

  if (!matter) return null

  const [timeline, entities, facts] = await Promise.all([
    prisma.caseTimeline.findMany({
      where: { matterId },
      orderBy: { occurredAt: 'desc' },
      take: 50,
      select: {
        id: true,
        category: true,
        title: true,
        occurredAt: true,
        isGap: true,
        gapDays: true,
      },
    }),
    prisma.caseEntity.findMany({
      where: { matterId, confidence: { gte: 0.5 } },
      orderBy: { confidence: 'desc' },
      select: { type: true, name: true, confidence: true },
    }),
    prisma.caseFact.findMany({
      where: { matterId, status: { in: ['CONFIRMED', 'CANDIDATE'] } },
      orderBy: { validFrom: 'desc' },
      take: 20,
      select: {
        subject: true,
        predicate: true,
        object: true,
        validFrom: true,
        status: true,
        confidence: true,
      },
    }),
  ])

  return { matter, timeline, entities, facts }
}

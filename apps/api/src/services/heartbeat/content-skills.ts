import { prisma } from '@velora/db'
import type { HeartbeatCheck, HeartbeatCheckResult } from './checklist'

/**
 * Content Agent Heartbeat Skills — Checks for content that needs generation or refresh.
 * These checks identify:
 * 1. Crashes without narratives
 * 2. Stale intersection danger scores
 * 3. Attorney review updates needing re-analysis
 */

// ─── Crashes Without Narratives ─────────────────────────────────────────────

async function checkCrashesWithoutNarratives(): Promise<HeartbeatCheckResult> {
  const totalCrashes = await prisma.crash.count()
  const withNarratives = await prisma.crashNarrative.count()
  const without = totalCrashes - withNarratives
  const threshold = Math.floor(totalCrashes * 0.3) // Flag if >30% lack narratives

  return {
    name: 'crashes_without_narratives',
    passed: without <= threshold,
    value: without,
    threshold,
    message:
      without <= threshold
        ? `${without} crash(es) without narratives (within threshold)`
        : `${without} crashes lack narratives — content generation needed`,
    severity: without > totalCrashes * 0.5 ? 'critical' : without > threshold ? 'warning' : 'info',
  }
}

// ─── Stale Intersection Scores ──────────────────────────────────────────────

async function checkStaleIntersectionScores(): Promise<HeartbeatCheckResult> {
  // IntersectionDangerScore table will be added in a future phase.
  // For now, check crashes with stale data as a proxy.
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  const staleCount = await prisma.crash.count({
    where: {
      updatedAt: { lt: thirtyDaysAgo },
    },
  })

  const totalCrashes = await prisma.crash.count()
  const threshold = Math.floor(totalCrashes * 0.2) // Flag if >20% are stale

  return {
    name: 'stale_intersection_scores',
    passed: staleCount <= threshold,
    value: staleCount,
    threshold,
    message:
      staleCount <= threshold
        ? `${staleCount} stale crash record(s) (within threshold)`
        : `${staleCount} crash records are >30 days old — data refresh needed`,
    severity: staleCount > totalCrashes * 0.5 ? 'critical' : staleCount > threshold ? 'warning' : 'info',
  }
}

// ─── Attorney Review Updates ────────────────────────────────────────────────

async function checkAttorneyReviewUpdates(): Promise<HeartbeatCheckResult> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  // Find attorneys with recent reviews but stale ReviewIntelligence
  const attorneysWithNewReviews = await prisma.attorney.count({
    where: {
      reviews: {
        some: {
          createdAt: { gte: sevenDaysAgo },
        },
      },
      reviewIntelligence: {
        analyzedAt: { lt: sevenDaysAgo },
      },
    },
  })

  const threshold = 5

  return {
    name: 'attorney_review_updates',
    passed: attorneysWithNewReviews <= threshold,
    value: attorneysWithNewReviews,
    threshold,
    message:
      attorneysWithNewReviews <= threshold
        ? `${attorneysWithNewReviews} attorney(s) with pending review re-analysis`
        : `${attorneysWithNewReviews} attorneys have new reviews needing re-analysis`,
    severity:
      attorneysWithNewReviews > 20 ? 'critical' : attorneysWithNewReviews > threshold ? 'warning' : 'info',
  }
}

// ─── Exported Content Skills ────────────────────────────────────────────────

export const contentHeartbeatChecks: HeartbeatCheck[] = [
  {
    name: 'crashes_without_narratives',
    description: 'Crashes missing AI-generated narratives',
    dispatchTo: 'narrator',
    check: checkCrashesWithoutNarratives,
  },
  {
    name: 'stale_intersection_scores',
    description: 'Intersection danger scores older than 30 days',
    dispatchTo: 'healer',
    check: checkStaleIntersectionScores,
  },
  {
    name: 'attorney_review_updates',
    description: 'Attorneys with new reviews needing re-analysis',
    dispatchTo: 'healer',
    check: checkAttorneyReviewUpdates,
  },
]

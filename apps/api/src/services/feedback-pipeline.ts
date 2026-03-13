import { prisma } from '@velora/db'
import type { Prisma } from '@velora/db'

/**
 * Feedback Pipeline — Aggregates raw feedback events into actionable signals.
 * Groups by crash type x severity x archetype, computes rates, upserts FeedbackAggregate.
 */

interface AggregationGroup {
  crashType: string | null
  severity: string | null
  archetypeId: string | null
}

interface AggregationResult extends AggregationGroup {
  narrativeApprovalRate: number
  equalizerUsefulRate: number
  avgTimeOnPage: number
  scrollThroughRate: number
  attorneyClickRate: number
  sampleSize: number
}

/**
 * Aggregate feedback for a given date.
 * Groups by crash type x severity x archetype and computes rates.
 */
export async function aggregateFeedback(date: Date): Promise<AggregationResult[]> {
  const dayStart = new Date(date)
  dayStart.setHours(0, 0, 0, 0)
  const dayEnd = new Date(date)
  dayEnd.setHours(23, 59, 59, 999)

  const period = dayStart.toISOString().split('T')[0]!

  // Get all feedback events for the day with their crash data
  const events = await prisma.feedbackEvent.findMany({
    where: {
      createdAt: { gte: dayStart, lte: dayEnd },
    },
    include: {
      crash: {
        select: {
          crashSeverity: true,
          mannerOfCollision: true,
          archetypeId: true,
        },
      },
    },
  })

  if (events.length === 0) return []

  // Group events by crash type x severity x archetype
  const groups = new Map<string, {
    key: AggregationGroup
    narrativeUp: number
    narrativeTotal: number
    equalizerYes: number
    equalizerTotal: number
    timeOnPageSum: number
    timeOnPageCount: number
    scrollCompleted: number
    scrollTotal: number
    attorneyClicks: number
    totalPageViews: number
  }>()

  for (const event of events) {
    const crashType = event.crash?.mannerOfCollision || null
    const severity = event.crash?.crashSeverity || null
    const archetypeId = event.crash?.archetypeId || null
    const groupKey = `${crashType}|${severity}|${archetypeId}`

    if (!groups.has(groupKey)) {
      groups.set(groupKey, {
        key: { crashType, severity, archetypeId },
        narrativeUp: 0,
        narrativeTotal: 0,
        equalizerYes: 0,
        equalizerTotal: 0,
        timeOnPageSum: 0,
        timeOnPageCount: 0,
        scrollCompleted: 0,
        scrollTotal: 0,
        attorneyClicks: 0,
        totalPageViews: 0,
      })
    }

    const group = groups.get(groupKey)!
    const value = event.value as Record<string, unknown>

    switch (event.type) {
      case 'NARRATIVE_THUMBS':
        group.narrativeTotal++
        if (value.thumbs === 'up') group.narrativeUp++
        break
      case 'EQUALIZER_USEFUL':
        group.equalizerTotal++
        if (value.useful === true) group.equalizerYes++
        break
      case 'TIME_ON_PAGE':
        group.timeOnPageCount++
        group.timeOnPageSum += (value.seconds as number) || 0
        group.totalPageViews++
        break
      case 'SCROLL_DEPTH':
        group.scrollTotal++
        if ((value.maxDepth as number) >= 80) group.scrollCompleted++
        break
      case 'ATTORNEY_CTR':
        group.attorneyClicks++
        break
    }
  }

  // Compute rates and upsert aggregates
  const results: AggregationResult[] = []

  for (const [, group] of groups) {
    const narrativeApprovalRate =
      group.narrativeTotal > 0 ? group.narrativeUp / group.narrativeTotal : 0
    const equalizerUsefulRate =
      group.equalizerTotal > 0 ? group.equalizerYes / group.equalizerTotal : 0
    const avgTimeOnPage =
      group.timeOnPageCount > 0 ? group.timeOnPageSum / group.timeOnPageCount : 0
    const scrollThroughRate =
      group.scrollTotal > 0 ? group.scrollCompleted / group.scrollTotal : 0
    const attorneyClickRate =
      group.totalPageViews > 0 ? group.attorneyClicks / group.totalPageViews : 0

    const sampleSize =
      group.narrativeTotal +
      group.equalizerTotal +
      group.timeOnPageCount +
      group.scrollTotal +
      group.attorneyClicks

    if (sampleSize === 0) continue

    const result: AggregationResult = {
      ...group.key,
      narrativeApprovalRate: Math.round(narrativeApprovalRate * 1000) / 1000,
      equalizerUsefulRate: Math.round(equalizerUsefulRate * 1000) / 1000,
      avgTimeOnPage: Math.round(avgTimeOnPage * 10) / 10,
      scrollThroughRate: Math.round(scrollThroughRate * 1000) / 1000,
      attorneyClickRate: Math.round(attorneyClickRate * 1000) / 1000,
      sampleSize,
    }

    // Upsert into FeedbackAggregate
    await prisma.feedbackAggregate.upsert({
      where: {
        period_crashType_severity: {
          period: period,
          crashType: group.key.crashType ?? '',
          severity: group.key.severity ?? '',
        },
      },
      create: {
        period: period,
        crashType: group.key.crashType,
        severity: group.key.severity,
        archetypeId: group.key.archetypeId,
        narrativeApprovalRate: result.narrativeApprovalRate,
        equalizerUsefulRate: result.equalizerUsefulRate,
        avgTimeOnPage: result.avgTimeOnPage,
        scrollThroughRate: result.scrollThroughRate,
        attorneyClickRate: result.attorneyClickRate,
        sampleSize: result.sampleSize,
      },
      update: {
        archetypeId: group.key.archetypeId,
        narrativeApprovalRate: result.narrativeApprovalRate,
        equalizerUsefulRate: result.equalizerUsefulRate,
        avgTimeOnPage: result.avgTimeOnPage,
        scrollThroughRate: result.scrollThroughRate,
        attorneyClickRate: result.attorneyClickRate,
        sampleSize: result.sampleSize,
      },
    })

    results.push(result)
  }

  return results
}

/**
 * Get the composite quality score for a given archetype.
 * Weighted: 40% narrative approval, 30% equalizer useful, 15% scroll-through, 15% attorney CTR.
 */
export async function getArchetypeQualityScore(archetypeId: string): Promise<{
  score: number
  sampleSize: number
  details: {
    narrativeApprovalRate: number
    equalizerUsefulRate: number
    scrollThroughRate: number
    attorneyClickRate: number
  }
} | null> {
  const aggregates = await prisma.feedbackAggregate.findMany({
    where: { archetypeId },
    orderBy: { period: 'desc' },
    take: 30, // Last 30 days
  })

  if (aggregates.length === 0) return null

  // Weighted average across recent periods
  let totalWeight = 0
  let weightedNarrative = 0
  let weightedEqualizer = 0
  let weightedScroll = 0
  let weightedAttorney = 0
  let totalSamples = 0

  for (const agg of aggregates) {
    const weight = agg.sampleSize
    totalWeight += weight
    weightedNarrative += agg.narrativeApprovalRate * weight
    weightedEqualizer += agg.equalizerUsefulRate * weight
    weightedScroll += agg.scrollThroughRate * weight
    weightedAttorney += agg.attorneyClickRate * weight
    totalSamples += agg.sampleSize
  }

  if (totalWeight === 0) return null

  const narrativeRate = weightedNarrative / totalWeight
  const equalizerRate = weightedEqualizer / totalWeight
  const scrollRate = weightedScroll / totalWeight
  const attorneyRate = weightedAttorney / totalWeight

  // Composite score: weighted blend
  const score = narrativeRate * 0.4 + equalizerRate * 0.3 + scrollRate * 0.15 + attorneyRate * 0.15

  return {
    score: Math.round(score * 1000) / 1000,
    sampleSize: totalSamples,
    details: {
      narrativeApprovalRate: Math.round(narrativeRate * 1000) / 1000,
      equalizerUsefulRate: Math.round(equalizerRate * 1000) / 1000,
      scrollThroughRate: Math.round(scrollRate * 1000) / 1000,
      attorneyClickRate: Math.round(attorneyRate * 1000) / 1000,
    },
  }
}

/**
 * Daily scheduled aggregation job.
 * Runs aggregation for yesterday's feedback data.
 */
export function startDailyAggregation(): void {
  const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000

  // Calculate time until next midnight
  const now = new Date()
  const nextMidnight = new Date(now)
  nextMidnight.setDate(nextMidnight.getDate() + 1)
  nextMidnight.setHours(0, 30, 0, 0) // Run at 00:30 to ensure all events are captured
  const msUntilMidnight = nextMidnight.getTime() - now.getTime()

  // Schedule first run, then repeat every 24 hours
  setTimeout(() => {
    runDailyAggregation()
    setInterval(runDailyAggregation, TWENTY_FOUR_HOURS)
  }, msUntilMidnight)

  console.log(`[Feedback Pipeline] Daily aggregation scheduled. First run in ${Math.round(msUntilMidnight / 1000 / 60)} minutes.`)
}

async function runDailyAggregation(): Promise<void> {
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)

  try {
    const results = await aggregateFeedback(yesterday)
    console.log(
      `[Feedback Pipeline] Aggregated ${results.length} groups for ${yesterday.toISOString().split('T')[0]}`,
    )
  } catch (error) {
    console.error('[Feedback Pipeline] Daily aggregation failed:', error)
  }
}

import { Router, type Request, type Response } from 'express'
import { prisma } from '@velora/db'

const router = Router()

// GET /api/admin/learning/quality-trends — Narrative quality over time
router.get('/quality-trends', async (_req: Request, res: Response) => {
  const aggregates = await prisma.feedbackAggregate.findMany({
    orderBy: { period: 'desc' },
    take: 90, // Last 90 days
    select: {
      period: true,
      narrativeApprovalRate: true,
      equalizerUsefulRate: true,
      avgTimeOnPage: true,
      scrollThroughRate: true,
      attorneyClickRate: true,
      sampleSize: true,
    },
  })

  // Group by period for overall daily trends
  const dailyMap = new Map<string, {
    period: string
    narrativeApprovalRate: number
    equalizerUsefulRate: number
    avgTimeOnPage: number
    scrollThroughRate: number
    attorneyClickRate: number
    totalSamples: number
    groupCount: number
  }>()

  for (const agg of aggregates) {
    const existing = dailyMap.get(agg.period)
    if (existing) {
      existing.narrativeApprovalRate += agg.narrativeApprovalRate * agg.sampleSize
      existing.equalizerUsefulRate += agg.equalizerUsefulRate * agg.sampleSize
      existing.avgTimeOnPage += agg.avgTimeOnPage * agg.sampleSize
      existing.scrollThroughRate += agg.scrollThroughRate * agg.sampleSize
      existing.attorneyClickRate += agg.attorneyClickRate * agg.sampleSize
      existing.totalSamples += agg.sampleSize
      existing.groupCount++
    } else {
      dailyMap.set(agg.period, {
        period: agg.period,
        narrativeApprovalRate: agg.narrativeApprovalRate * agg.sampleSize,
        equalizerUsefulRate: agg.equalizerUsefulRate * agg.sampleSize,
        avgTimeOnPage: agg.avgTimeOnPage * agg.sampleSize,
        scrollThroughRate: agg.scrollThroughRate * agg.sampleSize,
        attorneyClickRate: agg.attorneyClickRate * agg.sampleSize,
        totalSamples: agg.sampleSize,
        groupCount: 1,
      })
    }
  }

  const trends = Array.from(dailyMap.values())
    .map((d) => ({
      period: d.period,
      narrativeApprovalRate: d.totalSamples > 0 ? Math.round((d.narrativeApprovalRate / d.totalSamples) * 1000) / 1000 : 0,
      equalizerUsefulRate: d.totalSamples > 0 ? Math.round((d.equalizerUsefulRate / d.totalSamples) * 1000) / 1000 : 0,
      avgTimeOnPage: d.totalSamples > 0 ? Math.round((d.avgTimeOnPage / d.totalSamples) * 10) / 10 : 0,
      scrollThroughRate: d.totalSamples > 0 ? Math.round((d.scrollThroughRate / d.totalSamples) * 1000) / 1000 : 0,
      attorneyClickRate: d.totalSamples > 0 ? Math.round((d.attorneyClickRate / d.totalSamples) * 1000) / 1000 : 0,
      sampleSize: d.totalSamples,
    }))
    .sort((a, b) => a.period.localeCompare(b.period))

  res.json({ trends })
})

// GET /api/admin/learning/prompt-lineage — Prompt version history
router.get('/prompt-lineage', async (req: Request, res: Response) => {
  const signature = (req.query.signature as string) || 'narrative'

  const versions = await prisma.promptVersion.findMany({
    where: { signature },
    orderBy: { version: 'desc' },
    take: 50,
    select: {
      id: true,
      signature: true,
      version: true,
      parentId: true,
      archetypeId: true,
      mutations: true,
      scores: true,
      compositeScore: true,
      isActive: true,
      createdAt: true,
    },
  })

  res.json({ signature, versions })
})

// GET /api/admin/learning/experiments — Active and recent experiments
router.get('/experiments', async (_req: Request, res: Response) => {
  const experiments = await prisma.experiment.findMany({
    orderBy: { startedAt: 'desc' },
    take: 20,
  })

  // Get feedback counts per experiment variant
  const experimentsWithMetrics = await Promise.all(
    experiments.map(async (exp) => {
      const variants = exp.variants as unknown as Array<{ id: string; name: string; weight: number }>
      const variantMetrics = await Promise.all(
        variants.map(async (v) => {
          const feedbackCount = await prisma.feedbackEvent.count({
            where: { experimentId: exp.id, variant: v.id },
          })

          const thumbsUp = await prisma.feedbackEvent.count({
            where: {
              experimentId: exp.id,
              variant: v.id,
              type: 'NARRATIVE_THUMBS',
              value: { path: ['thumbs'], equals: 'up' },
            },
          })
          const thumbsTotal = await prisma.feedbackEvent.count({
            where: {
              experimentId: exp.id,
              variant: v.id,
              type: 'NARRATIVE_THUMBS',
            },
          })

          return {
            ...v,
            feedbackCount,
            approvalRate: thumbsTotal > 0 ? Math.round((thumbsUp / thumbsTotal) * 1000) / 1000 : null,
          }
        }),
      )

      return {
        id: exp.id,
        name: exp.name,
        signature: exp.signature,
        status: exp.status,
        winnerId: exp.winnerId,
        startedAt: exp.startedAt,
        completedAt: exp.completedAt,
        variants: variantMetrics,
      }
    }),
  )

  res.json({ experiments: experimentsWithMetrics })
})

// GET /api/admin/learning/cost-breakdown — AI cost tracking
router.get('/cost-breakdown', async (_req: Request, res: Response) => {
  // Aggregate narrative generation counts by model tier
  const narratives = await prisma.crashNarrative.findMany({
    select: {
      modelTier: true,
      generatedAt: true,
    },
    orderBy: { generatedAt: 'desc' },
    take: 1000,
  })

  const costPerTier: Record<string, number> = {
    premium: 0.015, // ~$0.015 per narrative (Opus)
    standard: 0.003, // ~$0.003 per narrative (Sonnet)
    budget: 0.0003, // ~$0.0003 per narrative (Haiku)
  }

  const tierCounts: Record<string, number> = {}
  const dailyCosts = new Map<string, number>()

  for (const n of narratives) {
    const tier = n.modelTier || 'standard'
    tierCounts[tier] = (tierCounts[tier] || 0) + 1

    const day = n.generatedAt.toISOString().split('T')[0]!
    const cost = costPerTier[tier] || 0.003
    dailyCosts.set(day, (dailyCosts.get(day) || 0) + cost)
  }

  const totalCost = Object.entries(tierCounts).reduce(
    (sum, [tier, count]) => sum + count * (costPerTier[tier] || 0.003),
    0,
  )

  res.json({
    totalNarratives: narratives.length,
    totalCost: Math.round(totalCost * 100) / 100,
    tierBreakdown: tierCounts,
    costPerTier,
    dailyCosts: Array.from(dailyCosts.entries())
      .map(([day, cost]) => ({ day, cost: Math.round(cost * 100) / 100 }))
      .sort((a, b) => a.day.localeCompare(b.day)),
  })
})

export default router

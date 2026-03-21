/**
 * AI Enrichment Pipeline — runs all AI-powered enrichment within a budget.
 *
 * 1. AI Review Intelligence: Analyze top attorneys' reviews with LLM
 * 2. Crash Narratives: Generate narratives for fatal/serious crashes
 * 3. GEPA Optimization: Run prompt evolution cycles
 *
 * Usage: DATABASE_URL=... OPENROUTER_API_KEY=... npx tsx apps/pipeline/src/scripts/ai-enrichment.ts [--budget 100] [--dry-run]
 */

import { prisma } from '@velora/db'
import { generateText } from 'ai'
import { getModel } from '@velora/ai'

// ============================================================
// Budget Tracker
// ============================================================
const BUDGET_MAX = parseFloat(process.argv.find(a => a.startsWith('--budget='))?.split('=')[1] || '100')
const DRY_RUN = process.argv.includes('--dry-run')
let totalSpent = 0

function trackCost(amount: number, label: string) {
  totalSpent += amount
  console.log(`  💰 $${amount.toFixed(4)} (${label}) | Total: $${totalSpent.toFixed(2)} / $${BUDGET_MAX}`)
}

function budgetRemaining(): number {
  return BUDGET_MAX - totalSpent
}

// ============================================================
// Phase 1: AI Review Intelligence
// ============================================================

const BATCH_DIMENSION_PROMPT = `You are a legal review analyst. Score each attorney review on 4 dimensions using a 0-100 scale.

CRITICAL SCORING GUIDELINES:
- 90-100: Exceptional — reviewer explicitly describes outstanding experience with specific examples
- 70-89: Good — reviewer indicates positive experience but without remarkable detail
- 50-69: Average — reviewer mentions dimension but with mixed or lukewarm sentiment
- 30-49: Below average — reviewer expresses dissatisfaction or concern
- 0-29: Poor — reviewer describes clearly negative experience
- 50: Default if dimension is NOT mentioned at all in the review
- A generic 5-star review like "Great lawyer!" with no specifics should score 65-70, NOT 90+
- Only score 90+ when the reviewer provides specific, concrete evidence of excellence

Also identify the PRIMARY dimension each review is most relevant to.

Return a JSON array with one object per review, in order:
[{ "communication": 72, "outcome": 50, "responsiveness": 68, "feeTransparency": 50, "primaryDimension": "communication" }, ...]

Dimensions:
- communication: How clearly the attorney explained legal options, case status, and decisions. Look for: "explained everything", "kept me informed", "hard to reach", "never called back"
- outcome: Satisfaction with case results. Look for: settlement amounts, "won my case", "dismissed", "got me X dollars", "lost"
- responsiveness: Speed and consistency of attorney responses. Look for: "same day", "quick response", "took weeks to reply", "always available"
- feeTransparency: Clarity about fees, billing, and costs. Look for: "no hidden fees", "contingency", "surprised by bill", "upfront about costs"

Reviews:
`

interface DimensionScores {
  communication: number
  outcome: number
  responsiveness: number
  feeTransparency: number
  // Legacy dimensions kept for DB compat but derived from core 4
  empathy: number
  expertise: number
  trialExperience: number
  satisfaction: number
}

function clamp(v: unknown): number {
  const n = typeof v === 'number' ? v : 50
  return Math.max(0, Math.min(100, Math.round(n)))
}

function heuristicScores(rating: number): DimensionScores {
  // Map 1-5 star to a reasonable range: 1★=15, 2★=30, 3★=50, 4★=65, 5★=75
  // Note: 5-star heuristic is 75, NOT 100 — only AI-analyzed reviews with
  // specific evidence should score 80+
  const base = Math.round(rating <= 3 ? rating * 50 / 3 : 50 + (rating - 3) * 12.5)
  return { communication: base, outcome: base, responsiveness: base, feeTransparency: base, empathy: base, expertise: base, trialExperience: base, satisfaction: base }
}

/**
 * Batch-extract dimensions for multiple reviews in a single API call.
 * Sends up to 10 reviews per call to minimize API round-trips.
 */
async function extractDimensionsBatch(
  reviews: Array<{ text: string | null; rating: number }>
): Promise<{ allScores: DimensionScores[]; aiCalls: number }> {
  const allScores: DimensionScores[] = []
  let aiCalls = 0

  // Split reviews: those with text (AI) vs without (heuristic)
  const withText: Array<{ idx: number; text: string; rating: number }> = []
  for (let i = 0; i < reviews.length; i++) {
    const r = reviews[i]
    if (r.text && r.text.trim().length >= 15) {
      withText.push({ idx: i, text: r.text.slice(0, 500), rating: r.rating })
    } else {
      // Will be filled by heuristic
    }
  }

  // Initialize all with heuristic
  for (const r of reviews) {
    allScores.push(heuristicScores(r.rating))
  }

  if (withText.length === 0) return { allScores, aiCalls: 0 }

  // Batch AI calls in groups of 10
  const BATCH = 10
  for (let i = 0; i < withText.length; i += BATCH) {
    const batch = withText.slice(i, i + BATCH)
    const prompt = BATCH_DIMENSION_PROMPT + batch.map((r, j) => `[${j + 1}] (${r.rating}★): "${r.text}"`).join('\n')

    try {
      const model = getModel('budget')
      const { text: response } = await generateText({
        model,
        prompt,
        maxTokens: 120 * batch.length, // ~120 tokens per review (4 dims + primaryDimension)
        temperature: 0.1,
      })
      aiCalls++

      // Parse array response
      const jsonMatch = response.match(/\[[\s\S]*\]/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as Array<Record<string, number | string>>
        for (let j = 0; j < Math.min(parsed.length, batch.length); j++) {
          const p = parsed[j]
          const comm = clamp(p.communication)
          const out = clamp(p.outcome)
          const resp = clamp(p.responsiveness)
          const fee = clamp(p.feeTransparency)
          // Derive legacy dimensions from core 4
          const avg = Math.round((comm + out + resp + fee) / 4)
          allScores[batch[j].idx] = {
            communication: comm,
            outcome: out,
            responsiveness: resp,
            feeTransparency: fee,
            empathy: Math.round((comm + resp) / 2), // empathy ≈ communication + responsiveness
            expertise: Math.round((out + fee) / 2),  // expertise ≈ outcome + fee transparency
            trialExperience: out,                     // trial experience ≈ outcome
            satisfaction: avg,                         // satisfaction = average of all
          }
          // Track primary dimension for bestQuotes
          if (typeof p.primaryDimension === 'string') {
            ;(allScores[batch[j].idx] as Record<string, unknown>)._primaryDimension = p.primaryDimension
          }
        }
      }
    } catch {
      // Heuristic fallback already set
      aiCalls++
    }
  }

  return { allScores, aiCalls }
}

const WEIGHTS = {
  communication: 0.25,
  responsiveness: 0.20,
  outcome: 0.30,
  reviewCount: 0.15,
  specialty: 0.10,
} as const

const CRASH_PRACTICE_AREAS = ['personal_injury', 'car_accident', 'truck_accident', 'motorcycle_accident', 'pedestrian_accident']

function computeSpecialtyScore(practiceAreas: string[]): number {
  const normalized = practiceAreas.map(a => a.toLowerCase().replace(/[\s-]+/g, '_'))
  let matches = 0
  for (const area of CRASH_PRACTICE_AREAS) {
    if (normalized.includes(area)) matches++
  }
  return Math.min(100, matches * 25)
}

async function runReviewIntelligence() {
  console.log('\n' + '='.repeat(60))
  console.log('PHASE 1: AI Review Intelligence')
  console.log('='.repeat(60))

  // Target: attorneys with 5+ reviews that have text, sorted by review count (most reviewed first)
  const attorneys = await prisma.attorney.findMany({
    where: {
      reviews: { some: { text: { not: null } } },
    },
    select: {
      id: true,
      practiceAreas: true,
      googleRating: true,
      googleReviewCount: true,
      reviews: {
        where: { text: { not: null } },
        select: { id: true, text: true, rating: true, publishedAt: true, authorName: true },
        orderBy: { publishedAt: 'desc' },
        take: 30, // Analyze up to 30 most recent reviews (not top-rated, to avoid positive bias)
      },
      _count: { select: { reviews: true } },
    },
    orderBy: { googleReviewCount: 'desc' },
    take: 3000, // Top 3000 most-reviewed attorneys
  })

  // Filter to those with 5+ text reviews
  const eligible = attorneys.filter(a => a.reviews.length >= 5)
  console.log(`Found ${eligible.length} attorneys with 5+ text reviews (from top 3000)`)

  const COST_PER_BATCH_CALL = 0.002 // Haiku batch call (~10 reviews per call)
  const totalReviews = eligible.reduce((sum, a) => sum + a.reviews.length, 0)
  const estimatedCalls = eligible.reduce((sum, a) => sum + Math.ceil(a.reviews.filter(r => r.text && r.text.length >= 15).length / 10), 0)
  const estimatedCost = estimatedCalls * COST_PER_BATCH_CALL
  console.log(`Total reviews: ${totalReviews} | Est. API calls: ${estimatedCalls} | Est. cost: $${estimatedCost.toFixed(2)}`)

  if (estimatedCost > budgetRemaining()) {
    const canAfford = Math.floor(budgetRemaining() / COST_PER_REVIEW)
    console.log(`⚠ Budget constraint: can only afford ${canAfford} reviews. Limiting scope.`)
  }

  if (DRY_RUN) {
    console.log('[DRY RUN] Would analyze reviews for', eligible.length, 'attorneys')
    return { analyzed: 0, cost: 0 }
  }

  let analyzed = 0
  let aiCalls = 0
  let errors = 0

  for (const attorney of eligible) {
    if (budgetRemaining() < 0.01) {
      console.log('⚠ Budget exhausted, stopping review intelligence')
      break
    }

    try {
      // Batch-extract dimensions from all reviews in 1-2 API calls
      const { allScores, aiCalls: reviewAICalls } = await extractDimensionsBatch(
        attorney.reviews.map(r => ({ text: r.text, rating: r.rating }))
      )
      aiCalls += reviewAICalls

      // Aggregate dimensions
      const dims: DimensionScores = {
        communication: 0, outcome: 0, responsiveness: 0, empathy: 0,
        expertise: 0, feeTransparency: 0, trialExperience: 0, satisfaction: 0,
      }
      for (const s of allScores) {
        dims.communication += s.communication
        dims.outcome += s.outcome
        dims.responsiveness += s.responsiveness
        dims.empathy += s.empathy
        dims.expertise += s.expertise
        dims.feeTransparency += s.feeTransparency
        dims.trialExperience += s.trialExperience
        dims.satisfaction += s.satisfaction
      }
      const count = allScores.length
      dims.communication = Math.round(dims.communication / count)
      dims.outcome = Math.round(dims.outcome / count)
      dims.responsiveness = Math.round(dims.responsiveness / count)
      dims.empathy = Math.round(dims.empathy / count)
      dims.expertise = Math.round(dims.expertise / count)
      dims.feeTransparency = Math.round(dims.feeTransparency / count)
      dims.trialExperience = Math.round(dims.trialExperience / count)
      dims.satisfaction = Math.round(dims.satisfaction / count)

      // Detect trend
      const sorted = attorney.reviews
        .filter(r => r.publishedAt)
        .sort((a, b) => a.publishedAt!.getTime() - b.publishedAt!.getTime())
      let trend: 'IMPROVING' | 'STABLE' | 'DECLINING' = 'STABLE'
      if (sorted.length >= 4) {
        const mid = Math.floor(sorted.length / 2)
        const olderAvg = sorted.slice(0, mid).reduce((s, r) => s + r.rating, 0) / mid
        const newerAvg = sorted.slice(mid).reduce((s, r) => s + r.rating, 0) / (sorted.length - mid)
        const diff = newerAvg - olderAvg
        if (diff > 0.3) trend = 'IMPROVING'
        else if (diff < -0.3) trend = 'DECLINING'
      }

      // Best quotes — pick diverse dimensions, not just top-rated
      const quoteCandidates = attorney.reviews
        .filter(r => r.text && r.text.length > 50)
        .map((r, idx) => ({
          text: r.text!.length > 200 ? r.text!.slice(0, 200) + '...' : r.text!,
          dimension: ((allScores[idx] as Record<string, unknown>)?._primaryDimension as string) || 'communication',
          sentiment: (r.rating >= 4 ? 'positive' : r.rating <= 2 ? 'negative' : 'neutral') as 'positive' | 'negative' | 'neutral',
          rating: r.rating,
        }))
      // Pick top positive, top negative (if exists), and one with unique dimension
      const bestQuotes: typeof quoteCandidates = []
      const positive = quoteCandidates.find(q => q.sentiment === 'positive')
      if (positive) bestQuotes.push(positive)
      const negative = quoteCandidates.find(q => q.sentiment === 'negative')
      if (negative) bestQuotes.push(negative)
      const usedDims = new Set(bestQuotes.map(q => q.dimension))
      const diverse = quoteCandidates.find(q => !usedDims.has(q.dimension))
      if (diverse) bestQuotes.push(diverse)

      // Compute Attorney Index score
      const reviewCount = attorney._count.reviews
      const reviewCountScore = Math.min(100, reviewCount * 3)
      const specialtyScore = computeSpecialtyScore(attorney.practiceAreas)
      const compositeScore = Math.round(
        dims.communication * WEIGHTS.communication +
        dims.responsiveness * WEIGHTS.responsiveness +
        dims.outcome * WEIGHTS.outcome +
        reviewCountScore * WEIGHTS.reviewCount +
        specialtyScore * WEIGHTS.specialty
      )
      const score = Math.max(0, Math.min(100, compositeScore))
      const dataQuality = reviewCount >= 30 ? 'HIGH' : reviewCount >= 10 ? 'MEDIUM' : 'LOW'

      // Upsert ReviewIntelligence + AttorneyIndex
      await prisma.$transaction([
        prisma.reviewIntelligence.upsert({
          where: { attorneyId: attorney.id },
          create: {
            attorneyId: attorney.id,
            ...dims,
            trend,
            trendPeriodMonths: 12,
            bestQuotes: bestQuotes.length > 0 ? bestQuotes : [],
            reviewCount,
          },
          update: {
            ...dims,
            trend,
            bestQuotes: bestQuotes.length > 0 ? bestQuotes : [],
            reviewCount,
            analyzedAt: new Date(),
          },
        }),
        prisma.attorneyIndex.upsert({
          where: { attorneyId: attorney.id },
          create: {
            attorneyId: attorney.id,
            score,
            communicationScore: dims.communication,
            responsivenessScore: dims.responsiveness,
            outcomeScore: dims.outcome,
            reviewCountScore,
            specialtyScore,
            reviewCount,
            dataQuality,
          },
          update: {
            score,
            communicationScore: dims.communication,
            responsivenessScore: dims.responsiveness,
            outcomeScore: dims.outcome,
            reviewCountScore,
            specialtyScore,
            reviewCount,
            dataQuality,
            computedAt: new Date(),
          },
        }),
      ])

      analyzed++
      const cost = reviewAICalls * COST_PER_BATCH_CALL
      trackCost(cost, `attorney ${analyzed}/${eligible.length} (${reviewAICalls} batch calls)`)

      if (analyzed % 50 === 0) {
        console.log(`\n📊 Progress: ${analyzed}/${eligible.length} attorneys | AI calls: ${aiCalls} | Errors: ${errors}`)
      }
    } catch (err) {
      errors++
      if (errors % 10 === 0) {
        console.warn(`⚠ ${errors} errors so far. Latest:`, err instanceof Error ? err.message : err)
      }
    }
  }

  console.log(`\n✅ Review Intelligence: ${analyzed} attorneys analyzed | ${aiCalls} AI calls | ${errors} errors`)
  return { analyzed, cost: totalSpent }
}

// ============================================================
// Phase 2: Crash Narrative Generation
// ============================================================

async function runNarrativeGeneration() {
  console.log('\n' + '='.repeat(60))
  console.log('PHASE 2: Crash Narrative Generation')
  console.log('='.repeat(60))

  // Count crashes without narratives by severity
  const severities = ['FATAL', 'SUSPECTED_SERIOUS_INJURY', 'SUSPECTED_MINOR_INJURY', 'POSSIBLE_INJURY', 'PROPERTY_DAMAGE_ONLY'] as const

  for (const sev of severities) {
    const count = await prisma.crash.count({
      where: { crashSeverity: sev, narratives: { none: {} } },
    })
    console.log(`  ${sev}: ${count} crashes without narratives`)
  }

  const COST_MAP: Record<string, number> = {
    FATAL: 0.15,
    SUSPECTED_SERIOUS_INJURY: 0.03,
    SUSPECTED_MINOR_INJURY: 0.005,
    POSSIBLE_INJURY: 0.005,
    PROPERTY_DAMAGE_ONLY: 0.005,
  }

  // Strategy: Generate for fatal first, then serious, then others
  // Dynamic import of the narrative generator (it's in the api app)
  const { generateNarrative } = await import('../../../api/src/services/narrative/generator')

  let totalGenerated = 0
  let totalFailed = 0

  // Fatal crashes — limit to fit budget (reserve $45 for serious + budget tier)
  const fatalLimit = Math.min(200, Math.floor((budgetRemaining() - 45) / 0.15))
  if (fatalLimit > 0) {
    console.log(`\n🔴 Generating narratives for up to ${fatalLimit} FATAL crashes...`)
    const fatalCrashes = await prisma.crash.findMany({
      where: { crashSeverity: 'FATAL', narratives: { none: {} } },
      select: { id: true },
      take: fatalLimit,
      orderBy: { crashDate: 'desc' },
    })

    if (DRY_RUN) {
      console.log(`[DRY RUN] Would generate ${fatalCrashes.length} fatal narratives (~$${(fatalCrashes.length * 0.15).toFixed(2)})`)
    } else {
      for (const crash of fatalCrashes) {
        if (budgetRemaining() < 0.15) break
        try {
          await generateNarrative(crash.id)
          totalGenerated++
          trackCost(0.15, `fatal narrative ${totalGenerated}`)
        } catch (err) {
          totalFailed++
          console.warn(`  Failed ${crash.id}:`, err instanceof Error ? err.message : String(err).slice(0, 80))
        }
      }
    }
  }

  // Serious injury crashes
  const seriousLimit = Math.min(1000, Math.floor(budgetRemaining() / 0.03))
  if (seriousLimit > 0) {
    console.log(`\n🟠 Generating narratives for up to ${seriousLimit} SERIOUS INJURY crashes...`)
    const seriousCrashes = await prisma.crash.findMany({
      where: { crashSeverity: 'SUSPECTED_SERIOUS_INJURY', narratives: { none: {} } },
      select: { id: true },
      take: seriousLimit,
      orderBy: { crashDate: 'desc' },
    })

    if (DRY_RUN) {
      console.log(`[DRY RUN] Would generate ${seriousCrashes.length} serious narratives (~$${(seriousCrashes.length * 0.03).toFixed(2)})`)
    } else {
      for (const crash of seriousCrashes) {
        if (budgetRemaining() < 0.03) break
        try {
          await generateNarrative(crash.id)
          totalGenerated++
          trackCost(0.03, `serious narrative ${totalGenerated}`)
          if (totalGenerated % 50 === 0) {
            console.log(`  📊 Generated: ${totalGenerated} | Failed: ${totalFailed} | Budget: $${budgetRemaining().toFixed(2)}`)
            await new Promise(r => setTimeout(r, 2000)) // Rate limit breathing room
          }
        } catch (err) {
          totalFailed++
        }
      }
    }
  }

  // Budget tier crashes (minor/possible/PDO)
  const budgetLimit = Math.min(5000, Math.floor(budgetRemaining() / 0.005))
  if (budgetLimit > 0) {
    console.log(`\n🟡 Generating narratives for up to ${budgetLimit} other crashes...`)
    const otherCrashes = await prisma.crash.findMany({
      where: {
        crashSeverity: { in: ['SUSPECTED_MINOR_INJURY', 'POSSIBLE_INJURY', 'PROPERTY_DAMAGE_ONLY'] },
        narratives: { none: {} },
      },
      select: { id: true },
      take: budgetLimit,
      orderBy: { crashDate: 'desc' },
    })

    if (DRY_RUN) {
      console.log(`[DRY RUN] Would generate ${otherCrashes.length} budget narratives (~$${(otherCrashes.length * 0.005).toFixed(2)})`)
    } else {
      for (const crash of otherCrashes) {
        if (budgetRemaining() < 0.005) break
        try {
          await generateNarrative(crash.id)
          totalGenerated++
          trackCost(0.005, `budget narrative ${totalGenerated}`)
          if (totalGenerated % 100 === 0) {
            console.log(`  📊 Generated: ${totalGenerated} | Failed: ${totalFailed} | Budget: $${budgetRemaining().toFixed(2)}`)
            await new Promise(r => setTimeout(r, 1000))
          }
        } catch (err) {
          totalFailed++
        }
      }
    }
  }

  console.log(`\n✅ Narratives: ${totalGenerated} generated | ${totalFailed} failed`)
  return { generated: totalGenerated, failed: totalFailed }
}

// ============================================================
// Phase 3: GEPA Optimization
// ============================================================

async function runGEPACycles() {
  console.log('\n' + '='.repeat(60))
  console.log('PHASE 3: GEPA Prompt Optimization')
  console.log('='.repeat(60))

  if (budgetRemaining() < 0.10) {
    console.log('⚠ Insufficient budget for GEPA cycles, skipping')
    return
  }

  try {
    const { runGEPACycle } = await import('../../../../packages/ai/src/optimization/gepa-optimizer')

    const signatures = ['narrative', 'equalizer', 'persona'] as const

    for (const sig of signatures) {
      if (budgetRemaining() < 0.03) break
      console.log(`\n🧬 Running GEPA cycle for "${sig}"...`)

      if (DRY_RUN) {
        console.log(`[DRY RUN] Would run GEPA cycle for ${sig} (~$0.025)`)
        continue
      }

      try {
        const result = await runGEPACycle({
          signature: sig,
          variants: 5,
          samples: 10,
          dryRun: false,
        })
        trackCost(0.025, `GEPA ${sig}`)
        console.log(`  ✅ ${sig}: ${result.variants.length} variants evaluated, winner score: ${result.winner?.score.toFixed(2) || 'N/A'}`)
      } catch (err) {
        console.warn(`  ⚠ GEPA ${sig} failed:`, err instanceof Error ? err.message : err)
      }
    }
  } catch (err) {
    console.warn('⚠ GEPA optimizer not available:', err instanceof Error ? err.message : err)
  }
}

// ============================================================
// Main
// ============================================================

async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗')
  console.log('║         Velora AI Enrichment Pipeline                    ║')
  console.log('╚══════════════════════════════════════════════════════════╝')
  console.log(`Budget: $${BUDGET_MAX} | Dry Run: ${DRY_RUN}`)
  console.log(`Started: ${new Date().toISOString()}\n`)

  // Phase 1: Review Intelligence (highest priority per user)
  const reviewResult = await runReviewIntelligence()

  // Phase 2: Crash Narratives
  const narrativeResult = await runNarrativeGeneration()

  // Phase 3: GEPA Optimization (cheap, run if budget remains)
  await runGEPACycles()

  // Final report
  console.log('\n' + '='.repeat(60))
  console.log('FINAL REPORT')
  console.log('='.repeat(60))
  console.log(`Total spent: $${totalSpent.toFixed(2)} / $${BUDGET_MAX}`)
  console.log(`Budget remaining: $${budgetRemaining().toFixed(2)}`)
  console.log(`Review Intelligence: ${reviewResult.analyzed} attorneys enriched`)
  console.log(`Narratives: ${narrativeResult.generated} generated, ${narrativeResult.failed} failed`)
  console.log(`Completed: ${new Date().toISOString()}`)

  await prisma.$disconnect()
}

main().catch((err) => {
  console.error('[AI Enrichment] Fatal error:', err)
  process.exit(1)
})

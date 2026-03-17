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

const DIMENSION_PROMPT = `Analyze this attorney review and score each dimension 0-100.
Return JSON only: { "communication": 85, "outcome": 70, "responsiveness": 80, "empathy": 75, "expertise": 90, "feeTransparency": 60, "trialExperience": 50, "satisfaction": 85 }

Dimension definitions:
- communication: clarity, frequency, accessibility of attorney communication
- outcome: satisfaction with case results
- responsiveness: response time, availability
- empathy: emotional support, understanding shown
- expertise: legal knowledge, strategy quality
- feeTransparency: clarity of fees, value perception
- trialExperience: courtroom capability
- satisfaction: overall client satisfaction

If a dimension is not mentioned, score it 50 (neutral).

Review text: `

interface DimensionScores {
  communication: number
  outcome: number
  responsiveness: number
  empathy: number
  expertise: number
  feeTransparency: number
  trialExperience: number
  satisfaction: number
}

function clamp(v: unknown): number {
  const n = typeof v === 'number' ? v : 50
  return Math.max(0, Math.min(100, Math.round(n)))
}

async function extractDimensions(text: string, rating: number): Promise<{ scores: DimensionScores; usedAI: boolean }> {
  if (!text || text.trim().length < 15) {
    const base = rating * 20
    return {
      scores: { communication: base, outcome: base, responsiveness: base, empathy: base, expertise: base, feeTransparency: base, trialExperience: base, satisfaction: base },
      usedAI: false,
    }
  }

  try {
    const model = getModel('budget')
    const { text: response } = await generateText({
      model,
      prompt: DIMENSION_PROMPT + JSON.stringify(text.slice(0, 500)),
      maxTokens: 200,
      temperature: 0.1,
    })

    const jsonMatch = response.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON')

    const parsed = JSON.parse(jsonMatch[0]) as Record<string, number>
    return {
      scores: {
        communication: clamp(parsed.communication),
        outcome: clamp(parsed.outcome),
        responsiveness: clamp(parsed.responsiveness),
        empathy: clamp(parsed.empathy),
        expertise: clamp(parsed.expertise),
        feeTransparency: clamp(parsed.feeTransparency),
        trialExperience: clamp(parsed.trialExperience),
        satisfaction: clamp(parsed.satisfaction),
      },
      usedAI: true,
    }
  } catch {
    const base = rating * 20
    return {
      scores: { communication: base, outcome: base, responsiveness: base, empathy: base, expertise: base, feeTransparency: base, trialExperience: base, satisfaction: base },
      usedAI: false,
    }
  }
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
        orderBy: { rating: 'desc' },
        take: 20, // Analyze up to 20 reviews per attorney
      },
      _count: { select: { reviews: true } },
    },
    orderBy: { googleReviewCount: 'desc' },
    take: 3000, // Top 3000 most-reviewed attorneys
  })

  // Filter to those with 5+ text reviews
  const eligible = attorneys.filter(a => a.reviews.length >= 5)
  console.log(`Found ${eligible.length} attorneys with 5+ text reviews (from top 3000)`)

  const COST_PER_REVIEW = 0.0003 // Haiku extraction
  const totalReviews = eligible.reduce((sum, a) => sum + a.reviews.length, 0)
  const estimatedCost = totalReviews * COST_PER_REVIEW
  console.log(`Total reviews to analyze: ${totalReviews} | Estimated cost: $${estimatedCost.toFixed(2)}`)

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
      // Extract dimensions from each review
      const allScores: DimensionScores[] = []
      let reviewAICalls = 0

      for (const review of attorney.reviews) {
        const { scores, usedAI } = await extractDimensions(review.text!, review.rating)
        allScores.push(scores)
        if (usedAI) {
          reviewAICalls++
          aiCalls++
        }
      }

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

      // Best quotes
      const bestQuotes = attorney.reviews
        .filter(r => r.text && r.text.length > 30 && r.rating >= 4)
        .slice(0, 3)
        .map(r => ({
          text: r.text!.length > 200 ? r.text!.slice(0, 200) + '...' : r.text!,
          dimension: 'satisfaction',
          sentiment: 'positive' as const,
          rating: r.rating,
        }))

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
      const cost = reviewAICalls * COST_PER_REVIEW
      trackCost(cost, `attorney ${analyzed}/${eligible.length} (${reviewAICalls} AI calls)`)

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

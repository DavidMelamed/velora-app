/**
 * Ingest attorney reviews into Qdrant vector database.
 *
 * Generates embeddings using Qwen3-Embedding-8B via OpenRouter,
 * then stores them in Qdrant Cloud for semantic search.
 *
 * Usage:
 *   DATABASE_URL=... OPENROUTER_API_KEY=... QDRANT_URL=... QDRANT_API_KEY=...
 *   npx tsx apps/pipeline/src/scripts/ingest-reviews-vector.ts [--batch-size 50] [--limit 1000] [--dry-run]
 *
 * Cost: ~$0.01 per 1M input tokens (Qwen3-Embedding-8B)
 *       ~500 tokens per review → $0.005 per 1000 reviews → ~$0.25 for 50K reviews
 */
import { prisma } from '@velora/db'
import {
  generateEmbeddingsBatch,
  buildReviewEmbeddingText,
  initCollection,
  upsertReviews,
  getCollectionInfo,
  EMBEDDING_DIMS,
} from '@velora/ai'
import type { ReviewPoint } from '@velora/ai'

// CLI args
const BATCH_SIZE = parseInt(process.argv.find(a => a.startsWith('--batch-size='))?.split('=')[1] || '50', 10)
const LIMIT = parseInt(process.argv.find(a => a.startsWith('--limit='))?.split('=')[1] || '0', 10) || Infinity
const DRY_RUN = process.argv.includes('--dry-run')
const SKIP = parseInt(process.argv.find(a => a.startsWith('--skip='))?.split('=')[1] || '0', 10)

async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗')
  console.log('║  Review Vector Ingestion Pipeline                       ║')
  console.log('╚══════════════════════════════════════════════════════════╝')
  console.log(`Embedding model: qwen/qwen3-embedding-8b (${EMBEDDING_DIMS} dims)`)
  console.log(`Batch size: ${BATCH_SIZE} | Limit: ${LIMIT === Infinity ? 'ALL' : LIMIT} | Skip: ${SKIP} | Dry run: ${DRY_RUN}`)
  console.log()

  // Initialize Qdrant collection
  if (!DRY_RUN) {
    await initCollection()
    const info = await getCollectionInfo()
    console.log(`[Qdrant] Current vectors: ${info.vectorCount} | Status: ${info.status}`)
  }

  // Count total reviews with text
  const totalReviews = await prisma.lawyerReview.count({
    where: { text: { not: null } },
  })
  console.log(`\nTotal reviews with text: ${totalReviews}`)

  // Get already-ingested review IDs from Qdrant to skip duplicates
  // We'll track by processing in ID order
  const effectiveLimit = Math.min(LIMIT, totalReviews - SKIP)
  console.log(`Processing: ${effectiveLimit} reviews (skip ${SKIP})`)

  let processed = 0
  let embedded = 0
  let errors = 0
  let cursor: string | undefined = undefined
  const startTime = Date.now()

  // Paginate through reviews using cursor-based pagination
  while (processed < effectiveLimit) {
    const take = Math.min(BATCH_SIZE, effectiveLimit - processed)

    const reviews = await prisma.lawyerReview.findMany({
      where: { text: { not: null } },
      select: {
        id: true,
        text: true,
        rating: true,
        authorName: true,
        publishedAt: true,
        lawyer: {
          select: {
            id: true,
            name: true,
            city: true,
            stateCode: true,
            practiceAreas: true,
          },
        },
      },
      orderBy: { id: 'asc' },
      take,
      skip: cursor ? 1 : SKIP + processed,
      cursor: cursor ? { id: cursor } : undefined,
    })

    if (reviews.length === 0) break

    cursor = reviews[reviews.length - 1].id

    // Build embedding texts
    const embeddingTexts = reviews.map(r =>
      buildReviewEmbeddingText({
        text: r.text!,
        rating: r.rating,
        authorName: r.authorName,
        attorneyName: r.lawyer?.name,
        city: r.lawyer?.city,
        stateCode: r.lawyer?.stateCode,
        practiceArea: r.lawyer?.practiceAreas?.[0],
      })
    )

    if (DRY_RUN) {
      processed += reviews.length
      console.log(`[DRY RUN] Would embed ${reviews.length} reviews (${processed}/${effectiveLimit})`)
      continue
    }

    try {
      // Generate embeddings
      const vectors = await generateEmbeddingsBatch(embeddingTexts)

      // Build Qdrant points
      const points: ReviewPoint[] = reviews.map((r, i) => ({
        id: r.id,
        vector: vectors[i],
        payload: {
          reviewId: r.id,
          attorneyId: r.lawyer?.id || '',
          attorneyName: r.lawyer?.name || '',
          text: (r.text || '').slice(0, 500), // store truncated text in payload
          rating: r.rating,
          city: r.lawyer?.city || undefined,
          stateCode: r.lawyer?.stateCode || undefined,
          practiceArea: r.lawyer?.practiceAreas?.[0] || undefined,
          authorName: r.authorName || undefined,
          publishedAt: r.publishedAt?.toISOString() || undefined,
        },
      }))

      // Upsert to Qdrant
      await upsertReviews(points)
      embedded += vectors.length
    } catch (err) {
      errors++
      console.warn(`  ⚠ Batch error at offset ${processed}:`, err instanceof Error ? err.message : String(err).slice(0, 100))
      // Continue with next batch
    }

    processed += reviews.length

    // Progress logging
    if (processed % 500 === 0 || processed >= effectiveLimit) {
      const elapsed = (Date.now() - startTime) / 1000
      const rate = processed / elapsed
      const eta = (effectiveLimit - processed) / rate
      const estCost = (processed * 500 * 0.01) / 1_000_000 // ~500 tokens per review at $0.01/M
      console.log(
        `  📊 Progress: ${processed}/${effectiveLimit} | ` +
        `Embedded: ${embedded} | Errors: ${errors} | ` +
        `Rate: ${rate.toFixed(0)}/s | ETA: ${(eta / 60).toFixed(1)}m | ` +
        `Est. cost: $${estCost.toFixed(4)}`
      )
    }
  }

  // Final stats
  console.log('\n' + '='.repeat(60))
  console.log('INGESTION COMPLETE')
  console.log('='.repeat(60))
  console.log(`Processed: ${processed}`)
  console.log(`Embedded: ${embedded}`)
  console.log(`Errors: ${errors}`)
  console.log(`Duration: ${((Date.now() - startTime) / 1000).toFixed(1)}s`)

  if (!DRY_RUN) {
    const info = await getCollectionInfo()
    console.log(`\n[Qdrant] Final vector count: ${info.vectorCount}`)
  }

  await prisma.$disconnect()
}

main().catch(err => {
  console.error('[Vector Ingestion] Fatal error:', err)
  process.exit(1)
})

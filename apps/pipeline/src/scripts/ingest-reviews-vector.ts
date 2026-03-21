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
const BATCH_SIZE = parseInt(process.argv.find(a => a.startsWith('--batch-size='))?.split('=')[1] || '100', 10)
const LIMIT = parseInt(process.argv.find(a => a.startsWith('--limit='))?.split('=')[1] || '0', 10) || Infinity
const DRY_RUN = process.argv.includes('--dry-run')
const SKIP = parseInt(process.argv.find(a => a.startsWith('--skip='))?.split('=')[1] || '0', 10)
const MAX_RETRIES = 5

async function withRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await fn()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err).slice(0, 200)
      if (attempt === MAX_RETRIES - 1) throw err
      // Reconnect Prisma on connection errors (P1001, P1017)
      const code = (err as { code?: string })?.code
      if (code === 'P1001' || code === 'P1017' || msg.includes('closed the connection')) {
        console.warn(`  ⚠ ${label} DB connection lost — reconnecting...`)
        try { await prisma.$disconnect() } catch {}
        await prisma.$connect()
      }
      const delay = Math.min(1000 * Math.pow(2, attempt) + Math.random() * 500, 30000)
      console.warn(`  ⚠ ${label} attempt ${attempt + 1} failed: ${msg} — retrying in ${(delay / 1000).toFixed(1)}s`)
      await new Promise(r => setTimeout(r, delay))
    }
  }
  throw new Error('unreachable')
}

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
  const totalReviews = await prisma.attorneyReview.count({
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

    const reviews = await withRetry(() => prisma.attorneyReview.findMany({
      where: { text: { not: null } },
      select: {
        id: true,
        text: true,
        rating: true,
        authorName: true,
        publishedAt: true,
        attorney: {
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
    }), `db-fetch@${processed}`)

    if (reviews.length === 0) break

    cursor = reviews[reviews.length - 1].id

    // Build embedding texts
    const embeddingTexts = reviews.map(r =>
      buildReviewEmbeddingText({
        text: r.text!,
        rating: r.rating,
        authorName: r.authorName,
        attorneyName: r.attorney?.name,
        city: r.attorney?.city,
        stateCode: r.attorney?.stateCode,
        practiceArea: r.attorney?.practiceAreas?.[0],
      })
    )

    if (DRY_RUN) {
      processed += reviews.length
      console.log(`[DRY RUN] Would embed ${reviews.length} reviews (${processed}/${effectiveLimit})`)
      continue
    }

    // Process in embedding sub-batches
    const EMBED_BATCH = 25
    for (let j = 0; j < reviews.length; j += EMBED_BATCH) {
      const subReviews = reviews.slice(j, j + EMBED_BATCH)
      const subTexts = embeddingTexts.slice(j, j + EMBED_BATCH)

      try {
        // Clean texts: remove null bytes and excessive whitespace
        const cleanTexts = subTexts.map(t => t.replace(/\0/g, '').replace(/\s+/g, ' ').trim()).filter(t => t.length > 0)
        if (cleanTexts.length === 0) continue

        const vectors = await withRetry(() => generateEmbeddingsBatch(cleanTexts), `embed@${processed + j}`)

        const points: ReviewPoint[] = subReviews.slice(0, vectors.length).map((r, i) => ({
          id: r.id,
          vector: vectors[i],
          payload: {
            reviewId: r.id,
            attorneyId: r.attorney?.id || '',
            attorneyName: r.attorney?.name || '',
            text: (r.text || '').slice(0, 500),
            rating: r.rating,
            city: r.attorney?.city || undefined,
            stateCode: r.attorney?.stateCode || undefined,
            practiceArea: r.attorney?.practiceAreas?.[0] || undefined,
            authorName: r.authorName || undefined,
            publishedAt: r.publishedAt?.toISOString() || undefined,
          },
        }))

        await withRetry(() => upsertReviews(points), `upsert@${processed + j}`)
        embedded += vectors.length
      } catch (err) {
        errors++
        if (errors <= 10 || errors % 100 === 0) {
          console.warn(`  ⚠ Sub-batch error at offset ${processed + j}:`, err instanceof Error ? err.message : String(err).slice(0, 200))
        }
      }
    }

    processed += reviews.length

    // Progress logging
    if (processed % 100 === 0 || processed >= effectiveLimit) {
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

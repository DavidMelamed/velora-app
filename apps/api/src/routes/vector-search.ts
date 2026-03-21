import { Router } from 'express'
import {
  generateEmbedding,
  hybridSearch,
  rerankAndEnrich,
  getCollectionInfo,
} from '@velora/ai'

const router = Router()

// POST /api/vector-search — Hybrid semantic search with re-ranking
router.post('/', async (req, res) => {
  try {
    const { query, limit, stateCode, city, attorneyId, minRating, practiceArea } = req.body as {
      query: string
      limit?: number
      stateCode?: string
      city?: string
      attorneyId?: string
      minRating?: number
      practiceArea?: string
    }

    if (!query || typeof query !== 'string') {
      res.status(400).json({ error: 'query string is required' })
      return
    }

    const maxResults = Math.min(limit || 10, 20)

    // 1. Generate embedding for the query
    const queryVector = await generateEmbedding(query)

    // 2. Hybrid search: vector similarity + metadata filters
    const vectorHits = await hybridSearch({
      queryVector,
      filters: {
        stateCode: stateCode?.toUpperCase(),
        city,
        attorneyId,
        minRating,
        practiceArea,
      },
      limit: maxResults * 5, // over-fetch for re-ranking diversity
      minScore: 0.3,
    })

    // 3. Re-rank with attorney profile enrichment
    const ranked = await rerankAndEnrich(vectorHits, { maxAttorneys: maxResults })

    res.json({
      query,
      attorneys: ranked.map(r => ({
        ...r.attorney,
        compositeScore: r.compositeScore,
        scoreBreakdown: r.scoreBreakdown,
        matchedReviews: r.relevantReviews,
      })),
      total: ranked.length,
    })
  } catch (error) {
    console.error('[Vector Search] Error:', error)
    const message = error instanceof Error ? error.message : 'Vector search failed'
    res.status(500).json({ error: message })
  }
})

// GET /api/vector-search/stats — Collection stats
router.get('/stats', async (_req, res) => {
  try {
    const info = await getCollectionInfo()
    res.json(info)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get stats'
    res.status(500).json({ error: message })
  }
})

export default router

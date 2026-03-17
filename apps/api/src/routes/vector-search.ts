import { Router } from 'express'
import { generateEmbedding, searchSimilar, getCollectionInfo } from '@velora/ai'

const router = Router()

// POST /api/vector-search — Semantic search over attorney reviews
router.post('/', async (req, res) => {
  try {
    const { query, limit, stateCode, city, attorneyId, minRating } = req.body as {
      query: string
      limit?: number
      stateCode?: string
      city?: string
      attorneyId?: string
      minRating?: number
    }

    if (!query || typeof query !== 'string') {
      res.status(400).json({ error: 'query string is required' })
      return
    }

    const queryVector = await generateEmbedding(query)

    const results = await searchSimilar(queryVector, {
      limit: Math.min(limit || 10, 50),
      minScore: 0.3,
      filter: {
        stateCode,
        city,
        attorneyId,
        minRating,
      },
    })

    res.json({
      query,
      results: results.map((r: { score: number; payload: { reviewId: string; attorneyId: string; attorneyName: string; text: string; rating: number; city?: string; stateCode?: string } }) => ({
        score: r.score,
        reviewId: r.payload.reviewId,
        attorneyId: r.payload.attorneyId,
        attorneyName: r.payload.attorneyName,
        text: r.payload.text,
        rating: r.payload.rating,
        city: r.payload.city,
        stateCode: r.payload.stateCode,
      })),
      total: results.length,
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

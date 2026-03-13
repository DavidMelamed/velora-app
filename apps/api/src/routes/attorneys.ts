import { Router } from 'express'

const router = Router()

// GET /api/attorneys — List attorneys
router.get('/', async (_req, res) => {
  res.json({ data: [], total: 0, message: 'Attorney listing not yet implemented' })
})

// GET /api/attorneys/:slug — Get attorney by slug
router.get('/:slug', async (req, res) => {
  res.json({ data: null, message: `Attorney ${req.params.slug} not yet implemented` })
})

export default router

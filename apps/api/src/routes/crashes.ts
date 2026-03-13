import { Router } from 'express'

const router = Router()

// GET /api/crashes — List crashes with pagination
router.get('/', async (_req, res) => {
  res.json({ data: [], total: 0, message: 'Crash listing not yet implemented' })
})

// GET /api/crashes/:id — Get single crash by ID
router.get('/:id', async (req, res) => {
  res.json({ data: null, message: `Crash ${req.params.id} not yet implemented` })
})

export default router

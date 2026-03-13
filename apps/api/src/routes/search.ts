import { Router } from 'express'

const router = Router()

// POST /api/search — AI-powered crash search
router.post('/', async (_req, res) => {
  res.json({ results: [], total: 0, message: 'Search not yet implemented' })
})

export default router

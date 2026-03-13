import { Router } from 'express'

const router = Router()

// POST /api/pipeline/trigger — Trigger a pipeline run
router.post('/trigger', async (_req, res) => {
  res.json({ success: false, message: 'Pipeline trigger not yet implemented' })
})

// GET /api/pipeline/status — Get pipeline status
router.get('/status', async (_req, res) => {
  res.json({ status: 'idle', runs: [], message: 'Pipeline status not yet implemented' })
})

export default router

import { Router } from 'express'

const router = Router()

// GET /api/equalizer/:crashId — Get Equalizer briefing for a crash
router.get('/:crashId', async (req, res) => {
  res.json({ data: null, message: `Equalizer for crash ${req.params.crashId} not yet implemented` })
})

// POST /api/equalizer/:crashId/generate — Generate Equalizer briefing
router.post('/:crashId/generate', async (req, res) => {
  res.json({ data: null, message: `Equalizer generation for crash ${req.params.crashId} not yet implemented` })
})

export default router

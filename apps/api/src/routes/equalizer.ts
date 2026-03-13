import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import { generateEqualizerBriefing, getCachedBriefing } from '../services/equalizer/briefing-generator'

const router = Router()

// Rate limit for generation endpoint: 10 per minute
const generateLimiter = rateLimit({
  windowMs: 60_000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many Equalizer generation requests, please try again later' },
})

// GET /api/equalizer/:crashId — Read cached briefing (public)
router.get('/:crashId', async (req, res, next) => {
  try {
    const crashId = req.params.crashId as string
    const briefing = await getCachedBriefing(crashId)
    if (!briefing) {
      return res.status(404).json({ error: 'Equalizer briefing not yet generated for this crash' })
    }
    return res.json({ data: briefing })
  } catch (err) {
    next(err)
  }
})

// POST /api/equalizer/:crashId/generate — Generate fresh (rate-limited: 10/min)
router.post('/:crashId/generate', generateLimiter, async (req, res, next) => {
  try {
    const crashId = req.params.crashId as string
    const result = await generateEqualizerBriefing(crashId)
    return res.json({ data: result })
  } catch (err) {
    if (err instanceof Error && err.message.includes('not found')) {
      return res.status(404).json({ error: err.message })
    }
    next(err)
  }
})

export default router

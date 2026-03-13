import { Router } from 'express'

const router = Router()

// POST /api/feedback — Submit user feedback event
router.post('/', async (_req, res) => {
  res.json({ success: true, message: 'Feedback submission not yet implemented' })
})

export default router

import { Router } from 'express'
import { extractFromImage, validateImageUpload } from '../services/pipeline/ocr-service'

const router = Router()

// POST /api/pipeline/trigger — Trigger a pipeline run
router.post('/trigger', async (_req, res) => {
  res.json({ success: false, message: 'Pipeline trigger not yet implemented' })
})

// GET /api/pipeline/status — Get pipeline status
router.get('/status', async (_req, res) => {
  res.json({ status: 'idle', runs: [], message: 'Pipeline status not yet implemented' })
})

// POST /api/pipeline/ocr — Process police report image via OCR
router.post('/ocr', async (req, res) => {
  try {
    const { image } = req.body as { image?: string }

    if (!image) {
      res.status(400).json({
        success: false,
        data: null,
        confidence: 0,
        rawText: null,
        error: 'Missing image field (base64 encoded)',
      })
      return
    }

    const validation = validateImageUpload(image)
    if (!validation.valid) {
      res.status(400).json({ success: false, data: null, confidence: 0, rawText: null, error: validation.error })
      return
    }

    const result = await extractFromImage(image)
    res.json(result)
  } catch (error) {
    console.error('[OCR] Processing error:', error)
    res.status(500).json({
      success: false,
      data: null,
      confidence: 0,
      rawText: null,
      error: 'Internal error during OCR processing',
    })
  }
})

export default router

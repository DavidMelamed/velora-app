import { Router } from 'express'
import { prisma } from '@velora/db'
import { extractFromImage, validateImageUpload } from '../services/pipeline/ocr-service'

const router = Router()

// POST /api/pipeline/trigger — Trigger a pipeline run
router.post('/trigger', async (req, res) => {
  try {
    const { source, stateCode, stage } = req.body as {
      source?: string
      stateCode?: string
      stage?: string
    }

    // Find or create a manual data source
    let dataSource = await prisma.dataSource.findFirst({
      where: { name: source || 'manual' },
    })
    if (!dataSource) {
      dataSource = await prisma.dataSource.create({
        data: {
          name: source || 'manual',
          type: 'API',
          baseUrl: '',
        },
      })
    }

    // Create a new pipeline run record
    const run = await prisma.pipelineRun.create({
      data: {
        status: 'QUEUED',
        stage: stage || 'BRONZE',
        dataSourceId: dataSource.id,
      },
    })

    res.json({
      success: true,
      runId: run.id,
      status: run.status,
      message: `Pipeline run ${run.id} queued`,
    })
  } catch (error) {
    console.error('[Pipeline] Trigger error:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to trigger pipeline',
    })
  }
})

// GET /api/pipeline/status — Get pipeline status and recent runs
router.get('/status', async (req, res) => {
  try {
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 10))

    const [runs, counts] = await Promise.all([
      prisma.pipelineRun.findMany({
        orderBy: { startedAt: 'desc' },
        take: limit,
        select: {
          id: true,
          status: true,
          stage: true,
          dataSourceId: true,
          startedAt: true,
          completedAt: true,
          recordsIn: true,
          recordsOut: true,
          recordsFailed: true,
          durationMs: true,
          errorLog: true,
        },
      }),
      prisma.pipelineRun.groupBy({
        by: ['status'],
        _count: true,
      }),
    ])

    const latestRun = runs[0] ?? null
    const statusCounts = Object.fromEntries(
      counts.map((c) => [c.status, c._count])
    )

    res.json({
      status: latestRun?.status === 'RUNNING' ? 'running' : 'idle',
      latestRun,
      runs,
      summary: statusCounts,
    })
  } catch (error) {
    console.error('[Pipeline] Status error:', error)
    res.status(500).json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Failed to get pipeline status',
    })
  }
})

// GET /api/pipeline/dead-letters — Get dead letter queue entries
router.get('/dead-letters', async (req, res) => {
  try {
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20))
    const page = Math.max(1, parseInt(req.query.page as string) || 1)

    const [data, total] = await Promise.all([
      prisma.pipelineDeadLetter.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.pipelineDeadLetter.count(),
    ])

    res.json({ data, total, page, limit })
  } catch (error) {
    console.error('[Pipeline] Dead letters error:', error)
    res.status(500).json({ error: 'Failed to get dead letters' })
  }
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

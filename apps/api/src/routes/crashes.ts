import { Router } from 'express'
import { generateNarrative } from '../services/narrative/generator'
import { checkNarrativeQuality } from '../services/narrative/quality-check'
import { prisma } from '@velora/db'
import type { CrashNarrativeContent } from '@velora/shared'

const router = Router()

// GET /api/crashes — List crashes with pagination
router.get('/', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20))
    const skip = (page - 1) * limit

    const [data, total] = await Promise.all([
      prisma.crash.findMany({
        skip,
        take: limit,
        orderBy: { crashDate: 'desc' },
        select: {
          id: true,
          stateCode: true,
          crashDate: true,
          crashSeverity: true,
          county: true,
          cityName: true,
          mannerOfCollision: true,
          _count: { select: { vehicles: true, persons: true } },
        },
      }),
      prisma.crash.count(),
    ])

    res.json({ data, total, page, limit })
  } catch (error) {
    console.error('Error listing crashes:', error)
    res.status(500).json({ error: 'Failed to list crashes' })
  }
})

// GET /api/crashes/:id — Get single crash by ID
router.get('/:id', async (req, res) => {
  try {
    const crash = await prisma.crash.findUnique({
      where: { id: req.params.id },
      include: {
        vehicles: {
          include: { driver: true, persons: true },
        },
        persons: true,
        narratives: true,
      },
    })

    if (!crash) {
      res.status(404).json({ error: 'Crash not found' })
      return
    }

    res.json({ data: crash })
  } catch (error) {
    console.error('Error fetching crash:', error)
    res.status(500).json({ error: 'Failed to fetch crash' })
  }
})

// POST /api/crashes/:id/confirm — "I Was In This Crash" confirmation
router.post('/:id/confirm', async (req, res) => {
  try {
    const crashId = req.params.id as string

    const crash = await prisma.crash.findUnique({
      where: { id: crashId },
      select: { id: true, confirmationCount: true },
    })

    if (!crash) {
      res.status(404).json({ error: 'Crash not found' })
      return
    }

    const newCount = crash.confirmationCount + 1
    const isVerified = newCount >= 3

    await prisma.crash.update({
      where: { id: crashId },
      data: { confirmationCount: newCount, isVerified },
    })

    const { role, description } = (req.body || {}) as { role?: string; description?: string }
    await prisma.feedbackEvent.create({
      data: {
        type: 'CRASH_CONFIRMATION',
        crashId,
        sessionId: (req.headers['x-session-id'] as string) || 'anonymous',
        value: { accurate: true, role: role || 'involved', description: description || '' },
      },
    })

    res.json({ success: true, isVerified, confirmationCount: newCount })
  } catch (error) {
    console.error('Error confirming crash:', error)
    res.status(500).json({ error: 'Failed to confirm crash' })
  }
})

// POST /api/crashes/:id/generate-narrative — Generate AI narrative for a crash
router.post('/:id/generate-narrative', async (req, res) => {
  try {
    const crashId = req.params.id

    // Verify crash exists
    const crash = await prisma.crash.findUnique({
      where: { id: crashId },
      include: {
        vehicles: { include: { driver: true } },
        persons: true,
      },
    })

    if (!crash) {
      res.status(404).json({ error: 'Crash not found' })
      return
    }

    // Generate narrative
    const result = await generateNarrative(crashId)

    // Run quality check
    const quality = checkNarrativeQuality(result.content, {
      stateCode: crash.stateCode,
      county: crash.county,
      cityName: crash.cityName,
      streetAddress: crash.streetAddress,
      crashSeverity: crash.crashSeverity,
      mannerOfCollision: crash.mannerOfCollision,
      atmosphericCondition: crash.atmosphericCondition,
      lightCondition: crash.lightCondition,
      vehicles: crash.vehicles,
    })

    // Update narrative with quality metrics if PII check passes
    if (quality.piiCheck.passed) {
      await prisma.crashNarrative.update({
        where: { id: result.narrativeId },
        data: {
          factualAccuracy: quality.factualAccuracy,
          toneScore: quality.toneScore,
          readabilityScore: quality.readabilityScore,
        },
      })
    }

    res.json({
      data: {
        narrativeId: result.narrativeId,
        content: result.content,
        quality,
      },
    })
  } catch (error) {
    console.error('Error generating narrative:', error)
    const message = error instanceof Error ? error.message : 'Failed to generate narrative'
    res.status(500).json({ error: message })
  }
})

export default router

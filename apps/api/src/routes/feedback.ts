import { Router, type Request, type Response } from 'express'
import { z } from 'zod'
import { prisma } from '@velora/db'
import type { Prisma } from '@velora/db'

const router = Router()

/**
 * Feedback event types:
 * - Explicit: NARRATIVE_THUMBS, NARRATIVE_EDIT, EQUALIZER_USEFUL, CRASH_CONFIRMATION
 * - Implicit: SEARCH_CLICK, TIME_ON_PAGE, SCROLL_DEPTH, ATTORNEY_CTR
 */
const FEEDBACK_TYPES = [
  'NARRATIVE_THUMBS',
  'NARRATIVE_EDIT',
  'EQUALIZER_USEFUL',
  'CRASH_CONFIRMATION',
  'SEARCH_CLICK',
  'TIME_ON_PAGE',
  'SCROLL_DEPTH',
  'ATTORNEY_CTR',
] as const

const feedbackSchema = z.object({
  type: z.enum(FEEDBACK_TYPES),
  crashId: z.string().optional(),
  sessionId: z.string().min(1),
  value: z.record(z.unknown()),
  experimentId: z.string().optional(),
  variant: z.string().optional(),
})

// POST /api/feedback — Submit user feedback event
router.post('/', async (req: Request, res: Response) => {
  const parsed = feedbackSchema.safeParse(req.body)

  if (!parsed.success) {
    res.status(400).json({
      success: false,
      error: 'Invalid feedback data',
      details: parsed.error.flatten().fieldErrors,
    })
    return
  }

  const { type, crashId, sessionId, value, experimentId, variant } = parsed.data

  // Validate crashId references a real crash if provided
  if (crashId) {
    const crash = await prisma.crash.findUnique({ where: { id: crashId }, select: { id: true } })
    if (!crash) {
      res.status(404).json({ success: false, error: 'Crash not found' })
      return
    }
  }

  // Type-specific value validation
  const valueValidation = validateFeedbackValue(type, value)
  if (!valueValidation.valid) {
    res.status(400).json({ success: false, error: valueValidation.error })
    return
  }

  const event = await prisma.feedbackEvent.create({
    data: {
      type,
      crashId,
      sessionId,
      value: value as Prisma.InputJsonValue,
      experimentId,
      variant,
    },
  })

  res.status(201).json({ success: true, id: event.id })
})

// GET /api/feedback/stats/:crashId — Get feedback stats for a crash
router.get('/stats/:crashId', async (req: Request, res: Response) => {
  const crashId = req.params.crashId as string

  const [thumbsUp, thumbsDown, equalizerUseful, equalizerNotUseful, totalEvents] =
    await Promise.all([
      prisma.feedbackEvent.count({
        where: { crashId, type: 'NARRATIVE_THUMBS', value: { path: ['thumbs'], equals: 'up' } },
      }),
      prisma.feedbackEvent.count({
        where: { crashId, type: 'NARRATIVE_THUMBS', value: { path: ['thumbs'], equals: 'down' } },
      }),
      prisma.feedbackEvent.count({
        where: { crashId, type: 'EQUALIZER_USEFUL', value: { path: ['useful'], equals: true } },
      }),
      prisma.feedbackEvent.count({
        where: { crashId, type: 'EQUALIZER_USEFUL', value: { path: ['useful'], equals: false } },
      }),
      prisma.feedbackEvent.count({ where: { crashId } }),
    ])

  res.json({
    crashId,
    narrativeThumbs: { up: thumbsUp, down: thumbsDown },
    equalizerUseful: { yes: equalizerUseful, no: equalizerNotUseful },
    totalEvents,
  })
})

function validateFeedbackValue(
  type: (typeof FEEDBACK_TYPES)[number],
  value: Record<string, unknown>,
): { valid: boolean; error?: string } {
  switch (type) {
    case 'NARRATIVE_THUMBS':
      if (value.thumbs !== 'up' && value.thumbs !== 'down') {
        return { valid: false, error: 'NARRATIVE_THUMBS requires value.thumbs: "up" | "down"' }
      }
      return { valid: true }

    case 'NARRATIVE_EDIT':
      if (typeof value.section !== 'string' || typeof value.suggestedText !== 'string') {
        return {
          valid: false,
          error: 'NARRATIVE_EDIT requires value.section (string) and value.suggestedText (string)',
        }
      }
      return { valid: true }

    case 'EQUALIZER_USEFUL':
      if (typeof value.useful !== 'boolean') {
        return { valid: false, error: 'EQUALIZER_USEFUL requires value.useful (boolean)' }
      }
      return { valid: true }

    case 'CRASH_CONFIRMATION':
      if (typeof value.accurate !== 'boolean') {
        return { valid: false, error: 'CRASH_CONFIRMATION requires value.accurate (boolean)' }
      }
      return { valid: true }

    case 'SEARCH_CLICK':
      if (typeof value.query !== 'string' || typeof value.resultId !== 'string') {
        return {
          valid: false,
          error: 'SEARCH_CLICK requires value.query (string) and value.resultId (string)',
        }
      }
      return { valid: true }

    case 'TIME_ON_PAGE':
      if (typeof value.seconds !== 'number' || value.seconds < 0) {
        return { valid: false, error: 'TIME_ON_PAGE requires value.seconds (positive number)' }
      }
      return { valid: true }

    case 'SCROLL_DEPTH':
      if (typeof value.maxDepth !== 'number' || value.maxDepth < 0 || value.maxDepth > 100) {
        return { valid: false, error: 'SCROLL_DEPTH requires value.maxDepth (0-100)' }
      }
      return { valid: true }

    case 'ATTORNEY_CTR':
      if (typeof value.attorneyId !== 'string') {
        return { valid: false, error: 'ATTORNEY_CTR requires value.attorneyId (string)' }
      }
      return { valid: true }

    default:
      return { valid: true }
  }
}

export default router

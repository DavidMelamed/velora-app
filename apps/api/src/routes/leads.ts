import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '@velora/db'

// ─── Zod Validation Schemas ─────────────────────────

const createLeadSchema = z.object({
  attorneyId: z.string().min(1, 'attorneyId is required'),
  name: z.string().min(1, 'name is required'),
  phone: z.string().min(1, 'phone is required'),
  email: z.string().email().optional(),
  message: z.string().optional(),
  crashId: z.string().optional(),
  matterId: z.string().optional(),
  source: z.string().optional(),
})

const emailCaptureSchema = z.object({
  email: z.string().email('A valid email is required'),
  source: z.string().optional(),
  crashId: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
})

const router = Router()

// POST /api/leads — Submit a consultation request
router.post('/', async (req, res) => {
  try {
    const parsed = createLeadSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() })
      return
    }
    const { attorneyId, name, phone, email, message, crashId, matterId, source } = parsed.data

    const attorney = await prisma.attorney.findUnique({
      where: { id: attorneyId },
      select: { id: true, name: true },
    })

    if (!attorney) {
      res.status(404).json({ error: 'Attorney not found' })
      return
    }

    const lead = await prisma.leadRequest.create({
      data: {
        attorneyId,
        name,
        phone,
        email: email ?? null,
        message: message ?? null,
        crashId: crashId ?? null,
        matterId: matterId ?? null,
        source: source ?? 'attorney_profile',
        status: 'NEW',
      },
    })

    res.status(201).json({ success: true, leadId: lead.id })
  } catch (error) {
    console.error('Error creating lead:', error)
    res.status(500).json({ error: 'Failed to submit consultation request' })
  }
})

// POST /api/email-capture — Capture email for gated content
router.post('/email-capture', async (req, res) => {
  try {
    const parsed = emailCaptureSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() })
      return
    }
    const { email, source, crashId, metadata } = parsed.data

    await prisma.emailCapture.upsert({
      where: {
        email_source: { email, source: source ?? 'equalizer' },
      },
      create: {
        email,
        source: source ?? 'equalizer',
        crashId: crashId ?? null,
        metadata: metadata as unknown as import('@velora/db').Prisma.InputJsonValue ?? undefined,
      },
      update: {
        metadata: metadata as unknown as import('@velora/db').Prisma.InputJsonValue ?? undefined,
      },
    })

    res.status(201).json({ success: true })
  } catch (error) {
    console.error('Error capturing email:', error)
    res.status(500).json({ error: 'Failed to capture email' })
  }
})

export default router

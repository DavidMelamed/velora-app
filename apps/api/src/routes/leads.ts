import { Router } from 'express'
import { prisma } from '@velora/db'

const router = Router()

// POST /api/leads — Submit a consultation request
router.post('/', async (req, res) => {
  try {
    const { attorneyId, name, phone, email, message, crashId, matterId, source } = req.body as {
      attorneyId: string
      name: string
      phone: string
      email?: string
      message?: string
      crashId?: string
      matterId?: string
      source?: string
    }

    if (!attorneyId || !name || !phone) {
      res.status(400).json({ error: 'attorneyId, name, and phone are required' })
      return
    }

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
    const { email, source, crashId, metadata } = req.body as {
      email: string
      source?: string
      crashId?: string
      metadata?: Record<string, unknown>
    }

    if (!email) {
      res.status(400).json({ error: 'Email is required' })
      return
    }

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

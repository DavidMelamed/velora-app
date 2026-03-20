import { Router } from 'express'
import { streamText } from 'ai'
import { z } from 'zod'
import { prisma } from '@velora/db'
import { getModel } from '@velora/ai'
import { createMatter, getMatter, updateMatterStatus, linkCrashToMatter } from '../services/case/matter'
import { ingestEpisode, ingestLocationVisit, ingestVoiceNote, ingestPhoto } from '../services/case/episode-ingest'
import { getActiveFacts } from '../services/case/fact-manager'
import { respondToConfirmation } from '../services/case/confirmation'
import { caseShepherdTools } from '../agents/tools/case-shepherd-tools'
import { agentConfigs, AGENT_IDS } from '../agents/mastra-config'
import { EpisodeType } from '@velora/shared'
import type { MatterCreateInput, EpisodeCreateInput, TimelineFilter } from '@velora/shared'
import { requireAuth, optionalAuth, type AuthenticatedRequest } from '../middleware/auth'

// ─── Zod Validation Schemas ─────────────────────────

const createMatterSchema = z.object({
  crashId: z.string().optional(),
  accidentDate: z.string().optional(),
  stateCode: z.string().length(2).optional(),
  clientName: z.string().optional(),
  clientPhone: z.string().optional(),
  clientEmail: z.string().email().optional(),
  userId: z.string().optional(),
})

const updateStatusSchema = z.object({
  status: z.enum(['INTAKE', 'ACTIVE', 'TREATING', 'DEMAND_PREP', 'LITIGATION', 'SETTLED', 'CLOSED']),
})

const linkCrashSchema = z.object({
  crashId: z.string().min(1, 'crashId is required'),
})

const episodeCreateSchema = z.object({
  type: z.enum([
    'CALL_TRANSCRIPT', 'CHAT_MESSAGE', 'VOICE_NOTE', 'LOCATION_VISIT',
    'PHOTO', 'DOCUMENT', 'EMAIL_EXTRACT', 'SYSTEM_EVENT', 'CONFIRMATION_RESPONSE',
  ]),
  textContent: z.string().optional(),
  mediaUrl: z.string().url().optional(),
  mediaType: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  locationName: z.string().optional(),
  occurredAt: z.string(),
  duration: z.number().optional(),
  title: z.string().optional(),
})

const voiceNoteSchema = z.object({
  mediaUrl: z.string().url(),
  transcription: z.string(),
  duration: z.number().positive(),
})

const photoSchema = z.object({
  mediaUrl: z.string().url(),
  exif: z.record(z.unknown()).optional().default({}),
})

const visitSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  enteredAt: z.string(),
  exitedAt: z.string(),
  locationName: z.string().optional(),
  providerName: z.string().optional(),
})

const confirmationSchema = z.object({
  confirmed: z.boolean(),
})

const chatSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string(),
  })).min(1, 'At least one message is required'),
})

const paginationQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

const router = Router()

// ─── Matter CRUD ────────────────────────────────────

// GET /api/case/me — Get current user's matter (most recent)
router.get('/me', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const matter = await prisma.matter.findFirst({
      where: { userId: req.userId },
      orderBy: { lastActivityAt: 'desc' },
      select: {
        id: true,
        clientName: true,
        status: true,
        accidentDate: true,
        stateCode: true,
        statuteDeadline: true,
        lastActivityAt: true,
      },
    })

    if (!matter) {
      res.status(404).json({ error: 'No active case found' })
      return
    }

    res.json(matter)
  } catch (error) {
    console.error('Error getting user matter:', error)
    res.status(500).json({ error: 'Failed to get matter' })
  }
})

// POST /api/case — Create matter
router.post('/', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const parsed = createMatterSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() })
      return
    }
    const input = parsed.data
    const matter = await prisma.matter.create({
      data: {
        userId: req.userId ?? null,
        clientName: input.clientName ?? null,
        clientPhone: input.clientPhone ?? null,
        clientEmail: input.clientEmail ?? null,
        crashId: input.crashId ?? null,
        accidentDate: input.accidentDate ? new Date(input.accidentDate) : null,
        stateCode: input.stateCode ?? null,
        status: 'INTAKE',
      },
    })
    res.status(201).json(matter)
  } catch (error) {
    console.error('Error creating matter:', error)
    res.status(500).json({ error: 'Failed to create matter' })
  }
})

// GET /api/case/:id — Get matter with relations
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const matter = await getMatter(req.params.id)
    if (!matter) {
      res.status(404).json({ error: 'Matter not found' })
      return
    }
    res.json(matter)
  } catch (error) {
    console.error('Error getting matter:', error)
    res.status(500).json({ error: 'Failed to get matter' })
  }
})

// PATCH /api/case/:id/status — Update status
router.patch('/:id/status', async (req, res) => {
  try {
    const parsed = updateStatusSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() })
      return
    }
    const { status } = parsed.data
    const matter = await updateMatterStatus(req.params.id, status as import('@velora/db').MatterStatus)
    res.json(matter)
  } catch (error) {
    console.error('Error updating matter status:', error)
    res.status(500).json({ error: 'Failed to update status' })
  }
})

// POST /api/case/:id/link-crash — Link crash to matter
router.post('/:id/link-crash', async (req, res) => {
  try {
    const parsed = linkCrashSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() })
      return
    }
    const { crashId } = parsed.data
    const matter = await linkCrashToMatter(req.params.id, crashId)
    res.json(matter)
  } catch (error) {
    console.error('Error linking crash:', error)
    res.status(500).json({ error: 'Failed to link crash' })
  }
})

// ─── Episodes ───────────────────────────────────────

// POST /api/case/:id/episodes — Ingest episode
router.post('/:id/episodes', async (req, res) => {
  try {
    const parsed = episodeCreateSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() })
      return
    }
    const input = parsed.data as EpisodeCreateInput
    const episode = await ingestEpisode(req.params.id, input)
    res.status(201).json(episode)
  } catch (error) {
    console.error('Error ingesting episode:', error)
    res.status(500).json({ error: 'Failed to ingest episode' })
  }
})

// GET /api/case/:id/episodes — List episodes
router.get('/:id/episodes', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 20))
    const type = req.query.type as string | undefined

    const where: Record<string, unknown> = { matterId: req.params.id }
    if (type) where.type = type

    const [data, total] = await Promise.all([
      prisma.episode.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { occurredAt: 'desc' },
      }),
      prisma.episode.count({ where }),
    ])

    res.json({ data, total, page, limit })
  } catch (error) {
    console.error('Error listing episodes:', error)
    res.status(500).json({ error: 'Failed to list episodes' })
  }
})

// GET /api/case/:id/episodes/:episodeId — Single episode with entities
router.get('/:id/episodes/:episodeId', async (req, res) => {
  try {
    const episode = await prisma.episode.findUnique({
      where: { id: req.params.episodeId },
      include: { entities: true, facts: true },
    })
    if (!episode || episode.matterId !== req.params.id) {
      res.status(404).json({ error: 'Episode not found' })
      return
    }
    res.json(episode)
  } catch (error) {
    console.error('Error getting episode:', error)
    res.status(500).json({ error: 'Failed to get episode' })
  }
})

// POST /api/case/:id/episodes/voice — Voice note
router.post('/:id/episodes/voice', async (req, res) => {
  try {
    const parsed = voiceNoteSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() })
      return
    }
    const { mediaUrl, transcription, duration } = parsed.data
    const episode = await ingestVoiceNote(req.params.id, mediaUrl, transcription, duration)
    res.status(201).json(episode)
  } catch (error) {
    console.error('Error ingesting voice note:', error)
    res.status(500).json({ error: 'Failed to ingest voice note' })
  }
})

// POST /api/case/:id/episodes/photo — Photo evidence
router.post('/:id/episodes/photo', async (req, res) => {
  try {
    const parsed = photoSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() })
      return
    }
    const { mediaUrl, exif } = parsed.data
    const episode = await ingestPhoto(req.params.id, mediaUrl, exif)
    res.status(201).json(episode)
  } catch (error) {
    console.error('Error ingesting photo:', error)
    res.status(500).json({ error: 'Failed to ingest photo' })
  }
})

// POST /api/case/:id/episodes/visit — Location visit
router.post('/:id/episodes/visit', async (req, res) => {
  try {
    const parsed = visitSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() })
      return
    }
    const episode = await ingestLocationVisit(req.params.id, parsed.data)
    res.status(201).json(episode)
  } catch (error) {
    console.error('Error ingesting visit:', error)
    res.status(500).json({ error: 'Failed to ingest visit' })
  }
})

// ─── Timeline ───────────────────────────────────────

// GET /api/case/:id/timeline — Timeline events
router.get('/:id/timeline', async (req, res) => {
  try {
    const { category, dateFrom, dateTo } = req.query as TimelineFilter

    const where: Record<string, unknown> = { matterId: req.params.id }
    if (category) where.category = category
    if (dateFrom || dateTo) {
      where.occurredAt = {
        ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
        ...(dateTo ? { lte: new Date(dateTo) } : {}),
      }
    }

    const events = await prisma.caseTimeline.findMany({
      where,
      orderBy: { occurredAt: 'desc' },
      take: 100,
    })

    res.json(events)
  } catch (error) {
    console.error('Error getting timeline:', error)
    res.status(500).json({ error: 'Failed to get timeline' })
  }
})

// ─── Entities ───────────────────────────────────────

// GET /api/case/:id/entities — Case entities
router.get('/:id/entities', async (req, res) => {
  try {
    const { page, limit } = paginationQuery.parse(req.query)
    const type = req.query.type as string | undefined
    const where: Record<string, unknown> = { matterId: req.params.id }
    if (type) where.type = type

    const [data, total] = await Promise.all([
      prisma.caseEntity.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { confidence: 'desc' },
      }),
      prisma.caseEntity.count({ where }),
    ])

    res.json({ data, total, page, limit })
  } catch (error) {
    console.error('Error getting entities:', error)
    res.status(500).json({ error: 'Failed to get entities' })
  }
})

// ─── Facts ──────────────────────────────────────────

// GET /api/case/:id/facts — Active facts
router.get('/:id/facts', async (req, res) => {
  try {
    const { page, limit } = paginationQuery.parse(req.query)
    const predicate = req.query.predicate as string | undefined
    const asOf = req.query.asOf ? new Date(req.query.asOf as string) : new Date()

    const where: Record<string, unknown> = {
      matterId: req.params.id,
      status: { in: ['CONFIRMED', 'CANDIDATE'] },
      validFrom: { lte: asOf },
      OR: [
        { validUntil: null },
        { validUntil: { gt: asOf } },
      ],
    }
    if (predicate) where.predicate = predicate

    const [data, total] = await Promise.all([
      prisma.caseFact.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { validFrom: 'desc' },
      }),
      prisma.caseFact.count({ where }),
    ])

    res.json({ data, total, page, limit })
  } catch (error) {
    console.error('Error getting facts:', error)
    res.status(500).json({ error: 'Failed to get facts' })
  }
})

// ─── Confirmations ──────────────────────────────────

// POST /api/case/:id/confirm/:confirmationId — Respond to confirmation
router.post('/:id/confirm/:confirmationId', async (req, res) => {
  try {
    const parsed = confirmationSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() })
      return
    }
    const { confirmed } = parsed.data

    const confirmation = await prisma.confirmation.findUnique({
      where: { id: req.params.confirmationId },
    })

    if (!confirmation || confirmation.matterId !== req.params.id) {
      res.status(404).json({ error: 'Confirmation not found' })
      return
    }

    await respondToConfirmation(req.params.confirmationId, confirmed)
    res.json({ success: true })
  } catch (error) {
    console.error('Error responding to confirmation:', error)
    res.status(500).json({ error: 'Failed to respond' })
  }
})

// GET /api/case/:id/confirmations — Pending confirmations
router.get('/:id/confirmations', async (req, res) => {
  try {
    const { page, limit } = paginationQuery.parse(req.query)
    const where = {
      matterId: req.params.id,
      confirmed: null as null,
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } },
      ],
    }

    const [data, total] = await Promise.all([
      prisma.confirmation.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { sentAt: 'desc' },
      }),
      prisma.confirmation.count({ where }),
    ])

    res.json({ data, total, page, limit })
  } catch (error) {
    console.error('Error getting confirmations:', error)
    res.status(500).json({ error: 'Failed to get confirmations' })
  }
})

// ─── Providers ──────────────────────────────────────

// GET /api/providers — Nearby providers
router.get('/providers/nearby', async (req, res) => {
  try {
    const lat = parseFloat(req.query.lat as string)
    const lng = parseFloat(req.query.lng as string)
    const radius = parseInt(req.query.radius as string, 10) || 5000

    if (isNaN(lat) || isNaN(lng)) {
      res.status(400).json({ error: 'lat and lng are required' })
      return
    }

    // Simple bounding box filter (good enough for provider geofencing)
    const degPerMeter = 1 / 111_320
    const latDelta = radius * degPerMeter
    const lngDelta = radius * degPerMeter / Math.cos(lat * Math.PI / 180)

    const providers = await prisma.provider.findMany({
      where: {
        latitude: { gte: lat - latDelta, lte: lat + latDelta },
        longitude: { gte: lng - lngDelta, lte: lng + lngDelta },
      },
    })

    res.json(providers)
  } catch (error) {
    console.error('Error getting providers:', error)
    res.status(500).json({ error: 'Failed to get providers' })
  }
})

// ─── Chat (Case Shepherd) ───────────────────────────

// POST /api/case/:id/chat — Send message to Case Shepherd (streaming SSE)
router.post('/:id/chat', async (req, res) => {
  try {
    const parsed = chatSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() })
      return
    }
    const { messages } = parsed.data
    const matterId = req.params.id

    // Load matter context for system prompt
    const matter = await prisma.matter.findUnique({ where: { id: matterId } })
    if (!matter) {
      res.status(404).json({ error: 'Matter not found' })
      return
    }

    const facts = await getActiveFacts(matterId)
    const recentTimeline = await prisma.caseTimeline.findMany({
      where: { matterId },
      orderBy: { occurredAt: 'desc' },
      take: 10,
    })
    const pendingConfirmations = await prisma.confirmation.findMany({
      where: { matterId, confirmed: null },
      take: 5,
    })

    const contextBlock = [
      `Client: ${matter.clientName || 'Unknown'}`,
      `Status: ${matter.status}`,
      matter.statuteDeadline
        ? `Statute deadline: ${matter.statuteDeadline.toISOString().split('T')[0]}`
        : null,
      facts.length
        ? `Active facts:\n${facts.slice(0, 10).map((f) => `- ${f.subject} ${f.predicate} ${f.object}`).join('\n')}`
        : null,
      recentTimeline.length
        ? `Recent events:\n${recentTimeline.map((e) => `- ${e.occurredAt.toISOString().split('T')[0]}: ${e.title}`).join('\n')}`
        : null,
      pendingConfirmations.length
        ? `Pending confirmations: ${pendingConfirmations.length}`
        : null,
    ].filter(Boolean).join('\n')

    const shepherdConfig = agentConfigs[AGENT_IDS.CASE_SHEPHERD]
    const systemPrompt = `${shepherdConfig.instructions}\n\n--- CASE CONTEXT ---\nMatter ID: ${matterId}\n${contextBlock}`

    // Save user message as episode
    const lastMessage = messages[messages.length - 1]
    if (lastMessage?.role === 'user') {
      await ingestEpisode(matterId, {
        type: EpisodeType.CHAT_MESSAGE,
        textContent: lastMessage.content,
        title: lastMessage.content.slice(0, 60),
        occurredAt: new Date().toISOString(),
        metadata: { role: 'user' },
      })
    }

    // Stream response
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')

    const result = streamText({
      model: getModel('standard'),
      system: systemPrompt,
      messages,
      tools: caseShepherdTools as Record<string, unknown>,
      maxSteps: 5,
    })

    const stream = result.toDataStream()
    const reader = stream.getReader()

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        res.write(value)
      }
    } finally {
      res.end()
    }
  } catch (error) {
    console.error('Error in case shepherd chat:', error)
    if (!res.headersSent) {
      res.status(500).json({ error: 'Chat failed' })
    }
  }
})

// GET /api/case/:id/chat/history — Chat message history
router.get('/:id/chat/history', async (req, res) => {
  try {
    const episodes = await prisma.episode.findMany({
      where: {
        matterId: req.params.id,
        type: { in: ['CHAT_MESSAGE', 'SYSTEM_EVENT'] },
      },
      orderBy: { occurredAt: 'asc' },
      select: {
        id: true,
        textContent: true,
        occurredAt: true,
        metadata: true,
      },
    })

    const messages = episodes.map((ep) => ({
      id: ep.id,
      role: (ep.metadata as Record<string, unknown>)?.role as string || 'system',
      content: ep.textContent || '',
      timestamp: ep.occurredAt,
    }))

    res.json(messages)
  } catch (error) {
    console.error('Error getting chat history:', error)
    res.status(500).json({ error: 'Failed to get chat history' })
  }
})

export default router

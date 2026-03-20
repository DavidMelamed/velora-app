/**
 * Additional case management routes:
 * - File upload (voice/photo with actual storage)
 * - Transcription
 * - PDF export
 * - Case sharing
 * - Redis caching
 */

import { Router } from 'express'
import { prisma } from '@velora/db'
import { uploadBase64 } from '../services/case/file-storage'
import { transcribeAudio } from '../services/case/transcription'
import { loadCaseChronology, generateChronologyHTML } from '../services/case/pdf-export'
import { generateShareToken, validateShareToken, getSharedCaseView } from '../services/case/case-sharing'
import { ingestVoiceNote, ingestPhoto } from '../services/case/episode-ingest'
import { processEpisodeExtraction } from '../services/case/entity-extractor'

const router = Router()

// ─── File Upload + Transcription ────────────────────

/**
 * POST /api/case/:id/upload/voice
 * Upload audio, transcribe it, and create a voice note episode.
 * Body: { audio: base64 string, mimeType: string }
 */
router.post('/:id/upload/voice', async (req, res) => {
  try {
    const matterId = req.params.id
    const { audio, mimeType } = req.body as { audio: string; mimeType?: string }

    if (!audio) {
      res.status(400).json({ error: 'audio (base64) is required' })
      return
    }

    const mime = mimeType || 'audio/m4a'

    // 1. Upload to storage
    const upload = await uploadBase64(audio, {
      mimeType: mime,
      folder: `cases/${matterId}/voice`,
    })

    // 2. Transcribe
    let transcription = ''
    let duration = 0
    try {
      const result = await transcribeAudio({ base64: audio, mimeType: mime })
      transcription = result.text
      duration = result.durationSeconds
    } catch (err) {
      console.warn('Transcription failed, saving without text:', err)
    }

    // 3. Create episode
    const episode = await ingestVoiceNote(matterId, upload.url, transcription, duration)

    // 4. Trigger async extraction if we have text
    if (transcription) {
      processEpisodeExtraction(episode.id).catch((err) =>
        console.error('Background extraction failed:', err)
      )
    }

    res.status(201).json({
      episodeId: episode.id,
      mediaUrl: upload.url,
      transcription,
      duration,
    })
  } catch (error) {
    console.error('Error uploading voice:', error)
    res.status(500).json({ error: 'Failed to upload voice note' })
  }
})

/**
 * POST /api/case/:id/upload/photo
 * Upload a photo and create a photo episode.
 * Body: { image: base64 string, mimeType: string, exif?: object }
 */
router.post('/:id/upload/photo', async (req, res) => {
  try {
    const matterId = req.params.id
    const { image, mimeType, exif } = req.body as {
      image: string
      mimeType?: string
      exif?: Record<string, unknown>
    }

    if (!image) {
      res.status(400).json({ error: 'image (base64) is required' })
      return
    }

    // 1. Upload to storage
    const upload = await uploadBase64(image, {
      mimeType: mimeType || 'image/jpeg',
      folder: `cases/${matterId}/photos`,
    })

    // 2. Create episode
    const episode = await ingestPhoto(matterId, upload.url, exif || {})

    res.status(201).json({
      episodeId: episode.id,
      mediaUrl: upload.url,
    })
  } catch (error) {
    console.error('Error uploading photo:', error)
    res.status(500).json({ error: 'Failed to upload photo' })
  }
})

// ─── PDF Export ─────────────────────────────────────

/**
 * GET /api/case/:id/export/pdf
 * Returns an HTML document that can be printed to PDF.
 */
router.get('/:id/export/pdf', async (req, res) => {
  try {
    const data = await loadCaseChronology(req.params.id)
    if (!data) {
      res.status(404).json({ error: 'Case not found' })
      return
    }

    const html = generateChronologyHTML(data)

    res.setHeader('Content-Type', 'text/html')
    res.setHeader('Content-Disposition', `inline; filename="case-chronology-${req.params.id}.html"`)
    res.send(html)
  } catch (error) {
    console.error('Error exporting PDF:', error)
    res.status(500).json({ error: 'Failed to export case' })
  }
})

/**
 * GET /api/case/:id/export/json
 * Returns structured case data for external tools.
 */
router.get('/:id/export/json', async (req, res) => {
  try {
    const data = await loadCaseChronology(req.params.id)
    if (!data) {
      res.status(404).json({ error: 'Case not found' })
      return
    }

    res.json(data)
  } catch (error) {
    console.error('Error exporting case:', error)
    res.status(500).json({ error: 'Failed to export case' })
  }
})

// ─── Case Sharing ───────────────────────────────────

/**
 * POST /api/case/:id/share
 * Generate a secure share link for this case.
 */
router.post('/:id/share', async (req, res) => {
  try {
    const matter = await prisma.matter.findUnique({
      where: { id: req.params.id },
      select: { id: true },
    })

    if (!matter) {
      res.status(404).json({ error: 'Case not found' })
      return
    }

    const { token, expiresAt } = generateShareToken(req.params.id)
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const shareUrl = `${baseUrl}/case/shared/${token}`

    res.json({ shareUrl, token, expiresAt })
  } catch (error) {
    console.error('Error generating share link:', error)
    res.status(500).json({ error: 'Failed to generate share link' })
  }
})

/**
 * GET /api/case/shared/:token
 * View a shared case (read-only, no PII).
 */
router.get('/shared/:token', async (req, res) => {
  try {
    const result = validateShareToken(req.params.token)

    if (!result.valid) {
      if (result.expired) {
        res.status(410).json({ error: 'Share link has expired' })
        return
      }
      res.status(403).json({ error: 'Invalid share link' })
      return
    }

    const caseView = await getSharedCaseView(result.matterId!)
    if (!caseView) {
      res.status(404).json({ error: 'Case not found' })
      return
    }

    res.json(caseView)
  } catch (error) {
    console.error('Error loading shared case:', error)
    res.status(500).json({ error: 'Failed to load shared case' })
  }
})

// ─── Non-streaming chat for mobile ──────────────────

/**
 * POST /api/case/:id/chat/simple
 * Non-streaming chat endpoint for mobile clients.
 * Returns { role: 'assistant', content: string } instead of SSE stream.
 */
router.post('/:id/chat/simple', async (req, res) => {
  try {
    const { generateText } = await import('ai')
    const { getModel } = await import('@velora/ai')
    const { getActiveFacts } = await import('../services/case/fact-manager')
    const { agentConfigs, AGENT_IDS } = await import('../agents/mastra-config')
    const { caseShepherdTools } = await import('../agents/tools/case-shepherd-tools')
    const { ingestEpisode } = await import('../services/case/episode-ingest')
    const { EpisodeType } = await import('@velora/shared')

    const matterId = req.params.id
    const { messages } = req.body as {
      messages: Array<{ role: 'user' | 'assistant'; content: string }>
    }

    if (!messages?.length) {
      res.status(400).json({ error: 'messages array is required' })
      return
    }

    const matter = await prisma.matter.findUnique({ where: { id: matterId } })
    if (!matter) {
      res.status(404).json({ error: 'Matter not found' })
      return
    }

    // Build context
    const facts = await getActiveFacts(matterId)
    const shepherdConfig = agentConfigs[AGENT_IDS.CASE_SHEPHERD]
    const contextLines = [
      `Client: ${matter.clientName || 'Unknown'}`,
      `Status: ${matter.status}`,
      facts.length
        ? `Active facts:\n${facts.slice(0, 10).map((f) => `- ${f.subject} ${f.predicate} ${f.object}`).join('\n')}`
        : null,
    ].filter(Boolean).join('\n')

    const systemPrompt = `${shepherdConfig.instructions}\n\n--- CASE CONTEXT ---\n${contextLines}`

    // Save user message
    const lastMsg = messages[messages.length - 1]
    if (lastMsg?.role === 'user') {
      await ingestEpisode(matterId, {
        type: EpisodeType.CHAT_MESSAGE,
        textContent: lastMsg.content,
        title: lastMsg.content.slice(0, 60),
        occurredAt: new Date().toISOString(),
        metadata: { role: 'user' },
      })
    }

    // Generate (non-streaming)
    const result = await generateText({
      model: getModel('standard'),
      system: systemPrompt,
      messages,
      tools: caseShepherdTools as Record<string, unknown>,
      maxSteps: 5,
    })

    // Save assistant response
    if (result.text) {
      await ingestEpisode(matterId, {
        type: EpisodeType.CHAT_MESSAGE,
        textContent: result.text,
        title: result.text.slice(0, 60),
        occurredAt: new Date().toISOString(),
        metadata: { role: 'assistant' },
      })
    }

    res.json({ role: 'assistant', content: result.text })
  } catch (error) {
    console.error('Error in simple chat:', error)
    res.status(500).json({ error: 'Chat failed' })
  }
})

export default router

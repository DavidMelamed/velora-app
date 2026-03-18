import { Router } from 'express'
import { streamText } from 'ai'
import {
  getModel,
  searchCrashesTool,
  getIntersectionStatsTool,
  findAttorneysTool,
  getTrendsTool,
  searchReviewsTool,
  getAttorneyProfileTool,
  findNearbyAttorneysTool,
  detectPersona,
  getPersonaConfig,
} from '@velora/ai'

const router = Router()

const BASE_SYSTEM_PROMPT = `You are Velora, a crash data intelligence assistant. You help users understand crash data, find patterns, locate attorneys, and make informed decisions after car accidents.

Key behaviors:
- Always use the available tools to fetch real data before answering
- Present data clearly with context and actionable insights
- Be empathetic when discussing crashes involving injuries or fatalities
- Never provide legal advice — suggest consulting an attorney for legal questions
- Cite data sources and note limitations when relevant
- For intersection queries, provide the danger score and safety context
- For attorney searches, highlight their Index score and review dimensions
- For trend analysis, describe patterns and anomalies in the data

Available capabilities:
- searchCrashes: Search crash records by state, city, severity, type, and date range
- getIntersectionStats: Analyze crash patterns near a geographic location
- findAttorneys: Find top-rated personal injury attorneys by location (structured SQL search)
- getTrends: Analyze crash trends over time by various periods
- searchReviews: **SEMANTIC SEARCH** over 800K+ attorney reviews — use this when users ask about specific qualities (communication, outcomes, fees, trial experience). Returns attorneys ranked by composite score with matched review snippets
- getAttorneyProfile: Get full attorney detail including review intelligence dimensions, best quotes, trend, and recent reviews. Use after searchReviews or findAttorneys to drill into a specific attorney
- findNearbyAttorneys: Find attorneys near a crash location with distance + quality blended scoring. Use after getting crash lat/lng from searchCrashes

Multi-step search strategies:
- "Find best lawyer near this crash": searchCrashes → get lat/lng → findNearbyAttorneys → getAttorneyProfile for top match
- "Lawyer with good communication": searchReviews with communication-focused query → getAttorneyProfile for top matches
- "Compare attorneys": getAttorneyProfile for each, present dimension scores side by side
- "Attorney reviews about outcomes": searchReviews with outcome-focused query, returns matched review snippets with context`

// POST /api/search — AI-powered crash search (streaming)
router.post('/', async (req, res) => {
  try {
    const { messages } = req.body as { messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> }

    if (!messages || !Array.isArray(messages)) {
      res.status(400).json({ error: 'messages array is required' })
      return
    }

    // Detect persona from the latest user message
    const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user')
    const userText = lastUserMessage?.content ?? ''
    const detected = detectPersona(typeof userText === 'string' ? userText : '')
    const personaConfig = getPersonaConfig(detected.type)

    const systemPrompt = `${BASE_SYSTEM_PROMPT}

${personaConfig.systemPromptModifier}

Detected persona: ${detected.type} (confidence: ${detected.confidence})
Tone: ${personaConfig.tone}`

    const result = streamText({
      model: getModel('standard'),
      system: systemPrompt,
      messages,
      tools: {
        searchCrashes: searchCrashesTool,
        getIntersectionStats: getIntersectionStatsTool,
        findAttorneys: findAttorneysTool,
        getTrends: getTrendsTool,
        searchReviews: searchReviewsTool,
        getAttorneyProfile: getAttorneyProfileTool,
        findNearbyAttorneys: findNearbyAttorneysTool,
      },
      maxSteps: 8,
    })

    // Stream the response as SSE
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')

    const response = await result.toDataStreamResponse()
    const reader = response.body?.getReader()
    if (!reader) {
      res.status(500).json({ error: 'Failed to create stream' })
      return
    }

    const decoder = new TextDecoder()
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        res.write(decoder.decode(value, { stream: true }))
      }
    } finally {
      res.end()
    }
  } catch (error) {
    console.error('[Search] Error:', error)
    if (!res.headersSent) {
      const message = error instanceof Error ? error.message : 'Search failed'
      res.status(500).json({ error: message })
    }
  }
})

export default router

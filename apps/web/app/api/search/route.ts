import { streamText } from 'ai'
import {
  getModel,
  searchCrashesTool,
  getIntersectionStatsTool,
  findAttorneysTool,
  getTrendsTool,
  detectPersona,
  getPersonaConfig,
} from '@velora/ai'

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
- findAttorneys: Find top-rated personal injury attorneys by location
- getTrends: Analyze crash trends over time by various periods`

export async function POST(req: Request) {
  const { messages } = await req.json()

  // Detect persona from the latest user message
  const lastUserMessage = [...messages].reverse().find((m: { role: string }) => m.role === 'user')
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
    },
    maxSteps: 8,
  })

  return result.toDataStreamResponse()
}

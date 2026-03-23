import { createDataStreamResponse, formatDataStreamPart, generateText, streamText } from 'ai'
import {
  detectPersona,
  findAttorneys,
  findAttorneysTool,
  getActiveProvider,
  getIntersectionStatsTool,
  getModel,
  getPersonaConfig,
  getTrends,
  getTrendsTool,
  recordProviderFailure,
  searchCrashes,
  searchCrashesTool,
} from '@velora/ai'
import { STATE_CATALOG } from '@velora/shared'

const BASE_SYSTEM_PROMPT = `You are Velora, a crash data intelligence assistant. You help users understand crash data, find patterns, locate attorneys, and make informed decisions after car accidents.

Key behaviors:
- Always use the available tools to fetch real data before answering
- Present data clearly with context and actionable insights
- Be empathetic when discussing crashes involving injuries or fatalities
- Never provide legal advice - suggest consulting an attorney for legal questions
- Cite data sources and note limitations when relevant
- For intersection queries, provide the danger score and safety context
- For attorney searches, highlight their Index score and review dimensions
- For trend analysis, describe patterns and anomalies in the data

Available capabilities:
- searchCrashes: Search crash records by state, city, severity, type, and date range
- getIntersectionStats: Analyze crash patterns near a geographic location
- findAttorneys: Find top-rated personal injury attorneys by location
- getTrends: Analyze crash trends over time by various periods`

type StructuredSearchResponse =
  | {
      kind: 'text'
      text: string
    }
  | {
      kind: 'tool'
      text: string
      toolName: 'searchCrashes' | 'findAttorneys' | 'getTrends'
      args: Record<string, unknown>
      result: Record<string, unknown>
    }

const STATE_MATCHERS = [...STATE_CATALOG].sort((a, b) => b.name.length - a.name.length)
const OPEN_ENDED_SEARCH_CHECK_TTL_MS = 5 * 60 * 1000
const OPEN_ENDED_SEARCH_LIMITED_MESSAGE =
  'Open-ended AI answers are temporarily limited right now. I can still help with state-based crash searches, attorney lookups, and trend analysis. Try "Find top-rated personal injury attorneys in PA", "Show me fatal crashes in Pennsylvania this year", or "What are crash trends by day of week in New York?".'

let openEndedSearchHealth:
  | {
      available: boolean
      checkedAt: number
    }
  | null = null

export async function POST(req: Request) {
  try {
    const { messages } = await req.json()

    const lastUserMessage = [...messages].reverse().find((m: { role: string }) => m.role === 'user')
    const userText = getUserText(lastUserMessage)

    const structuredResponse = await resolveStructuredSearch(userText)
    if (structuredResponse) {
      return createStructuredSearchResponse(structuredResponse)
    }

    if (!(await canServeOpenEndedSearch())) {
      return createStructuredSearchResponse({
        kind: 'text',
        text: OPEN_ENDED_SEARCH_LIMITED_MESSAGE,
      })
    }

    const detected = detectPersona(userText)
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
      onError: ({ error }) => {
        console.error('Search stream failed', error)
      },
    })

    return result.toDataStreamResponse({
      getErrorMessage: () => 'Search failed.',
    })
  } catch (error) {
    console.error('Search route initialization failed', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    const isProviderConfigError = message.includes('No AI provider available')

    return Response.json(
      {
        error: isProviderConfigError
          ? 'Search is not configured. Set an AI provider key for the web app.'
          : 'Search failed.',
        details: process.env.NODE_ENV === 'production' ? undefined : message,
      },
      { status: isProviderConfigError ? 503 : 500 },
    )
  }
}

async function canServeOpenEndedSearch(): Promise<boolean> {
  const now = Date.now()
  if (openEndedSearchHealth && now - openEndedSearchHealth.checkedAt < OPEN_ENDED_SEARCH_CHECK_TTL_MS) {
    return openEndedSearchHealth.available
  }

  try {
    await generateText({
      model: getModel('standard'),
      prompt: 'Reply with the single word OK.',
      maxTokens: 5,
      temperature: 0,
    })

    openEndedSearchHealth = { available: true, checkedAt: now }
    return true
  } catch (error) {
    const activeProvider = getActiveProvider()
    if (activeProvider) {
      recordProviderFailure(activeProvider)
    }

    console.error('Open-ended search availability check failed', error)
    openEndedSearchHealth = { available: false, checkedAt: now }
    return false
  }
}

async function resolveStructuredSearch(query: string): Promise<StructuredSearchResponse | null> {
  const normalized = query.trim().toLowerCase()
  if (!normalized) {
    return {
      kind: 'text',
      text: 'Ask about crashes, attorneys, or trends in a state, for example "Show me fatal crashes in Pennsylvania this year".',
    }
  }

  if (normalized.includes('intersection')) {
    return {
      kind: 'text',
      text: 'Intersection lookups need a specific point on the map right now. Try a crash, attorney, or trend query with a state.',
    }
  }

  const state = extractState(query)

  if (normalized.includes('attorney') || normalized.includes('lawyer')) {
    if (!state) {
      return {
        kind: 'text',
        text: 'Include a state for attorney searches, for example "Find top-rated personal injury attorneys in PA".',
      }
    }

    const args = {
      stateCode: state.code,
      specialty: detectSpecialty(normalized),
      limit: 5,
    }
    const result = await findAttorneys(args)

    return {
      kind: 'tool',
      text:
        result.total > 0
          ? `Here are the top-ranked attorneys I found in ${state.name}.`
          : `I could not find ranked attorneys in ${state.name} for that search.`,
      toolName: 'findAttorneys',
      args,
      result,
    }
  }

  if (normalized.includes('trend')) {
    if (!state) {
      return {
        kind: 'text',
        text: 'Include a state for trend queries, for example "What are crash trends by day of week in New York?".',
      }
    }

    const args = {
      stateCode: state.code,
      period: detectTrendPeriod(normalized),
      ...extractDateRange(normalized),
    }
    const result = await getTrends(args)

    return {
      kind: 'tool',
      text: `Here are the crash trends for ${state.name}.`,
      toolName: 'getTrends',
      args,
      result,
    }
  }

  if (
    normalized.includes('crash') ||
    normalized.includes('collision') ||
    normalized.includes('accident') ||
    normalized.includes('fatal')
  ) {
    if (!state) {
      return {
        kind: 'text',
        text: 'Include a state for crash searches, for example "How many rear-end collisions happened in California?".',
      }
    }

    const args = {
      stateCode: state.code,
      severity: detectSeverity(normalized),
      crashType: detectCrashType(normalized),
      limit: 10,
      ...extractDateRange(normalized),
    }
    const result = await searchCrashes(args)

    return {
      kind: 'tool',
      text: `I found ${result.total.toLocaleString()} crashes matching that search in ${state.name}.`,
      toolName: 'searchCrashes',
      args,
      result,
    }
  }

  return null
}

function createStructuredSearchResponse(response: StructuredSearchResponse): Response {
  return createDataStreamResponse({
    execute: (dataStream) => {
      dataStream.write(formatDataStreamPart('text', response.text))

      if (response.kind === 'tool') {
        const toolCallId = crypto.randomUUID()
        dataStream.write(
          formatDataStreamPart('tool_call', {
            toolCallId,
            toolName: response.toolName,
            args: response.args,
          }),
        )
        dataStream.write(
          formatDataStreamPart('tool_result', {
            toolCallId,
            result: response.result,
          }),
        )
      }

      dataStream.write(
        formatDataStreamPart('finish_message', {
          finishReason: 'stop',
          usage: { promptTokens: 0, completionTokens: 0 },
        }),
      )
    },
    onError: () => 'Search failed.',
  })
}

function getUserText(message: { content?: unknown; parts?: Array<{ type?: string; text?: string }> } | undefined): string {
  if (!message) return ''
  if (typeof message.content === 'string') return message.content
  if (Array.isArray(message.parts)) {
    return message.parts
      .filter((part) => part?.type === 'text' && typeof part.text === 'string')
      .map((part) => part.text as string)
      .join('\n')
  }
  return ''
}

function extractState(query: string) {
  const normalized = query.toLowerCase()

  for (const state of STATE_MATCHERS) {
    if (new RegExp(`\\b${escapeRegExp(state.name.toLowerCase())}\\b`, 'i').test(normalized)) {
      return state
    }
  }

  for (const state of STATE_MATCHERS) {
    if (new RegExp(`\\b${state.code.toLowerCase()}\\b`, 'i').test(normalized)) {
      return state
    }
  }

  return null
}

function detectSpecialty(query: string): string | undefined {
  if (query.includes('workers compensation')) return 'workers_compensation'
  if (query.includes('truck accident')) return 'truck_accident'
  if (query.includes('car accident')) return 'car_accident'
  if (
    query.includes('personal injury') ||
    query.includes('injury attorney') ||
    query.includes('accident lawyer')
  ) {
    return 'personal_injury'
  }
  return undefined
}

function detectTrendPeriod(query: string): 'month' | 'year' | 'dayOfWeek' | 'hourOfDay' {
  if (query.includes('day of week')) return 'dayOfWeek'
  if (query.includes('hour of day') || query.includes('time of day') || query.includes('hourly')) {
    return 'hourOfDay'
  }
  if (query.includes('by year') || query.includes('yearly')) return 'year'
  return 'month'
}

function detectSeverity(query: string):
  | 'FATAL'
  | 'SUSPECTED_SERIOUS_INJURY'
  | 'SUSPECTED_MINOR_INJURY'
  | 'POSSIBLE_INJURY'
  | 'PROPERTY_DAMAGE_ONLY'
  | undefined {
  if (query.includes('fatal')) return 'FATAL'
  if (query.includes('serious injury')) return 'SUSPECTED_SERIOUS_INJURY'
  if (query.includes('minor injury')) return 'SUSPECTED_MINOR_INJURY'
  if (query.includes('possible injury')) return 'POSSIBLE_INJURY'
  if (query.includes('property damage')) return 'PROPERTY_DAMAGE_ONLY'
  return undefined
}

function detectCrashType(query: string): string | undefined {
  if (query.includes('rear-end') || query.includes('rear end')) return 'FRONT_TO_REAR'
  if (query.includes('head-on') || query.includes('head on')) return 'FRONT_TO_FRONT'
  if (query.includes('angle') || query.includes('t-bone') || query.includes('side impact')) {
    return 'ANGLE'
  }
  if (query.includes('sideswipe')) {
    return query.includes('opposite direction')
      ? 'SIDESWIPE_OPPOSITE_DIRECTION'
      : 'SIDESWIPE_SAME_DIRECTION'
  }
  return undefined
}

function extractDateRange(query: string): { dateFrom?: string; dateTo?: string } {
  const today = new Date()
  const todayText = formatDate(today)

  if (query.includes('this year')) {
    return {
      dateFrom: `${today.getFullYear()}-01-01`,
      dateTo: todayText,
    }
  }

  if (query.includes('last year')) {
    const lastYear = today.getFullYear() - 1
    return {
      dateFrom: `${lastYear}-01-01`,
      dateTo: `${lastYear}-12-31`,
    }
  }

  return {}
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0] ?? ''
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

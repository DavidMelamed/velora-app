/**
 * Persona detection for adaptive AI responses.
 * The system detects user intent and adjusts tone, detail level, and call-to-action.
 */

export type PersonaType = 'victim' | 'family' | 'attorney' | 'researcher' | 'journalist' | 'general'

export interface DetectedPersona {
  type: PersonaType
  confidence: number // 0-1
  signals: string[]  // what triggered detection
}

export interface PersonaConfig {
  type: PersonaType
  tone: string
  detailLevel: 'high' | 'medium' | 'low'
  showSettlementContext: boolean
  showAttorneyMatches: boolean
  callToAction: string
  systemPromptModifier: string
}

const PERSONA_CONFIGS: Record<PersonaType, PersonaConfig> = {
  victim: {
    type: 'victim',
    tone: 'empathetic, empowering, action-oriented',
    detailLevel: 'high',
    showSettlementContext: true,
    showAttorneyMatches: true,
    callToAction: 'Understand your rights and next steps',
    systemPromptModifier:
      'The user was likely involved in this crash. Be empathetic and trauma-informed. Focus on actionable next steps. Never minimize their experience.',
  },
  family: {
    type: 'family',
    tone: 'compassionate, clear, supportive',
    detailLevel: 'high',
    showSettlementContext: true,
    showAttorneyMatches: true,
    callToAction: 'Support resources and legal guidance',
    systemPromptModifier:
      'The user is likely a family member of someone involved. Be compassionate. Focus on support resources and what they can do to help.',
  },
  attorney: {
    type: 'attorney',
    tone: 'professional, data-driven, precise',
    detailLevel: 'high',
    showSettlementContext: true,
    showAttorneyMatches: false,
    callToAction: 'Full case analysis and comparable data',
    systemPromptModifier:
      'The user is likely a legal professional. Provide technical detail, comparable cohort statistics, and liability analysis. Skip basic legal explanations.',
  },
  researcher: {
    type: 'researcher',
    tone: 'analytical, neutral, comprehensive',
    detailLevel: 'high',
    showSettlementContext: false,
    showAttorneyMatches: false,
    callToAction: 'Explore the full dataset',
    systemPromptModifier:
      'The user is conducting research. Focus on data patterns, statistical context, and methodology. Provide source attribution for all claims.',
  },
  journalist: {
    type: 'journalist',
    tone: 'factual, quotable, contextual',
    detailLevel: 'medium',
    showSettlementContext: false,
    showAttorneyMatches: false,
    callToAction: 'Download data and cite sources',
    systemPromptModifier:
      'The user is likely a journalist. Provide quotable facts, trend context, and data source attribution. Highlight newsworthy patterns.',
  },
  general: {
    type: 'general',
    tone: 'clear, informative, accessible',
    detailLevel: 'medium',
    showSettlementContext: false,
    showAttorneyMatches: false,
    callToAction: 'Learn more about crash safety',
    systemPromptModifier: 'Provide a balanced, informative response appropriate for a general audience.',
  },
}

/**
 * Detect persona from user query and context signals.
 * Uses keyword matching and contextual signals - will be enhanced with ML in Phase 5.
 */
export function detectPersona(query: string, signals?: { referrer?: string; hasLocation?: boolean }): DetectedPersona {
  const lowerQuery = query.toLowerCase()
  const detectedSignals: string[] = []

  // Victim signals
  if (/\b(my crash|i was (in|hit|involved)|my accident|happened to me|what should i do)\b/.test(lowerQuery)) {
    detectedSignals.push('first_person_crash_reference')
    return { type: 'victim', confidence: 0.9, signals: detectedSignals }
  }

  // Family signals
  if (/\b(my (son|daughter|mother|father|husband|wife|partner|family)|loved one)\b/.test(lowerQuery)) {
    detectedSignals.push('family_member_reference')
    return { type: 'family', confidence: 0.85, signals: detectedSignals }
  }

  // Attorney signals
  if (/\b(my client|case evaluation|client|case|liability|damages|negligence|statute|tort|deposition)\b/.test(lowerQuery)) {
    detectedSignals.push('legal_terminology')
    return { type: 'attorney', confidence: 0.8, signals: detectedSignals }
  }

  // Researcher signals
  if (/\b(study|dataset|correlation|regression|statistical|methodology|sample size)\b/.test(lowerQuery)) {
    detectedSignals.push('research_terminology')
    return { type: 'researcher', confidence: 0.75, signals: detectedSignals }
  }

  // Journalist signals
  if (/\b(reporting on|public records|trends in|story|report|article|quote|source|interview|press)\b/.test(lowerQuery)) {
    detectedSignals.push('journalism_terminology')
    return { type: 'journalist', confidence: 0.7, signals: detectedSignals }
  }

  // Location-based signals (geofencing)
  if (signals?.hasLocation) {
    detectedSignals.push('user_has_location')
    return { type: 'victim', confidence: 0.6, signals: detectedSignals }
  }

  return { type: 'general', confidence: 0.5, signals: ['no_specific_signals'] }
}

export function getPersonaConfig(personaType: PersonaType): PersonaConfig {
  return PERSONA_CONFIGS[personaType]
}

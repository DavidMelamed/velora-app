'use client'

type PersonaType = 'victim' | 'family' | 'attorney' | 'researcher' | 'journalist' | 'general'

const PERSONA_LABELS: Record<PersonaType, { label: string; color: string }> = {
  victim: { label: 'Crash Victim', color: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
  family: { label: 'Family', color: 'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' },
  attorney: { label: 'Legal Professional', color: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  researcher: { label: 'Researcher', color: 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
  journalist: { label: 'Journalist', color: 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' },
  general: { label: 'General', color: 'bg-gray-50 text-gray-600 dark:bg-gray-800 dark:text-gray-400' },
}

/**
 * Detects persona from message text using simple pattern matching.
 * Mirrors the server-side detectPersona from @velora/ai for UI display.
 */
export function detectPersonaClient(text: string): PersonaType {
  const lower = text.toLowerCase()

  if (/\b(my crash|i was (in|hit|involved)|my accident|happened to me|what should i do)\b/.test(lower)) {
    return 'victim'
  }
  if (/\b(my (son|daughter|mother|father|husband|wife|partner|family)|loved one)\b/.test(lower)) {
    return 'family'
  }
  if (/\b(my client|case evaluation|statute|liability|damages|negligence|tort|deposition)\b/.test(lower)) {
    return 'attorney'
  }
  if (/\b(study|dataset|correlation|regression|statistical|methodology)\b/.test(lower)) {
    return 'researcher'
  }
  if (/\b(reporting on|public records|trends in|story|article|quote|press)\b/.test(lower)) {
    return 'journalist'
  }
  return 'general'
}

interface PersonaBadgeProps {
  persona: PersonaType
  className?: string
}

export function PersonaBadge({ persona, className = '' }: PersonaBadgeProps) {
  if (persona === 'general') return null

  const config = PERSONA_LABELS[persona]

  return (
    <span
      className={[
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-opacity',
        config.color,
        className,
      ].join(' ')}
    >
      {config.label}
    </span>
  )
}

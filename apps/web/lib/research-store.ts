/**
 * Research session persistence layer.
 * All data lives in localStorage — no auth required.
 */

export interface SavedSession {
  id: string
  title: string
  preview: string // first user message
  messageCount: number
  savedAt: string // ISO date
  messages: unknown[] // serialized AI messages
}

export interface ViewedAttorney {
  slug: string
  name: string
  firmName: string | null
  city: string | null
  stateCode: string | null
  indexScore: number | null
  reviewCount: number
  viewedAt: string // ISO date
}

const KEYS = {
  sessions: 'velora:research:sessions',
  viewed: 'velora:research:viewed',
  active: 'velora-search-messages', // existing key from SearchInterface
} as const

const MAX_SESSIONS = 10
const MAX_VIEWED = 20

// ── Sessions ────────────────────────────────────────────────────────────────

export function getSavedSessions(): SavedSession[] {
  try {
    const stored = localStorage.getItem(KEYS.sessions)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

export function saveSession(messages: unknown[]): SavedSession | null {
  if (!messages || messages.length < 2) return null

  const userMessages = (messages as Array<{ role: string; content?: string; parts?: Array<{ type: string; text?: string }> }>)
    .filter((m) => m.role === 'user')

  if (userMessages.length === 0) return null

  const firstUserMsg = userMessages[0]
  const preview = typeof firstUserMsg.content === 'string'
    ? firstUserMsg.content
    : firstUserMsg.parts?.find((p) => p.type === 'text')?.text ?? 'Search session'

  // Generate a short title from the first message
  const title = preview.length > 60 ? preview.slice(0, 57) + '...' : preview

  const session: SavedSession = {
    id: `sess_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    title,
    preview,
    messageCount: messages.length,
    savedAt: new Date().toISOString(),
    messages,
  }

  const existing = getSavedSessions()
  // Don't save duplicates of the same first message within 1 minute
  const isDuplicate = existing.some(
    (s) => s.preview === preview && Date.now() - new Date(s.savedAt).getTime() < 60_000,
  )
  if (isDuplicate) return null

  const updated = [session, ...existing].slice(0, MAX_SESSIONS)
  try {
    localStorage.setItem(KEYS.sessions, JSON.stringify(updated))
  } catch {}

  return session
}

export function deleteSession(id: string): void {
  const sessions = getSavedSessions().filter((s) => s.id !== id)
  try {
    localStorage.setItem(KEYS.sessions, JSON.stringify(sessions))
  } catch {}
}

export function clearAllSessions(): void {
  try {
    localStorage.removeItem(KEYS.sessions)
  } catch {}
}

// ── Viewed Attorneys ────────────────────────────────────────────────────────

export function getViewedAttorneys(): ViewedAttorney[] {
  try {
    const stored = localStorage.getItem(KEYS.viewed)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

export function trackAttorneyView(attorney: Omit<ViewedAttorney, 'viewedAt'>): void {
  const existing = getViewedAttorneys().filter((a) => a.slug !== attorney.slug)
  const updated: ViewedAttorney[] = [
    { ...attorney, viewedAt: new Date().toISOString() },
    ...existing,
  ].slice(0, MAX_VIEWED)

  try {
    localStorage.setItem(KEYS.viewed, JSON.stringify(updated))
  } catch {}
}

export function clearViewedAttorneys(): void {
  try {
    localStorage.removeItem(KEYS.viewed)
  } catch {}
}

// ── Active Session ──────────────────────────────────────────────────────────

export function getActiveMessages(): unknown[] | null {
  try {
    const stored = localStorage.getItem(KEYS.active)
    return stored ? JSON.parse(stored) : null
  } catch {
    return null
  }
}

export function hasActiveSession(): boolean {
  const msgs = getActiveMessages()
  return Array.isArray(msgs) && msgs.length > 0
}

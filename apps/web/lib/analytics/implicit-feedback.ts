/**
 * Implicit feedback tracking — scroll depth, time-on-page, attorney CTR.
 * Sends events to /api/feedback in the background.
 */

const API_BASE = typeof window !== 'undefined'
  ? (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000')
  : ''

function getSessionId(): string {
  if (typeof window === 'undefined') return ''
  let sid = sessionStorage.getItem('velora_session_id')
  if (!sid) {
    sid = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
    sessionStorage.setItem('velora_session_id', sid)
  }
  return sid
}

async function sendFeedback(
  type: string,
  value: Record<string, unknown>,
  crashId?: string,
): Promise<void> {
  try {
    await fetch(`${API_BASE}/api/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type,
        crashId,
        sessionId: getSessionId(),
        value,
      }),
      keepalive: true, // Survive page unload
    })
  } catch {
    // Non-critical — silently fail
  }
}

/**
 * Track scroll depth on the current page.
 * Reports the maximum scroll depth (0-100) when the user leaves or after 60s.
 */
export function trackScrollDepth(crashId?: string): () => void {
  if (typeof window === 'undefined') return () => {}

  let maxDepth = 0
  let reported = false

  function onScroll() {
    const scrollHeight = document.documentElement.scrollHeight - window.innerHeight
    if (scrollHeight <= 0) return
    const currentDepth = Math.min(100, Math.round((window.scrollY / scrollHeight) * 100))
    if (currentDepth > maxDepth) {
      maxDepth = currentDepth
    }
  }

  function report() {
    if (reported || maxDepth === 0) return
    reported = true
    sendFeedback('SCROLL_DEPTH', { maxDepth }, crashId)
  }

  window.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('beforeunload', report)
  const timeout = setTimeout(report, 60_000) // Report after 60s if still on page

  return () => {
    report()
    window.removeEventListener('scroll', onScroll)
    window.removeEventListener('beforeunload', report)
    clearTimeout(timeout)
  }
}

/**
 * Track time spent on page.
 * Reports seconds spent when user leaves.
 */
export function trackTimeOnPage(crashId?: string): () => void {
  if (typeof window === 'undefined') return () => {}

  const startTime = Date.now()
  let reported = false

  function report() {
    if (reported) return
    reported = true
    const seconds = Math.round((Date.now() - startTime) / 1000)
    if (seconds >= 2) {
      // Only report if user spent at least 2 seconds
      sendFeedback('TIME_ON_PAGE', { seconds }, crashId)
    }
  }

  window.addEventListener('beforeunload', report)

  return () => {
    report()
    window.removeEventListener('beforeunload', report)
  }
}

/**
 * Track attorney click-through.
 */
export function trackAttorneyClick(crashId: string, attorneyId: string): void {
  sendFeedback('ATTORNEY_CTR', { attorneyId }, crashId)
}

/**
 * Track search result click.
 */
export function trackSearchClick(query: string, resultId: string): void {
  sendFeedback('SEARCH_CLICK', { query, resultId })
}

export { getSessionId }

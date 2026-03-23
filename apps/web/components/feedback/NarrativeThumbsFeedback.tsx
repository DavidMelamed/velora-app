'use client'

import { useState, useCallback } from 'react'
import { PUBLIC_API_BASE } from '@/lib/public-api-base'

interface NarrativeThumbsFeedbackProps {
  crashId: string
  sessionId: string
}

export function NarrativeThumbsFeedback({ crashId, sessionId }: NarrativeThumbsFeedbackProps) {
  const [submitted, setSubmitted] = useState<'up' | 'down' | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const submitFeedback = useCallback(
    async (thumbs: 'up' | 'down') => {
      if (submitted || isSubmitting) return
      setIsSubmitting(true)

      try {
        const res = await fetch(`${PUBLIC_API_BASE}/api/feedback`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'NARRATIVE_THUMBS',
            crashId,
            sessionId,
            value: { thumbs },
          }),
        })

        if (res.ok) {
          setSubmitted(thumbs)
        }
      } catch {
        // Silently fail — feedback is non-critical
      } finally {
        setIsSubmitting(false)
      }
    },
    [crashId, sessionId, submitted, isSubmitting],
  )

  if (submitted) {
    return (
      <div className="mt-4 flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
        <span>{submitted === 'up' ? '\u2713' : '\u2713'}</span>
        <span>Thanks for your feedback!</span>
      </div>
    )
  }

  return (
    <div className="mt-4 flex items-center gap-3 border-t border-gray-100 pt-3">
      <span className="text-xs text-gray-500">Was this narrative helpful?</span>
      <button
        onClick={() => submitFeedback('up')}
        disabled={isSubmitting}
        className="rounded-md border border-gray-200 px-3 py-1 text-sm text-gray-600 transition-colors hover:border-green-300 hover:bg-green-50 hover:text-green-700 disabled:opacity-50"
        aria-label="Thumbs up"
      >
        Yes
      </button>
      <button
        onClick={() => submitFeedback('down')}
        disabled={isSubmitting}
        className="rounded-md border border-gray-200 px-3 py-1 text-sm text-gray-600 transition-colors hover:border-red-300 hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
        aria-label="Thumbs down"
      >
        No
      </button>
    </div>
  )
}

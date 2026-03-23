'use client'

import { useState, useCallback } from 'react'
import { PUBLIC_API_BASE } from '@/lib/public-api-base'

interface EqualizerUsefulProps {
  crashId: string
  sessionId: string
}

export function EqualizerUseful({ crashId, sessionId }: EqualizerUsefulProps) {
  const [submitted, setSubmitted] = useState<boolean | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const submitFeedback = useCallback(
    async (useful: boolean) => {
      if (submitted !== null || isSubmitting) return
      setIsSubmitting(true)

      try {
        const res = await fetch(`${PUBLIC_API_BASE}/api/feedback`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'EQUALIZER_USEFUL',
            crashId,
            sessionId,
            value: { useful },
          }),
        })

        if (res.ok) {
          setSubmitted(useful)
        }
      } catch {
        // Silently fail — feedback is non-critical
      } finally {
        setIsSubmitting(false)
      }
    },
    [crashId, sessionId, submitted, isSubmitting],
  )

  if (submitted !== null) {
    return (
      <div className="mt-4 flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-700">
        <span>{'\u2713'}</span>
        <span>{submitted ? 'Glad it helped!' : 'Thanks — we\'ll improve this.'}</span>
      </div>
    )
  }

  return (
    <div className="mt-4 flex items-center gap-3 border-t border-gray-100 pt-3">
      <span className="text-xs text-gray-500">Was this Equalizer briefing helpful?</span>
      <button
        onClick={() => submitFeedback(true)}
        disabled={isSubmitting}
        className="rounded-md border border-gray-200 px-3 py-1 text-sm text-gray-600 transition-colors hover:border-green-300 hover:bg-green-50 hover:text-green-700 disabled:opacity-50"
        aria-label="Yes, helpful"
      >
        Yes
      </button>
      <button
        onClick={() => submitFeedback(false)}
        disabled={isSubmitting}
        className="rounded-md border border-gray-200 px-3 py-1 text-sm text-gray-600 transition-colors hover:border-red-300 hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
        aria-label="No, not helpful"
      >
        No
      </button>
    </div>
  )
}

'use client'

import { useState, type ReactNode } from 'react'

interface EmailGateProps {
  children: ReactNode
  crashId?: string
}

export function EmailGate({ children, crashId }: EmailGateProps) {
  const [unlocked, setUnlocked] = useState(false)
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Check localStorage for previous unlock
  if (typeof window !== 'undefined' && !unlocked) {
    const stored = localStorage.getItem('velora_email_captured')
    if (stored) {
      setUnlocked(true)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.includes('@')) {
      setError('Please enter a valid email address')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'
      await fetch(`${apiUrl}/api/leads/email-capture`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, source: 'equalizer', crashId }),
      })

      localStorage.setItem('velora_email_captured', email)
      setUnlocked(true)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (unlocked) {
    return <>{children}</>
  }

  return (
    <div className="relative">
      {/* Blurred preview */}
      <div className="pointer-events-none select-none blur-sm" aria-hidden="true">
        {children}
      </div>

      {/* Overlay */}
      <div className="absolute inset-0 flex items-center justify-center bg-white/80 backdrop-blur-sm dark:bg-gray-900/80">
        <div className="mx-4 w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-lg dark:border-gray-700 dark:bg-gray-800">
          <h3 className="text-center text-lg font-bold text-gray-900 dark:text-white">
            Unlock Your Full Crash Report
          </h3>
          <p className="mt-2 text-center text-sm text-gray-500 dark:text-gray-400">
            Enter your email to view settlement ranges, liability analysis, and matched attorneys.
          </p>

          <form onSubmit={handleSubmit} className="mt-4 space-y-3">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />

            {error && (
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? 'Unlocking...' : 'View Full Report'}
            </button>

            <p className="text-center text-xs text-gray-400">
              Free. No spam. Unsubscribe anytime.
            </p>
          </form>
        </div>
      </div>
    </div>
  )
}

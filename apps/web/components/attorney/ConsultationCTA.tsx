'use client'

import { useState } from 'react'
import { PUBLIC_API_BASE } from '@/lib/public-api-base'

interface ConsultationCTAProps {
  attorneyId: string
  attorneyName: string
}

export function ConsultationCTA({ attorneyId, attorneyName }: ConsultationCTAProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    const form = e.currentTarget
    const formData = new FormData(form)

    try {
      const res = await fetch(`${PUBLIC_API_BASE}/api/leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attorneyId,
          name: formData.get('name'),
          phone: formData.get('phone'),
          email: formData.get('email') || undefined,
          message: formData.get('message') || undefined,
          source: 'attorney_profile',
        }),
      })

      if (!res.ok) throw new Error('Failed to submit')
      setSubmitted(true)
    } catch {
      setError('Something went wrong. Please try again or call the attorney directly.')
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="rounded-lg border-2 border-green-200 bg-green-50 p-6 text-center dark:border-green-800 dark:bg-green-900/20">
        <div className="text-2xl">&#10003;</div>
        <h3 className="mt-2 text-lg font-semibold text-green-800 dark:text-green-200">Request Sent!</h3>
        <p className="mt-1 text-sm text-green-700 dark:text-green-300">
          {attorneyName} will receive your consultation request shortly.
        </p>
      </div>
    )
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="w-full rounded-lg bg-blue-600 px-6 py-3 text-base font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
      >
        Request Free Consultation
      </button>
    )
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <h3 className="mb-3 text-base font-semibold text-gray-900 dark:text-white">
        Request a Free Consultation
      </h3>
      <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
        {attorneyName} will be notified of your request.
      </p>

      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          name="name"
          type="text"
          required
          placeholder="Your name"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
        />
        <input
          name="phone"
          type="tel"
          required
          placeholder="Phone number"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
        />
        <input
          name="email"
          type="email"
          placeholder="Email (optional)"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
        />
        <textarea
          name="message"
          placeholder="Briefly describe your situation (optional)"
          rows={3}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
        />

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        )}

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? 'Sending...' : 'Send Request'}
          </button>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400"
          >
            Cancel
          </button>
        </div>

        <p className="text-xs text-gray-400">
          By submitting, you agree to be contacted by this attorney. This is not legal advice.
        </p>
      </form>
    </div>
  )
}

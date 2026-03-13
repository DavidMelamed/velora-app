'use client'

import { useState } from 'react'

interface IWasInThisCrashProps {
  crashId: string
  isVerified?: boolean
}

type Step = 'confirm' | 'details' | 'thankyou'

export function IWasInThisCrash({ crashId, isVerified }: IWasInThisCrashProps) {
  const [step, setStep] = useState<Step>('confirm')
  const [role, setRole] = useState('')
  const [description, setDescription] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (isVerified) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3">
        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-green-500 text-xs text-white">
          ✓
        </span>
        <span className="text-sm font-medium text-green-800">
          Verified by a person involved in this crash
        </span>
      </div>
    )
  }

  const handleConfirm = () => {
    setStep('details')
  }

  const handleSubmit = async () => {
    setIsSubmitting(true)
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'
      await fetch(`${apiUrl}/api/crashes/${crashId}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: role || undefined,
          description: description || undefined,
        }),
      })
      setStep('thankyou')
    } catch {
      // Still show thank you — we do not want to frustrate a crash victim
      setStep('thankyou')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSkipDetails = async () => {
    setIsSubmitting(true)
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'
      await fetch(`${apiUrl}/api/crashes/${crashId}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
    } catch {
      // Ignore — still show thank you
    }
    setIsSubmitting(false)
    setStep('thankyou')
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6">
      {step === 'confirm' && (
        <div className="text-center">
          <h3 className="text-lg font-semibold text-gray-900">
            Were you involved in this crash?
          </h3>
          <p className="mt-2 text-sm text-gray-500">
            Your confirmation helps us verify crash data and provide better
            information for everyone.
          </p>
          <button
            onClick={handleConfirm}
            className="mt-4 rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            I was in this crash
          </button>
        </div>
      )}

      {step === 'details' && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            Optional Details
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            This information is optional and helps improve our data. No personal
            information is stored.
          </p>

          <div className="mt-4 space-y-4">
            <div>
              <label
                htmlFor="role"
                className="block text-sm font-medium text-gray-700"
              >
                Your role in the crash
              </label>
              <select
                id="role"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">Prefer not to say</option>
                <option value="driver">Driver</option>
                <option value="passenger">Passenger</option>
                <option value="pedestrian">Pedestrian</option>
                <option value="cyclist">Cyclist</option>
                <option value="witness">Witness</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="description"
                className="block text-sm font-medium text-gray-700"
              >
                Anything to add? (optional)
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Any details that might help (road conditions, what happened, etc.)"
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="mt-4 flex gap-3">
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex-1 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {isSubmitting ? 'Submitting...' : 'Submit'}
            </button>
            <button
              onClick={handleSkipDetails}
              disabled={isSubmitting}
              className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Skip
            </button>
          </div>
        </div>
      )}

      {step === 'thankyou' && (
        <div className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
            <span className="text-xl text-green-600">✓</span>
          </div>
          <h3 className="mt-3 text-lg font-semibold text-gray-900">
            Thank you
          </h3>
          <p className="mt-2 text-sm text-gray-500">
            Your confirmation has been recorded. This helps verify crash data
            for everyone.
          </p>
          <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
            <p className="text-sm font-medium text-blue-800">
              Get your free Crash Equalizer briefing
            </p>
            <p className="mt-1 text-xs text-blue-600">
              See comparable crashes, liability signals, and settlement context
              — the same information insurance companies use.
            </p>
            <a
              href={`/crashes/${crashId}#equalizer`}
              className="mt-2 inline-block rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              View Equalizer
            </a>
          </div>
        </div>
      )}
    </div>
  )
}

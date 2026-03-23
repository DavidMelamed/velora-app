"use client"

import { useState } from "react"
import { PUBLIC_API_BASE } from "@/lib/public-api-base"

interface IWasInThisCrashProps {
  crashId: string
  isVerified?: boolean
}

type Step = "initial" | "details" | "thankyou"

export function IWasInThisCrash({ crashId, isVerified }: IWasInThisCrashProps) {
  const [step, setStep] = useState<Step>("initial")
  const [role, setRole] = useState("")
  const [description, setDescription] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [resultVerified, setResultVerified] = useState(isVerified || false)

  if (resultVerified && step === "initial") {
    return (
      <div className="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-green-500 text-xs text-white">
            V
          </span>
          <span className="text-sm font-semibold text-green-800">
            Verified by community
          </span>
        </div>
      </div>
    )
  }

  const handleConfirm = () => setStep("details")

  const handleSubmit = async () => {
    setIsSubmitting(true)
    try {
      const res = await fetch(`${PUBLIC_API_BASE}/api/crashes/${crashId}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, description }),
      })
      const data = await res.json()
      if (data.isVerified) setResultVerified(true)
      setStep("thankyou")
    } catch {
      setStep("thankyou")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSkipDetails = async () => {
    setIsSubmitting(true)
    try {
      await fetch(`${PUBLIC_API_BASE}/api/crashes/${crashId}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
      setStep("thankyou")
    } catch {
      setStep("thankyou")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="mt-6 rounded-xl border border-blue-100 bg-blue-50 p-6">
      {step === "initial" && (
        <div className="text-center">
          <h3 className="text-lg font-semibold text-gray-900">
            Were you involved in this crash?
          </h3>
          <p className="mt-1 text-sm text-gray-600">
            Help verify this report and connect with resources.
          </p>
          <button
            onClick={handleConfirm}
            className="mt-4 rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
          >
            I Was In This Crash
          </button>
        </div>
      )}

      {step === "details" && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            Optional: Share Details
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            This helps improve our data accuracy.
          </p>
          <div className="mt-4 space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Your role
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 text-sm"
              >
                <option value="">Select...</option>
                <option value="driver">Driver</option>
                <option value="passenger">Passenger</option>
                <option value="pedestrian">Pedestrian</option>
                <option value="witness">Witness</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Anything to add?
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="Optional details..."
                className="mt-1 block w-full rounded-md border-gray-300 text-sm"
              />
            </div>
          </div>
          <div className="mt-4 flex gap-3">
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {isSubmitting ? "Submitting..." : "Submit"}
            </button>
            <button
              onClick={handleSkipDetails}
              disabled={isSubmitting}
              className="rounded-lg border border-gray-300 px-5 py-2 text-sm text-gray-600 hover:bg-gray-50"
            >
              Skip
            </button>
          </div>
        </div>
      )}

      {step === "thankyou" && (
        <div className="text-center">
          <h3 className="text-lg font-semibold text-green-800">
            Thank you for confirming
          </h3>
          <p className="mt-1 text-sm text-gray-600">
            Your input helps make crash data more accurate for everyone.
          </p>
          <div className="mt-4 rounded-lg border border-blue-200 bg-white p-4">
            <p className="text-sm font-medium text-gray-900">
              Get your personalized Crash Equalizer briefing
            </p>
            <p className="mt-1 text-xs text-gray-500">
              See comparable crashes, settlement estimates, and attorney recommendations.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

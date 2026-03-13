'use client'

import { useCopilotReadable, useCopilotAction } from '@copilotkit/react-core'
import { CopilotSidebar } from '@copilotkit/react-ui'
import '@copilotkit/react-ui/styles.css'

interface CrashData {
  id: string
  crashDate: string
  location: string
  severity: string | null
  stateCode: string
  county: string | null
  mannerOfCollision: string | null
  vehicleCount: number
  personCount: number
  latitude: number | null
  longitude: number | null
}

interface CrashPageSidebarProps {
  crash: CrashData
}

export function CrashPageSidebar({ crash }: CrashPageSidebarProps) {
  // Expose crash context to the AI assistant
  useCopilotReadable({
    description: 'The crash record currently being viewed by the user',
    value: {
      crashId: crash.id,
      date: crash.crashDate,
      location: crash.location,
      severity: crash.severity,
      state: crash.stateCode,
      county: crash.county,
      collisionType: crash.mannerOfCollision,
      vehicleCount: crash.vehicleCount,
      personCount: crash.personCount,
      coordinates: crash.latitude && crash.longitude
        ? { lat: crash.latitude, lng: crash.longitude }
        : null,
    },
  })

  // Action: Find similar crashes
  useCopilotAction({
    name: 'findSimilarCrashes',
    description: 'Search for crashes similar to the one being viewed, based on severity, location, collision type, and other factors.',
    parameters: [
      {
        name: 'radius',
        type: 'number',
        description: 'Search radius in miles (default: 10)',
        required: false,
      },
      {
        name: 'maxResults',
        type: 'number',
        description: 'Maximum number of similar crashes to return (default: 10)',
        required: false,
      },
    ],
    handler: async ({ radius = 10, maxResults = 10 }) => {
      // TODO: Call API endpoint to find similar crashes
      // POST /api/crashes/similar with crash context + parameters
      const response = await fetch('/api/crashes/similar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          crashId: crash.id,
          radius,
          maxResults,
        }),
      })

      if (!response.ok) {
        return { error: 'Failed to find similar crashes. The API may not be available yet.' }
      }

      return response.json()
    },
  })

  // Action: Generate Equalizer briefing
  useCopilotAction({
    name: 'generateEqualizer',
    description: 'Generate or retrieve the Crash Equalizer briefing for this crash, showing comparable crashes, liability signals, settlement context, and attorney recommendations.',
    parameters: [],
    handler: async () => {
      // TODO: Call Equalizer API endpoint
      const response = await fetch(`/api/equalizer/${crash.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      if (!response.ok) {
        return { error: 'Failed to generate Equalizer briefing. The API may not be available yet.' }
      }

      return response.json()
    },
  })

  return (
    <CopilotSidebar
      defaultOpen={false}
      labels={{
        title: 'Crash Assistant',
        initial: `I can help you understand this crash report. Ask me about similar crashes, liability factors, or what steps to take next.`,
        placeholder: 'Ask about this crash...',
      }}
      clickOutsideToClose
    />
  )
}

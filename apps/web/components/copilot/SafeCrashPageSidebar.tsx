'use client'

import React, { useEffect, useState } from 'react'

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

/**
 * Safely loads CrashPageSidebar only when CopilotKit is available.
 * Renders nothing if CopilotKit fails to load or isn't configured.
 */
export function SafeCrashPageSidebar({ crash }: { crash: CrashData }) {
  const [SidebarComponent, setSidebarComponent] = useState<React.ComponentType<{ crash: CrashData }> | null>(null)

  useEffect(() => {
    // Only try to load the sidebar if CopilotKit runtime exists
    fetch('/api/copilot', { method: 'HEAD' })
      .then((res) => {
        if (res.ok || res.status === 405) {
          return import('./CrashPageSidebar').then((mod) => {
            setSidebarComponent(() => mod.CrashPageSidebar)
          })
        }
      })
      .catch(() => {
        // CopilotKit not available — render nothing
      })
  }, [])

  if (!SidebarComponent) return null

  return <SidebarComponent crash={crash} />
}

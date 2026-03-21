'use client'

import { useEffect } from 'react'
import { trackScrollDepth, trackTimeOnPage } from '@/lib/analytics/implicit-feedback'

interface CrashPageFeedbackTrackerProps {
  crashId: string
}

/**
 * Invisible client component that tracks implicit feedback signals
 * (scroll depth and time on page) for a crash page.
 */
export function CrashPageFeedbackTracker({ crashId }: CrashPageFeedbackTrackerProps) {
  useEffect(() => {
    const cleanupScroll = trackScrollDepth(crashId)
    const cleanupTime = trackTimeOnPage(crashId)

    return () => {
      cleanupScroll()
      cleanupTime()
    }
  }, [crashId])

  return null
}

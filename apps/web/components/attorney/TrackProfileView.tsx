'use client'

import { useEffect } from 'react'
import { trackAttorneyView } from '@/lib/research-store'

interface TrackProfileViewProps {
  slug: string
  name: string
  firmName: string | null
  city: string | null
  stateCode: string | null
  indexScore: number | null
  reviewCount: number
}

/**
 * Invisible component that records an attorney profile view in localStorage.
 */
export function TrackProfileView(props: TrackProfileViewProps) {
  useEffect(() => {
    trackAttorneyView(props)
  }, [props.slug]) // eslint-disable-line react-hooks/exhaustive-deps

  return null
}

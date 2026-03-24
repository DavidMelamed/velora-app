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
    trackAttorneyView({
      slug: props.slug,
      name: props.name,
      firmName: props.firmName,
      city: props.city,
      stateCode: props.stateCode,
      indexScore: props.indexScore,
      reviewCount: props.reviewCount,
    })
  }, [props.slug, props.name, props.firmName, props.city, props.stateCode, props.indexScore, props.reviewCount])

  return null
}

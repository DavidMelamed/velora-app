'use client'

import { cn } from '@/lib/utils'

interface CrashMapProps {
  latitude: number | null | undefined
  longitude: number | null | undefined
  className?: string
}

/**
 * Simple crash location display.
 * Uses a static map placeholder with coordinates.
 * Can be upgraded to react-leaflet when needed.
 */
export function CrashMap({ latitude, longitude, className }: CrashMapProps) {
  if (!latitude || !longitude) {
    return (
      <div
        className={cn(
          'flex items-center justify-center rounded-lg border border-gray-200 bg-gray-50 p-8',
          className
        )}
      >
        <p className="text-sm text-gray-400">Location data not available</p>
      </div>
    )
  }

  // OpenStreetMap static tile URL for the location
  const zoom = 14
  const tileUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${longitude - 0.01},${latitude - 0.01},${longitude + 0.01},${latitude + 0.01}&layer=mapnik&marker=${latitude},${longitude}`

  return (
    <div className={cn('overflow-hidden rounded-lg border border-gray-200', className)}>
      <div className="relative">
        <iframe
          title="Crash location map"
          src={tileUrl}
          className="h-64 w-full border-0"
          loading="lazy"
          referrerPolicy="no-referrer"
        />
      </div>
      <div className="flex items-center justify-between bg-gray-50 px-4 py-2">
        <p className="text-xs text-gray-500">
          {latitude.toFixed(4)}, {longitude.toFixed(4)}
        </p>
        <a
          href={`https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=${zoom}/${latitude}/${longitude}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-blue-600 hover:underline"
        >
          Open in map
        </a>
      </div>
    </div>
  )
}

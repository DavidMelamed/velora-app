import { prisma } from '@velora/db'
import type { Episode, EpisodeType as PrismaEpisodeType } from '@velora/db'
import { EpisodeType } from '@velora/shared'
import type { EpisodeCreateInput } from '@velora/shared'

/**
 * Ingest a new episode into a matter.
 * Episodes are the raw building blocks — every interaction, visit, call, or document.
 */
export async function ingestEpisode(
  matterId: string,
  input: EpisodeCreateInput
): Promise<Episode> {
  const matter = await prisma.matter.findUnique({ where: { id: matterId } })
  if (!matter) {
    throw new Error(`Matter not found: ${matterId}`)
  }

  const episode = await prisma.episode.create({
    data: {
      matterId,
      type: input.type as PrismaEpisodeType,
      title: input.title ?? null,
      textContent: input.textContent ?? null,
      mediaUrl: input.mediaUrl ?? null,
      mediaType: input.mediaType ?? null,
      metadata: (input.metadata as unknown as import('@velora/db').Prisma.InputJsonValue) ?? undefined,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      locationName: input.locationName ?? null,
      occurredAt: new Date(input.occurredAt),
      duration: input.duration ?? null,
      isProcessed: false,
    },
  })

  // Update matter last activity
  await prisma.matter.update({
    where: { id: matterId },
    data: { lastActivityAt: new Date() },
  })

  return episode
}

/**
 * Ingest a location visit episode (from geofencing).
 */
export async function ingestLocationVisit(
  matterId: string,
  visit: {
    latitude: number
    longitude: number
    locationName?: string
    providerName?: string
    enteredAt: string
    exitedAt: string
  }
): Promise<Episode> {
  const enteredAt = new Date(visit.enteredAt)
  const exitedAt = new Date(visit.exitedAt)
  const durationSeconds = Math.round((exitedAt.getTime() - enteredAt.getTime()) / 1000)
  const displayName = visit.providerName || visit.locationName || 'Location visit'

  return ingestEpisode(matterId, {
    type: EpisodeType.LOCATION_VISIT,
    title: `Visit to ${displayName}`,
    latitude: visit.latitude,
    longitude: visit.longitude,
    locationName: displayName,
    occurredAt: visit.enteredAt,
    duration: durationSeconds,
    metadata: {
      enteredAt: visit.enteredAt,
      exitedAt: visit.exitedAt,
      providerName: visit.providerName,
    },
  })
}

/**
 * Ingest a voice note episode (from mobile recorder).
 */
export async function ingestVoiceNote(
  matterId: string,
  mediaUrl: string,
  transcription: string,
  durationSeconds: number
): Promise<Episode> {
  const title =
    transcription.length > 60
      ? transcription.slice(0, 60) + '...'
      : transcription

  return ingestEpisode(matterId, {
    type: EpisodeType.VOICE_NOTE,
    title,
    textContent: transcription,
    mediaUrl,
    mediaType: 'audio/m4a',
    occurredAt: new Date().toISOString(),
    duration: durationSeconds,
  })
}

/**
 * Ingest a photo episode (from evidence camera).
 */
export async function ingestPhoto(
  matterId: string,
  mediaUrl: string,
  exif: Record<string, unknown>
): Promise<Episode> {
  // Extract GPS from EXIF if present
  const latitude = exif.GPSLatitude as number | undefined
  const longitude = exif.GPSLongitude as number | undefined
  const timestamp = exif.DateTimeOriginal as string | undefined

  return ingestEpisode(matterId, {
    type: EpisodeType.PHOTO,
    title: 'Photo evidence',
    mediaUrl,
    mediaType: 'image/jpeg',
    latitude,
    longitude,
    occurredAt: timestamp || new Date().toISOString(),
    metadata: exif,
  })
}

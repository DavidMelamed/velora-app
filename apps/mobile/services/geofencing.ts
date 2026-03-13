/**
 * Geofencing Service
 * Background crash proximity detection using expo-location + expo-task-manager
 */

import * as Location from 'expo-location'
import * as TaskManager from 'expo-task-manager'
import { api } from '../lib/api'
import { sendCrashProximityNotification } from './notifications'

// Task name constant for the background geofence task
export const GEOFENCE_TASK = 'VELORA_GEOFENCE_TASK'

// Trigger radius in meters
export const GEOFENCE_RADIUS = 200

// Minimum time between location updates (ms)
const LOCATION_UPDATE_INTERVAL = 60_000

// Minimum distance change to trigger update (meters)
const LOCATION_UPDATE_DISTANCE = 50

export interface GeofenceAlert {
  id: string
  crashId: string
  location: string
  severity: string | null
  distance: number
  timestamp: string
  latitude: number
  longitude: number
}

// In-memory alert history (persisted in AsyncStorage in production)
let alertHistory: GeofenceAlert[] = []

/**
 * Get stored alert history
 */
export function getAlertHistory(): GeofenceAlert[] {
  return [...alertHistory].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  )
}

/**
 * Add an alert to history
 */
export function addAlert(alert: GeofenceAlert): void {
  // Deduplicate by crashId within last hour
  const oneHourAgo = Date.now() - 60 * 60 * 1000
  const isDuplicate = alertHistory.some(
    (a) =>
      a.crashId === alert.crashId &&
      new Date(a.timestamp).getTime() > oneHourAgo
  )
  if (!isDuplicate) {
    alertHistory = [alert, ...alertHistory].slice(0, 100) // Keep last 100
  }
}

/**
 * Clear alert history
 */
export function clearAlertHistory(): void {
  alertHistory = []
}

/**
 * Calculate distance between two coordinates (Haversine formula)
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000 // Earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

/**
 * Request location permissions
 */
export async function requestLocationPermissions(): Promise<{
  foreground: boolean
  background: boolean
}> {
  const { status: foregroundStatus } =
    await Location.requestForegroundPermissionsAsync()
  if (foregroundStatus !== 'granted') {
    return { foreground: false, background: false }
  }

  const { status: backgroundStatus } =
    await Location.requestBackgroundPermissionsAsync()

  return {
    foreground: true,
    background: backgroundStatus === 'granted',
  }
}

/**
 * Get current location
 */
export async function getCurrentLocation(): Promise<Location.LocationObject | null> {
  const { status } = await Location.getForegroundPermissionsAsync()
  if (status !== 'granted') return null

  return await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  })
}

/**
 * Start background location tracking for geofencing
 */
export async function startGeofencing(): Promise<boolean> {
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(GEOFENCE_TASK)
    if (isRegistered) {
      return true
    }

    const { status } = await Location.getBackgroundPermissionsAsync()
    if (status !== 'granted') {
      return false
    }

    await Location.startLocationUpdatesAsync(GEOFENCE_TASK, {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: LOCATION_UPDATE_INTERVAL,
      distanceInterval: LOCATION_UPDATE_DISTANCE,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: 'Velora',
        notificationBody: 'Monitoring for nearby crash sites',
        notificationColor: '#2563eb',
      },
    })

    return true
  } catch {
    return false
  }
}

/**
 * Stop background location tracking
 */
export async function stopGeofencing(): Promise<void> {
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(GEOFENCE_TASK)
    if (isRegistered) {
      await Location.stopLocationUpdatesAsync(GEOFENCE_TASK)
    }
  } catch {
    // Silently fail
  }
}

/**
 * Define the background task handler
 * Call this at app startup (outside of component tree)
 */
export function defineGeofenceTask(): void {
  TaskManager.defineTask(GEOFENCE_TASK, async ({ data, error }) => {
    if (error) {
      console.error('[Geofence] Task error:', error.message)
      return
    }

    if (!data) return

    const locationData = data as { locations: Location.LocationObject[] }
    const locations = locationData.locations

    if (!locations || locations.length === 0) return

    const latestLocation = locations[locations.length - 1]
    if (!latestLocation) return

    const { latitude, longitude } = latestLocation.coords

    try {
      const response = await api.getNearbyCrashes(latitude, longitude, GEOFENCE_RADIUS)

      if (response.crashes && response.crashes.length > 0) {
        for (const crash of response.crashes) {
          const distance = crash.latitude && crash.longitude
            ? calculateDistance(latitude, longitude, crash.latitude, crash.longitude)
            : 0

          const alert: GeofenceAlert = {
            id: `${crash.id}-${Date.now()}`,
            crashId: crash.id,
            location: crash.location,
            severity: crash.severity,
            distance: Math.round(distance),
            timestamp: new Date().toISOString(),
            latitude: crash.latitude || latitude,
            longitude: crash.longitude || longitude,
          }

          addAlert(alert)
          await sendCrashProximityNotification(alert)
        }
      }
    } catch (err) {
      console.error('[Geofence] Failed to check nearby crashes:', err)
    }
  })
}

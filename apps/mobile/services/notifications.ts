/**
 * Push Notification Service
 * Handles expo-notifications setup and crash alert delivery
 */

import type { GeofenceAlert } from './geofencing'

// Notification types
export enum NotificationType {
  NEARBY_CRASH = 'NEARBY_CRASH',
  DEADLINE_REMINDER = 'DEADLINE_REMINDER',
  CRASH_UPDATE = 'CRASH_UPDATE',
  EQUALIZER_READY = 'EQUALIZER_READY',
}

export interface CrashNotificationPayload {
  type: NotificationType
  crashId?: string
  title: string
  body: string
  data?: Record<string, string>
}

/**
 * Register for push notifications
 * Returns the Expo push token or null
 */
export async function registerForPushNotifications(): Promise<string | null> {
  try {
    const Notifications = require('expo-notifications') as typeof import('expo-notifications')
    const Device = require('expo-device') as typeof import('expo-device')

    if (!Device.isDevice) {
      console.warn('[Notifications] Push notifications require a physical device')
      return null
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync()
    let finalStatus = existingStatus

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync()
      finalStatus = status
    }

    if (finalStatus !== 'granted') {
      return null
    }

    const tokenResponse = await Notifications.getExpoPushTokenAsync()
    return tokenResponse.data
  } catch {
    console.warn('[Notifications] expo-notifications not available')
    return null
  }
}

/**
 * Configure notification handler (call at app startup)
 */
export function configureNotificationHandler(): void {
  try {
    const Notifications = require('expo-notifications') as typeof import('expo-notifications')

    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    })
  } catch {
    // expo-notifications not available
  }
}

/**
 * Schedule a local notification for crash proximity
 */
export async function sendCrashProximityNotification(
  alert: GeofenceAlert
): Promise<void> {
  try {
    const Notifications = require('expo-notifications') as typeof import('expo-notifications')

    await Notifications.scheduleNotificationAsync({
      content: {
        title: `Crash site nearby (${alert.distance}m)`,
        body: alert.location || 'A crash was reported near your location',
        data: {
          type: NotificationType.NEARBY_CRASH,
          crashId: alert.crashId,
          latitude: String(alert.latitude),
          longitude: String(alert.longitude),
        },
        sound: true,
      },
      trigger: null, // Immediate
    })
  } catch {
    console.warn('[Notifications] Failed to send crash proximity notification')
  }
}

/**
 * Schedule a deadline reminder notification
 */
export async function sendDeadlineReminder(
  crashId: string,
  daysRemaining: number,
  stateCode: string
): Promise<void> {
  try {
    const Notifications = require('expo-notifications') as typeof import('expo-notifications')

    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Statute of Limitations Reminder',
        body: `${daysRemaining} days remaining to file a claim in ${stateCode}. Don't miss your deadline.`,
        data: {
          type: NotificationType.DEADLINE_REMINDER,
          crashId,
          stateCode,
        },
        sound: true,
      },
      trigger: null,
    })
  } catch {
    console.warn('[Notifications] Failed to send deadline reminder')
  }
}

/**
 * Notify that an Equalizer briefing is ready
 */
export async function sendEqualizerReadyNotification(
  crashId: string,
  location: string
): Promise<void> {
  try {
    const Notifications = require('expo-notifications') as typeof import('expo-notifications')

    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Crash Equalizer Ready',
        body: `Your personalized crash briefing for ${location} is ready to view.`,
        data: {
          type: NotificationType.EQUALIZER_READY,
          crashId,
        },
        sound: true,
      },
      trigger: null,
    })
  } catch {
    console.warn('[Notifications] Failed to send equalizer ready notification')
  }
}

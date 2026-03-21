import { useEffect } from 'react'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { configureNotificationHandler, registerForPushNotifications } from '../services/notifications'
import { defineGeofenceTask } from '../services/geofencing'

// Define background tasks outside component tree
defineGeofenceTask()

// Configure notification handler
configureNotificationHandler()

export default function RootLayout() {
  useEffect(() => {
    // Register for push notifications on mount
    registerForPushNotifications().then((token) => {
      if (token) {
        console.log('[Velora] Push token:', token)
        const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000'
        fetch(`${apiUrl}/api/push-token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, platform: 'expo' }),
        }).catch((err) => console.warn('[Velora] Failed to register push token:', err))
      }
    })
  }, [])

  return (
    <>
      <StatusBar style="auto" />
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="scan"
          options={{
            title: 'Scan Report',
            presentation: 'modal',
          }}
        />
      </Stack>
    </>
  )
}

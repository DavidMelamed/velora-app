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
        // TODO: Send token to backend for server-side push
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

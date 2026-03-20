import React, { useState } from 'react'
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { useRouter } from 'expo-router'
import { colors, spacing, fontSize, borderRadius } from '../lib/theme'
import { api } from '../lib/api'

type Step = 'hero' | 'location' | 'notifications' | 'creating'

export default function OnboardingScreen() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('hero')
  const [locationGranted, setLocationGranted] = useState(false)
  const [notifGranted, setNotifGranted] = useState(false)

  const requestLocation = async () => {
    try {
      const Location = require('expo-location')
      const { status } = await Location.requestForegroundPermissionsAsync()
      setLocationGranted(status === 'granted')
    } catch {
      // Permission module not available
    }
    setStep('notifications')
  }

  const requestNotifications = async () => {
    try {
      const Notifications = require('expo-notifications')
      const { status } = await Notifications.requestPermissionsAsync()
      setNotifGranted(status === 'granted')
    } catch {
      // Permission module not available
    }
    setStep('creating')
    await createMatter()
  }

  const createMatter = async () => {
    try {
      const matter = await api.createMatter({})
      // Store matterId for use by case and chat screens
      const AsyncStorage = require('@react-native-async-storage/async-storage').default
      await AsyncStorage.setItem('velora_matter_id', matter.id)
      await AsyncStorage.setItem('velora_onboarded', 'true')
      router.replace('/(tabs)/case' as any)
    } catch (err) {
      console.error('Failed to create matter:', err)
      // Navigate anyway so user isn't stuck
      router.replace('/(tabs)' as any)
    }
  }

  return (
    <View style={styles.container}>
      {step === 'hero' && (
        <View style={styles.content}>
          <Text style={styles.logo}>Velora</Text>
          <Text style={styles.heroText}>
            We help you get more money by automatically logging everything that helps your lawyer
            tell the most complete story possible.
          </Text>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => setStep('location')}
            activeOpacity={0.7}
          >
            <Text style={styles.primaryButtonText}>Get Started</Text>
          </TouchableOpacity>
        </View>
      )}

      {step === 'location' && (
        <View style={styles.content}>
          <Text style={styles.stepIcon}>📍</Text>
          <Text style={styles.stepTitle}>Location Access</Text>
          <Text style={styles.stepDescription}>
            We use your location to automatically detect relevant events and log them to your
            case timeline.
          </Text>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={requestLocation}
            activeOpacity={0.7}
          >
            <Text style={styles.primaryButtonText}>Enable Location</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.skipButton}
            onPress={() => setStep('notifications')}
            activeOpacity={0.7}
          >
            <Text style={styles.skipText}>Skip for now</Text>
          </TouchableOpacity>
        </View>
      )}

      {step === 'notifications' && (
        <View style={styles.content}>
          <Text style={styles.stepIcon}>🔔</Text>
          <Text style={styles.stepTitle}>Notifications</Text>
          <Text style={styles.stepDescription}>
            Get reminders for appointments, deadlines, and important case updates so nothing
            falls through the cracks.
          </Text>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={requestNotifications}
            activeOpacity={0.7}
          >
            <Text style={styles.primaryButtonText}>Enable Notifications</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.skipButton}
            onPress={async () => {
              setStep('creating')
              await createMatter()
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.skipText}>Skip for now</Text>
          </TouchableOpacity>
        </View>
      )}

      {step === 'creating' && (
        <View style={styles.content}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.creatingText}>Setting up your case...</Text>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  logo: {
    fontSize: 40,
    fontWeight: '800',
    color: colors.primary,
    marginBottom: spacing.xl,
  },
  heroText: {
    fontSize: fontSize.lg,
    color: colors.text.primary,
    textAlign: 'center',
    lineHeight: 28,
    marginBottom: spacing.xxl,
  },
  stepIcon: {
    fontSize: 56,
    marginBottom: spacing.lg,
  },
  stepTitle: {
    fontSize: fontSize.xxl,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  stepDescription: {
    fontSize: fontSize.md,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: spacing.xl,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.xl,
    width: '100%',
    alignItems: 'center',
  },
  primaryButtonText: {
    color: colors.text.inverse,
    fontSize: fontSize.lg,
    fontWeight: '700',
  },
  skipButton: {
    marginTop: spacing.md,
    padding: spacing.sm,
  },
  skipText: {
    color: colors.text.muted,
    fontSize: fontSize.md,
  },
  creatingText: {
    marginTop: spacing.lg,
    fontSize: fontSize.md,
    color: colors.text.secondary,
  },
})

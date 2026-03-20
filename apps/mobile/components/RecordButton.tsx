import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { colors, fontSize } from '../lib/theme'
import { api } from '../lib/api'

interface RecordButtonProps {
  matterId: string
  onRecordingComplete?: (episode: any) => void
}

type RecordingState = 'idle' | 'recording' | 'processing'

export default function RecordButton({ matterId, onRecordingComplete }: RecordButtonProps) {
  const [state, setState] = useState<RecordingState>('idle')
  const [duration, setDuration] = useState(0)
  const recordingRef = useRef<any>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pulseAnim = useRef(new Animated.Value(1)).current

  useEffect(() => {
    if (state === 'recording') {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.15, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      )
      loop.start()
      return () => loop.stop()
    } else {
      pulseAnim.setValue(1)
    }
  }, [state, pulseAnim])

  const startRecording = useCallback(async () => {
    try {
      const { Audio } = require('expo-av')
      const permission = await Audio.requestPermissionsAsync()
      if (!permission.granted) return

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      })

      const recording = new Audio.Recording()
      await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY)
      await recording.startAsync()
      recordingRef.current = recording
      setState('recording')
      setDuration(0)
      timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000)
    } catch (err) {
      console.error('Failed to start recording:', err)
    }
  }, [])

  const stopRecording = useCallback(async () => {
    if (!recordingRef.current) return
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }

    setState('processing')
    try {
      await recordingRef.current.stopAndUnloadAsync()
      const uri = recordingRef.current.getURI()
      recordingRef.current = null

      // Upload the recording
      const formData = new FormData()
      formData.append('audio', {
        uri,
        type: 'audio/m4a',
        name: 'recording.m4a',
      } as any)
      formData.append('matterId', matterId)

      const response = await fetch(`${api.getBaseUrl()}/api/case/${matterId}/episodes/voice`, {
        method: 'POST',
        body: formData,
        // Don't set Content-Type manually — FormData sets correct boundary automatically
      })
      if (!response.ok) {
        throw new Error(`Upload failed: ${response.status}`)
      }
      const episode = await response.json()
      onRecordingComplete?.(episode)
    } catch (err) {
      console.error('Failed to upload recording:', err)
      try {
        const Alert = require('react-native').Alert
        Alert.alert('Upload Failed', 'Could not upload your recording. Please try again.')
      } catch { /* Alert may not be available */ }
    } finally {
      setState('idle')
      setDuration(0)
    }
  }, [matterId, onRecordingComplete])

  const handlePress = useCallback(() => {
    if (state === 'idle') startRecording()
    else if (state === 'recording') stopRecording()
  }, [state, startRecording, stopRecording])

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  return (
    <View style={styles.container}>
      <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
        <TouchableOpacity
          style={[
            styles.button,
            state === 'recording' && styles.buttonRecording,
            state === 'processing' && styles.buttonProcessing,
          ]}
          onPress={handlePress}
          disabled={state === 'processing'}
          activeOpacity={0.7}
        >
          {state === 'idle' && <Text style={styles.icon}>🎤</Text>}
          {state === 'recording' && (
            <Text style={styles.durationText}>{formatDuration(duration)}</Text>
          )}
          {state === 'processing' && (
            <ActivityIndicator color={colors.text.inverse} size="small" />
          )}
        </TouchableOpacity>
      </Animated.View>
      <Text style={styles.label}>
        {state === 'idle' ? 'Record' : state === 'recording' ? 'Tap to stop' : 'Processing...'}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  button: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  buttonRecording: {
    backgroundColor: colors.error,
  },
  buttonProcessing: {
    backgroundColor: colors.text.muted,
  },
  icon: {
    fontSize: 28,
  },
  durationText: {
    color: colors.text.inverse,
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  label: {
    marginTop: 6,
    fontSize: fontSize.xs,
    color: colors.text.secondary,
  },
})

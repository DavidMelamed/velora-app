import { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Image,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native'
import { useRouter } from 'expo-router'
import { colors, spacing, fontSize, borderRadius } from '../lib/theme'
import { captureReportImage, pickReportImage, processReportImage } from '../services/camera-ocr'
import type { CapturedImage } from '../services/camera-ocr'
import type { OcrResult } from '../lib/api'

type ScanState = 'idle' | 'captured' | 'processing' | 'complete' | 'error'

export default function ScanScreen() {
  const router = useRouter()
  const [state, setState] = useState<ScanState>('idle')
  const [image, setImage] = useState<CapturedImage | null>(null)
  const [result, setResult] = useState<OcrResult | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleCapture = async () => {
    const captured = await captureReportImage()
    if (captured) {
      setImage(captured)
      setState('captured')
    }
  }

  const handlePickFromLibrary = async () => {
    const picked = await pickReportImage()
    if (picked) {
      setImage(picked)
      setState('captured')
    }
  }

  const handleProcess = async () => {
    if (!image) return

    setState('processing')
    setErrorMessage(null)

    try {
      const ocrResult = await processReportImage(image)
      setResult(ocrResult)
      setState(ocrResult.success ? 'complete' : 'error')
      if (!ocrResult.success) {
        setErrorMessage('Could not extract crash data from this image. Try a clearer photo.')
      }
    } catch (err: unknown) {
      setState('error')
      const msg = err && typeof err === 'object' && 'message' in err
        ? (err as { message: string }).message
        : 'Failed to process image. Please try again.'
      setErrorMessage(msg)
    }
  }

  const handleRetry = () => {
    setImage(null)
    setResult(null)
    setErrorMessage(null)
    setState('idle')
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      {state === 'idle' && (
        <View style={styles.captureSection}>
          <Text style={styles.title}>Scan Police Report</Text>
          <Text style={styles.description}>
            Take a photo of your police report and we will extract the crash data
            automatically.
          </Text>

          <Pressable style={styles.primaryButton} onPress={handleCapture}>
            <Text style={styles.primaryButtonText}>Take Photo</Text>
          </Pressable>

          <Pressable style={styles.secondaryButton} onPress={handlePickFromLibrary}>
            <Text style={styles.secondaryButtonText}>Choose from Library</Text>
          </Pressable>
        </View>
      )}

      {state === 'captured' && image && (
        <View style={styles.previewSection}>
          <Image source={{ uri: image.uri }} style={styles.previewImage} />

          <View style={styles.previewActions}>
            <Pressable style={styles.secondaryButton} onPress={handleRetry}>
              <Text style={styles.secondaryButtonText}>Retake</Text>
            </Pressable>
            <Pressable style={styles.primaryButton} onPress={handleProcess}>
              <Text style={styles.primaryButtonText}>Process Report</Text>
            </Pressable>
          </View>
        </View>
      )}

      {state === 'processing' && (
        <View style={styles.processingSection}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.processingText}>
            Analyzing police report...
          </Text>
          <Text style={styles.processingSubtext}>
            This may take a few seconds
          </Text>
        </View>
      )}

      {state === 'complete' && result?.data && (
        <View style={styles.resultSection}>
          <Text style={styles.resultTitle}>Report Extracted</Text>
          <Text style={styles.confidence}>
            Confidence: {Math.round(result.confidence * 100)}%
          </Text>

          {result.data.location && (
            <ResultField label="Location" value={result.data.location} />
          )}
          {result.data.crashDate && (
            <ResultField label="Date" value={result.data.crashDate} />
          )}
          {result.data.severity && (
            <ResultField label="Severity" value={result.data.severity} />
          )}
          {result.data.mannerOfCollision && (
            <ResultField label="Collision Type" value={result.data.mannerOfCollision} />
          )}

          <Pressable
            style={[styles.primaryButton, { marginTop: spacing.lg }]}
            onPress={() => {
              Alert.alert('Saved', 'Crash data has been saved.')
              router.back()
            }}
          >
            <Text style={styles.primaryButtonText}>Save & Continue</Text>
          </Pressable>

          <Pressable style={styles.secondaryButton} onPress={handleRetry}>
            <Text style={styles.secondaryButtonText}>Scan Another</Text>
          </Pressable>
        </View>
      )}

      {state === 'error' && (
        <View style={styles.errorSection}>
          <Text style={styles.errorTitle}>Processing Failed</Text>
          <Text style={styles.errorText}>{errorMessage}</Text>

          <Pressable style={styles.primaryButton} onPress={handleRetry}>
            <Text style={styles.primaryButtonText}>Try Again</Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
  )
}

function ResultField({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.resultField}>
      <Text style={styles.resultLabel}>{label}</Text>
      <Text style={styles.resultValue}>{value}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    flexGrow: 1,
  },
  captureSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
  },
  title: {
    fontSize: fontSize.xxl,
    fontWeight: '700',
    color: colors.text.primary,
    textAlign: 'center',
  },
  description: {
    fontSize: fontSize.md,
    color: colors.text.secondary,
    textAlign: 'center',
    maxWidth: 300,
    marginBottom: spacing.lg,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    width: '100%',
  },
  primaryButtonText: {
    color: colors.text.inverse,
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: colors.surface,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    width: '100%',
  },
  secondaryButtonText: {
    color: colors.text.primary,
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  previewSection: {
    alignItems: 'center',
    gap: spacing.md,
  },
  previewImage: {
    width: '100%',
    height: 400,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.surface,
  },
  previewActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    width: '100%',
  },
  processingSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
  },
  processingText: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: colors.text.primary,
  },
  processingSubtext: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
  },
  resultSection: {
    gap: spacing.sm,
  },
  resultTitle: {
    fontSize: fontSize.xxl,
    fontWeight: '700',
    color: colors.text.primary,
  },
  confidence: {
    fontSize: fontSize.sm,
    color: colors.success,
    fontWeight: '600',
    marginBottom: spacing.md,
  },
  resultField: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  resultLabel: {
    fontSize: fontSize.xs,
    color: colors.text.muted,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  resultValue: {
    fontSize: fontSize.md,
    color: colors.text.primary,
    marginTop: 2,
  },
  errorSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
  },
  errorTitle: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.error,
  },
  errorText: {
    fontSize: fontSize.md,
    color: colors.text.secondary,
    textAlign: 'center',
    maxWidth: 300,
    marginBottom: spacing.lg,
  },
})

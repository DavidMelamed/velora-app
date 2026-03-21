import { useState, useCallback } from 'react'
import {
  View, Text, StyleSheet, Pressable, ActivityIndicator, ScrollView,
} from 'react-native'
import { colors, spacing, fontSize, borderRadius } from '../lib/theme'
import {
  captureReportImage, processReportImage, validateOcrResult,
} from '../services/camera-ocr'
import type { OcrResult } from '../lib/api'

type ScanState = 'idle' | 'processing' | 'results' | 'error'

export default function ScanScreen() {
  const [scanState, setScanState] = useState<ScanState>('idle')
  const [ocrResult, setOcrResult] = useState<OcrResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleCapture = useCallback(async () => {
    const image = await captureReportImage()
    if (!image) return

    setScanState('processing')
    setError(null)
    try {
      const result = await processReportImage(image)
      setOcrResult(result)
      if (result.success) { setScanState('results') }
      else { setError('Could not extract data. Try again.'); setScanState('error') }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'OCR failed'
      setError(message); setScanState('error')
    }
  }, [])

  const handleRetry = useCallback(() => {
    setOcrResult(null); setError(null); setScanState('idle')
  }, [])

  const validation = ocrResult ? validateOcrResult(ocrResult) : null

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {scanState === 'idle' && (
        <View style={styles.startContainer}>
          <Text style={styles.title}>Scan Police Report</Text>
          <Text style={styles.description}>
            Take a photo of your police report and our AI will extract crash details.
          </Text>
          <Pressable style={styles.captureButton} onPress={handleCapture}>
            <Text style={styles.captureButtonText}>Open Camera</Text>
          </Pressable>
        </View>
      )}
      {scanState === 'processing' && (
        <View style={styles.processingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.processingTitle}>Processing Report...</Text>
        </View>
      )}
      {scanState === 'results' && ocrResult?.data && (
        <View style={styles.resultsContainer}>
          <Text style={styles.resultsTitle}>Extracted Data</Text>
          <View style={styles.dataFields}>
            {ocrResult.data.crashDate && <DataField label="Date" value={ocrResult.data.crashDate} />}
            {ocrResult.data.location && <DataField label="Location" value={ocrResult.data.location} />}
            {ocrResult.data.stateCode && <DataField label="State" value={ocrResult.data.stateCode} />}
            {ocrResult.data.severity && <DataField label="Severity" value={ocrResult.data.severity} />}
          </View>
          <Pressable style={styles.captureButton} onPress={handleRetry}>
            <Text style={styles.captureButtonText}>Scan Another</Text>
          </Pressable>
        </View>
      )}
      {scanState === 'error' && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Scan Failed</Text>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.captureButton} onPress={handleRetry}>
            <Text style={styles.captureButtonText}>Try Again</Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
  )
}

function DataField({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.dataField}>
      <Text style={styles.dataFieldLabel}>{label}</Text>
      <Text style={styles.dataFieldValue}>{value}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, flexGrow: 1 },
  startContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: fontSize.xxl, fontWeight: '700', color: colors.text.primary, textAlign: 'center' },
  description: { fontSize: fontSize.md, color: colors.text.secondary, textAlign: 'center', marginTop: spacing.sm, maxWidth: 300 },
  captureButton: { backgroundColor: colors.primary, paddingVertical: spacing.md, paddingHorizontal: spacing.xl, borderRadius: borderRadius.lg, alignItems: 'center', marginTop: spacing.xl, width: '100%', maxWidth: 300 },
  captureButtonText: { color: colors.text.inverse, fontSize: fontSize.md, fontWeight: '600' },
  processingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.md },
  processingTitle: { fontSize: fontSize.lg, fontWeight: '600', color: colors.text.primary },
  resultsContainer: { gap: spacing.md },
  resultsTitle: { fontSize: fontSize.xl, fontWeight: '700', color: colors.text.primary },
  dataFields: { gap: spacing.sm },
  dataField: { backgroundColor: colors.surface, borderRadius: borderRadius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  dataFieldLabel: { fontSize: fontSize.xs, fontWeight: '600', color: colors.text.muted, textTransform: 'uppercase' },
  dataFieldValue: { fontSize: fontSize.md, color: colors.text.primary, marginTop: 2 },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.md },
  errorTitle: { fontSize: fontSize.lg, fontWeight: '600', color: colors.error },
  errorText: { fontSize: fontSize.sm, color: colors.text.secondary, textAlign: 'center', maxWidth: 280 },
})

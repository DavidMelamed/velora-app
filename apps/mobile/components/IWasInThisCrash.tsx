import { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ActivityIndicator,
} from 'react-native'
import { colors, spacing, fontSize, borderRadius } from '../lib/theme'
import { api } from '../lib/api'

interface IWasInThisCrashProps {
  crashId: string
  isVerified?: boolean
}

type Step = 'confirm' | 'details' | 'thankyou'

const ROLES = [
  { label: 'Driver', value: 'driver' },
  { label: 'Passenger', value: 'passenger' },
  { label: 'Pedestrian', value: 'pedestrian' },
  { label: 'Cyclist', value: 'cyclist' },
  { label: 'Witness', value: 'witness' },
]

export function IWasInThisCrash({ crashId, isVerified }: IWasInThisCrashProps) {
  const [step, setStep] = useState<Step>('confirm')
  const [selectedRole, setSelectedRole] = useState<string | null>(null)
  const [description, setDescription] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (isVerified) {
    return (
      <View style={styles.verifiedBanner}>
        <Text style={styles.verifiedIcon}>✓</Text>
        <Text style={styles.verifiedText}>
          Verified by a person involved in this crash
        </Text>
      </View>
    )
  }

  const handleConfirm = () => {
    setStep('details')
  }

  const handleSubmit = async () => {
    setIsSubmitting(true)
    try {
      await api.confirmCrash(crashId, {
        role: selectedRole || undefined,
        description: description || undefined,
      })
    } catch {
      // Still show thank you
    }
    setIsSubmitting(false)
    setStep('thankyou')
  }

  const handleSkip = async () => {
    setIsSubmitting(true)
    try {
      await api.confirmCrash(crashId)
    } catch {
      // Ignore
    }
    setIsSubmitting(false)
    setStep('thankyou')
  }

  return (
    <View style={styles.container}>
      {step === 'confirm' && (
        <View style={styles.centered}>
          <Text style={styles.title}>Were you involved in this crash?</Text>
          <Text style={styles.subtitle}>
            Your confirmation helps verify crash data for everyone.
          </Text>
          <Pressable style={styles.primaryButton} onPress={handleConfirm}>
            <Text style={styles.primaryButtonText}>I was in this crash</Text>
          </Pressable>
        </View>
      )}

      {step === 'details' && (
        <View>
          <Text style={styles.title}>Optional Details</Text>
          <Text style={styles.subtitle}>
            This helps improve our data. No personal information is stored.
          </Text>

          <Text style={styles.label}>Your role</Text>
          <View style={styles.roleRow}>
            {ROLES.map((role) => (
              <Pressable
                key={role.value}
                style={[
                  styles.roleChip,
                  selectedRole === role.value && styles.roleChipSelected,
                ]}
                onPress={() =>
                  setSelectedRole(
                    selectedRole === role.value ? null : role.value
                  )
                }
              >
                <Text
                  style={[
                    styles.roleChipText,
                    selectedRole === role.value && styles.roleChipTextSelected,
                  ]}
                >
                  {role.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>Anything to add? (optional)</Text>
          <TextInput
            style={styles.textArea}
            value={description}
            onChangeText={setDescription}
            placeholder="Road conditions, what happened, etc."
            placeholderTextColor={colors.text.muted}
            multiline
            numberOfLines={3}
          />

          <View style={styles.buttonRow}>
            <Pressable
              style={[styles.primaryButton, { flex: 1 }]}
              onPress={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color={colors.text.inverse} size="small" />
              ) : (
                <Text style={styles.primaryButtonText}>Submit</Text>
              )}
            </Pressable>
            <Pressable
              style={[styles.secondaryButton, { flex: 0 }]}
              onPress={handleSkip}
              disabled={isSubmitting}
            >
              <Text style={styles.secondaryButtonText}>Skip</Text>
            </Pressable>
          </View>
        </View>
      )}

      {step === 'thankyou' && (
        <View style={styles.centered}>
          <View style={styles.checkCircle}>
            <Text style={styles.checkMark}>✓</Text>
          </View>
          <Text style={styles.title}>Thank you</Text>
          <Text style={styles.subtitle}>
            Your confirmation has been recorded.
          </Text>

          <View style={styles.equalizerCta}>
            <Text style={styles.equalizerTitle}>
              Get your free Crash Equalizer
            </Text>
            <Text style={styles.equalizerSubtitle}>
              See comparable crashes, liability signals, and settlement context.
            </Text>
          </View>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  centered: {
    alignItems: 'center',
  },
  title: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: colors.text.primary,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    textAlign: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: colors.text.inverse,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: colors.text.primary,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  label: {
    fontSize: fontSize.sm,
    fontWeight: '500',
    color: colors.text.primary,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  roleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  roleChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  roleChipSelected: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  roleChipText: {
    fontSize: fontSize.xs,
    color: colors.text.secondary,
  },
  roleChipTextSelected: {
    color: colors.primary,
    fontWeight: '600',
  },
  textArea: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    fontSize: fontSize.sm,
    color: colors.text.primary,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  checkCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#dcfce7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  checkMark: {
    fontSize: 20,
    color: colors.success,
  },
  equalizerCta: {
    backgroundColor: colors.primaryLight,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    width: '100%',
  },
  equalizerTitle: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: '#1e40af',
  },
  equalizerSubtitle: {
    fontSize: fontSize.xs,
    color: '#3b82f6',
    marginTop: 2,
  },
  verifiedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#dcfce7',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    padding: spacing.md,
    gap: spacing.sm,
  },
  verifiedIcon: {
    fontSize: 14,
    color: colors.text.inverse,
    backgroundColor: colors.success,
    width: 20,
    height: 20,
    borderRadius: 10,
    textAlign: 'center',
    lineHeight: 20,
    overflow: 'hidden',
  },
  verifiedText: {
    fontSize: fontSize.sm,
    fontWeight: '500',
    color: '#166534',
    flex: 1,
  },
})

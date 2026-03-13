import { useState } from "react"
import { View, Text, StyleSheet, Pressable, TextInput } from "react-native"
import { colors, spacing, fontSize, borderRadius } from "../lib/theme"
import { api } from "../lib/api"

interface IWasInThisCrashProps {
  crashId: string
  isVerified?: boolean
}

type Step = "initial" | "details" | "thankyou"

export function IWasInThisCrash({ crashId, isVerified }: IWasInThisCrashProps) {
  const [step, setStep] = useState<Step>("initial")
  const [role, setRole] = useState("")
  const [description, setDescription] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [resultVerified, setResultVerified] = useState(isVerified || false)

  if (resultVerified && step === "initial") {
    return (
      <View style={styles.verifiedBadge}>
        <Text style={styles.verifiedText}>Verified by community</Text>
      </View>
    )
  }

  const handleSubmit = async () => {
    setIsSubmitting(true)
    try {
      const result = await api.confirmCrash(crashId, { role, description })
      if (result.isVerified) setResultVerified(true)
      setStep("thankyou")
    } catch {
      setStep("thankyou")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <View style={styles.container}>
      {step === "initial" && (
        <View style={styles.centerContent}>
          <Text style={styles.title}>Were you involved in this crash?</Text>
          <Text style={styles.subtitle}>Help verify this report and connect with resources.</Text>
          <Pressable style={styles.primaryButton} onPress={() => setStep("details")}>
            <Text style={styles.primaryButtonText}>I Was In This Crash</Text>
          </Pressable>
        </View>
      )}

      {step === "details" && (
        <View>
          <Text style={styles.title}>Optional: Share Details</Text>
          <Text style={styles.subtitle}>This helps improve our data accuracy.</Text>
          <TextInput
            style={styles.input}
            placeholder="Your role (driver, passenger, witness...)"
            placeholderTextColor={colors.text.muted}
            value={role}
            onChangeText={setRole}
          />
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Anything to add? (optional)"
            placeholderTextColor={colors.text.muted}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={3}
          />
          <View style={styles.buttonRow}>
            <Pressable
              style={[styles.primaryButton, isSubmitting && styles.disabled]}
              onPress={handleSubmit}
              disabled={isSubmitting}
            >
              <Text style={styles.primaryButtonText}>
                {isSubmitting ? "Submitting..." : "Submit"}
              </Text>
            </Pressable>
            <Pressable
              style={styles.secondaryButton}
              onPress={handleSubmit}
              disabled={isSubmitting}
            >
              <Text style={styles.secondaryButtonText}>Skip</Text>
            </Pressable>
          </View>
        </View>
      )}

      {step === "thankyou" && (
        <View style={styles.centerContent}>
          <Text style={styles.thankYouTitle}>Thank you for confirming</Text>
          <Text style={styles.subtitle}>
            Your input helps make crash data more accurate for everyone.
          </Text>
          <View style={styles.ctaCard}>
            <Text style={styles.ctaTitle}>Get your Crash Equalizer briefing</Text>
            <Text style={styles.ctaSubtitle}>
              See comparable crashes, settlement estimates, and attorney recommendations.
            </Text>
          </View>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.primaryLight,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginTop: spacing.md,
  },
  centerContent: { alignItems: "center" },
  title: { fontSize: fontSize.lg, fontWeight: "600", color: colors.text.primary },
  subtitle: { fontSize: fontSize.sm, color: colors.text.secondary, marginTop: spacing.xs, textAlign: "center" },
  primaryButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.lg,
    marginTop: spacing.md,
  },
  primaryButtonText: { color: colors.text.inverse, fontWeight: "600", fontSize: fontSize.sm },
  secondaryButton: {
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.lg,
    marginTop: spacing.md,
  },
  secondaryButtonText: { color: colors.text.secondary, fontSize: fontSize.sm },
  disabled: { opacity: 0.5 },
  input: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginTop: spacing.sm,
    fontSize: fontSize.sm,
    color: colors.text.primary,
  },
  textArea: { minHeight: 60, textAlignVertical: "top" },
  buttonRow: { flexDirection: "row", gap: spacing.sm },
  verifiedBadge: {
    backgroundColor: "#dcfce7",
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginTop: spacing.md,
    alignItems: "center",
  },
  verifiedText: { color: "#166534", fontWeight: "600", fontSize: fontSize.sm },
  thankYouTitle: { fontSize: fontSize.lg, fontWeight: "600", color: "#166534" },
  ctaCard: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  ctaTitle: { fontSize: fontSize.sm, fontWeight: "600", color: colors.text.primary },
  ctaSubtitle: { fontSize: fontSize.xs, color: colors.text.secondary, marginTop: spacing.xs },
})

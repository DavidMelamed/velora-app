import { View, Text, StyleSheet } from "react-native"
import { getGuidanceForSeverity } from "@velora/shared"
import type { GuidanceStep } from "@velora/shared"
import { colors, spacing, fontSize, borderRadius } from "../lib/theme"

interface WhatToDoNextProps {
  severity: string | null
}

const priorityColors: Record<string, { bg: string; text: string }> = {
  critical: { bg: "#fee2e2", text: "#991b1b" },
  important: { bg: "#ffedd5", text: "#9a3412" },
  recommended: { bg: "#dbeafe", text: "#1e40af" },
}

export function WhatToDoNext({ severity }: WhatToDoNextProps) {
  const guidance = getGuidanceForSeverity(severity)

  return (
    <View style={styles.container}>
      <Text style={styles.headline}>What To Do Next</Text>
      <Text style={styles.subtitle}>{guidance.urgencyMessage}</Text>

      <View style={styles.stepsContainer}>
        {guidance.steps.map((step, idx) => (
          <StepCard key={idx} step={step} index={idx + 1} />
        ))}
      </View>

      <Text style={styles.disclaimer}>
        This guidance is for informational purposes only and does not constitute legal advice.
      </Text>
    </View>
  )
}

function StepCard({ step, index }: { step: GuidanceStep; index: number }) {
  const pColors = priorityColors[step.priority] || priorityColors.recommended!

  return (
    <View style={styles.stepCard}>
      <View style={styles.stepNumber}>
        <Text style={styles.stepNumberText}>{index}</Text>
      </View>
      <View style={styles.stepContent}>
        <View style={styles.stepHeader}>
          <Text style={styles.stepTitle}>{step.title}</Text>
          <View style={[styles.priorityBadge, { backgroundColor: pColors.bg }]}>
            <Text style={[styles.priorityText, { color: pColors.text }]}>{step.priority}</Text>
          </View>
        </View>
        <Text style={styles.stepDescription}>{step.description}</Text>
        <Text style={styles.stepTimeframe}>{step.timeframe}</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginTop: spacing.lg,
  },
  headline: { fontSize: fontSize.xl, fontWeight: "700", color: colors.text.primary },
  subtitle: { fontSize: fontSize.sm, color: colors.text.secondary, marginTop: spacing.xs },
  stepsContainer: { marginTop: spacing.lg, gap: spacing.md },
  stepCard: { flexDirection: "row", gap: spacing.md },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primaryLight,
    justifyContent: "center",
    alignItems: "center",
  },
  stepNumberText: { fontSize: fontSize.sm, fontWeight: "700", color: colors.primary },
  stepContent: { flex: 1 },
  stepHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" },
  stepTitle: { fontSize: fontSize.md, fontWeight: "600", color: colors.text.primary },
  priorityBadge: { paddingHorizontal: spacing.sm, paddingVertical: 1, borderRadius: borderRadius.full },
  priorityText: { fontSize: fontSize.xs, fontWeight: "600" },
  stepDescription: { fontSize: fontSize.sm, color: colors.text.secondary, marginTop: spacing.xs, lineHeight: 20 },
  stepTimeframe: { fontSize: fontSize.xs, color: colors.text.muted, marginTop: spacing.xs },
  disclaimer: { fontSize: fontSize.xs, color: colors.text.muted, marginTop: spacing.lg, fontStyle: "italic" },
})

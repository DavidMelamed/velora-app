import { useState } from 'react'
import { View, Text, StyleSheet, Pressable } from 'react-native'
import { getGuidanceForSeverity } from '@velora/shared'
import type { GuidanceStep } from '@velora/shared'
import { colors, spacing, fontSize, borderRadius } from '../lib/theme'

interface WhatToDoNextProps {
  severity: string | null | undefined
}

const priorityColors: Record<string, { bg: string; border: string; text: string; badge: string; badgeText: string }> = {
  critical: {
    bg: '#fef2f2',
    border: '#fecaca',
    text: '#991b1b',
    badge: '#dc2626',
    badgeText: '#ffffff',
  },
  important: {
    bg: '#fffbeb',
    border: '#fde68a',
    text: '#92400e',
    badge: '#f59e0b',
    badgeText: '#ffffff',
  },
  recommended: {
    bg: '#eff6ff',
    border: '#bfdbfe',
    text: '#1e40af',
    badge: '#3b82f6',
    badgeText: '#ffffff',
  },
}

export function WhatToDoNext({ severity }: WhatToDoNextProps) {
  const guidance = getGuidanceForSeverity(severity)
  const [expandedIndex, setExpandedIndex] = useState<number | null>(0)

  return (
    <View style={styles.container}>
      <Text style={styles.title}>What To Do Next</Text>
      <Text style={styles.urgency}>{guidance.urgencyMessage}</Text>

      <View style={styles.stepList}>
        {guidance.steps.map((step, index) => (
          <StepCard
            key={index}
            step={step}
            index={index}
            isExpanded={expandedIndex === index}
            onToggle={() =>
              setExpandedIndex(expandedIndex === index ? null : index)
            }
          />
        ))}
      </View>
    </View>
  )
}

function StepCard({
  step,
  index,
  isExpanded,
  onToggle,
}: {
  step: GuidanceStep
  index: number
  isExpanded: boolean
  onToggle: () => void
}) {
  const pColors = priorityColors[step.priority] || priorityColors.recommended

  return (
    <Pressable
      onPress={onToggle}
      style={[
        styles.stepCard,
        { backgroundColor: pColors.bg, borderColor: pColors.border },
      ]}
    >
      <View style={styles.stepHeader}>
        <View style={styles.stepNumber}>
          <Text style={styles.stepNumberText}>{index + 1}</Text>
        </View>
        <View style={styles.stepContent}>
          <View style={styles.stepTitleRow}>
            <Text style={[styles.stepTitle, { color: pColors.text }]} numberOfLines={2}>
              {step.title}
            </Text>
            <View style={[styles.priorityBadge, { backgroundColor: pColors.badge }]}>
              <Text style={[styles.priorityText, { color: pColors.badgeText }]}>
                {step.priority}
              </Text>
            </View>
          </View>

          {isExpanded && (
            <View style={styles.stepDetails}>
              <Text style={styles.stepDescription}>{step.description}</Text>
              <Text style={styles.stepTimeframe}>{step.timeframe}</Text>
            </View>
          )}
        </View>
      </View>
    </Pressable>
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
  title: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: colors.text.primary,
  },
  urgency: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  stepList: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  stepCard: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    padding: spacing.md,
  },
  stepHeader: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: '#4b5563',
  },
  stepContent: {
    flex: 1,
  },
  stepTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flexWrap: 'wrap',
  },
  stepTitle: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    flex: 1,
  },
  priorityBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 1,
    borderRadius: borderRadius.full,
  },
  priorityText: {
    fontSize: 10,
    fontWeight: '600',
  },
  stepDetails: {
    marginTop: spacing.sm,
  },
  stepDescription: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    lineHeight: 20,
  },
  stepTimeframe: {
    fontSize: fontSize.xs,
    fontWeight: '500',
    color: colors.text.muted,
    marginTop: spacing.xs,
  },
})

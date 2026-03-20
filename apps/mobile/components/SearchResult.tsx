import { View, Text, StyleSheet, Pressable } from 'react-native'
import { useRouter } from 'expo-router'
import { colors, spacing, fontSize, borderRadius, getSeverityColors, getSeverityLabel } from '../lib/theme'
import type { CrashSearchResult } from '../lib/api'

interface SearchResultProps {
  crash: CrashSearchResult
}

export function SearchResult({ crash }: SearchResultProps) {
  const router = useRouter()
  const severityColors = getSeverityColors(crash.severity)
  const severityLabel = getSeverityLabel(crash.severity)

  const formattedDate = new Date(crash.crashDate).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })

  return (
    <Pressable
      style={styles.container}
      onPress={() => {
        // Navigate to crash detail (deep link or webview)
      }}
    >
      <View style={styles.header}>
        <View
          style={[
            styles.severityBadge,
            {
              backgroundColor: severityColors.bg,
              borderColor: severityColors.border,
            },
          ]}
        >
          <Text style={[styles.severityText, { color: severityColors.text }]}>
            {severityLabel}
          </Text>
        </View>
        <Text style={styles.date}>{formattedDate}</Text>
      </View>

      <Text style={styles.location} numberOfLines={2}>
        {crash.location || 'Location unknown'}
      </Text>

      {crash.summary && (
        <Text style={styles.summary} numberOfLines={3}>
          {crash.summary}
        </Text>
      )}

      <View style={styles.footer}>
        <Text style={styles.meta}>
          {crash.vehicleCount} vehicle{crash.vehicleCount !== 1 ? 's' : ''}
        </Text>
        <Text style={styles.metaSep}>·</Text>
        <Text style={styles.meta}>
          {crash.personCount} person{crash.personCount !== 1 ? 's' : ''}
        </Text>
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  severityBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  severityText: {
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  date: {
    fontSize: fontSize.xs,
    color: colors.text.muted,
  },
  location: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  summary: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    lineHeight: 20,
    marginBottom: spacing.sm,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  meta: {
    fontSize: fontSize.xs,
    color: colors.text.muted,
  },
  metaSep: {
    fontSize: fontSize.xs,
    color: colors.text.muted,
    marginHorizontal: spacing.xs,
  },
})

import React, { useState } from 'react'
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { colors, spacing, fontSize, borderRadius } from '../lib/theme'

export interface Confirmation {
  id: string
  prompt: string
  confirmed?: boolean
  sentAt: string
}

interface ConfirmationCardProps {
  confirmation: Confirmation
  onRespond: (id: string, confirmed: boolean) => void
}

export default function ConfirmationCard({ confirmation, onRespond }: ConfirmationCardProps) {
  const [loading, setLoading] = useState(false)

  const handleRespond = async (confirmed: boolean) => {
    setLoading(true)
    try {
      await onRespond(confirmation.id, confirmed)
    } finally {
      setLoading(false)
    }
  }

  return (
    <View style={styles.card}>
      <Text style={styles.prompt}>{confirmation.prompt}</Text>
      {loading ? (
        <ActivityIndicator color={colors.primary} style={styles.loader} />
      ) : (
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.noButton}
            onPress={() => handleRespond(false)}
            activeOpacity={0.7}
          >
            <Text style={styles.noText}>No</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.yesButton}
            onPress={() => handleRespond(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.yesText}>Yes</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    backgroundColor: colors.card,
  },
  prompt: {
    fontSize: fontSize.md,
    color: colors.text.primary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.md,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  noButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.error,
    alignItems: 'center',
  },
  noText: {
    color: colors.error,
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  yesButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  yesText: {
    color: colors.text.inverse,
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  loader: {
    paddingVertical: spacing.sm,
  },
})

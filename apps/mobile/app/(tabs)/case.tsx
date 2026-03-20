import React, { useCallback, useEffect, useState } from 'react'
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { useRouter } from 'expo-router'
import { colors, spacing, fontSize, borderRadius } from '../../lib/theme'
import { api } from '../../lib/api'
import TimelineView, { type TimelineEvent } from '../../components/TimelineView'
import RecordButton from '../../components/RecordButton'
import ConfirmationCard, { type Confirmation } from '../../components/ConfirmationCard'

interface MatterSummary {
  id: string
  status: string
  statuteDeadline: string | null
  clientName?: string
}

export default function CaseScreen() {
  const router = useRouter()
  const [matter, setMatter] = useState<MatterSummary | null>(null)
  const [events, setEvents] = useState<TimelineEvent[]>([])
  const [confirmations, setConfirmations] = useState<Confirmation[]>([])
  const [refreshing, setRefreshing] = useState(false)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    try {
      // Load matterId from AsyncStorage (set during onboarding)
      const AsyncStorage = require('@react-native-async-storage/async-storage').default
      const matterId = await AsyncStorage.getItem('velora_matter_id')
      if (!matterId) {
        setMatter(null)
        return
      }

      const matterRes = await api.getMatter(matterId)
      setMatter(matterRes as MatterSummary)

      const [timelineRes, confirmRes] = await Promise.all([
        api.getCaseTimeline(matterId, 10),
        api.getCaseConfirmations(matterId),
      ])
      setEvents((timelineRes || []) as TimelineEvent[])
      setConfirmations((confirmRes || []) as Confirmation[])
    } catch {
      // No matter yet or API unavailable
      setMatter(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await fetchData()
    setRefreshing(false)
  }, [fetchData])

  const handleConfirmRespond = useCallback(
    async (id: string, confirmed: boolean) => {
      if (!matter) return
      try {
        await api.respondToConfirmation(matter.id, id, confirmed)
        setConfirmations((prev) => prev.filter((c) => c.id !== id))
      } catch (err) {
        console.error('Failed to respond to confirmation:', err)
      }
    },
    [matter]
  )

  const handleRecordingComplete = useCallback(() => {
    fetchData()
  }, [fetchData])

  const daysUntilDeadline = matter?.statuteDeadline
    ? Math.ceil(
        (new Date(matter.statuteDeadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      )
    : null

  if (loading) {
    return (
      <View style={styles.centered}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    )
  }

  if (!matter) {
    return (
      <View style={styles.centered}>
        <Text style={styles.placeholderEmoji}>📋</Text>
        <Text style={styles.placeholderTitle}>No Active Case</Text>
        <Text style={styles.placeholderSubtitle}>
          Start tracking your accident case to build the strongest story for your lawyer.
        </Text>
        <TouchableOpacity
          style={styles.startButton}
          onPress={() => router.push('/onboarding')}
        >
          <Text style={styles.startButtonText}>Get Started</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Status + Deadline */}
      <View style={styles.statusRow}>
        <View style={styles.statusBadge}>
          <Text style={styles.statusText}>{matter.status}</Text>
        </View>
        {daysUntilDeadline !== null && (
          <View
            style={[
              styles.deadlineBadge,
              daysUntilDeadline < 90 && styles.deadlineUrgent,
            ]}
          >
            <Text
              style={[
                styles.deadlineText,
                daysUntilDeadline < 90 && styles.deadlineTextUrgent,
              ]}
            >
              {daysUntilDeadline}d until statute deadline
            </Text>
          </View>
        )}
      </View>

      {/* Quick Actions */}
      <View style={styles.quickActions}>
        <RecordButton matterId={matter.id} onRecordingComplete={handleRecordingComplete} />
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => router.push('/scan' as any)}
          activeOpacity={0.7}
        >
          <Text style={styles.actionIcon}>📷</Text>
          <Text style={styles.actionLabel}>Camera</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => router.push('/(tabs)/chat' as any)}
          activeOpacity={0.7}
        >
          <Text style={styles.actionIcon}>💬</Text>
          <Text style={styles.actionLabel}>Chat</Text>
        </TouchableOpacity>
      </View>

      {/* Pending Confirmations */}
      {confirmations.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pending Confirmations</Text>
          {confirmations.map((c) => (
            <ConfirmationCard
              key={c.id}
              confirmation={c}
              onRespond={handleConfirmRespond}
            />
          ))}
        </View>
      )}

      {/* Recent Activity */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Activity</Text>
        <TimelineView events={events} />
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.md,
  },
  centered: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  loadingText: {
    color: colors.text.muted,
    fontSize: fontSize.md,
  },
  placeholderEmoji: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  placeholderTitle: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  placeholderSubtitle: {
    fontSize: fontSize.md,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.lg,
  },
  startButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
  },
  startButtonText: {
    color: '#FFFFFF',
    fontSize: fontSize.md,
    fontWeight: '600' as const,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  statusBadge: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  statusText: {
    color: colors.primary,
    fontSize: fontSize.xs,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  deadlineBadge: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  deadlineUrgent: {
    backgroundColor: '#fef2f2',
  },
  deadlineText: {
    color: colors.text.secondary,
    fontSize: fontSize.xs,
    fontWeight: '500',
  },
  deadlineTextUrgent: {
    color: colors.error,
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-start',
    paddingVertical: spacing.md,
    marginBottom: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
  },
  actionButton: {
    alignItems: 'center',
  },
  actionIcon: {
    fontSize: 28,
    marginBottom: 6,
  },
  actionLabel: {
    fontSize: fontSize.xs,
    color: colors.text.secondary,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
})

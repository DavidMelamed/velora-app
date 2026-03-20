import React, { useState } from 'react'
import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { colors, spacing, fontSize, borderRadius } from '../lib/theme'

export interface TimelineEvent {
  id: string
  category: 'medical' | 'legal' | 'communication' | 'financial' | 'milestone'
  title: string
  description?: string
  occurredAt: string
  duration?: number
  isGap?: boolean
  gapDays?: number
  episodeId?: string
}

interface TimelineViewProps {
  events: TimelineEvent[]
  onRefresh?: () => void
  refreshing?: boolean
}

const CATEGORY_COLORS: Record<TimelineEvent['category'], string> = {
  medical: '#3B82F6',
  legal: '#8B5CF6',
  communication: '#10B981',
  financial: '#F59E0B',
  milestone: '#EAB308',
}

function relativeTime(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diffMs = now - then
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDay = Math.floor(diffHr / 24)
  if (diffDay < 30) return `${diffDay}d ago`
  const diffMonth = Math.floor(diffDay / 30)
  return `${diffMonth}mo ago`
}

function TimelineItem({ event }: { event: TimelineEvent }) {
  const [expanded, setExpanded] = useState(false)
  const dotColor = CATEGORY_COLORS[event.category] || colors.text.muted

  if (event.isGap) {
    return (
      <View style={styles.gapRow}>
        <View style={styles.lineContainer}>
          <View style={[styles.dashedLine]} />
        </View>
        <View style={styles.gapCard}>
          <Text style={styles.gapText}>
            ⚠️ {event.gapDays}-day gap in activity
          </Text>
          {event.description ? (
            <Text style={styles.gapDescription}>{event.description}</Text>
          ) : null}
        </View>
      </View>
    )
  }

  return (
    <TouchableOpacity
      style={styles.itemRow}
      onPress={() => setExpanded(!expanded)}
      activeOpacity={0.7}
    >
      <View style={styles.lineContainer}>
        <View style={styles.line} />
        <View style={[styles.dot, { backgroundColor: dotColor }]} />
        <View style={styles.line} />
      </View>
      <View style={styles.itemContent}>
        <View style={styles.itemHeader}>
          <Text style={styles.itemTitle} numberOfLines={expanded ? undefined : 1}>
            {event.title}
          </Text>
          <Text style={styles.itemTime}>{relativeTime(event.occurredAt)}</Text>
        </View>
        {expanded && event.description ? (
          <Text style={styles.itemDescription}>{event.description}</Text>
        ) : null}
      </View>
    </TouchableOpacity>
  )
}

export default function TimelineView({ events, onRefresh, refreshing }: TimelineViewProps) {
  if (events.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No activity yet</Text>
      </View>
    )
  }

  return (
    <FlatList
      data={events}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => <TimelineItem event={item} />}
      onRefresh={onRefresh}
      refreshing={refreshing ?? false}
      contentContainerStyle={styles.list}
      showsVerticalScrollIndicator={false}
    />
  )
}

const styles = StyleSheet.create({
  list: {
    paddingVertical: spacing.sm,
  },
  empty: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    color: colors.text.muted,
    fontSize: fontSize.md,
  },
  itemRow: {
    flexDirection: 'row',
    minHeight: 56,
  },
  lineContainer: {
    width: 32,
    alignItems: 'center',
  },
  line: {
    flex: 1,
    width: 2,
    backgroundColor: colors.border,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  dashedLine: {
    flex: 1,
    width: 2,
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: colors.error,
  },
  itemContent: {
    flex: 1,
    paddingLeft: spacing.sm,
    paddingVertical: spacing.sm,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemTitle: {
    flex: 1,
    fontSize: fontSize.md,
    color: colors.text.primary,
    fontWeight: '500',
  },
  itemTime: {
    fontSize: fontSize.xs,
    color: colors.text.muted,
    marginLeft: spacing.sm,
  },
  itemDescription: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    marginTop: spacing.xs,
    lineHeight: 20,
  },
  gapRow: {
    flexDirection: 'row',
    minHeight: 48,
  },
  gapCard: {
    flex: 1,
    marginLeft: spacing.sm,
    marginVertical: spacing.xs,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.error,
    borderStyle: 'dashed',
    borderRadius: borderRadius.md,
    backgroundColor: '#fef2f2',
  },
  gapText: {
    fontSize: fontSize.sm,
    color: colors.error,
    fontWeight: '600',
  },
  gapDescription: {
    fontSize: fontSize.xs,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
})

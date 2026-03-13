import { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
  Alert,
} from 'react-native'
import { colors, spacing, fontSize, borderRadius, getSeverityColors, getSeverityLabel } from '../../lib/theme'
import {
  getAlertHistory,
  clearAlertHistory,
  requestLocationPermissions,
  startGeofencing,
  stopGeofencing,
} from '../../services/geofencing'
import type { GeofenceAlert } from '../../services/geofencing'

export default function AlertsScreen() {
  const [alerts, setAlerts] = useState<GeofenceAlert[]>([])
  const [isGeofencingActive, setIsGeofencingActive] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const loadAlerts = useCallback(() => {
    setAlerts(getAlertHistory())
  }, [])

  useEffect(() => {
    loadAlerts()
  }, [loadAlerts])

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    loadAlerts()
    setRefreshing(false)
  }, [loadAlerts])

  const handleToggleGeofencing = async () => {
    if (isGeofencingActive) {
      await stopGeofencing()
      setIsGeofencingActive(false)
      return
    }

    const permissions = await requestLocationPermissions()

    if (!permissions.foreground) {
      Alert.alert(
        'Location Required',
        'Velora needs location access to alert you when you are near a crash site. Please enable location in Settings.',
      )
      return
    }

    if (!permissions.background) {
      Alert.alert(
        'Background Location',
        'For the best experience, allow background location access so Velora can alert you even when the app is closed.',
      )
    }

    const started = await startGeofencing()
    setIsGeofencingActive(started)

    if (!started) {
      Alert.alert(
        'Geofencing Error',
        'Could not start location monitoring. Please check your permissions and try again.',
      )
    }
  }

  const handleClearHistory = () => {
    Alert.alert(
      'Clear Alert History',
      'Are you sure you want to clear all alerts?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            clearAlertHistory()
            loadAlerts()
          },
        },
      ],
    )
  }

  const renderAlert = ({ item }: { item: GeofenceAlert }) => {
    const severityColors = getSeverityColors(item.severity)
    const severityLabel = getSeverityLabel(item.severity)
    const timeAgo = getTimeAgo(item.timestamp)

    return (
      <View style={styles.alertCard}>
        <View style={styles.alertHeader}>
          <View
            style={[
              styles.severityDot,
              { backgroundColor: severityColors.text },
            ]}
          />
          <Text style={styles.alertSeverity}>{severityLabel}</Text>
          <Text style={styles.alertTime}>{timeAgo}</Text>
        </View>
        <Text style={styles.alertLocation} numberOfLines={2}>
          {item.location || 'Unknown location'}
        </Text>
        <Text style={styles.alertDistance}>
          {item.distance}m from your location
        </Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      {/* Geofencing toggle */}
      <View style={styles.controlBar}>
        <View>
          <Text style={styles.controlTitle}>Proximity Alerts</Text>
          <Text style={styles.controlSubtitle}>
            {isGeofencingActive
              ? 'Monitoring for nearby crash sites'
              : 'Enable to get alerts near crash sites'}
          </Text>
        </View>
        <Pressable
          style={[
            styles.toggleButton,
            isGeofencingActive && styles.toggleButtonActive,
          ]}
          onPress={handleToggleGeofencing}
        >
          <Text
            style={[
              styles.toggleText,
              isGeofencingActive && styles.toggleTextActive,
            ]}
          >
            {isGeofencingActive ? 'ON' : 'OFF'}
          </Text>
        </Pressable>
      </View>

      {/* Alert history */}
      <FlatList
        data={alerts}
        keyExtractor={(item) => item.id}
        renderItem={renderAlert}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>No alerts yet</Text>
            <Text style={styles.emptyText}>
              {isGeofencingActive
                ? 'You will be notified when you are within 200m of a crash site.'
                : 'Enable proximity alerts to get notified near crash sites.'}
            </Text>
          </View>
        }
        ListHeaderComponent={
          alerts.length > 0 ? (
            <View style={styles.listHeader}>
              <Text style={styles.listHeaderText}>Recent Alerts</Text>
              <Pressable onPress={handleClearHistory}>
                <Text style={styles.clearText}>Clear</Text>
              </Pressable>
            </View>
          ) : null
        }
      />
    </View>
  )
}

function getTimeAgo(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  controlBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  controlTitle: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.text.primary,
  },
  controlSubtitle: {
    fontSize: fontSize.xs,
    color: colors.text.secondary,
    marginTop: 2,
  },
  toggleButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.border,
  },
  toggleButtonActive: {
    backgroundColor: colors.success,
  },
  toggleText: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: colors.text.secondary,
  },
  toggleTextActive: {
    color: colors.text.inverse,
  },
  list: {
    padding: spacing.md,
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  listHeaderText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  clearText: {
    fontSize: fontSize.sm,
    color: colors.error,
    fontWeight: '500',
  },
  alertCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  alertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  severityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: spacing.xs,
  },
  alertSeverity: {
    fontSize: fontSize.xs,
    fontWeight: '600',
    color: colors.text.secondary,
    flex: 1,
  },
  alertTime: {
    fontSize: fontSize.xs,
    color: colors.text.muted,
  },
  alertLocation: {
    fontSize: fontSize.md,
    fontWeight: '500',
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  alertDistance: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
  },
  emptyTitle: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: colors.text.primary,
  },
  emptyText: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    marginTop: spacing.xs,
    textAlign: 'center',
    maxWidth: 280,
  },
})

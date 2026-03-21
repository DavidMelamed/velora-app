/**
 * Velora Mobile Theme
 * Severity color palette matching web design system
 */

export const colors = {
  // Severity colors (matching web SeverityBadge)
  severity: {
    fatal: {
      bg: '#334155',       // slate-700
      text: '#f1f5f9',     // slate-100
      border: '#475569',   // slate-600
    },
    serious: {
      bg: '#fee2e2',       // red-100
      text: '#991b1b',     // red-800
      border: '#fecaca',   // red-200
    },
    minor: {
      bg: '#fef3c7',       // amber-100
      text: '#92400e',     // amber-800
      border: '#fde68a',   // amber-200
    },
    possible: {
      bg: '#fef9c3',       // yellow-100
      text: '#854d0e',     // yellow-800
      border: '#fef08a',   // yellow-200
    },
    pdo: {
      bg: '#dcfce7',       // green-100
      text: '#166534',     // green-800
      border: '#bbf7d0',   // green-200
    },
    unknown: {
      bg: '#f3f4f6',       // gray-100
      text: '#374151',     // gray-700
      border: '#e5e7eb',   // gray-200
    },
  },

  // Core palette
  primary: '#2563eb',        // blue-600
  primaryLight: '#dbeafe',   // blue-100
  primaryDark: '#1d4ed8',    // blue-700

  background: '#ffffff',
  surface: '#f9fafb',        // gray-50
  card: '#ffffff',
  border: '#e5e7eb',         // gray-200

  text: {
    primary: '#111827',      // gray-900
    secondary: '#6b7280',    // gray-500
    muted: '#9ca3af',        // gray-400
    inverse: '#ffffff',
  },

  success: '#16a34a',        // green-600
  warning: '#d97706',        // amber-600
  error: '#dc2626',          // red-600
  info: '#2563eb',           // blue-600
} as const

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const

export const fontSize = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const

export const borderRadius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
} as const

/**
 * Map MMUCC severity enum to theme severity key
 */
export function getSeverityColors(severity: string | null | undefined) {
  const key = severity?.toUpperCase() || ''
  if (key === 'FATAL') return colors.severity.fatal
  if (key.includes('SERIOUS')) return colors.severity.serious
  if (key.includes('MINOR')) return colors.severity.minor
  if (key.includes('POSSIBLE')) return colors.severity.possible
  if (key.includes('PROPERTY') || key === 'PDO') return colors.severity.pdo
  return colors.severity.unknown
}

/**
 * Map severity to human-readable label
 */
export function getSeverityLabel(severity: string | null | undefined): string {
  const key = severity?.toUpperCase() || ''
  if (key === 'FATAL') return 'Fatal'
  if (key.includes('SERIOUS')) return 'Serious Injury'
  if (key.includes('MINOR')) return 'Minor Injury'
  if (key.includes('POSSIBLE')) return 'Possible Injury'
  if (key.includes('PROPERTY') || key === 'PDO') return 'Property Damage'
  return 'Unknown'
}

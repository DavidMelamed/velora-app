import React from 'react'

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info'
  size?: 'sm' | 'md'
}

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ variant = 'default', size = 'md', className = '', children, ...props }, ref) => {
    const variantClasses: Record<string, string> = {
      default: 'bg-gray-100 text-gray-800',
      success: 'bg-green-100 text-green-800',
      warning: 'bg-yellow-100 text-yellow-800',
      danger: 'bg-red-100 text-red-800',
      info: 'bg-blue-100 text-blue-800',
    }

    const sizeClasses: Record<string, string> = {
      sm: 'px-2 py-0.5 text-xs',
      md: 'px-2.5 py-1 text-sm',
    }

    return (
      <span
        ref={ref}
        className={`inline-flex items-center rounded-full font-medium ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
        {...props}
      >
        {children}
      </span>
    )
  }
)

Badge.displayName = 'Badge'

/** Convenience: Map crash severity to badge variant */
export function severityToBadgeVariant(severity: string): BadgeProps['variant'] {
  switch (severity) {
    case 'FATAL':
      return 'danger'
    case 'SUSPECTED_SERIOUS_INJURY':
      return 'danger'
    case 'SUSPECTED_MINOR_INJURY':
      return 'warning'
    case 'POSSIBLE_INJURY':
      return 'warning'
    case 'PROPERTY_DAMAGE_ONLY':
      return 'info'
    default:
      return 'default'
  }
}

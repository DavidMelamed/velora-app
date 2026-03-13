import React from 'react'

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'text' | 'circular' | 'rectangular'
  width?: string | number
  height?: string | number
}

export const Skeleton = React.forwardRef<HTMLDivElement, SkeletonProps>(
  ({ variant = 'text', width, height, className = '', style, ...props }, ref) => {
    const variantClasses: Record<string, string> = {
      text: 'rounded h-4',
      circular: 'rounded-full',
      rectangular: 'rounded-md',
    }

    const computedStyle: React.CSSProperties = {
      ...style,
      ...(width ? { width: typeof width === 'number' ? `${width}px` : width } : {}),
      ...(height ? { height: typeof height === 'number' ? `${height}px` : height } : {}),
    }

    return (
      <div
        ref={ref}
        className={`animate-pulse bg-gray-200 ${variantClasses[variant]} ${className}`}
        style={computedStyle}
        aria-hidden="true"
        {...props}
      />
    )
  }
)

Skeleton.displayName = 'Skeleton'

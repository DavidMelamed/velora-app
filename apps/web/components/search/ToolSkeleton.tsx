'use client'

import { cn } from '@/lib/utils'

type ToolType = 'crashSearch' | 'intersectionLookup' | 'attorneySearch' | 'trendAnalysis' | 'default'

interface ToolSkeletonProps {
  toolName: ToolType
  className?: string
}

function Pulse({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={cn('animate-pulse rounded bg-gray-200', className)} style={style} />
}

function CrashSearchSkeleton() {
  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      <div className="border-b border-gray-200 px-4 py-3">
        <Pulse className="h-4 w-32" />
        <div className="mt-2 flex gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Pulse key={i} className="h-3 w-12" />
          ))}
        </div>
      </div>
      <div className="divide-y divide-gray-100">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3">
            <Pulse className="h-3 w-3 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <Pulse className="h-4 w-48" />
              <Pulse className="h-3 w-32" />
            </div>
            <Pulse className="h-5 w-14 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  )
}

function IntersectionSkeleton() {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5">
      <Pulse className="h-5 w-40" />
      <div className="mt-4">
        <div className="flex items-baseline justify-between">
          <Pulse className="h-3 w-20" />
          <Pulse className="h-6 w-8" />
        </div>
        <Pulse className="mt-1.5 h-2.5 w-full rounded-full" />
      </div>
      <div className="mt-4 border-t border-gray-100 pt-4">
        <Pulse className="h-3 w-24" />
        <Pulse className="mt-1 h-8 w-16" />
      </div>
      <div className="mt-4 border-t border-gray-100 pt-4 space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2">
            <Pulse className="h-3 w-14" />
            <Pulse className="h-2 flex-1 rounded-full" />
            <Pulse className="h-3 w-6" />
          </div>
        ))}
      </div>
    </div>
  )
}

function AttorneySkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="flex items-start gap-3">
            <Pulse className="h-14 w-14 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <Pulse className="h-4 w-28" />
              <Pulse className="h-3 w-20" />
              <Pulse className="h-3 w-16" />
            </div>
          </div>
          <Pulse className="mt-3 h-5 w-32 rounded-full" />
          <div className="mt-2 flex gap-1">
            {Array.from({ length: 3 }).map((_, j) => (
              <Pulse key={j} className="h-5 w-16 rounded" />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function TrendSkeleton() {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5">
      <Pulse className="h-4 w-36" />
      <div className="mt-4 flex h-64 items-end gap-2 px-8">
        {Array.from({ length: 12 }).map((_, i) => (
          <Pulse
            key={i}
            className="flex-1 rounded-t"
            style={{ height: `${20 + Math.random() * 70}%` }}
          />
        ))}
      </div>
    </div>
  )
}

function DefaultSkeleton() {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5 space-y-3">
      <Pulse className="h-5 w-40" />
      <Pulse className="h-4 w-full" />
      <Pulse className="h-4 w-3/4" />
      <Pulse className="h-4 w-1/2" />
    </div>
  )
}

const SKELETON_MAP: Record<ToolType, () => React.JSX.Element> = {
  crashSearch: CrashSearchSkeleton,
  intersectionLookup: IntersectionSkeleton,
  attorneySearch: AttorneySkeleton,
  trendAnalysis: TrendSkeleton,
  default: DefaultSkeleton,
}

export function ToolSkeleton({ toolName, className }: ToolSkeletonProps) {
  const SkeletonComponent = SKELETON_MAP[toolName] || SKELETON_MAP.default

  return (
    <div className={cn(className)} role="status" aria-label="Loading...">
      <SkeletonComponent />
    </div>
  )
}

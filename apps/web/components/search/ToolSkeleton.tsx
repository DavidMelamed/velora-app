'use client'

export function ToolSkeleton({ toolName }: { toolName: string }) {
  const labels: Record<string, string> = {
    searchCrashes: 'Searching crash records...',
    getIntersectionStats: 'Analyzing intersection...',
    findAttorneys: 'Finding attorneys...',
    getTrends: 'Computing trends...',
  }

  return (
    <div className="my-3 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800">
      <p className="mb-3 text-sm font-medium text-gray-500 dark:text-gray-400">
        {labels[toolName] ?? 'Processing...'}
      </p>
      <div className="space-y-2">
        <div className="h-5 w-3/4 animate-pulse rounded-md bg-gray-200" aria-hidden="true" />
        <div className="h-5 w-1/2 animate-pulse rounded-md bg-gray-200" aria-hidden="true" />
        <div className="h-5 w-2/3 animate-pulse rounded-md bg-gray-200" aria-hidden="true" />
      </div>
    </div>
  )
}

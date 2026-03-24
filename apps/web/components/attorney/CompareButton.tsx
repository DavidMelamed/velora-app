'use client'

import { useCompare } from './CompareContext'

interface CompareButtonProps {
  slug: string
  compact?: boolean
}

export function CompareButton({ slug, compact }: CompareButtonProps) {
  const { add, remove, has, isFull } = useCompare()
  const isSelected = has(slug)

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        if (isSelected) {
          remove(slug)
        } else if (!isFull) {
          add(slug)
        }
      }}
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
        isSelected
          ? 'border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:border-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
          : isFull
            ? 'cursor-not-allowed border-gray-200 bg-gray-50 text-gray-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-500'
            : 'border-gray-200 bg-white text-gray-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-400 dark:hover:border-blue-700 dark:hover:text-blue-300'
      }`}
      title={isSelected ? 'Remove from comparison' : isFull ? 'Comparison full (max 4)' : 'Add to comparison'}
    >
      {isSelected ? (
        <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
            clipRule="evenodd"
          />
        </svg>
      ) : (
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
      )}
      {!compact && (isSelected ? 'Comparing' : 'Compare')}
    </button>
  )
}

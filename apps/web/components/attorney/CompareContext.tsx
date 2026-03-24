'use client'

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'

const STORAGE_KEY = 'velora:compare'
const MAX_COMPARE = 4

interface CompareContextValue {
  shortlist: string[] // attorney slugs
  add: (slug: string) => void
  remove: (slug: string) => void
  has: (slug: string) => boolean
  clear: () => void
  isFull: boolean
}

const CompareContext = createContext<CompareContextValue>({
  shortlist: [],
  add: () => {},
  remove: () => {},
  has: () => false,
  clear: () => {},
  isFull: false,
})

export function useCompare() {
  return useContext(CompareContext)
}

export function CompareProvider({ children }: { children: ReactNode }) {
  const [shortlist, setShortlist] = useState<string[]>([])

  // Hydrate from localStorage after mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        if (Array.isArray(parsed)) setShortlist(parsed.slice(0, MAX_COMPARE))
      }
    } catch {}
  }, [])

  // Persist on change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(shortlist))
    } catch {}
  }, [shortlist])

  const add = useCallback((slug: string) => {
    setShortlist((prev) => {
      if (prev.includes(slug) || prev.length >= MAX_COMPARE) return prev
      return [...prev, slug]
    })
  }, [])

  const remove = useCallback((slug: string) => {
    setShortlist((prev) => prev.filter((s) => s !== slug))
  }, [])

  const has = useCallback(
    (slug: string) => shortlist.includes(slug),
    [shortlist],
  )

  const clear = useCallback(() => setShortlist([]), [])

  return (
    <CompareContext.Provider value={{ shortlist, add, remove, has, clear, isFull: shortlist.length >= MAX_COMPARE }}>
      {children}
      {shortlist.length > 0 && <CompareFloatingBar />}
    </CompareContext.Provider>
  )
}

function CompareFloatingBar() {
  const { shortlist, clear } = useCompare()
  const compareUrl = `/attorneys/compare?slugs=${shortlist.join(',')}`

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-blue-200 bg-white/95 shadow-lg backdrop-blur-sm dark:border-blue-800 dark:bg-gray-950/95">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700 dark:bg-blue-900 dark:text-blue-300">
            {shortlist.length}
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              {shortlist.length} attorney{shortlist.length !== 1 ? 's' : ''} selected
            </p>
            <p className="text-xs text-gray-500">
              {shortlist.length < 2 ? 'Add at least 2 to compare' : 'Ready to compare'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={clear}
            className="rounded-lg px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            Clear
          </button>
          <a
            href={shortlist.length >= 2 ? compareUrl : undefined}
            className={`rounded-lg px-5 py-2 text-sm font-medium text-white transition-colors ${
              shortlist.length >= 2
                ? 'bg-blue-600 hover:bg-blue-700'
                : 'cursor-not-allowed bg-gray-300 dark:bg-gray-600'
            }`}
            onClick={(e) => {
              if (shortlist.length < 2) e.preventDefault()
            }}
          >
            Compare Now
          </a>
        </div>
      </div>
    </div>
  )
}

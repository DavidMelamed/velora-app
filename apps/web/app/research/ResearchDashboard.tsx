'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  getSavedSessions,
  deleteSession,
  getViewedAttorneys,
  clearViewedAttorneys,
  hasActiveSession,
  clearAllSessions,
  type SavedSession,
  type ViewedAttorney,
} from '@/lib/research-store'
import { useCompare } from '@/components/attorney/CompareContext'

function formatRelativeDate(isoDate: string): string {
  const date = new Date(isoDate)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60_000)
  if (diffMin < 1) return 'Just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHrs = Math.floor(diffMin / 60)
  if (diffHrs < 24) return `${diffHrs}h ago`
  const diffDays = Math.floor(diffHrs / 24)
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}

export function ResearchDashboard() {
  const [sessions, setSessions] = useState<SavedSession[]>([])
  const [viewed, setViewed] = useState<ViewedAttorney[]>([])
  const [hasActive, setHasActive] = useState(false)
  const { shortlist, remove, clear: clearShortlist } = useCompare()

  // Load data from localStorage after mount
  useEffect(() => {
    setSessions(getSavedSessions())
    setViewed(getViewedAttorneys())
    setHasActive(hasActiveSession())
  }, [])

  const handleDeleteSession = useCallback((id: string) => {
    deleteSession(id)
    setSessions(getSavedSessions())
  }, [])

  const handleClearSessions = useCallback(() => {
    clearAllSessions()
    setSessions([])
  }, [])

  const handleClearViewed = useCallback(() => {
    clearViewedAttorneys()
    setViewed([])
  }, [])

  const isEmpty = sessions.length === 0 && viewed.length === 0 && shortlist.length === 0 && !hasActive

  return (
    <div className="mt-8 space-y-8">
      {isEmpty && (
        <div className="rounded-xl border-2 border-dashed border-gray-200 px-8 py-16 text-center dark:border-gray-700">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
            <svg className="h-8 w-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">No research yet</h2>
          <p className="mt-2 text-sm text-gray-500">
            Start searching for crash data or browsing attorneys — your activity will appear here.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <a
              href="/search"
              className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
            >
              Start Searching
            </a>
            <a
              href="/attorneys"
              className="rounded-lg border border-gray-200 px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              Browse Attorneys
            </a>
          </div>
        </div>
      )}

      {/* ── Active Session ── */}
      {hasActive && (
        <section>
          <div className="mb-3 flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-green-500" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Active Search</h2>
          </div>
          <a
            href="/search"
            className="block rounded-lg border border-green-200 bg-green-50 p-4 transition-colors hover:border-green-300 dark:border-green-800 dark:bg-green-900/20 dark:hover:border-green-700"
          >
            <p className="text-sm font-medium text-green-800 dark:text-green-200">
              You have an active search session
            </p>
            <p className="mt-1 text-xs text-green-600 dark:text-green-400">
              Click to continue where you left off
            </p>
          </a>
        </section>
      )}

      {/* ── Comparison Shortlist ── */}
      {shortlist.length > 0 && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Comparison Shortlist ({shortlist.length})
            </h2>
            <div className="flex items-center gap-2">
              {shortlist.length >= 2 && (
                <a
                  href={`/attorneys/compare?slugs=${shortlist.join(',')}`}
                  className="rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                >
                  Compare Now
                </a>
              )}
              <button
                onClick={clearShortlist}
                className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                Clear
              </button>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {shortlist.map((slug) => {
              const viewedInfo = viewed.find((v) => v.slug === slug)
              return (
                <div
                  key={slug}
                  className="relative rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-900/20"
                >
                  <button
                    onClick={() => remove(slug)}
                    className="absolute right-2 top-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    title="Remove"
                  >
                    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </button>
                  <a href={`/attorneys/${slug}`} className="block">
                    <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                      {viewedInfo?.name ?? slug.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                    </p>
                    {viewedInfo && (
                      <p className="text-xs text-blue-600 dark:text-blue-400">
                        {[viewedInfo.city, viewedInfo.stateCode].filter(Boolean).join(', ')}
                        {viewedInfo.indexScore != null && ` · Score: ${Math.round(viewedInfo.indexScore)}`}
                      </p>
                    )}
                  </a>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* ── Saved Sessions ── */}
      {sessions.length > 0 && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Saved Searches ({sessions.length})
            </h2>
            <button
              onClick={handleClearSessions}
              className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              Clear all
            </button>
          </div>
          <div className="space-y-3">
            {sessions.map((session) => (
              <div
                key={session.id}
                className="group flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4 transition-colors hover:border-blue-300 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-blue-600"
              >
                <a
                  href={`/search?restore=${session.id}`}
                  className="min-w-0 flex-1"
                >
                  <p className="truncate text-sm font-medium text-gray-900 dark:text-white">
                    {session.title}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {session.messageCount} messages · {formatRelativeDate(session.savedAt)}
                  </p>
                </a>
                <button
                  onClick={() => handleDeleteSession(session.id)}
                  className="ml-3 shrink-0 text-gray-300 opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100"
                  title="Delete"
                >
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Recently Viewed Attorneys ── */}
      {viewed.length > 0 && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Recently Viewed ({viewed.length})
            </h2>
            <button
              onClick={handleClearViewed}
              className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              Clear
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {viewed.map((attorney) => (
              <a
                key={attorney.slug}
                href={`/attorneys/${attorney.slug}`}
                className="rounded-lg border border-gray-200 bg-white p-4 transition-colors hover:border-blue-300 hover:shadow-sm dark:border-gray-700 dark:bg-gray-800 dark:hover:border-blue-600"
              >
                <div className="flex items-start justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-gray-900 dark:text-white">
                      {attorney.name}
                    </p>
                    {attorney.firmName && (
                      <p className="truncate text-xs text-gray-500">{attorney.firmName}</p>
                    )}
                    <p className="text-xs text-gray-400">
                      {[attorney.city, attorney.stateCode].filter(Boolean).join(', ')}
                    </p>
                  </div>
                  {attorney.indexScore != null && (
                    <span className="ml-2 shrink-0 text-lg font-bold text-blue-600 dark:text-blue-400">
                      {Math.round(attorney.indexScore)}
                    </span>
                  )}
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-xs text-gray-400">
                    {attorney.reviewCount} review{attorney.reviewCount !== 1 ? 's' : ''}
                  </span>
                  <span className="text-xs text-gray-400">
                    {formatRelativeDate(attorney.viewedAt)}
                  </span>
                </div>
              </a>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

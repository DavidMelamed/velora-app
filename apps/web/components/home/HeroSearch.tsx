'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function HeroSearch() {
  const [query, setQuery] = useState('')
  const [focused, setFocused] = useState(false)
  const router = useRouter()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query.trim())}`)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto w-full max-w-2xl">
      <div
        className={`flex items-center gap-2 rounded-2xl border bg-white p-2 shadow-lg transition-all dark:bg-gray-900 ${
          focused
            ? 'border-blue-300 shadow-xl shadow-blue-500/10 ring-4 ring-blue-500/10 dark:border-blue-700'
            : 'border-gray-200 shadow-gray-200/50 dark:border-gray-700'
        }`}
      >
        <div className="pl-4 text-gray-400">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="Search crashes, intersections, attorneys..."
          className="flex-1 bg-transparent px-2 py-3 text-base outline-none placeholder:text-gray-400 dark:text-white"
        />
        <button
          type="submit"
          disabled={!query.trim()}
          className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-3 text-sm font-medium text-white shadow-sm transition-all hover:shadow-md disabled:cursor-not-allowed disabled:opacity-40"
        >
          Search
        </button>
      </div>
    </form>
  )
}

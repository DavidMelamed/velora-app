'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function HeroSearch() {
  const [query, setQuery] = useState('')
  const router = useRouter()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query.trim())}`)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto w-full max-w-2xl">
      <div className="flex items-center gap-3">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search crashes, intersections, attorneys..."
          className="flex-1 rounded-full border border-gray-300 bg-white px-6 py-4 text-base shadow-sm outline-none transition-all focus:border-blue-500 focus:shadow-md dark:border-gray-600 dark:bg-gray-800 dark:focus:border-blue-400"
        />
        <button
          type="submit"
          disabled={!query.trim()}
          className="rounded-full bg-blue-600 px-8 py-4 text-base font-medium text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Search
        </button>
      </div>
    </form>
  )
}

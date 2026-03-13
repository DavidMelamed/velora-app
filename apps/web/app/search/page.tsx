import type { Metadata } from 'next'
import { SearchInterface } from '@/components/search/SearchInterface'

export const metadata: Metadata = {
  title: 'Search | Velora',
  description:
    'Search crash data, find dangerous intersections, locate top-rated attorneys, and analyze trends with AI-powered intelligence.',
}

export default function SearchPage() {
  return (
    <main className="min-h-screen">
      <SearchInterface />
    </main>
  )
}

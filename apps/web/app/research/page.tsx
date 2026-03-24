import type { Metadata } from 'next'
import { ResearchDashboard } from './ResearchDashboard'

export const metadata: Metadata = {
  title: 'My Research — Saved Searches & Attorney Shortlist | Velora',
  description:
    'Pick up where you left off. View saved search sessions, recently viewed attorneys, and your comparison shortlist.',
}

export default function ResearchPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
        My Research
      </h1>
      <p className="mt-2 text-gray-500">
        Your search history, viewed attorneys, and comparison shortlist — all saved locally in your browser.
      </p>
      <ResearchDashboard />
    </main>
  )
}

export const revalidate = 3600

import { Suspense } from 'react'
import { HeroSearch } from '@/components/home/HeroSearch'
import { RecentCrashes } from '@/components/home/RecentCrashes'
import { StatsBar } from '@/components/home/StatsBar'
import { websiteSchema, jsonLdScript } from '@/lib/seo/schema-markup'

const STEPS = [
  {
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
      </svg>
    ),
    title: 'Search',
    description: 'Ask about any crash, intersection, or attorney in natural language.',
  },
  {
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5m.75-9l3-3 2.148 2.148A12.061 12.061 0 0116.5 7.605" />
      </svg>
    ),
    title: 'Understand',
    description: 'Get AI-powered analysis with comparable crashes, danger scores, and trends.',
  },
  {
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
      </svg>
    ),
    title: 'Act',
    description: 'Find top-rated attorneys, understand your rights, and make informed decisions.',
  },
]

export default function HomePage() {
  const siteSchema = websiteSchema()

  return (
    <main className="min-h-screen">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(siteSchema) }}
      />

      {/* Hero with gradient mesh background */}
      <section className="relative overflow-hidden px-4 pb-20 pt-20 sm:pt-28">
        {/* Animated gradient orbs */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -left-40 -top-40 h-80 w-80 rounded-full bg-blue-400/20 blur-3xl" />
          <div className="absolute -right-40 top-20 h-96 w-96 rounded-full bg-indigo-400/15 blur-3xl" />
          <div className="absolute -bottom-20 left-1/3 h-72 w-72 rounded-full bg-cyan-400/10 blur-3xl" />
        </div>

        <div className="relative z-10 flex flex-col items-center">
          {/* Badge */}
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-blue-200/60 bg-blue-50/80 px-4 py-1.5 text-sm text-blue-700 backdrop-blur-sm dark:border-blue-800/60 dark:bg-blue-900/30 dark:text-blue-300">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-500" />
            </span>
            AI-Powered Crash Intelligence
          </div>

          <h1 className="mb-6 max-w-4xl text-center text-5xl font-bold leading-tight tracking-tight sm:text-6xl lg:text-7xl">
            Know what the insurance company knows.{' '}
            <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-600 bg-clip-text text-transparent">
              Before they call.
            </span>
          </h1>

          <p className="mb-12 max-w-2xl text-center text-lg leading-relaxed text-gray-600 dark:text-gray-400">
            Crash data intelligence that levels the playing field. Search crashes, find patterns, and connect with top attorneys — all powered by AI.
          </p>

          <HeroSearch />

          {/* Trust indicators */}
          <div className="mt-8 flex items-center gap-6 text-sm text-gray-400">
            <span className="flex items-center gap-1.5">
              <svg className="h-4 w-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
              </svg>
              Free to use
            </span>
            <span className="flex items-center gap-1.5">
              <svg className="h-4 w-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
              </svg>
              No account needed
            </span>
            <span className="flex items-center gap-1.5">
              <svg className="h-4 w-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
              </svg>
              Public data
            </span>
          </div>
        </div>
      </section>

      {/* Stats — Bento cards */}
      <Suspense
        fallback={
          <div className="mx-auto grid max-w-4xl gap-4 px-6 sm:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800" />
            ))}
          </div>
        }
      >
        <StatsBar />
      </Suspense>

      {/* How It Works — Card grid */}
      <section className="mx-auto max-w-5xl px-6 py-24">
        <div className="mb-4 text-center text-sm font-medium uppercase tracking-widest text-blue-600 dark:text-blue-400">
          How It Works
        </div>
        <h2 className="mb-16 text-center text-3xl font-bold tracking-tight sm:text-4xl">
          Three steps to level the playing field
        </h2>
        <div className="grid gap-6 sm:grid-cols-3">
          {STEPS.map((step) => (
            <div
              key={step.title}
              className="group relative rounded-2xl border border-gray-200/80 bg-white p-8 transition-all hover:border-blue-200 hover:shadow-lg hover:shadow-blue-500/5 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-blue-800"
            >
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 text-blue-600 transition-colors group-hover:from-blue-100 group-hover:to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 dark:text-blue-400">
                {step.icon}
              </div>
              <h3 className="mb-2 text-lg font-semibold">{step.title}</h3>
              <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-400">{step.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Recent Crashes */}
      <section className="border-t border-gray-100 bg-gray-50/50 py-20 dark:border-gray-800 dark:bg-gray-900/50">
        <Suspense>
          <RecentCrashes />
        </Suspense>
      </section>

      {/* Footer CTA */}
      <section className="relative overflow-hidden px-4 py-24 text-center">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 top-0 h-64 w-full -translate-x-1/2 bg-gradient-to-b from-blue-50/50 to-transparent dark:from-blue-900/10" />
        </div>
        <div className="relative">
          <h2 className="mb-4 text-3xl font-bold tracking-tight sm:text-4xl">
            Ready to level the playing field?
          </h2>
          <p className="mb-8 text-lg text-gray-600 dark:text-gray-400">
            Search any crash, intersection, or attorney — free and open.
          </p>
          <a
            href="/search"
            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-3.5 text-base font-medium text-white shadow-lg shadow-blue-500/25 transition-all hover:shadow-xl hover:shadow-blue-500/30"
          >
            Start Searching
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 px-6 py-8 dark:border-gray-800">
        <div className="mx-auto flex max-w-7xl items-center justify-between text-sm text-gray-400">
          <span>Velora Crash Intelligence Platform</span>
          <div className="flex gap-6">
            <a href="/attorneys" className="hover:text-gray-600 dark:hover:text-gray-300">Attorneys</a>
            <a href="/search" className="hover:text-gray-600 dark:hover:text-gray-300">Search</a>
          </div>
        </div>
      </footer>
    </main>
  )
}

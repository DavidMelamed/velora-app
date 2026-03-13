import { Suspense } from 'react'
import { HeroSearch } from '@/components/home/HeroSearch'
import { RecentCrashes } from '@/components/home/RecentCrashes'
import { StatsBar } from '@/components/home/StatsBar'

const STEPS = [
  {
    number: '1',
    title: 'Search',
    description: 'Ask about any crash, intersection, or attorney in natural language.',
  },
  {
    number: '2',
    title: 'Understand',
    description: 'Get AI-powered analysis with comparable crashes, danger scores, and trends.',
  },
  {
    number: '3',
    title: 'Act',
    description: 'Find top-rated attorneys, understand your rights, and make informed decisions.',
  },
]

export default function HomePage() {
  return (
    <main className="min-h-screen">
      {/* Hero */}
      <section className="flex flex-col items-center justify-center px-4 pb-16 pt-24">
        <h1 className="mb-4 max-w-3xl text-center text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
          Know what the insurance company knows.{' '}
          <span className="text-blue-600 dark:text-blue-400">Before they call.</span>
        </h1>
        <p className="mb-10 max-w-xl text-center text-lg text-gray-600 dark:text-gray-400">
          Crash data intelligence that levels the playing field. Search crashes, find patterns, and
          connect with top attorneys — all powered by AI.
        </p>
        <HeroSearch />
      </section>

      {/* Stats Bar */}
      <Suspense
        fallback={
          <div className="border-y border-gray-200 bg-gray-50 py-8 dark:border-gray-700 dark:bg-gray-900">
            <div className="mx-auto flex max-w-4xl justify-around">
              {[1, 2, 3].map((i) => (
                <div key={i} className="text-center">
                  <div className="h-9 w-20 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
                  <div className="mt-2 h-4 w-24 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
                </div>
              ))}
            </div>
          </div>
        }
      >
        <StatsBar />
      </Suspense>

      {/* How It Works */}
      <section className="mx-auto max-w-4xl px-4 py-16">
        <h2 className="mb-12 text-center text-3xl font-bold tracking-tight">How It Works</h2>
        <div className="grid gap-8 sm:grid-cols-3">
          {STEPS.map((step) => (
            <div key={step.number} className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-xl font-bold text-blue-600 dark:bg-blue-900 dark:text-blue-300">
                {step.number}
              </div>
              <h3 className="mb-2 text-xl font-semibold">{step.title}</h3>
              <p className="text-gray-600 dark:text-gray-400">{step.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Recent Crashes */}
      <Suspense>
        <RecentCrashes />
      </Suspense>

      {/* Footer CTA */}
      <section className="px-4 py-16 text-center">
        <h2 className="mb-4 text-2xl font-bold">Ready to level the playing field?</h2>
        <p className="mb-6 text-gray-600 dark:text-gray-400">
          Search any crash, intersection, or attorney — free and open.
        </p>
        <a
          href="/search"
          className="inline-block rounded-full bg-blue-600 px-8 py-3 font-medium text-white transition-colors hover:bg-blue-700"
        >
          Start Searching
        </a>
      </section>
    </main>
  )
}

import type { Metadata } from 'next'
import { CompareProvider } from '@/components/attorney/CompareContext'
import './globals.css'

export const metadata: Metadata = {
  title: 'Velora — Crash Intelligence Platform',
  description:
    'Velora kills information asymmetry in the car accident industry. Every crash victim gets the same information insurance companies have.',
}

function Navbar() {
  return (
    <nav className="fixed top-0 z-50 w-full border-b border-white/10 bg-white/80 backdrop-blur-xl dark:bg-gray-950/80">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <a href="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 text-sm font-bold text-white">
            V
          </div>
          <span className="text-lg font-semibold tracking-tight text-gray-900 dark:text-white">
            Velora
          </span>
        </a>

        {/* Desktop nav */}
        <div className="hidden items-center gap-8 md:flex">
          <a href="/search" className="text-sm text-gray-600 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-white">
            Search
          </a>
          <a href="/attorneys" className="text-sm text-gray-600 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-white">
            Attorneys
          </a>
          <a href="/research" className="text-sm text-gray-600 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-white">
            My Research
          </a>
          <a href="/sign-in" className="rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-2 text-sm font-medium text-white shadow-sm shadow-blue-500/25 transition-all hover:shadow-md hover:shadow-blue-500/30">
            Sign In
          </a>
        </div>

        {/* Mobile nav */}
        <div className="flex items-center gap-4 md:hidden">
          <a href="/search" className="text-sm text-gray-600 dark:text-gray-400">Search</a>
          <a href="/attorneys" className="text-sm text-gray-600 dark:text-gray-400">Attorneys</a>
          <a href="/research" className="text-sm text-gray-600 dark:text-gray-400">Research</a>
          <a href="/sign-in" className="rounded-full bg-blue-600 px-4 py-1.5 text-xs font-medium text-white">
            Sign In
          </a>
        </div>
      </div>
    </nav>
  )
}

function Footer() {
  return (
    <footer className="border-t border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-950">
      <div className="mx-auto max-w-7xl px-6 py-12">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-blue-600 to-indigo-600 text-xs font-bold text-white">V</div>
              <span className="font-semibold text-gray-900 dark:text-white">Velora</span>
            </div>
            <p className="mt-3 text-sm text-gray-500">
              Crash data intelligence that levels the playing field.
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Platform</h3>
            <ul className="mt-3 space-y-2">
              <li><a href="/search" className="text-sm text-gray-500 hover:text-gray-900 dark:hover:text-white">AI Search</a></li>
              <li><a href="/attorneys" className="text-sm text-gray-500 hover:text-gray-900 dark:hover:text-white">Attorney Directory</a></li>
              <li><a href="/colorado" className="text-sm text-gray-500 hover:text-gray-900 dark:hover:text-white">Colorado Crashes</a></li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Resources</h3>
            <ul className="mt-3 space-y-2">
              <li><a href="/search?q=what+to+do+after+a+car+accident" className="text-sm text-gray-500 hover:text-gray-900 dark:hover:text-white">After an Accident</a></li>
              <li><a href="/search?q=how+to+find+a+personal+injury+attorney" className="text-sm text-gray-500 hover:text-gray-900 dark:hover:text-white">Finding an Attorney</a></li>
              <li><a href="/embed/docs" className="text-sm text-gray-500 hover:text-gray-900 dark:hover:text-white">Embed Widget</a></li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Legal</h3>
            <ul className="mt-3 space-y-2">
              <li><span className="text-sm text-gray-400">Privacy Policy</span></li>
              <li><span className="text-sm text-gray-400">Terms of Service</span></li>
            </ul>
            <p className="mt-4 text-xs text-gray-400">
              Not legal advice. For informational purposes only.
            </p>
          </div>
        </div>

        <div className="mt-8 border-t border-gray-200 pt-6 text-center text-xs text-gray-400 dark:border-gray-800">
          Velora Crash Intelligence Platform
        </div>
      </div>
    </footer>
  )
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="flex min-h-screen flex-col bg-white text-gray-900 antialiased dark:bg-gray-950 dark:text-gray-100">
        <CompareProvider>
          <Navbar />
          <div className="flex-1 pt-16">
            {children}
          </div>
          <Footer />
        </CompareProvider>
      </body>
    </html>
  )
}

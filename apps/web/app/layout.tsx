import type { Metadata } from 'next'
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

        <div className="hidden items-center gap-8 md:flex">
          <a href="/search" className="text-sm text-gray-600 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-white">
            Search
          </a>
          <a href="/attorneys" className="text-sm text-gray-600 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-white">
            Attorneys
          </a>
          <a href="/sign-in" className="rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-2 text-sm font-medium text-white shadow-sm shadow-blue-500/25 transition-all hover:shadow-md hover:shadow-blue-500/30">
            Sign In
          </a>
        </div>
      </div>
    </nav>
  )
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-white text-gray-900 antialiased dark:bg-gray-950 dark:text-gray-100">
        <Navbar />
        <div className="pt-16">
          {children}
        </div>
      </body>
    </html>
  )
}

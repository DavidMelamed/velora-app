import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Velora — Crash Intelligence Platform',
  description:
    'Velora kills information asymmetry in the car accident industry. Every crash victim gets the same information insurance companies have.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-white text-gray-900 antialiased dark:bg-gray-950 dark:text-gray-100">
        {children}
      </body>
    </html>
  )
}

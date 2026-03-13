'use client'

import { useState, useCallback } from 'react'

interface SharePanelProps {
  crashId: string
  location: string
}

export function SharePanel({ crashId, location }: SharePanelProps) {
  const [copied, setCopied] = useState(false)
  const [showMenu, setShowMenu] = useState(false)

  const reportUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/report/${crashId}`
      : `/report/${crashId}`

  const shareTitle = `Crash Equalizer Report — ${location}`
  const shareText = `Check out this crash analysis report for ${location} on Velora.`

  const copyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(reportUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea')
      textarea.value = reportUrl
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }, [reportUrl])

  const shareEmail = useCallback(() => {
    const subject = encodeURIComponent(shareTitle)
    const body = encodeURIComponent(`${shareText}\n\n${reportUrl}`)
    window.open(`mailto:?subject=${subject}&body=${body}`, '_self')
  }, [reportUrl, shareTitle, shareText])

  const shareSms = useCallback(() => {
    const body = encodeURIComponent(`${shareText} ${reportUrl}`)
    window.open(`sms:?body=${body}`, '_self')
  }, [reportUrl, shareText])

  const shareNative = useCallback(async () => {
    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      try {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: reportUrl,
        })
      } catch {
        // User cancelled or API unavailable
        setShowMenu(true)
      }
    } else {
      setShowMenu(true)
    }
  }, [reportUrl, shareTitle, shareText])

  return (
    <div className="relative">
      <button
        onClick={shareNative}
        className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
      >
        Share Report
      </button>

      {showMenu && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />

          {/* Menu */}
          <div className="absolute right-0 z-50 mt-2 w-48 rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-800">
            <button
              onClick={() => {
                copyLink()
                setShowMenu(false)
              }}
              className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              {copied ? 'Copied!' : 'Copy Link'}
            </button>
            <button
              onClick={() => {
                shareEmail()
                setShowMenu(false)
              }}
              className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              Email
            </button>
            <button
              onClick={() => {
                shareSms()
                setShowMenu(false)
              }}
              className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              SMS / Text
            </button>
          </div>
        </>
      )}
    </div>
  )
}

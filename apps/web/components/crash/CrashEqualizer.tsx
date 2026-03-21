'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import type { EqualizerBriefing, LiabilitySignal, AttorneyMatch } from '@velora/shared'
import { SettlementRangeBar } from './SettlementRangeBar'
import { LiabilityCard } from './LiabilityCard'

interface CrashEqualizerProps {
  briefing: EqualizerBriefing
  stateCode: string
  className?: string
}

const CONFIDENCE_BADGE: Record<string, { label: string; className: string }> = {
  HIGH: { label: 'High Confidence', className: 'bg-green-100 text-green-800' },
  MEDIUM: { label: 'Medium Confidence', className: 'bg-amber-100 text-amber-800' },
  LOW: { label: 'Low Confidence', className: 'bg-gray-100 text-gray-700' },
}

function SeverityDistributionBar({ crashes }: { crashes: EqualizerBriefing['comparable']['crashes'] }) {
  const severityCounts: Record<string, number> = {}
  for (const c of crashes) {
    severityCounts[c.severity] = (severityCounts[c.severity] || 0) + 1
  }
  const total = crashes.length || 1
  const bars = [
    { key: 'FATAL', label: 'Fatal', color: 'bg-slate-700', count: severityCounts['FATAL'] || 0 },
    { key: 'SUSPECTED_SERIOUS_INJURY', label: 'Serious', color: 'bg-red-500', count: severityCounts['SUSPECTED_SERIOUS_INJURY'] || 0 },
    { key: 'SUSPECTED_MINOR_INJURY', label: 'Minor', color: 'bg-amber-500', count: severityCounts['SUSPECTED_MINOR_INJURY'] || 0 },
    { key: 'POSSIBLE_INJURY', label: 'Possible', color: 'bg-yellow-500', count: severityCounts['POSSIBLE_INJURY'] || 0 },
    { key: 'PROPERTY_DAMAGE_ONLY', label: 'PDO', color: 'bg-green-500', count: severityCounts['PROPERTY_DAMAGE_ONLY'] || 0 },
  ].filter((b) => b.count > 0)

  return (
    <div className="flex h-4 w-full overflow-hidden rounded-full">
      {bars.map((bar) => (
        <div
          key={bar.key}
          className={cn('h-full', bar.color)}
          style={{ width: `${(bar.count / total) * 100}%` }}
          title={`${bar.label}: ${bar.count}`}
        />
      ))}
    </div>
  )
}

function AttorneyCard({ attorney, rank }: { attorney: AttorneyMatch; rank: number }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-3">
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">
        {rank}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-gray-900">{attorney.name}</p>
        <p className="text-xs text-gray-500">{attorney.matchReason}</p>
      </div>
      <div className="text-right">
        <div className="text-lg font-bold text-blue-600">{Math.round(attorney.indexScore)}</div>
        <div className="text-xs text-gray-400">Index</div>
      </div>
    </div>
  )
}

function ShareSection() {
  const [copied, setCopied] = useState(false)

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback
    }
  }

  const handleEmailShare = () => {
    const subject = encodeURIComponent('Crash Equalizer Report')
    const body = encodeURIComponent(`Check out this crash analysis: ${window.location.href}`)
    window.open(`mailto:?subject=${subject}&body=${body}`)
  }

  const handleWebShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Crash Equalizer Report',
          text: 'Check out this crash analysis',
          url: window.location.href,
        })
      } catch {
        // User cancelled
      }
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={handleCopyLink}
        className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
      >
        {copied ? 'Copied!' : 'Copy Link'}
      </button>
      <button
        onClick={handleEmailShare}
        className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
      >
        Email
      </button>
      {typeof navigator !== 'undefined' && 'share' in navigator && (
        <button
          onClick={handleWebShare}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
        >
          Share
        </button>
      )}
    </div>
  )
}

export function CrashEqualizer({ briefing, stateCode, className }: CrashEqualizerProps) {
  const { comparable, liability, settlement, attorneyMatches } = briefing
  const confidenceBadge = CONFIDENCE_BADGE[comparable.confidenceLevel] || CONFIDENCE_BADGE.LOW

  const injuryCount = comparable.crashes.filter(
    (c) => c.severity !== 'PROPERTY_DAMAGE_ONLY'
  ).length
  const fatalCount = comparable.crashes.filter((c) => c.severity === 'FATAL').length
  const injuryRate = comparable.crashes.length > 0
    ? ((injuryCount / comparable.crashes.length) * 100).toFixed(1)
    : '0'
  const fatalRate = comparable.crashes.length > 0
    ? ((fatalCount / comparable.crashes.length) * 100).toFixed(1)
    : '0'

  const midSettlement = Math.round(
    (settlement.adjustedRange.low + settlement.adjustedRange.high) / 2
  )

  return (
    <div className={cn('space-y-8', className)}>
      {/* Section 1: Crashes Like Yours */}
      <section className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Crashes Like Yours</h2>
          <span className={cn('rounded-full px-3 py-1 text-xs font-medium', confidenceBadge.className)}>
            {confidenceBadge.label}
          </span>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-4">
          <div className="rounded-lg bg-gray-50 p-3 text-center">
            <div className="text-2xl font-bold text-gray-900">{comparable.matchCount}</div>
            <div className="text-xs text-gray-500">Similar crashes</div>
          </div>
          <div className="rounded-lg bg-gray-50 p-3 text-center">
            <div className="text-2xl font-bold text-gray-900">{injuryRate}%</div>
            <div className="text-xs text-gray-500">Injury rate</div>
          </div>
          <div className="rounded-lg bg-gray-50 p-3 text-center">
            <div className="text-2xl font-bold text-gray-900">{fatalRate}%</div>
            <div className="text-xs text-gray-500">Fatality rate</div>
          </div>
        </div>

        <div className="mt-4">
          <p className="text-xs font-medium text-gray-500">Severity Distribution</p>
          <div className="mt-1">
            <SeverityDistributionBar crashes={comparable.crashes} />
          </div>
          <div className="mt-1 flex flex-wrap gap-3 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full bg-slate-700" /> Fatal
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full bg-red-500" /> Serious
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full bg-amber-500" /> Minor
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full bg-yellow-500" /> Possible
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full bg-green-500" /> PDO
            </span>
          </div>
        </div>
      </section>

      {/* Section 2: What The Data Suggests */}
      {liability.length > 0 && (
        <section>
          <h2 className="text-xl font-bold text-gray-900">What The Data Suggests</h2>
          <p className="mt-1 text-sm text-gray-500">
            Liability signals detected from the crash report data
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {liability.map((signal: LiabilitySignal, i: number) => (
              <LiabilityCard key={i} signal={signal} />
            ))}
          </div>
        </section>
      )}

      {/* Section 3: What To Expect */}
      <section>
        <h2 className="text-xl font-bold text-gray-900">What To Expect</h2>
        <p className="mt-1 text-sm text-gray-500">
          Estimated outcomes based on comparable crashes
        </p>

        <div className="mt-4">
          <SettlementRangeBar
            low={settlement.adjustedRange.low}
            mid={midSettlement}
            high={settlement.adjustedRange.high}
          />
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <p className="text-xs font-medium text-gray-500">State Fault Type</p>
            <p className="mt-1 text-sm font-semibold text-gray-900">
              {stateCode} &mdash; {settlement.stateFactor.multiplier}x factor
            </p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <p className="text-xs font-medium text-gray-500">Adjustment Factors</p>
            <div className="mt-1 space-y-0.5">
              {settlement.adjustmentFactors.map((f, i) => (
                <p key={i} className="text-xs text-gray-600">
                  {f.name}: {f.multiplier}x &mdash; {f.reason}
                </p>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Section 4: Your Best Options */}
      {attorneyMatches.length > 0 && (
        <section>
          <h2 className="text-xl font-bold text-gray-900">Your Best Options</h2>
          <p className="mt-1 text-sm text-gray-500">
            Top-rated attorneys for crashes like yours
          </p>
          <div className="mt-4 space-y-3">
            {attorneyMatches.slice(0, 3).map((attorney: AttorneyMatch, i: number) => (
              <AttorneyCard key={attorney.attorneyId} attorney={attorney} rank={i + 1} />
            ))}
          </div>
        </section>
      )}

      {/* Section 5: Share This Report */}
      <section className="rounded-xl border border-gray-200 bg-gray-50 p-6">
        <h2 className="text-lg font-bold text-gray-900">Share This Report</h2>
        <p className="mt-1 text-sm text-gray-500">
          Send this Equalizer briefing to someone who needs it
        </p>
        <div className="mt-4">
          <ShareSection />
        </div>
      </section>

      {/* Disclaimer */}
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
        <p className="text-xs text-amber-800">
          <strong>Disclaimer:</strong> This analysis is based on public crash data and is not legal
          advice. Settlement ranges are estimates derived from comparable crash outcomes and should not
          be relied upon as predictions. Consult a licensed attorney for advice specific to your
          situation.
        </p>
      </div>
    </div>
  )
}

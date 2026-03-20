'use client'

import { useState, useEffect, useCallback } from 'react'

// Use relative URL to proxy through Next.js, avoiding CORS issues
const API_BASE = ''

interface QualityTrend {
  period: string
  narrativeApprovalRate: number
  equalizerUsefulRate: number
  avgTimeOnPage: number
  scrollThroughRate: number
  attorneyClickRate: number
  sampleSize: number
}

interface PromptVersion {
  id: string
  signature: string
  version: number
  parentId: string | null
  archetypeId: string | null
  mutations: string[] | null
  scores: Record<string, number> | null
  compositeScore: number | null
  isActive: boolean
  createdAt: string
}

interface ExperimentData {
  id: string
  name: string
  signature: string
  status: string
  winnerId: string | null
  startedAt: string
  completedAt: string | null
  variants: Array<{
    id: string
    name: string
    weight: number
    feedbackCount: number
    approvalRate: number | null
  }>
}

interface CostBreakdown {
  totalNarratives: number
  totalCost: number
  tierBreakdown: Record<string, number>
  costPerTier: Record<string, number>
  dailyCosts: Array<{ day: string; cost: number }>
}

export default function LearningDashboard() {
  const [trends, setTrends] = useState<QualityTrend[]>([])
  const [lineage, setLineage] = useState<PromptVersion[]>([])
  const [experiments, setExperiments] = useState<ExperimentData[]>([])
  const [costs, setCosts] = useState<CostBreakdown | null>(null)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState(false)
  const [selectedSignature, setSelectedSignature] = useState('narrative')

  const fetchData = useCallback(async () => {
    setLoading(true)
    setFetchError(false)
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 10_000)

      const [trendsRes, lineageRes, experimentsRes, costsRes] = await Promise.all([
        fetch(`${API_BASE}/api/admin/learning/quality-trends`, { signal: controller.signal }),
        fetch(`${API_BASE}/api/admin/learning/prompt-lineage?signature=${selectedSignature}`, { signal: controller.signal }),
        fetch(`${API_BASE}/api/admin/learning/experiments`, { signal: controller.signal }),
        fetch(`${API_BASE}/api/admin/learning/cost-breakdown`, { signal: controller.signal }),
      ])

      clearTimeout(timeout)

      if (trendsRes.ok) {
        const data = await trendsRes.json()
        setTrends(data.trends || [])
      }
      if (lineageRes.ok) {
        const data = await lineageRes.json()
        setLineage(data.versions || [])
      }
      if (experimentsRes.ok) {
        const data = await experimentsRes.json()
        setExperiments(data.experiments || [])
      }
      if (costsRes.ok) {
        const data = await costsRes.json()
        setCosts(data)
      }
    } catch {
      setFetchError(true)
    } finally {
      setLoading(false)
    }
  }, [selectedSignature])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  if (loading) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900">Self-Learning Dashboard</h1>
        <p className="mt-4 text-gray-500">Loading metrics...</p>
      </main>
    )
  }

  if (fetchError) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900">Self-Learning Dashboard</h1>
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-700">Unable to load metrics. The API may be unavailable.</p>
          <button onClick={fetchData} className="mt-2 rounded bg-red-100 px-3 py-1 text-sm text-red-800 hover:bg-red-200">
            Retry
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Self-Learning Dashboard</h1>
        <button
          onClick={fetchData}
          className="rounded-md bg-gray-100 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-200"
        >
          Refresh
        </button>
      </div>

      {/* Quality Trends */}
      <section className="mt-8">
        <h2 className="text-lg font-semibold text-gray-900">Narrative Quality Trends</h2>
        {trends.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">No feedback data yet. Quality trends will appear once users submit feedback.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="pb-2 pr-4">Date</th>
                  <th className="pb-2 pr-4">Approval</th>
                  <th className="pb-2 pr-4">Equalizer</th>
                  <th className="pb-2 pr-4">Avg Time</th>
                  <th className="pb-2 pr-4">Scroll</th>
                  <th className="pb-2 pr-4">Atty CTR</th>
                  <th className="pb-2">Samples</th>
                </tr>
              </thead>
              <tbody>
                {trends.slice(-14).map((t) => (
                  <tr key={t.period} className="border-b border-gray-100">
                    <td className="py-2 pr-4 font-mono text-xs">{t.period}</td>
                    <td className="py-2 pr-4">
                      <RateIndicator value={t.narrativeApprovalRate} />
                    </td>
                    <td className="py-2 pr-4">
                      <RateIndicator value={t.equalizerUsefulRate} />
                    </td>
                    <td className="py-2 pr-4">{t.avgTimeOnPage.toFixed(1)}s</td>
                    <td className="py-2 pr-4">
                      <RateIndicator value={t.scrollThroughRate} />
                    </td>
                    <td className="py-2 pr-4">
                      <RateIndicator value={t.attorneyClickRate} />
                    </td>
                    <td className="py-2 text-gray-500">{t.sampleSize}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* GEPA Lineage Viewer */}
      <section className="mt-10">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold text-gray-900">Prompt Version Lineage</h2>
          <select
            value={selectedSignature}
            onChange={(e) => setSelectedSignature(e.target.value)}
            className="rounded-md border border-gray-300 px-2 py-1 text-sm"
          >
            <option value="narrative">Narrative</option>
            <option value="equalizer">Equalizer</option>
            <option value="persona">Persona</option>
          </select>
        </div>
        {lineage.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">No prompt versions yet. Run a GEPA cycle to create prompt variants.</p>
        ) : (
          <div className="mt-4 space-y-2">
            {lineage.map((v) => (
              <div
                key={v.id}
                className={`rounded-lg border p-3 ${v.isActive ? 'border-green-300 bg-green-50' : 'border-gray-200 bg-white'}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold">v{v.version}</span>
                    {v.isActive && (
                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                        ACTIVE
                      </span>
                    )}
                    {v.parentId && (
                      <span className="text-xs text-gray-400">
                        from parent
                      </span>
                    )}
                  </div>
                  {v.compositeScore !== null && (
                    <span className="font-mono text-sm">
                      Score: {v.compositeScore.toFixed(3)}
                    </span>
                  )}
                </div>
                {v.mutations && (
                  <div className="mt-1 flex gap-1">
                    {(v.mutations as string[]).map((m, i) => (
                      <span key={i} className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">
                        {m}
                      </span>
                    ))}
                  </div>
                )}
                {v.scores && (
                  <div className="mt-1 flex gap-3 text-xs text-gray-500">
                    {Object.entries(v.scores as Record<string, number>).map(([key, val]) => (
                      <span key={key}>
                        {key}: {val.toFixed(2)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Active Experiments */}
      <section className="mt-10">
        <h2 className="text-lg font-semibold text-gray-900">A/B Experiments</h2>
        {experiments.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">No experiments created yet.</p>
        ) : (
          <div className="mt-4 space-y-4">
            {experiments.map((exp) => (
              <div key={exp.id} className="rounded-lg border border-gray-200 bg-white p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">{exp.name}</h3>
                    <p className="text-xs text-gray-500">
                      {exp.signature} | Started {new Date(exp.startedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      exp.status === 'RUNNING'
                        ? 'bg-blue-100 text-blue-700'
                        : exp.status === 'COMPLETED'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-purple-100 text-purple-700'
                    }`}
                  >
                    {exp.status}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {exp.variants.map((v) => (
                    <div
                      key={v.id}
                      className={`rounded-md border p-2 text-sm ${
                        v.id === exp.winnerId ? 'border-green-300 bg-green-50' : 'border-gray-100'
                      }`}
                    >
                      <div className="font-medium">{v.name}</div>
                      <div className="text-xs text-gray-500">
                        {v.feedbackCount} events
                        {v.approvalRate !== null && ` | ${(v.approvalRate * 100).toFixed(1)}% approval`}
                      </div>
                      {v.id === exp.winnerId && (
                        <span className="text-xs font-medium text-green-600">Winner</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* AI Cost Breakdown */}
      <section className="mt-10">
        <h2 className="text-lg font-semibold text-gray-900">AI Cost Breakdown</h2>
        {!costs || costs.totalNarratives === 0 ? (
          <p className="mt-2 text-sm text-gray-500">No AI generation costs tracked yet.</p>
        ) : (
          <div className="mt-4">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <StatCard label="Total Narratives" value={costs.totalNarratives.toString()} />
              <StatCard label="Total Cost" value={`$${costs.totalCost.toFixed(2)}`} />
              {Object.entries(costs.tierBreakdown).map(([tier, count]) => (
                <StatCard
                  key={tier}
                  label={`${tier.charAt(0).toUpperCase() + tier.slice(1)} Tier`}
                  value={`${count} ($${((costs.costPerTier[tier] || 0) * count).toFixed(2)})`}
                />
              ))}
            </div>
          </div>
        )}
      </section>
    </main>
  )
}

function RateIndicator({ value }: { value: number }) {
  const pct = (value * 100).toFixed(1)
  const color = value >= 0.8 ? 'text-green-600' : value >= 0.5 ? 'text-yellow-600' : 'text-red-600'
  return <span className={`font-mono text-sm ${color}`}>{pct}%</span>
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3">
      <div className="text-xs font-medium text-gray-500">{label}</div>
      <div className="mt-1 text-lg font-semibold text-gray-900">{value}</div>
    </div>
  )
}

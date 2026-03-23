import TimelineWeb, { type TimelineEvent } from '@/components/case/TimelineWeb'
import KnowledgeGraph from '@/components/case/KnowledgeGraph'
import { SERVER_API_URL } from '@/lib/server-api-url'

const API = SERVER_API_URL

interface Matter {
  id: string
  clientName: string
  accidentDate: string
  status: string
  statuteDeadline: string
  summary?: string
}

interface Entity {
  id: string
  type: 'provider' | 'injury' | 'medication' | 'person' | 'vehicle'
  name: string
  confidence: number
}

interface Fact {
  id: string
  subject: string
  predicate: string
  object: string
  confidence: number
  source?: string
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { next: { revalidate: 60 } })
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

function daysUntil(dateStr: string): number {
  const target = new Date(dateStr)
  const now = new Date()
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active: 'bg-green-100 text-green-700',
    pending: 'bg-yellow-100 text-yellow-700',
    closed: 'bg-gray-100 text-gray-600',
    settled: 'bg-blue-100 text-blue-700',
  }
  const cls = colors[status.toLowerCase()] || 'bg-gray-100 text-gray-600'
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>
      {status}
    </span>
  )
}

function ConfidenceBar({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100)
  const color =
    pct >= 80 ? 'bg-green-500' : pct >= 50 ? 'bg-yellow-500' : 'bg-red-500'
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-gray-200">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] text-gray-400">{pct}%</span>
    </div>
  )
}

function StatuteCountdown({ deadline }: { deadline: string }) {
  const days = daysUntil(deadline)
  const urgent = days <= 90
  const color = urgent ? 'text-red-600' : 'text-gray-600'
  return (
    <div className={`text-sm ${color}`}>
      {days > 0 ? (
        <>
          <span className="font-semibold">{days}</span> days to statute
          {urgent && (
            <span className="ml-1 inline-block animate-pulse rounded bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-700">
              URGENT
            </span>
          )}
        </>
      ) : (
        <span className="font-semibold text-red-700">Statute expired</span>
      )}
    </div>
  )
}

const ENTITY_GROUPS: { type: Entity['type']; label: string }[] = [
  { type: 'provider', label: 'Providers' },
  { type: 'injury', label: 'Injuries' },
  { type: 'medication', label: 'Medications' },
]

export default async function CasePage({
  params,
}: {
  params: Promise<{ matterId: string }>
}) {
  const { matterId } = await params

  const [matter, timeline, entities, facts] = await Promise.all([
    fetchJson<Matter>(`${API}/api/case/${matterId}`),
    fetchJson<TimelineEvent[]>(`${API}/api/case/${matterId}/timeline`),
    fetchJson<Entity[]>(`${API}/api/case/${matterId}/entities`),
    fetchJson<Fact[]>(`${API}/api/case/${matterId}/facts`),
  ])

  if (!matter) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Case Not Found</h1>
          <p className="mt-2 text-gray-500">This case could not be loaded. The case may not exist or the service is temporarily unavailable.</p>
          <a href="/" className="mt-4 inline-block rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">Go Home</a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <header className="border-b border-gray-200 bg-white px-6 py-4">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">{matter.clientName}</h1>
            <p className="text-sm text-gray-500">
              Accident: {new Date(matter.accidentDate).toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <StatusBadge status={matter.status} />
            <StatuteCountdown deadline={matter.statuteDeadline} />
          </div>
        </div>
      </header>

      {/* 3-column layout */}
      <div className="mx-auto flex max-w-7xl flex-col gap-6 p-6 lg:flex-row">
        {/* Left sidebar: Entities */}
        <aside className="w-full shrink-0 lg:w-64">
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <h2 className="mb-3 text-sm font-semibold text-gray-700">Key Entities</h2>
            {ENTITY_GROUPS.map(group => {
              const items = (entities ?? []).filter(e => e.type === group.type)
              if (items.length === 0) return null
              return (
                <div key={group.type} className="mb-4 last:mb-0">
                  <h3 className="mb-1.5 text-xs font-medium uppercase tracking-wide text-gray-400">
                    {group.label}
                  </h3>
                  <ul className="space-y-2">
                    {items.map(entity => (
                      <li key={entity.id}>
                        <p className="text-sm text-gray-800">{entity.name}</p>
                        <ConfidenceBar confidence={entity.confidence} />
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}
            {(entities ?? []).length === 0 && (
              <p className="text-xs text-gray-400">No entities extracted yet.</p>
            )}
          </div>
        </aside>

        {/* Center: Timeline + Knowledge Graph */}
        <main className="min-w-0 flex-1 space-y-6">
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <h2 className="mb-3 text-sm font-semibold text-gray-700">Case Timeline</h2>
            <TimelineWeb events={timeline ?? []} matterId={matterId} />
          </div>

          {/* Knowledge Graph Explorer */}
          <KnowledgeGraph matterId={matterId} />
        </main>

        {/* Right sidebar: Facts */}
        <aside className="w-full shrink-0 lg:w-64">
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <h2 className="mb-3 text-sm font-semibold text-gray-700">Active Facts</h2>
            {(facts ?? []).length > 0 ? (
              <ul className="space-y-3">
                {(facts ?? []).map(fact => (
                  <li key={fact.id} className="border-b border-gray-100 pb-2 last:border-0">
                    <p className="text-sm text-gray-800">
                      <span className="font-medium">{fact.subject}</span>{' '}
                      <span className="text-gray-500">{fact.predicate}</span>{' '}
                      <span className="font-medium">{fact.object}</span>
                    </p>
                    <div className="mt-0.5 flex items-center gap-2">
                      <ConfidenceBar confidence={fact.confidence} />
                      {fact.source && (
                        <span className="text-[10px] text-gray-400">{fact.source}</span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-gray-400">No facts extracted yet.</p>
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}

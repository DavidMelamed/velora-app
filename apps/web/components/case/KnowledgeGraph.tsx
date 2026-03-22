'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

interface GraphNode {
  id: string
  label: string
  type: string
  confidence: number
  attributes: Record<string, unknown>
  group: number
  // d3 simulation properties
  x?: number
  y?: number
  fx?: number | null
  fy?: number | null
  vx?: number
  vy?: number
}

interface GraphEdge {
  id: string
  source: string | GraphNode
  target: string | GraphNode
  label: string
  confidence: number
  validFrom: string
  validUntil: string | null
  status: string
}

interface KnowledgeGraphData {
  nodes: GraphNode[]
  edges: GraphEdge[]
  stats: {
    nodeCount: number
    edgeCount: number
    entityTypes: Record<string, number>
    predicates: Record<string, number>
  }
}

interface KnowledgeGraphProps {
  matterId: string
  apiUrl?: string
}

const TYPE_COLORS: Record<string, string> = {
  matter: '#2563eb',    // blue-600
  PERSON: '#8b5cf6',    // violet-500
  ORGANIZATION: '#6366f1', // indigo-500
  FACILITY: '#06b6d4',  // cyan-500
  INJURY: '#ef4444',    // red-500
  BODY_PART: '#f97316',  // orange-500
  MEDICATION: '#22c55e', // green-500
  CLAIM: '#eab308',     // yellow-500
  VEHICLE_ENTITY: '#64748b', // slate-500
  POLICY: '#a855f7',    // purple-500
  APPOINTMENT: '#14b8a6', // teal-500
  EXPENSE: '#f59e0b',   // amber-500
  episode: '#94a3b8',   // slate-400
  implicit: '#d1d5db',  // gray-300
  crash: '#dc2626',     // red-600
}

const TYPE_LABELS: Record<string, string> = {
  matter: 'Client',
  PERSON: 'Person',
  ORGANIZATION: 'Organization',
  FACILITY: 'Facility',
  INJURY: 'Injury',
  BODY_PART: 'Body Part',
  MEDICATION: 'Medication',
  CLAIM: 'Claim',
  VEHICLE_ENTITY: 'Vehicle',
  POLICY: 'Policy',
  APPOINTMENT: 'Appointment',
  EXPENSE: 'Expense',
  episode: 'Episode',
  implicit: 'Inferred',
}

export default function KnowledgeGraph({ matterId, apiUrl }: KnowledgeGraphProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [graphData, setGraphData] = useState<KnowledgeGraphData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null)
  const [includeEpisodes, setIncludeEpisodes] = useState(false)
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null)
  const simulationRef = useRef<ReturnType<typeof createSimulation> | null>(null)
  const transformRef = useRef({ x: 0, y: 0, scale: 1 })
  const dragRef = useRef<{ node: GraphNode | null; startX: number; startY: number }>({ node: null, startX: 0, startY: 0 })

  const api = apiUrl || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

  const fetchGraph = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (includeEpisodes) params.set('includeEpisodes', 'true')
      const res = await fetch(`${api}/api/case/${matterId}/graph?${params}`)
      if (!res.ok) throw new Error(`Failed to load graph: ${res.status}`)
      const data = await res.json()
      setGraphData(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load graph')
    } finally {
      setLoading(false)
    }
  }, [matterId, api, includeEpisodes])

  useEffect(() => {
    fetchGraph()
  }, [fetchGraph])

  // Run force simulation
  useEffect(() => {
    if (!graphData || !canvasRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const width = canvas.clientWidth
    const height = canvas.clientHeight
    canvas.width = width * 2 // retina
    canvas.height = height * 2
    ctx.scale(2, 2)

    const nodes = graphData.nodes.map(n => ({ ...n }))
    const edges = graphData.edges.map(e => ({
      ...e,
      source: nodes.find(n => n.id === (typeof e.source === 'string' ? e.source : e.source.id)) || e.source,
      target: nodes.find(n => n.id === (typeof e.target === 'string' ? e.target : e.target.id)) || e.target,
    }))

    // Place matter node at center
    const matterNode = nodes.find(n => n.type === 'matter')
    if (matterNode) {
      matterNode.x = width / 2
      matterNode.y = height / 2
    }

    const sim = createSimulation(nodes, edges as any, width, height)
    simulationRef.current = sim

    function draw() {
      if (!ctx) return
      const { x: tx, y: ty, scale } = transformRef.current

      ctx.clearRect(0, 0, width, height)
      ctx.save()
      ctx.translate(tx, ty)
      ctx.scale(scale, scale)

      // Draw edges
      for (const edge of edges) {
        const source = edge.source as GraphNode
        const target = edge.target as GraphNode
        if (!source.x || !source.y || !target.x || !target.y) continue

        ctx.beginPath()
        ctx.moveTo(source.x, source.y)
        ctx.lineTo(target.x, target.y)
        ctx.strokeStyle = edge.status === 'CONFIRMED'
          ? 'rgba(34, 197, 94, 0.4)'  // green
          : edge.status === 'CANDIDATE'
            ? 'rgba(59, 130, 246, 0.3)' // blue
            : 'rgba(156, 163, 175, 0.2)' // gray
        ctx.lineWidth = Math.max(0.5, edge.confidence * 2)
        ctx.stroke()

        // Edge label
        const midX = (source.x + target.x) / 2
        const midY = (source.y + target.y) / 2
        ctx.fillStyle = 'rgba(107, 114, 128, 0.6)'
        ctx.font = '9px system-ui'
        ctx.textAlign = 'center'
        ctx.fillText(edge.label, midX, midY - 3)
      }

      // Draw nodes
      for (const node of nodes) {
        if (!node.x || !node.y) continue

        const radius = node.type === 'matter' ? 20
          : node.type === 'episode' ? 6
          : node.type === 'implicit' ? 8
          : 10 + (node.confidence * 4)
        const color = TYPE_COLORS[node.type] || '#9ca3af'
        const isHovered = hoveredNode?.id === node.id
        const isSelected = selectedNode?.id === node.id

        // Node circle
        ctx.beginPath()
        ctx.arc(node.x, node.y, radius, 0, Math.PI * 2)
        ctx.fillStyle = color
        ctx.globalAlpha = 0.15 + node.confidence * 0.85
        ctx.fill()
        ctx.globalAlpha = 1

        // Border
        ctx.strokeStyle = isSelected ? '#1d4ed8' : isHovered ? '#3b82f6' : color
        ctx.lineWidth = isSelected ? 3 : isHovered ? 2 : 1
        ctx.stroke()

        // Label
        ctx.fillStyle = '#1f2937'
        ctx.font = node.type === 'matter' ? 'bold 12px system-ui' : '10px system-ui'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'top'
        const label = node.label.length > 20 ? node.label.slice(0, 18) + '...' : node.label
        ctx.fillText(label, node.x, node.y + radius + 3)
      }

      ctx.restore()
    }

    // Animation loop
    let animFrame: number
    function tick() {
      sim.tick()
      draw()
      if (sim.alpha() > 0.01) {
        animFrame = requestAnimationFrame(tick)
      }
    }
    tick()

    // Mouse interaction
    function getNodeAt(clientX: number, clientY: number): GraphNode | null {
      const rect = canvas.getBoundingClientRect()
      const { x: tx, y: ty, scale } = transformRef.current
      const mx = (clientX - rect.left - tx) / scale
      const my = (clientY - rect.top - ty) / scale

      for (const node of [...nodes].reverse()) {
        if (!node.x || !node.y) continue
        const r = node.type === 'matter' ? 20 : 12
        const dx = mx - node.x
        const dy = my - node.y
        if (dx * dx + dy * dy < r * r) return node
      }
      return null
    }

    function onMouseMove(e: MouseEvent) {
      const node = getNodeAt(e.clientX, e.clientY)
      setHoveredNode(node)
      canvas.style.cursor = node ? 'pointer' : dragRef.current.node ? 'grabbing' : 'default'

      if (dragRef.current.node) {
        const rect = canvas.getBoundingClientRect()
        const { x: tx, y: ty, scale } = transformRef.current
        dragRef.current.node.fx = (e.clientX - rect.left - tx) / scale
        dragRef.current.node.fy = (e.clientY - rect.top - ty) / scale
        sim.alpha(0.3)
        tick()
      }
    }

    function onMouseDown(e: MouseEvent) {
      const node = getNodeAt(e.clientX, e.clientY)
      if (node) {
        dragRef.current = { node, startX: e.clientX, startY: e.clientY }
        node.fx = node.x
        node.fy = node.y
      }
    }

    function onMouseUp(e: MouseEvent) {
      if (dragRef.current.node) {
        const moved = Math.abs(e.clientX - dragRef.current.startX) + Math.abs(e.clientY - dragRef.current.startY)
        if (moved < 5) {
          setSelectedNode(prev => prev?.id === dragRef.current.node?.id ? null : dragRef.current.node)
        }
        dragRef.current.node.fx = null
        dragRef.current.node.fy = null
        dragRef.current = { node: null, startX: 0, startY: 0 }
        sim.alpha(0.1)
        tick()
      }
    }

    function onWheel(e: WheelEvent) {
      e.preventDefault()
      const rect = canvas.getBoundingClientRect()
      const mouseX = e.clientX - rect.left
      const mouseY = e.clientY - rect.top
      const delta = e.deltaY > 0 ? 0.9 : 1.1
      const t = transformRef.current

      t.x = mouseX - (mouseX - t.x) * delta
      t.y = mouseY - (mouseY - t.y) * delta
      t.scale *= delta
      t.scale = Math.max(0.1, Math.min(5, t.scale))
      draw()
    }

    canvas.addEventListener('mousemove', onMouseMove)
    canvas.addEventListener('mousedown', onMouseDown)
    canvas.addEventListener('mouseup', onMouseUp)
    canvas.addEventListener('wheel', onWheel, { passive: false })

    return () => {
      cancelAnimationFrame(animFrame)
      canvas.removeEventListener('mousemove', onMouseMove)
      canvas.removeEventListener('mousedown', onMouseDown)
      canvas.removeEventListener('mouseup', onMouseUp)
      canvas.removeEventListener('wheel', onWheel)
    }
  }, [graphData, hoveredNode, selectedNode])

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="text-center">
          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
          <p className="text-sm text-gray-500">Building knowledge graph...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-96 items-center justify-center rounded-xl border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20">
        <div className="text-center">
          <p className="text-sm text-red-600">{error}</p>
          <button onClick={fetchGraph} className="mt-2 text-sm text-blue-600 hover:underline">Retry</button>
        </div>
      </div>
    )
  }

  if (!graphData) return null

  return (
    <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-4 py-3 dark:border-gray-800">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Knowledge Graph</h3>
          <p className="text-xs text-gray-500">
            {graphData.stats.nodeCount} nodes, {graphData.stats.edgeCount} relationships
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs text-gray-500">
            <input
              type="checkbox"
              checked={includeEpisodes}
              onChange={(e) => setIncludeEpisodes(e.target.checked)}
              className="rounded border-gray-300"
            />
            Show episodes
          </label>
          <button
            onClick={fetchGraph}
            className="rounded-md bg-gray-100 px-2.5 py-1 text-xs text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Graph canvas */}
      <div className="relative">
        <canvas
          ref={canvasRef}
          className="h-[500px] w-full cursor-default"
          style={{ touchAction: 'none' }}
        />

        {/* Legend */}
        <div className="absolute bottom-3 left-3 rounded-lg border border-gray-200/80 bg-white/90 p-2 backdrop-blur-sm dark:border-gray-700 dark:bg-gray-900/90">
          <div className="grid grid-cols-3 gap-x-4 gap-y-1">
            {Object.entries(TYPE_COLORS).filter(([type]) => {
              const stats = graphData.stats.entityTypes
              return type === 'matter' || stats[type] || type === 'implicit'
            }).slice(0, 9).map(([type, color]) => (
              <div key={type} className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
                <span className="text-[10px] text-gray-500">{TYPE_LABELS[type] || type}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Zoom hint */}
        <div className="absolute bottom-3 right-3 text-[10px] text-gray-400">
          Scroll to zoom, drag to pan, click nodes to inspect
        </div>
      </div>

      {/* Selected node detail */}
      {selectedNode && (
        <div className="border-t border-gray-200 px-4 py-3 dark:border-gray-800">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: TYPE_COLORS[selectedNode.type] || '#9ca3af' }} />
                <span className="text-sm font-semibold text-gray-900 dark:text-white">{selectedNode.label}</span>
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-500 dark:bg-gray-800">
                  {TYPE_LABELS[selectedNode.type] || selectedNode.type}
                </span>
              </div>
              <div className="mt-1 text-xs text-gray-500">
                Confidence: {Math.round(selectedNode.confidence * 100)}%
              </div>
            </div>
            <button
              onClick={() => setSelectedNode(null)}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          {Object.keys(selectedNode.attributes).length > 0 && (
            <div className="mt-2 rounded-md bg-gray-50 p-2 dark:bg-gray-800">
              <pre className="text-[10px] text-gray-600 dark:text-gray-400">
                {JSON.stringify(selectedNode.attributes, null, 2)}
              </pre>
            </div>
          )}
          {/* Show connected edges */}
          <div className="mt-2">
            <p className="text-[10px] font-medium text-gray-400">Relationships:</p>
            <div className="mt-1 space-y-0.5">
              {graphData.edges
                .filter(e => {
                  const sid = typeof e.source === 'string' ? e.source : e.source.id
                  const tid = typeof e.target === 'string' ? e.target : e.target.id
                  return sid === selectedNode.id || tid === selectedNode.id
                })
                .slice(0, 10)
                .map((e) => {
                  const sid = typeof e.source === 'string' ? e.source : e.source.id
                  const otherNode = graphData.nodes.find(n =>
                    n.id === (sid === selectedNode.id
                      ? (typeof e.target === 'string' ? e.target : e.target.id)
                      : sid)
                  )
                  return (
                    <div key={e.id} className="text-[10px] text-gray-500">
                      <span className="text-gray-700 dark:text-gray-300">{e.label}</span>
                      {' → '}
                      <span className="font-medium text-gray-700 dark:text-gray-300">{otherNode?.label || '?'}</span>
                      {e.status === 'CONFIRMED' && <span className="ml-1 text-green-500">&#10003;</span>}
                    </div>
                  )
                })}
            </div>
          </div>
        </div>
      )}

      {/* Stats bar */}
      <div className="flex flex-wrap gap-3 border-t border-gray-200 px-4 py-2 dark:border-gray-800">
        {Object.entries(graphData.stats.entityTypes).map(([type, count]) => (
          <span key={type} className="text-[10px] text-gray-400">
            {TYPE_LABELS[type] || type}: {count}
          </span>
        ))}
      </div>
    </div>
  )
}

// ─── Simple force simulation (no d3 dependency) ─────

function createSimulation(
  nodes: GraphNode[],
  edges: Array<{ source: GraphNode; target: GraphNode }>,
  width: number,
  height: number
) {
  let alpha = 1
  const centerX = width / 2
  const centerY = height / 2

  // Initialize positions
  for (const node of nodes) {
    if (!node.x) node.x = centerX + (Math.random() - 0.5) * 300
    if (!node.y) node.y = centerY + (Math.random() - 0.5) * 300
    node.vx = 0
    node.vy = 0
  }

  function tick() {
    alpha *= 0.99

    // Center gravity
    for (const node of nodes) {
      if (node.fx != null) { node.x = node.fx; node.vx = 0 }
      if (node.fy != null) { node.y = node.fy; node.vy = 0 }
      if (node.fx != null && node.fy != null) continue

      node.vx! += (centerX - node.x!) * 0.001 * alpha
      node.vy! += (centerY - node.y!) * 0.001 * alpha
    }

    // Repulsion between all nodes
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i]!
        const b = nodes[j]!
        const dx = b.x! - a.x!
        const dy = b.y! - a.y!
        const dist = Math.sqrt(dx * dx + dy * dy) || 1
        const force = -300 * alpha / (dist * dist)
        const fx = dx / dist * force
        const fy = dy / dist * force
        if (a.fx == null) a.vx! += fx
        if (a.fy == null) a.vy! += fy
        if (b.fx == null) b.vx! -= fx
        if (b.fy == null) b.vy! -= fy
      }
    }

    // Spring force for edges
    for (const edge of edges) {
      const source = edge.source
      const target = edge.target
      if (!source.x || !target.x) continue
      const dx = target.x - source.x
      const dy = target.y! - source.y!
      const dist = Math.sqrt(dx * dx + dy * dy) || 1
      const idealDist = 120
      const force = (dist - idealDist) * 0.005 * alpha
      const fx = dx / dist * force
      const fy = dy / dist * force
      if (source.fx == null) source.vx! += fx
      if (source.fy == null) source.vy! += fy
      if (target.fx == null) target.vx! -= fx
      if (target.fy == null) target.vy! -= fy
    }

    // Apply velocity
    for (const node of nodes) {
      if (node.fx != null || node.fy != null) continue
      node.vx! *= 0.9 // damping
      node.vy! *= 0.9
      node.x! += node.vx!
      node.y! += node.vy!
      // Bounds
      node.x = Math.max(20, Math.min(width - 20, node.x!))
      node.y = Math.max(20, Math.min(height - 20, node.y!))
    }
  }

  return {
    tick,
    alpha: (newAlpha?: number) => {
      if (newAlpha !== undefined) alpha = newAlpha
      return alpha
    },
  }
}

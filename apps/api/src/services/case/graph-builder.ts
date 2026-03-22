/**
 * Knowledge Graph Builder
 * Transforms case entities + facts into a graph structure
 * suitable for force-directed visualization.
 */

import { prisma } from '@velora/db'

export interface GraphNode {
  id: string
  label: string
  type: string // entity type or 'matter' | 'episode'
  confidence: number
  attributes: Record<string, unknown>
  group: number // for coloring
}

export interface GraphEdge {
  id: string
  source: string
  target: string
  label: string // predicate
  confidence: number
  validFrom: string
  validUntil: string | null
  status: string
}

export interface KnowledgeGraph {
  nodes: GraphNode[]
  edges: GraphEdge[]
  stats: {
    nodeCount: number
    edgeCount: number
    entityTypes: Record<string, number>
    predicates: Record<string, number>
  }
}

const TYPE_GROUPS: Record<string, number> = {
  PERSON: 1,
  ORGANIZATION: 2,
  FACILITY: 3,
  INJURY: 4,
  BODY_PART: 4,
  MEDICATION: 5,
  CLAIM: 6,
  VEHICLE_ENTITY: 7,
  POLICY: 6,
  APPOINTMENT: 8,
  EXPENSE: 9,
  matter: 0,
  crash: 10,
}

/**
 * Build the full knowledge graph for a matter.
 */
export async function buildKnowledgeGraph(
  matterId: string,
  options?: { asOf?: Date; includeRejected?: boolean; includeEpisodes?: boolean }
): Promise<KnowledgeGraph | null> {
  const matter = await prisma.matter.findUnique({
    where: { id: matterId },
    select: {
      id: true,
      clientName: true,
      status: true,
      accidentDate: true,
      crashId: true,
    },
  })

  if (!matter) return null

  // Load entities
  const entities = await prisma.caseEntity.findMany({
    where: { matterId },
    orderBy: { confidence: 'desc' },
  })

  // Load facts
  const factWhere: Record<string, unknown> = { matterId }
  if (!options?.includeRejected) {
    factWhere.status = { in: ['CONFIRMED', 'CANDIDATE'] }
  }
  if (options?.asOf) {
    factWhere.validFrom = { lte: options.asOf }
    factWhere.OR = [
      { validUntil: null },
      { validUntil: { gt: options.asOf } },
    ]
  }

  const facts = await prisma.caseFact.findMany({
    where: factWhere as any,
    orderBy: { validFrom: 'desc' },
  })

  // Build nodes
  const nodes: GraphNode[] = []
  const nodeIndex = new Map<string, string>() // normalizedName -> nodeId

  // Central matter node
  nodes.push({
    id: matter.id,
    label: matter.clientName || 'Client',
    type: 'matter',
    confidence: 1,
    attributes: {
      status: matter.status,
      accidentDate: matter.accidentDate?.toISOString(),
    },
    group: TYPE_GROUPS.matter,
  })

  // Entity nodes
  for (const entity of entities) {
    const nodeId = `entity-${entity.id}`
    nodes.push({
      id: nodeId,
      label: entity.name,
      type: entity.type,
      confidence: entity.confidence,
      attributes: entity.attributes as Record<string, unknown>,
      group: TYPE_GROUPS[entity.type] ?? 11,
    })
    nodeIndex.set(entity.normalizedName || entity.name.toLowerCase(), nodeId)
  }

  // Optionally add episode nodes
  if (options?.includeEpisodes) {
    const episodes = await prisma.episode.findMany({
      where: { matterId },
      select: { id: true, type: true, title: true, occurredAt: true },
      orderBy: { occurredAt: 'desc' },
      take: 50,
    })

    for (const ep of episodes) {
      nodes.push({
        id: `episode-${ep.id}`,
        label: ep.title || ep.type,
        type: 'episode',
        confidence: 1,
        attributes: { episodeType: ep.type, occurredAt: ep.occurredAt.toISOString() },
        group: 12,
      })
    }
  }

  // Build edges from facts
  const edges: GraphEdge[] = []
  const entityTypes: Record<string, number> = {}
  const predicates: Record<string, number> = {}

  for (const fact of facts) {
    // Try to find source and target nodes
    const sourceId = findNodeId(fact.subject, nodeIndex, matter.id, matter.clientName)
    const targetId = findNodeId(fact.object, nodeIndex, matter.id, matter.clientName)

    // If both nodes don't exist as entities, create implicit nodes
    if (!sourceId) {
      const implicitId = `implicit-${fact.subject.toLowerCase().replace(/\s+/g, '-')}`
      if (!nodes.find(n => n.id === implicitId)) {
        nodes.push({
          id: implicitId,
          label: fact.subject,
          type: 'implicit',
          confidence: fact.confidence,
          attributes: {},
          group: 11,
        })
      }
    }
    if (!targetId) {
      const implicitId = `implicit-${fact.object.toLowerCase().replace(/\s+/g, '-')}`
      if (!nodes.find(n => n.id === implicitId)) {
        nodes.push({
          id: implicitId,
          label: fact.object,
          type: 'implicit',
          confidence: fact.confidence,
          attributes: {},
          group: 11,
        })
      }
    }

    const resolvedSource = sourceId || `implicit-${fact.subject.toLowerCase().replace(/\s+/g, '-')}`
    const resolvedTarget = targetId || `implicit-${fact.object.toLowerCase().replace(/\s+/g, '-')}`

    edges.push({
      id: `fact-${fact.id}`,
      source: resolvedSource,
      target: resolvedTarget,
      label: fact.predicate.replace(/_/g, ' '),
      confidence: fact.confidence,
      validFrom: fact.validFrom.toISOString(),
      validUntil: fact.validUntil?.toISOString() ?? null,
      status: fact.status,
    })

    predicates[fact.predicate] = (predicates[fact.predicate] || 0) + 1
  }

  // Count entity types
  for (const entity of entities) {
    entityTypes[entity.type] = (entityTypes[entity.type] || 0) + 1
  }

  return {
    nodes,
    edges,
    stats: {
      nodeCount: nodes.length,
      edgeCount: edges.length,
      entityTypes,
      predicates,
    },
  }
}

function findNodeId(
  name: string,
  nodeIndex: Map<string, string>,
  matterId: string,
  clientName: string | null
): string | null {
  const normalized = name.toLowerCase().trim()

  // Check if it's the client/matter
  if (normalized === 'client' || normalized === clientName?.toLowerCase()) {
    return matterId
  }

  // Check entity index
  if (nodeIndex.has(normalized)) {
    return nodeIndex.get(normalized)!
  }

  // Fuzzy match: check if any entity name contains this name or vice versa
  for (const [key, id] of nodeIndex.entries()) {
    if (key.includes(normalized) || normalized.includes(key)) {
      return id
    }
  }

  return null
}

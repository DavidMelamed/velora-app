import { prisma } from '@velora/db'

const GRAPH_NAME = 'velora_graph'

/**
 * Check if Apache AGE extension is available
 */
export async function isGraphAvailable(): Promise<boolean> {
  try {
    const result = await prisma.$queryRawUnsafe<{ extname: string }[]>(
      `SELECT extname FROM pg_extension WHERE extname = 'age'`
    )
    return result.length > 0
  } catch {
    return false
  }
}

/**
 * Execute a Cypher query against the Apache AGE graph
 */
export async function cypher<T = unknown>(
  query: string,
  returnType: string = 'result agtype'
): Promise<T[]> {
  const available = await isGraphAvailable()
  if (!available) {
    console.warn('Apache AGE not available — graph queries disabled')
    return []
  }

  await prisma.$executeRawUnsafe(`LOAD 'age';`)
  await prisma.$executeRawUnsafe(`SET search_path = ag_catalog, "$user", public;`)

  return prisma.$queryRawUnsafe<T[]>(
    `SELECT * FROM ag_catalog.cypher('${GRAPH_NAME}', $$ ${query} $$) AS (${returnType})`
  )
}

/**
 * Create a crash node in the graph
 */
export async function createCrashNode(crashId: string, properties: {
  stateCode: string
  crashDate: string
  severity?: string
  latitude?: number
  longitude?: number
}): Promise<void> {
  const props = JSON.stringify({ id: crashId, ...properties })
  await cypher(
    `CREATE (c:Crash ${props}) RETURN c`,
    'c agtype'
  )
}

/**
 * Create an intersection node in the graph
 */
export async function createIntersectionNode(intersectionId: string, properties: {
  name: string
  stateCode: string
  latitude: number
  longitude: number
  dangerScore?: number
}): Promise<void> {
  const props = JSON.stringify({ id: intersectionId, ...properties })
  await cypher(
    `CREATE (i:Intersection ${props}) RETURN i`,
    'i agtype'
  )
}

/**
 * Create an OCCURRED_AT edge between a crash and an intersection
 */
export async function createOccurredAtEdge(crashId: string, intersectionId: string): Promise<void> {
  await cypher(
    `MATCH (c:Crash {id: '${crashId}'}), (i:Intersection {id: '${intersectionId}'})
     CREATE (c)-[r:OCCURRED_AT]->(i)
     RETURN r`,
    'r agtype'
  )
}

/**
 * Find crashes connected to a specific intersection
 */
export async function findCrashesAtIntersection(intersectionId: string, limit: number = 50): Promise<unknown[]> {
  return cypher(
    `MATCH (c:Crash)-[:OCCURRED_AT]->(i:Intersection {id: '${intersectionId}'})
     RETURN c
     ORDER BY c.crashDate DESC
     LIMIT ${limit}`,
    'c agtype'
  )
}

/**
 * Find dangerous intersections by crash count
 */
export async function findDangerousIntersections(stateCode: string, limit: number = 20): Promise<unknown[]> {
  return cypher(
    `MATCH (c:Crash)-[:OCCURRED_AT]->(i:Intersection {stateCode: '${stateCode}'})
     WITH i, count(c) AS crashCount
     ORDER BY crashCount DESC
     LIMIT ${limit}
     RETURN i, crashCount`,
    'i agtype, crashCount agtype'
  )
}

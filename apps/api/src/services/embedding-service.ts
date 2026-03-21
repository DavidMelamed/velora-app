import { prisma } from '@velora/db'

// Configuration
const EMBEDDING_MODEL = 'text-embedding-3-small'
const EMBEDDING_DIMENSIONS = 1536

interface EmbeddingResult {
  crashId: string
  similarity: number
}

/**
 * Generate embedding for crash text using OpenAI API
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: text,
      dimensions: EMBEDDING_DIMENSIONS,
    }),
  })

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`)
  }

  const data = await response.json()
  return data.data[0].embedding
}

/**
 * Store crash embedding in database
 */
export async function storeCrashEmbedding(crashId: string, text: string): Promise<void> {
  const embedding = await generateEmbedding(text)
  const vectorStr = `[${embedding.join(',')}]`

  await prisma.$executeRawUnsafe(
    `INSERT INTO "CrashEmbedding" (id, "crashId", embedding, model, "createdAt")
     VALUES (gen_random_uuid(), $1, $2::vector, $3, NOW())
     ON CONFLICT ("crashId") DO UPDATE SET embedding = $2::vector, "createdAt" = NOW()`,
    crashId,
    vectorStr,
    EMBEDDING_MODEL
  )
}

/**
 * Find similar crashes by vector similarity
 */
export async function findSimilarCrashes(
  crashId: string,
  limit: number = 10
): Promise<EmbeddingResult[]> {
  const results = await prisma.$queryRawUnsafe<EmbeddingResult[]>(
    `SELECT ce2."crashId", 1 - (ce1.embedding <=> ce2.embedding) as similarity
     FROM "CrashEmbedding" ce1
     JOIN "CrashEmbedding" ce2 ON ce1."crashId" != ce2."crashId"
     WHERE ce1."crashId" = $1
     ORDER BY ce1.embedding <=> ce2.embedding
     LIMIT $2`,
    crashId,
    limit
  )
  return results
}

/**
 * Semantic search across crash embeddings
 */
export async function semanticSearchCrashes(
  queryText: string,
  limit: number = 10
): Promise<EmbeddingResult[]> {
  const embedding = await generateEmbedding(queryText)
  const vectorStr = `[${embedding.join(',')}]`

  const results = await prisma.$queryRawUnsafe<EmbeddingResult[]>(
    `SELECT "crashId", 1 - (embedding <=> $1::vector) as similarity
     FROM "CrashEmbedding"
     ORDER BY embedding <=> $1::vector
     LIMIT $2`,
    vectorStr,
    limit
  )
  return results
}

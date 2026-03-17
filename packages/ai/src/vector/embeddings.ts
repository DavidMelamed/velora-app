/**
 * Embedding generation using Qwen3-Embedding-8B via OpenRouter.
 * Uses OpenAI-compatible API endpoint.
 */
import OpenAI from 'openai'

const EMBEDDING_MODEL = 'qwen/qwen3-embedding-8b'
const EMBEDDING_DIMS = 1024 // Matryoshka truncation from native 4096 — balances quality vs storage

let client: OpenAI | null = null

function getClient(): OpenAI {
  if (!client) {
    const apiKey = process.env.OPENROUTER_API_KEY
    if (!apiKey) throw new Error('OPENROUTER_API_KEY is required for embeddings')
    client = new OpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey,
    })
  }
  return client
}

/**
 * Generate an embedding for a single text string.
 * Returns a normalized float array of EMBEDDING_DIMS dimensions.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await getClient().embeddings.create({
    model: EMBEDDING_MODEL,
    input: text.slice(0, 8000), // ~2K tokens safety limit
  })
  const fullVector = response.data[0].embedding
  // Matryoshka truncation: take first N dims and re-normalize
  const truncated = fullVector.slice(0, EMBEDDING_DIMS)
  const norm = Math.sqrt(truncated.reduce((sum, v) => sum + v * v, 0))
  return norm > 0 ? truncated.map(v => v / norm) : truncated
}

/**
 * Generate embeddings for multiple texts in a single API call.
 * OpenRouter supports batch input.
 */
export async function generateEmbeddingsBatch(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return []

  const response = await getClient().embeddings.create({
    model: EMBEDDING_MODEL,
    input: texts.map(t => t.slice(0, 8000)),
  })

  return response.data
    .sort((a, b) => a.index - b.index)
    .map(d => {
      const truncated = d.embedding.slice(0, EMBEDDING_DIMS)
      const norm = Math.sqrt(truncated.reduce((sum, v) => sum + v * v, 0))
      return norm > 0 ? truncated.map(v => v / norm) : truncated
    })
}

/**
 * Build a review embedding text from review data.
 * Combines rating, author context, and review text into a single string
 * optimized for semantic similarity search.
 */
export function buildReviewEmbeddingText(review: {
  text: string
  rating: number
  authorName?: string | null
  practiceArea?: string | null
  attorneyName?: string | null
  city?: string | null
  stateCode?: string | null
}): string {
  const parts: string[] = []
  if (review.attorneyName) parts.push(`Attorney: ${review.attorneyName}`)
  if (review.city && review.stateCode) parts.push(`Location: ${review.city}, ${review.stateCode}`)
  if (review.practiceArea) parts.push(`Practice area: ${review.practiceArea}`)
  parts.push(`Rating: ${review.rating}/5`)
  parts.push(review.text)
  return parts.join('\n')
}

export { EMBEDDING_MODEL, EMBEDDING_DIMS }

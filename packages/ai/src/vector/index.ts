export {
  generateEmbedding,
  generateEmbeddingsBatch,
  buildReviewEmbeddingText,
  EMBEDDING_MODEL,
  EMBEDDING_DIMS,
} from './embeddings'

export {
  initCollection,
  upsertReviews,
  searchSimilar,
  hybridSearch,
  ensurePayloadIndexes,
  getCollectionInfo,
  COLLECTION_NAME,
} from './qdrant-store'

export type { ReviewPoint } from './qdrant-store'

export { rerankAndEnrich } from './reranker'
export type { VectorHit, RankedAttorneyResult } from './reranker'

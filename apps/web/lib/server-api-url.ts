import 'server-only'

export const SERVER_API_URL =
  process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

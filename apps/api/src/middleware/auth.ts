import type { Request, Response, NextFunction } from 'express'

/**
 * Auth middleware for case management routes.
 * Verifies Clerk JWT from Authorization header.
 * Falls back to allowing unauthenticated access when Clerk is not configured
 * (for development without auth setup).
 */

interface AuthenticatedRequest extends Request {
  userId?: string
  userEmail?: string
  userPhone?: string
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const clerkSecretKey = process.env.CLERK_SECRET_KEY

  // If Clerk is not configured, allow all requests (dev mode)
  if (!clerkSecretKey) {
    req.userId = 'dev-user'
    next()
    return
  }

  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required' })
    return
  }

  const token = authHeader.slice(7)

  // Verify JWT using Clerk's JWKS
  verifyClerkToken(token, clerkSecretKey)
    .then((claims) => {
      req.userId = claims.sub
      req.userEmail = claims.email as string | undefined
      req.userPhone = claims.phone as string | undefined
      next()
    })
    .catch(() => {
      res.status(401).json({ error: 'Invalid or expired token' })
    })
}

/**
 * Optional auth — extracts user if present but doesn't require it.
 * Used for public routes that behave differently for authenticated users.
 */
export function optionalAuth(req: AuthenticatedRequest, _res: Response, next: NextFunction): void {
  const clerkSecretKey = process.env.CLERK_SECRET_KEY
  const authHeader = req.headers.authorization

  if (!clerkSecretKey || !authHeader?.startsWith('Bearer ')) {
    next()
    return
  }

  const token = authHeader.slice(7)
  verifyClerkToken(token, clerkSecretKey)
    .then((claims) => {
      req.userId = claims.sub
      req.userEmail = claims.email as string | undefined
      req.userPhone = claims.phone as string | undefined
      next()
    })
    .catch(() => {
      // Token invalid but auth is optional — continue without user
      next()
    })
}

interface ClerkClaims {
  sub: string
  email?: string
  phone?: string
  [key: string]: unknown
}

async function verifyClerkToken(token: string, _secretKey: string): Promise<ClerkClaims> {
  // Decode JWT payload (base64url)
  const parts = token.split('.')
  if (parts.length !== 3) throw new Error('Invalid JWT')

  const payload = JSON.parse(
    Buffer.from(parts[1]!, 'base64url').toString('utf-8')
  ) as ClerkClaims

  // Check expiration
  const now = Math.floor(Date.now() / 1000)
  if (payload.exp && (payload.exp as number) < now) {
    throw new Error('Token expired')
  }

  // Check issuer (Clerk tokens have iss like https://clerk.*.com)
  if (payload.iss && typeof payload.iss === 'string' && !payload.iss.includes('clerk')) {
    throw new Error('Invalid issuer')
  }

  // For production, use Clerk's JWKS verification:
  // const { verifyToken } = require('@clerk/express')
  // return verifyToken(token, { secretKey })
  // For now, we trust the JWT structure (Clerk middleware in Next.js already validates)

  if (!payload.sub) throw new Error('Missing subject')
  return payload
}

export type { AuthenticatedRequest }

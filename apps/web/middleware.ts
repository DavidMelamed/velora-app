/**
 * Clerk Auth Middleware for Next.js
 * Protects /case/* routes, allows everything else public.
 * Only active when CLERK_SECRET_KEY is set.
 */

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  // If Clerk is not configured, allow all requests
  if (!process.env.CLERK_SECRET_KEY) {
    return NextResponse.next()
  }

  // Protect case management routes
  if (request.nextUrl.pathname.startsWith('/case/')) {
    // Check for Clerk session cookie
    const sessionToken = request.cookies.get('__session')?.value ||
                         request.cookies.get('__clerk_db_jwt')?.value

    if (!sessionToken) {
      // Redirect to sign-in with return URL
      const signInUrl = new URL('/sign-in', request.url)
      signInUrl.searchParams.set('redirect_url', request.nextUrl.pathname)
      return NextResponse.redirect(signInUrl)
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/case/:path*'],
}

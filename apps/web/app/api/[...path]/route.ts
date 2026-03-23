import { NextRequest, NextResponse } from 'next/server'
import { SERVER_API_URL } from '@/lib/server-api-url'

export const dynamic = 'force-dynamic'
export const revalidate = 0

async function proxyRequest(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params
  const upstreamUrl = new URL(
    `/api/${path.join('/')}${request.nextUrl.search}`,
    SERVER_API_URL,
  )

  const headers = new Headers(request.headers)
  headers.delete('host')
  headers.delete('content-length')

  const init: RequestInit = {
    method: request.method,
    headers,
    cache: 'no-store',
    redirect: 'manual',
  }

  if (!['GET', 'HEAD'].includes(request.method)) {
    const body = await request.arrayBuffer()
    if (body.byteLength > 0) {
      init.body = body
    }
  }

  try {
    const response = await fetch(upstreamUrl, init)
    const responseHeaders = new Headers(response.headers)
    responseHeaders.delete('content-length')

    return new NextResponse(await response.arrayBuffer(), {
      status: response.status,
      headers: responseHeaders,
    })
  } catch {
    return NextResponse.json(
      { error: `Failed to connect to upstream API at ${SERVER_API_URL}` },
      { status: 502 },
    )
  }
}

export const GET = proxyRequest
export const POST = proxyRequest
export const PUT = proxyRequest
export const PATCH = proxyRequest
export const DELETE = proxyRequest
export const OPTIONS = proxyRequest

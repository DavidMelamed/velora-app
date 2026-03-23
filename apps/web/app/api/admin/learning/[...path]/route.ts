import { NextRequest, NextResponse } from 'next/server'
import { SERVER_API_URL } from '@/lib/server-api-url'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params
  const subPath = path.join('/')
  const searchParams = request.nextUrl.searchParams.toString()
  const url = `${SERVER_API_URL}/api/admin/learning/${subPath}${searchParams ? `?${searchParams}` : ''}`

  try {
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      next: { revalidate: 60 },
    })

    if (!res.ok) {
      return NextResponse.json(
        { error: `Upstream API returned ${res.status}` },
        { status: res.status }
      )
    }

    const data = await res.json()
    return NextResponse.json(data)
  } catch {
    return NextResponse.json(
      { error: 'Failed to connect to API' },
      { status: 502 }
    )
  }
}

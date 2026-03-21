import { NextResponse } from 'next/server'

export async function GET() {
  const diagnostics: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    env: {
      DATABASE_URL_SET: !!process.env.DATABASE_URL,
      DATABASE_URL_PREFIX: process.env.DATABASE_URL?.substring(0, 30) + '...',
      NODE_ENV: process.env.NODE_ENV,
    },
  }

  try {
    const { prisma } = await import('@velora/db')
    const count = await prisma.crash.count()
    diagnostics.database = { connected: true, crashCount: count }
  } catch (error) {
    diagnostics.database = {
      connected: false,
      error: (error as Error).message,
      name: (error as Error).name,
      stack: (error as Error).stack?.split('\n').slice(0, 5),
    }
  }

  return NextResponse.json(diagnostics, {
    status: diagnostics.database && (diagnostics.database as Record<string, unknown>).connected ? 200 : 500,
  })
}

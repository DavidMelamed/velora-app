/**
 * Creates the 'payload' schema for PayloadCMS isolation.
 * Run this BEFORE the first PayloadCMS migration.
 *
 * Usage: DATABASE_URL=... npx tsx scripts/create-payload-schema.ts
 */
import { PrismaClient } from '@prisma/client'

async function main() {
  const prisma = new PrismaClient()

  try {
    await prisma.$executeRawUnsafe('CREATE SCHEMA IF NOT EXISTS payload')
    console.log('[DB] Created "payload" schema (or already exists)')

    // Also enable pgvector extension
    await prisma.$executeRawUnsafe('CREATE EXTENSION IF NOT EXISTS vector')
    console.log('[DB] Enabled "vector" extension (or already exists)')
  } catch (error) {
    console.error('[DB] Error:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

main()

#!/bin/bash
# Vercel build script: generates Prisma client, builds Next.js, copies engine binary
set -e

echo "=== Step 1: Generate Prisma Client ==="
pnpm turbo db:generate

echo "=== Step 2: Copy engine to apps/web/.prisma/client (pre-build) ==="
mkdir -p apps/web/.prisma/client
ENGINE=$(find . -name 'libquery_engine-rhel-openssl-3.0.x.so.node' -type f 2>/dev/null | head -1)
if [ -n "$ENGINE" ]; then
  echo "Found engine at: $ENGINE"
  cp "$ENGINE" apps/web/.prisma/client/
  # Copy schema.prisma from the generated client
  SCHEMA=$(find . -path '*/.prisma/client/schema.prisma' -type f 2>/dev/null | head -1)
  if [ -n "$SCHEMA" ]; then
    cp "$SCHEMA" apps/web/.prisma/client/
  fi
  echo "Pre-build copy done:"
  ls -la apps/web/.prisma/client/
else
  echo "WARNING: Could not find Prisma engine binary!"
fi

echo "=== Step 3: Build Next.js ==="
pnpm turbo build --filter=@velora/web...

echo "=== Step 4: Copy engine to .next/server (post-build) ==="
if [ -n "$ENGINE" ]; then
  cp "$ENGINE" apps/web/.next/server/ 2>/dev/null || true
  echo "Post-build copy to .next/server:"
  ls -la apps/web/.next/server/libquery_engine* 2>/dev/null || echo "No engine in .next/server"
fi

echo "=== Step 5: Verify .next/server/chunks contents ==="
ls apps/web/.next/server/chunks/ 2>/dev/null | head -10
find apps/web/.next -name 'libquery*' 2>/dev/null || echo "No engine found in .next"

echo "=== Build complete ==="

#!/bin/bash
# Vercel build script: generates Prisma client, copies engine binary, builds Next.js
set -e

echo "=== Step 1: Generate Prisma Client ==="
pnpm turbo db:generate

echo "=== Step 2: Find Prisma engine binaries ==="
find . -name 'libquery_engine*' -type f 2>/dev/null || echo "No engine binaries found!"
find . -name '*.so.node' -type f 2>/dev/null || echo "No .so.node files found!"

echo "=== Step 3: Copy engine to apps/web/.prisma/client ==="
mkdir -p apps/web/.prisma/client

# Find and copy the rhel engine binary
ENGINE=$(find . -name 'libquery_engine-rhel-openssl-3.0.x.so.node' -type f 2>/dev/null | head -1)
if [ -n "$ENGINE" ]; then
  echo "Found engine at: $ENGINE"
  cp "$ENGINE" apps/web/.prisma/client/
  # Also copy schema.prisma
  find . -name 'schema.prisma' -path '*/.prisma/*' -exec cp {} apps/web/.prisma/client/ \; 2>/dev/null || true
  echo "Copied engine to apps/web/.prisma/client/"
  ls -la apps/web/.prisma/client/
else
  echo "WARNING: Could not find Prisma engine binary!"
fi

echo "=== Step 4: Build Next.js ==="
pnpm turbo build --filter=@velora/web...

echo "=== Build complete ==="

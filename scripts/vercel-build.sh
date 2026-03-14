#!/bin/bash
# Vercel build script
set -e

echo "=== Step 1: Generate Prisma Client ==="
pnpm turbo db:generate

echo "=== Step 2: Build Next.js ==="
pnpm turbo build --filter=@velora/web...

echo "=== Build complete ==="

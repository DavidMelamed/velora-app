#!/bin/bash
# Vercel build script
set -e

echo "=== Step 1: Generate Prisma Client ==="
pnpm turbo db:generate

echo "=== Step 2: Build Next.js (force fresh) ==="
pnpm turbo build --filter=@velora/web... --force

echo "=== Build complete ==="

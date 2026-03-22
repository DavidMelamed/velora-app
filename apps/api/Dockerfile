FROM node:22-slim AS base
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
RUN npm i -g pnpm@10

WORKDIR /app

# Copy all workspace config files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json .npmrc ./

# Copy ALL source files first (before install to avoid symlink conflicts)
COPY packages/ packages/
COPY apps/api/ apps/api/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Generate Prisma client
RUN DATABASE_URL="postgresql://x:x@localhost/x" ./node_modules/.bin/prisma generate --schema=packages/db/prisma/schema.prisma

EXPOSE 4000
CMD ["./node_modules/.bin/tsx", "apps/api/src/index.ts"]

import { withPayload } from '@payloadcms/next/withPayload'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@velora/ui', '@velora/shared', '@velora/ai'],
  outputFileTracingRoot: path.join(__dirname, '../../'),
  outputFileTracingIncludes: {
    '/**': [
      './apps/web/.prisma/client/**/*',
    ],
  },
}

export default withPayload(nextConfig)

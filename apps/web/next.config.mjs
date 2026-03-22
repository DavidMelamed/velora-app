import { withPayload } from '@payloadcms/next/withPayload'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@velora/ui', '@velora/shared', '@velora/ai'],
  outputFileTracingRoot: path.join(__dirname, '../../'),
}

export default withPayload(nextConfig)


// Force cache bust - remove after deploy

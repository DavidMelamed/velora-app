import { withPayload } from '@payloadcms/next/withPayload'

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@velora/ui', '@velora/shared', '@velora/ai'],
}

export default withPayload(nextConfig)

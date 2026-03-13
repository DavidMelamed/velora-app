import { buildConfig } from 'payload'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { fileURLToPath } from 'url'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  admin: {
    user: 'users',
    importMap: {
      baseDir: path.resolve(dirname),
    },
  },
  editor: lexicalEditor(),
  db: postgresAdapter({
    pool: { connectionString: process.env.DATABASE_URL || '' },
    schemaName: 'payload', // CRITICAL: isolates Payload from Prisma's public schema
  }),
  secret: process.env.PAYLOAD_SECRET || 'velora-dev-secret-change-in-production',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  collections: [
    // Users (admin/editor access)
    {
      slug: 'users',
      auth: true,
      fields: [
        {
          name: 'role',
          type: 'select',
          options: ['admin', 'editor'],
          defaultValue: 'editor',
        },
      ],
    },
    // Legal guides (Phase 6 - programmatic SEO)
    {
      slug: 'legal-guides',
      fields: [
        { name: 'title', type: 'text', required: true },
        { name: 'stateCode', type: 'text', required: true },
        {
          name: 'category',
          type: 'select',
          options: ['statute-of-limitations', 'fault-types', 'insurance-requirements', 'what-to-do'],
        },
        { name: 'content', type: 'richText' },
        { name: 'seoTitle', type: 'text' },
        { name: 'seoDescription', type: 'textarea' },
      ],
    },
    // Attorney profiles (Phase 1)
    {
      slug: 'attorney-profiles',
      fields: [
        { name: 'attorneyId', type: 'text', required: true },
        { name: 'bio', type: 'richText' },
        { name: 'headshot', type: 'upload', relationTo: 'media' },
        { name: 'featured', type: 'checkbox', defaultValue: false },
      ],
    },
    // Media uploads
    {
      slug: 'media',
      upload: {
        staticDir: path.resolve(dirname, 'media'),
      },
      fields: [{ name: 'alt', type: 'text' }],
    },
  ],
  globals: [
    {
      slug: 'site-settings',
      fields: [
        { name: 'siteName', type: 'text', defaultValue: 'Velora' },
        { name: 'tagline', type: 'text' },
        { name: 'disclaimerText', type: 'textarea' },
      ],
    },
  ],
})

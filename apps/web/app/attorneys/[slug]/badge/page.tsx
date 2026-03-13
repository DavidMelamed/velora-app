import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { prisma } from '@velora/db'

interface BadgePageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: BadgePageProps): Promise<Metadata> {
  const { slug } = await params
  const attorney = await prisma.attorney.findUnique({
    where: { slug },
    select: { name: true },
  })

  return {
    title: attorney
      ? `Badge Embed Code — ${attorney.name} | Velora`
      : 'Attorney Not Found',
  }
}

export default async function AttorneyBadgePage({ params }: BadgePageProps) {
  const { slug } = await params
  const attorney = await prisma.attorney.findUnique({
    where: { slug },
    select: { name: true, slug: true, firmName: true },
  })

  if (!attorney) {
    notFound()
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://velora.com'

  const htmlEmbed = `<a href="${baseUrl}/attorneys/${attorney.slug}" target="_blank" rel="noopener">
  <img src="${baseUrl}/api/badge/${attorney.slug}" alt="Velora Verified Attorney" width="200" height="56" />
</a>`

  const widgetEmbed = `<script src="${baseUrl}/embed/velora-widgets.js"></script>
<velora-attorney-badge slug="${attorney.slug}" theme="light"></velora-attorney-badge>`

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
        Badge for {attorney.name}
      </h1>
      {attorney.firmName && (
        <p className="mt-1 text-gray-600 dark:text-gray-400">{attorney.firmName}</p>
      )}

      {/* Preview */}
      <section className="mt-8">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Preview</h2>
        <div className="mt-4 flex gap-8">
          <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
            <p className="mb-2 text-xs text-gray-500">Light</p>
            {/* eslint-disable-next-line */}
            <img
              src={`/api/badge/${attorney.slug}?theme=light`}
              alt="Light badge preview"
              width={200}
              height={56}
            />
          </div>
          <div className="rounded-lg border border-gray-700 bg-gray-900 p-6">
            <p className="mb-2 text-xs text-gray-400">Dark</p>
            {/* eslint-disable-next-line */}
            <img
              src={`/api/badge/${attorney.slug}?theme=dark`}
              alt="Dark badge preview"
              width={200}
              height={56}
            />
          </div>
        </div>
      </section>

      {/* HTML Embed */}
      <section className="mt-8">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Option 1: Simple Image Embed
        </h2>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Copy and paste this HTML into your website:
        </p>
        <pre className="mt-3 overflow-x-auto rounded-lg bg-gray-900 p-4 text-sm text-green-400">
          {htmlEmbed}
        </pre>
      </section>

      {/* Widget Embed */}
      <section className="mt-8">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Option 2: Web Component
        </h2>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Use the Velora Web Component for a richer experience:
        </p>
        <pre className="mt-3 overflow-x-auto rounded-lg bg-gray-900 p-4 text-sm text-green-400">
          {widgetEmbed}
        </pre>
      </section>

      <div className="mt-8">
        <a
          href={`/attorneys/${attorney.slug}`}
          className="text-blue-600 hover:underline dark:text-blue-400"
        >
          Back to attorney profile
        </a>
      </div>
    </main>
  )
}

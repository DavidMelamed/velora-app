import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Embeddable Widgets — Developer Documentation | Velora',
  description: 'Embed Velora crash maps, intersection stats, and attorney badges on your website.',
}

export default function EmbedDocsPage() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://velora.com'

  return (
    <main className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
        Embeddable Widgets
      </h1>
      <p className="mt-3 text-lg text-gray-600 dark:text-gray-400">
        Add Velora crash data to your website with simple HTML tags. All widgets use Shadow DOM for
        style isolation.
      </p>

      {/* Installation */}
      <section className="mt-10">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Installation</h2>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Add this script tag to your page:
        </p>
        <pre className="mt-3 overflow-x-auto rounded-lg bg-gray-900 p-4 text-sm text-green-400">
          {`<script src="${baseUrl}/embed/velora-widgets.js"></script>`}
        </pre>
      </section>

      {/* Crash Map */}
      <section className="mt-10">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          Crash Map
        </h2>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Display a map centered on a crash location.
        </p>
        <pre className="mt-3 overflow-x-auto rounded-lg bg-gray-900 p-4 text-sm text-green-400">
          {`<velora-crash-map
  latitude="39.7392"
  longitude="-104.9903"
  zoom="14"
  width="100%"
  height="300px"
></velora-crash-map>`}
        </pre>
        <div className="mt-4 rounded-lg border border-gray-200 p-4 dark:border-gray-700">
          <h3 className="text-sm font-medium text-gray-500">Attributes</h3>
          <table className="mt-2 w-full text-sm">
            <thead>
              <tr className="border-b dark:border-gray-700">
                <th className="py-2 text-left font-medium">Attribute</th>
                <th className="py-2 text-left font-medium">Default</th>
                <th className="py-2 text-left font-medium">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-gray-700">
              <tr><td className="py-2"><code>latitude</code></td><td>39.8283</td><td>Latitude</td></tr>
              <tr><td className="py-2"><code>longitude</code></td><td>-98.5795</td><td>Longitude</td></tr>
              <tr><td className="py-2"><code>zoom</code></td><td>12</td><td>Map zoom level</td></tr>
              <tr><td className="py-2"><code>width</code></td><td>100%</td><td>Widget width</td></tr>
              <tr><td className="py-2"><code>height</code></td><td>300px</td><td>Widget height</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Intersection Widget */}
      <section className="mt-10">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          Intersection Stats
        </h2>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Display crash statistics for an intersection.
        </p>
        <pre className="mt-3 overflow-x-auto rounded-lg bg-gray-900 p-4 text-sm text-green-400">
          {`<velora-intersection
  address="Colfax Ave & Broadway"
  state="CO"
  theme="light"
></velora-intersection>`}
        </pre>
        <div className="mt-4 rounded-lg border border-gray-200 p-4 dark:border-gray-700">
          <h3 className="text-sm font-medium text-gray-500">Attributes</h3>
          <table className="mt-2 w-full text-sm">
            <thead>
              <tr className="border-b dark:border-gray-700">
                <th className="py-2 text-left font-medium">Attribute</th>
                <th className="py-2 text-left font-medium">Required</th>
                <th className="py-2 text-left font-medium">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-gray-700">
              <tr><td className="py-2"><code>address</code></td><td>Yes</td><td>Intersection or street address</td></tr>
              <tr><td className="py-2"><code>state</code></td><td>Yes</td><td>Two-letter state code</td></tr>
              <tr><td className="py-2"><code>theme</code></td><td>No</td><td>light or dark</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Attorney Badge */}
      <section className="mt-10">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          Attorney Badge
        </h2>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Display a Velora-verified attorney badge that links to the attorney profile.
        </p>
        <pre className="mt-3 overflow-x-auto rounded-lg bg-gray-900 p-4 text-sm text-green-400">
          {`<velora-attorney-badge
  slug="john-doe-co"
  theme="light"
></velora-attorney-badge>`}
        </pre>
        <div className="mt-4 rounded-lg border border-gray-200 p-4 dark:border-gray-700">
          <h3 className="text-sm font-medium text-gray-500">Attributes</h3>
          <table className="mt-2 w-full text-sm">
            <thead>
              <tr className="border-b dark:border-gray-700">
                <th className="py-2 text-left font-medium">Attribute</th>
                <th className="py-2 text-left font-medium">Required</th>
                <th className="py-2 text-left font-medium">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-gray-700">
              <tr><td className="py-2"><code>slug</code></td><td>Yes</td><td>Attorney slug from Velora</td></tr>
              <tr><td className="py-2"><code>theme</code></td><td>No</td><td>light or dark</td></tr>
            </tbody>
          </table>
        </div>
      </section>
    </main>
  )
}

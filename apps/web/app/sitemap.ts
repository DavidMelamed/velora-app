import type { MetadataRoute } from 'next'

/**
 * Sitemap Index — Points to per-tier sitemaps.
 * Each tier has max 50K URLs per sitemap file.
 */

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://velora.com'

const TIERS = ['core', 'states', 'cities', 'attributes', 'temporal', 'attorneys', 'crashes']

export default function sitemap(): MetadataRoute.Sitemap {
  // Return a sitemap index pointing to per-tier sitemaps
  return TIERS.map((tier) => ({
    url: `${BASE_URL}/sitemap/${tier}`,
    lastModified: new Date(),
  }))
}

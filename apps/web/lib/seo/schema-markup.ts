/**
 * JSON-LD Schema Markup — Structured data for all page types.
 * Returns objects ready to be serialized into <script type="application/ld+json">.
 */

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://velora.com'

/**
 * Event schema for crash pages
 */
export function crashEventSchema(crash: {
  id: string
  crashDate: string
  location: string
  stateCode: string
  severity?: string | null
  latitude?: number | null
  longitude?: number | null
  vehicleCount: number
  personCount: number
  description?: string
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: `Traffic Crash: ${crash.location}`,
    description: crash.description ?? `${crash.severity?.replace(/_/g, ' ') ?? 'Unknown severity'} crash in ${crash.location}`,
    startDate: crash.crashDate,
    location: {
      '@type': 'Place',
      name: crash.location,
      address: {
        '@type': 'PostalAddress',
        addressRegion: crash.stateCode,
      },
      ...(crash.latitude && crash.longitude
        ? {
            geo: {
              '@type': 'GeoCoordinates',
              latitude: crash.latitude,
              longitude: crash.longitude,
            },
          }
        : {}),
    },
    url: `${BASE_URL}/crash/${crash.id}`,
    organizer: {
      '@type': 'Organization',
      name: 'Velora',
      url: BASE_URL,
    },
  }
}

/**
 * Dataset schema for data/statistics pages
 */
export function datasetSchema(dataset: {
  name: string
  description: string
  url: string
  dateModified?: string
  spatialCoverage?: string
  temporalCoverage?: string
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    name: dataset.name,
    description: dataset.description,
    url: `${BASE_URL}${dataset.url}`,
    creator: {
      '@type': 'Organization',
      name: 'Velora',
      url: BASE_URL,
    },
    license: 'https://creativecommons.org/licenses/by/4.0/',
    dateModified: dataset.dateModified ?? new Date().toISOString().split('T')[0],
    ...(dataset.spatialCoverage ? { spatialCoverage: dataset.spatialCoverage } : {}),
    ...(dataset.temporalCoverage ? { temporalCoverage: dataset.temporalCoverage } : {}),
  }
}

/**
 * LegalService schema for attorney pages
 */
export function legalServiceSchema(attorney: {
  name: string
  slug: string
  firmName?: string | null
  city?: string | null
  stateCode?: string | null
  phone?: string | null
  website?: string | null
  indexScore?: number
  reviewCount?: number
  practiceAreas?: string[]
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'LegalService',
    name: attorney.firmName ?? attorney.name,
    url: `${BASE_URL}/attorneys/${attorney.slug}`,
    ...(attorney.website ? { sameAs: attorney.website } : {}),
    ...(attorney.phone ? { telephone: attorney.phone } : {}),
    ...(attorney.city || attorney.stateCode
      ? {
          address: {
            '@type': 'PostalAddress',
            ...(attorney.city ? { addressLocality: attorney.city } : {}),
            ...(attorney.stateCode ? { addressRegion: attorney.stateCode } : {}),
          },
        }
      : {}),
    ...(attorney.indexScore !== undefined
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: (attorney.indexScore / 20).toFixed(1), // Convert 0-100 to 0-5 scale
            bestRating: '5',
            ratingCount: attorney.reviewCount ?? 0,
          },
        }
      : {}),
    ...(attorney.practiceAreas && attorney.practiceAreas.length > 0
      ? { knowsAbout: attorney.practiceAreas }
      : {}),
    employee: {
      '@type': 'Person',
      name: attorney.name,
      jobTitle: 'Attorney',
    },
  }
}

/**
 * WebSite + SearchAction schema for homepage
 */
export function websiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Velora',
    url: BASE_URL,
    description:
      'Crash data intelligence that levels the playing field. Search crashes, find patterns, and connect with top attorneys.',
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${BASE_URL}/search?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
    publisher: {
      '@type': 'Organization',
      name: 'Velora',
      url: BASE_URL,
    },
  }
}

/**
 * FAQPage schema for FAQ sections
 */
export function faqPageSchema(
  faqs: Array<{ question: string; answer: string }>
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  }
}

/**
 * BreadcrumbList schema
 */
export function breadcrumbSchema(
  items: Array<{ name: string; url: string }>
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: `${BASE_URL}${item.url}`,
    })),
  }
}

/**
 * Helper to render JSON-LD in page head
 */
export function jsonLdScript(schema: Record<string, unknown>): string {
  return JSON.stringify(schema)
}

/** Alias for jsonLdScript — serialize schema to JSON-LD string */
export function schemaToJsonLd(schema: Record<string, unknown>): string {
  return JSON.stringify(schema)
}

/** Alias for datasetSchema with extended params */
export function generateDatasetSchema(params: {
  name: string
  description: string
  url: string
  dateModified?: string
  spatialCoverage?: string
  temporalCoverage?: string
  recordCount?: number
}) {
  const base = datasetSchema(params)
  if (params.recordCount !== undefined) {
    return { ...base, size: `${params.recordCount} records` }
  }
  return base
}

/** Alias for faqPageSchema */
export function generateFAQSchema(faqs: Array<{ question: string; answer: string }>) {
  return faqPageSchema(faqs)
}

/** Generate common FAQs for a location page */
export function generateLocationFAQs(
  location: string,
  stats: { totalCrashes: number; fatalCrashes: number }
): Array<{ question: string; answer: string }> {
  return [
    {
      question: `How many car crashes have been reported in ${location}?`,
      answer: `There have been ${stats.totalCrashes.toLocaleString()} crashes recorded in ${location}, including ${stats.fatalCrashes.toLocaleString()} fatal crashes.`,
    },
    {
      question: `What should I do after a car accident in ${location}?`,
      answer: `After a crash in ${location}, ensure safety first, call 911, document the scene, exchange information, seek medical attention, and consider consulting a personal injury attorney. Use our Crash Equalizer to understand your options.`,
    },
    {
      question: `How can I find crash data for ${location}?`,
      answer: `Velora provides free access to crash data for ${location}. Search for specific crashes, view intersection danger scores, or explore trends by crash type and severity.`,
    },
    {
      question: `How do I find the best car accident attorney in ${location}?`,
      answer: `Use Velora's Attorney Index to find top-rated personal injury attorneys in ${location}. Our AI-powered Review Intelligence scores attorneys across 8 dimensions including communication, outcome, and responsiveness.`,
    },
  ]
}

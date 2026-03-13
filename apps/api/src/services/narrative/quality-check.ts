import type { CrashNarrativeContent, NarrativeQualityMetrics } from '@velora/shared'

// PII detection patterns
const PII_PATTERNS = {
  phone: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g,
  email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
  ssn: /\b\d{3}-\d{2}-\d{4}\b/g,
  // Full names: 2+ capitalized words in a row (potential names)
  fullName: /\b[A-Z][a-z]+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\b/g,
}

// Known proper nouns that are NOT PII (road names, city names, etc.)
const KNOWN_NON_PII = new Set([
  'United States', 'New York', 'Los Angeles', 'San Francisco', 'San Diego',
  'Las Vegas', 'New Jersey', 'New Mexico', 'New Hampshire', 'North Carolina',
  'South Carolina', 'North Dakota', 'South Dakota', 'West Virginia', 'Rhode Island',
  'Property Damage', 'Serious Injury', 'Minor Injury', 'Possible Injury',
  'Fatal Crash', 'Hit Run', 'Speed Limit', 'Front Rear',
])

interface CrashLike {
  stateCode?: string
  county?: string | null
  cityName?: string | null
  streetAddress?: string | null
  crashSeverity?: string | null
  mannerOfCollision?: string | null
  atmosphericCondition?: string | null
  lightCondition?: string | null
  vehicles?: Array<{ make?: string | null; model?: string | null }> | null
}

/**
 * Check narrative content for quality issues.
 */
export function checkNarrativeQuality(
  content: CrashNarrativeContent,
  crash: CrashLike
): NarrativeQualityMetrics {
  const allText = Object.values(content).join(' ')

  // 1. PII Check
  const piiIssues: string[] = []
  const phoneMatches = allText.match(PII_PATTERNS.phone)
  if (phoneMatches) piiIssues.push(`Phone numbers found: ${phoneMatches.join(', ')}`)
  const emailMatches = allText.match(PII_PATTERNS.email)
  if (emailMatches) piiIssues.push(`Email addresses found: ${emailMatches.join(', ')}`)
  const ssnMatches = allText.match(PII_PATTERNS.ssn)
  if (ssnMatches) piiIssues.push(`SSN-like numbers found`)

  // Check for full names that are not known proper nouns or crash field values
  const nameMatches = allText.match(PII_PATTERNS.fullName) || []
  const crashFieldValues = new Set([
    crash.county, crash.cityName, crash.streetAddress,
    ...(crash.vehicles?.map((v) => v.make).filter(Boolean) || []),
    ...(crash.vehicles?.map((v) => v.model).filter(Boolean) || []),
  ].filter(Boolean) as string[])

  for (const name of nameMatches) {
    if (!KNOWN_NON_PII.has(name) && !crashFieldValues.has(name)) {
      piiIssues.push(`Potential name found: "${name}"`)
    }
  }

  // 2. Readability (Flesch-Kincaid approximation)
  const readabilityScore = calculateFleschKincaid(allText)

  // 3. Factual Accuracy — verify mentioned data points exist in crash record
  let factualChecks = 0
  let factualMatches = 0

  if (crash.stateCode) {
    factualChecks++
    if (allText.includes(crash.stateCode)) factualMatches++
  }
  if (crash.county) {
    factualChecks++
    if (allText.toLowerCase().includes(crash.county.toLowerCase())) factualMatches++
  }
  if (crash.crashSeverity) {
    factualChecks++
    // Allow fuzzy match on severity
    const severityWords = crash.crashSeverity.toLowerCase().replace(/_/g, ' ')
    if (allText.toLowerCase().includes(severityWords) || allText.toLowerCase().includes('fatal') && crash.crashSeverity === 'FATAL') {
      factualMatches++
    }
  }
  if (crash.mannerOfCollision) {
    factualChecks++
    const collisionWords = crash.mannerOfCollision.toLowerCase().replace(/_/g, ' ')
    if (allText.toLowerCase().includes(collisionWords)) factualMatches++
  }
  if (crash.atmosphericCondition) {
    factualChecks++
    const weatherWords = crash.atmosphericCondition.toLowerCase().replace(/_/g, ' ')
    if (allText.toLowerCase().includes(weatherWords)) factualMatches++
  }

  const factualAccuracy = factualChecks > 0 ? factualMatches / factualChecks : 1

  // 4. Completeness — check all 10 sections have content
  const sections = [
    content.headline,
    content.summary,
    content.incidentSection,
    content.vehiclesSection,
    content.conditionsSection,
    content.factorsSection,
    content.injurySection,
    content.locationSection,
    content.impactSection,
    content.whatToDoNext,
  ]
  const filledSections = sections.filter((s) => s && s.trim().length > 10).length
  const completeness = filledSections / 10

  // 5. Tone Score — basic heuristic based on severity-appropriate language
  const toneScore = assessTone(allText, crash.crashSeverity || 'PROPERTY_DAMAGE_ONLY')

  return {
    factualAccuracy,
    toneScore,
    readabilityScore,
    completeness,
    piiCheck: { passed: piiIssues.length === 0, issues: piiIssues },
  }
}

/**
 * Approximate Flesch-Kincaid grade level.
 */
function calculateFleschKincaid(text: string): number {
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0)
  const words = text.split(/\s+/).filter((w) => w.length > 0)
  const syllables = words.reduce((sum, word) => sum + countSyllables(word), 0)

  if (sentences.length === 0 || words.length === 0) return 0

  const avgWordsPerSentence = words.length / sentences.length
  const avgSyllablesPerWord = syllables / words.length

  // Flesch-Kincaid Grade Level formula
  const gradeLevel = 0.39 * avgWordsPerSentence + 11.8 * avgSyllablesPerWord - 15.59

  return Math.max(0, Math.round(gradeLevel * 10) / 10)
}

/**
 * Rough syllable count for English words.
 */
function countSyllables(word: string): number {
  word = word.toLowerCase().replace(/[^a-z]/g, '')
  if (word.length <= 3) return 1

  // Count vowel groups
  const vowelGroups = word.match(/[aeiouy]+/g)
  let count = vowelGroups ? vowelGroups.length : 1

  // Subtract silent 'e' at end
  if (word.endsWith('e') && !word.endsWith('le')) count--
  // Ensure at least 1 syllable
  return Math.max(1, count)
}

/**
 * Basic tone assessment — checks for severity-appropriate language.
 */
function assessTone(text: string, severity: string): number {
  const lower = text.toLowerCase()
  let score = 0.7 // baseline

  // Check for blame language (bad for all severities)
  const blameWords = ['fault', 'blame', 'caused by', 'responsible for', 'guilty']
  const blameCount = blameWords.filter((w) => lower.includes(w)).length
  score -= blameCount * 0.1

  // Check for appropriate framing
  const goodFraming = ['the data indicates', 'the data suggests', 'contributing factors', 'based on the record']
  const goodCount = goodFraming.filter((w) => lower.includes(w)).length
  score += goodCount * 0.05

  if (severity === 'FATAL') {
    // Fatal should have somber, respectful tone
    const somberWords = ['respectfully', 'tragic', 'loss', 'sympathy', 'support']
    const somberCount = somberWords.filter((w) => lower.includes(w)).length
    score += somberCount * 0.05

    // Should not be casual
    const casualWords = ['luckily', 'thankfully', 'just a', 'only a']
    const casualCount = casualWords.filter((w) => lower.includes(w)).length
    score -= casualCount * 0.15
  }

  return Math.max(0, Math.min(1, score))
}

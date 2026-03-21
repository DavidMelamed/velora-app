import { prisma } from '@velora/db'
import { generateText } from 'ai'
import {
  getModelForCrash,
  getModelTierForCrash,
  getActiveProvider,
  getNarrativePrompt,
  classifyDataTier,
} from '@velora/ai'
import type { CrashNarrativeContent } from '@velora/shared'

/**
 * Load a crash with all relations needed for narrative generation.
 */
async function loadCrashWithRelations(crashId: string) {
  const crash = await prisma.crash.findUnique({
    where: { id: crashId },
    include: {
      vehicles: {
        include: {
          driver: true,
          persons: true,
        },
      },
      persons: true,
    },
  })

  if (!crash) {
    throw new Error(`Crash not found: ${crashId}`)
  }

  return crash
}

/**
 * Format crash data into a prompt-friendly string for the LLM.
 */
function formatCrashForPrompt(crash: Awaited<ReturnType<typeof loadCrashWithRelations>>): string {
  const parts: string[] = []

  parts.push(`CRASH RECORD:`)
  parts.push(`- State: ${crash.stateCode}`)
  parts.push(`- Date: ${crash.crashDate.toISOString().split('T')[0]}`)
  if (crash.crashTime) parts.push(`- Time: ${crash.crashTime}`)
  parts.push(`- Severity: ${crash.crashSeverity || 'UNKNOWN'}`)
  if (crash.county) parts.push(`- County: ${crash.county}`)
  if (crash.cityName) parts.push(`- City: ${crash.cityName}`)
  if (crash.streetAddress) parts.push(`- Location: ${crash.streetAddress}`)
  if (crash.latitude && crash.longitude) {
    parts.push(`- Coordinates: ${crash.latitude}, ${crash.longitude}`)
  }
  if (crash.mannerOfCollision) parts.push(`- Manner of Collision: ${crash.mannerOfCollision}`)
  if (crash.atmosphericCondition) parts.push(`- Weather: ${crash.atmosphericCondition}`)
  if (crash.lightCondition) parts.push(`- Lighting: ${crash.lightCondition}`)
  if (crash.firstHarmfulEvent) parts.push(`- First Harmful Event: ${crash.firstHarmfulEvent}`)
  if (crash.relationToJunction) parts.push(`- Relation to Junction: ${crash.relationToJunction}`)
  if (crash.intersectionType) parts.push(`- Intersection Type: ${crash.intersectionType}`)
  if (crash.crashRelatedFactors.length > 0) {
    parts.push(`- Crash Factors: ${crash.crashRelatedFactors.join(', ')}`)
  }

  // Vehicles
  if (crash.vehicles.length > 0) {
    parts.push(`\nVEHICLES (${crash.vehicles.length}):`)
    for (const [i, v] of crash.vehicles.entries()) {
      parts.push(`  Vehicle ${i + 1}:`)
      if (v.make) parts.push(`    - Make: ${v.make}`)
      if (v.model) parts.push(`    - Model: ${v.model}`)
      if (v.modelYear) parts.push(`    - Year: ${v.modelYear}`)
      if (v.bodyType) parts.push(`    - Body Type: ${v.bodyType}`)
      if (v.totalOccupants != null) parts.push(`    - Occupants: ${v.totalOccupants}`)
      if (v.directionOfTravel) parts.push(`    - Direction: ${v.directionOfTravel}`)
      if (v.speedLimit != null) parts.push(`    - Speed Limit: ${v.speedLimit} mph`)
      if (v.hitAndRun) parts.push(`    - Hit and Run: YES`)
      if (v.contributingCircumstances.length > 0) {
        parts.push(`    - Contributing: ${v.contributingCircumstances.join(', ')}`)
      }

      // Driver info (no PII)
      if (v.driver) {
        parts.push(`    Driver:`)
        if (v.driver.speedingRelated) parts.push(`      - Speeding Related: YES`)
        if (v.driver.distractedBy) parts.push(`      - Distracted By: ${v.driver.distractedBy}`)
        if (v.driver.driverCondition) parts.push(`      - Condition: ${v.driver.driverCondition}`)
        if (v.driver.suspectedAlcoholDrug) parts.push(`      - Suspected Alcohol/Drug: YES`)
        if (v.driver.driverActions.length > 0) {
          parts.push(`      - Actions: ${v.driver.driverActions.join(', ')}`)
        }
      }
    }
  }

  // Persons (no PII - exclude names)
  if (crash.persons.length > 0) {
    parts.push(`\nPERSONS (${crash.persons.length}):`)
    for (const [i, p] of crash.persons.entries()) {
      parts.push(`  Person ${i + 1}:`)
      parts.push(`    - Type: ${p.personType}`)
      if (p.injuryStatus) parts.push(`    - Injury: ${p.injuryStatus}`)
      if (p.sex) parts.push(`    - Sex: ${p.sex}`)
      if (p.seatingPosition) parts.push(`    - Seating: ${p.seatingPosition}`)
      if (p.restraintUse) parts.push(`    - Restraint: ${p.restraintUse}`)
      if (p.airBagDeployed) parts.push(`    - Airbag: ${p.airBagDeployed}`)
      if (p.ejection) parts.push(`    - Ejection: ${p.ejection}`)
    }
  }

  return parts.join('\n')
}

/**
 * Generate a crash narrative using AI with severity-based model routing.
 */
export async function generateNarrative(crashId: string): Promise<{
  content: CrashNarrativeContent
  narrativeId: string
}> {
  const startTime = Date.now()

  // Load crash with all relations
  const crash = await loadCrashWithRelations(crashId)

  // Check if narrative already exists
  const existing = await prisma.crashNarrative.findUnique({
    where: { crashId },
  })
  if (existing) {
    return {
      content: existing.content as unknown as CrashNarrativeContent,
      narrativeId: existing.id,
    }
  }

  // Classify data tier
  const dataTier = classifyDataTier({
    vehicles: crash.vehicles.map((v) => ({
      driver: v.driver,
      make: v.make,
      modelYear: v.modelYear,
    })),
    persons: crash.persons,
    atmosphericCondition: crash.atmosphericCondition,
    lightCondition: crash.lightCondition,
    mannerOfCollision: crash.mannerOfCollision,
    latitude: crash.latitude,
    longitude: crash.longitude,
  })

  // Get severity-routed model
  const severity = crash.crashSeverity || 'PROPERTY_DAMAGE_ONLY'
  const modelTier = getModelTierForCrash(severity)
  const model = getModelForCrash(severity)
  const provider = getActiveProvider()

  // Build prompt
  const systemPrompt = getNarrativePrompt(severity)
  const userPrompt = formatCrashForPrompt(crash)

  // Generate narrative
  const result = await generateText({
    model,
    system: systemPrompt,
    prompt: userPrompt,
    maxTokens: 2000,
    temperature: 0.3,
  })

  // Parse the response
  let content: CrashNarrativeContent
  try {
    // Try to extract JSON from the response
    const text = result.text
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('No JSON object found in response')
    }
    content = JSON.parse(jsonMatch[0]) as CrashNarrativeContent
  } catch (parseError) {
    // Fallback: create a structured response from the text
    content = {
      headline: `Crash Report: ${severity.replace(/_/g, ' ')} incident in ${crash.county || crash.stateCode}`,
      summary: result.text.slice(0, 300),
      incidentSection: result.text,
      vehiclesSection: `${crash.vehicles.length} vehicle(s) involved.`,
      conditionsSection: [crash.atmosphericCondition, crash.lightCondition].filter(Boolean).join(', ') || 'Not reported',
      factorsSection: crash.crashRelatedFactors.join(', ') || 'No contributing factors reported.',
      injurySection: `${crash.persons.length} person(s) involved.`,
      locationSection: [crash.streetAddress, crash.cityName, crash.county, crash.stateCode].filter(Boolean).join(', '),
      impactSection: 'Impact analysis based on available data.',
      whatToDoNext: 'Contact your insurance provider and consult with a personal injury attorney if injured.',
    }
  }

  const generationMs = Date.now() - startTime

  // Store in database
  const narrative = await prisma.crashNarrative.create({
    data: {
      crashId,
      content: content as any,
      summary: content.summary,
      modelTier,
      modelId: provider ? `${provider}/${modelTier}` : `unknown/${modelTier}`,
      dataTier,
      generationMs,
    },
  })

  return { content, narrativeId: narrative.id }
}

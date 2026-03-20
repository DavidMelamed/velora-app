import { generateObject } from 'ai'
import { getModel } from '../gateway'
import { ExtractionResult } from './schemas'
import type { ExtractionResultType } from './schemas'

const EXTRACTION_SYSTEM_PROMPT = `You are an entity extraction system for a personal injury case management platform.

Extract all named entities, relationships, and temporal facts from the provided text.

Entity types to extract:
- PERSON: people mentioned (clients, doctors, adjusters, attorneys, witnesses) with their role
- FACILITY: medical facilities (PT clinics, hospitals, imaging centers, pharmacies) with type
- ORGANIZATION: companies (insurers, employers, law firms)
- INJURY: injuries and conditions with body part and diagnosis
- BODY_PART: specific body parts mentioned in context of injury
- MEDICATION: medications with dosage and prescriber
- APPOINTMENT: scheduled or completed medical appointments
- CLAIM: insurance claim numbers and details
- POLICY: insurance policy numbers
- EXPENSE: medical bills, costs mentioned
- VEHICLE_ENTITY: vehicles involved in the accident

For facts, use subject-predicate-object triples:
- "Client" "treating_at" "Spine Center" (with validFrom date if mentioned)
- "Dr. Smith" "diagnosed_with" "herniation L4-L5"
- "Client" "prescribed" "Ibuprofen 800mg"
- "Client" "has_appointment" "PT at Spine Center on 2026-04-01"

Be thorough but precise. Only extract information that is explicitly stated or strongly implied.
Assign confidence scores: 0.9+ for explicitly stated, 0.6-0.8 for inferred, 0.3-0.5 for uncertain.`

export async function extractEntities(
  text: string,
  context?: {
    knownEntities?: string[]
    matterSummary?: string
  }
): Promise<ExtractionResultType> {
  const contextLines: string[] = []
  if (context?.knownEntities?.length) {
    contextLines.push(`Known entities in this case: ${context.knownEntities.join(', ')}`)
  }
  if (context?.matterSummary) {
    contextLines.push(`Case context: ${context.matterSummary}`)
  }

  const systemPrompt = contextLines.length
    ? `${EXTRACTION_SYSTEM_PROMPT}\n\n${contextLines.join('\n')}`
    : EXTRACTION_SYSTEM_PROMPT

  const { object } = await generateObject({
    model: getModel('budget'),
    schema: ExtractionResult,
    system: systemPrompt,
    prompt: text,
  })

  return object
}

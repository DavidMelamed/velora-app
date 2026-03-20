import { z } from 'zod'

export const PersonExtraction = z.object({
  name: z.string(),
  role: z.string().describe('Role in the case: client, adjuster, doctor, nurse, witness, attorney, etc.'),
  phone: z.string().optional(),
  company: z.string().optional(),
  relationship: z.string().optional(),
})

export const FacilityExtraction = z.object({
  name: z.string(),
  type: z.enum([
    'PT', 'CHIROPRACTOR', 'ER', 'IMAGING', 'ORTHOPEDIC',
    'PRIMARY_CARE', 'PHARMACY', 'HOSPITAL', 'URGENT_CARE', 'OTHER',
  ]),
  address: z.string().optional(),
  specialty: z.string().optional(),
})

export const InjuryExtraction = z.object({
  bodyPart: z.string(),
  description: z.string(),
  diagnosis: z.string().optional(),
  severity: z.string().optional(),
})

export const MedicationExtraction = z.object({
  name: z.string(),
  dosage: z.string().optional(),
  frequency: z.string().optional(),
  prescriber: z.string().optional(),
})

export const AppointmentExtraction = z.object({
  provider: z.string(),
  date: z.string(),
  type: z.string(),
  notes: z.string().optional(),
})

export const FactExtraction = z.object({
  subject: z.string().describe('Who or what the fact is about'),
  predicate: z.string().describe('Relationship: treating_at, diagnosed_with, insured_by, has_appointment, prescribed, etc.'),
  object: z.string().describe('The value: facility name, diagnosis, insurer, date, medication, etc.'),
  validFrom: z.string().optional().describe('When this fact became true (ISO date)'),
  confidence: z.number().min(0).max(1).default(0.7),
})

export const EntityExtraction = z.object({
  type: z.enum([
    'PERSON', 'ORGANIZATION', 'FACILITY', 'INJURY', 'BODY_PART',
    'MEDICATION', 'CLAIM', 'VEHICLE_ENTITY', 'POLICY', 'APPOINTMENT', 'EXPENSE',
  ]),
  name: z.string(),
  attributes: z.record(z.unknown()).describe('Type-specific attributes'),
  confidence: z.number().min(0).max(1),
})

export const ExtractionResult = z.object({
  entities: z.array(EntityExtraction),
  facts: z.array(FactExtraction),
  summary: z.string().describe('One-sentence summary of what was discussed or observed'),
})

export type ExtractionResultType = z.infer<typeof ExtractionResult>

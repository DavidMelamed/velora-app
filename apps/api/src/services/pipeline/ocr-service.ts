/**
 * OCR Service - Processes police report images using AI vision models
 */
import { generateText } from 'ai'
import { getModel, getActiveProvider } from '@velora/ai'

export interface OcrExtractionResult {
  success: boolean
  data: Partial<ExtractedCrashData> | null
  confidence: number
  rawText: string | null
}

export interface ExtractedCrashData {
  crashDate: string
  crashTime: string | null
  location: string
  stateCode: string
  county: string | null
  cityName: string | null
  streetAddress: string | null
  severity: string | null
  mannerOfCollision: string | null
  vehicleCount: number
  personCount: number
}

const EXTRACTION_PROMPT = `You are an expert at reading police crash reports. Extract the following fields from this crash report image. Return ONLY valid JSON with these fields:

{
  "crashDate": "YYYY-MM-DD",
  "crashTime": "HH:MM" or null,
  "location": "full location description",
  "stateCode": "2-letter state code",
  "county": "county name" or null,
  "cityName": "city name" or null,
  "streetAddress": "street address" or null,
  "severity": "FATAL" | "SUSPECTED_SERIOUS_INJURY" | "SUSPECTED_MINOR_INJURY" | "POSSIBLE_INJURY" | "PROPERTY_DAMAGE_ONLY" or null,
  "mannerOfCollision": "collision type" or null,
  "vehicleCount": number,
  "personCount": number
}

If a field cannot be determined from the image, use null for strings and 0 for numbers.`

/**
 * Extract crash data from a base64-encoded police report image
 */
export async function extractFromImage(imageBase64: string): Promise<OcrExtractionResult> {
  try {
    if (!imageBase64 || imageBase64.length < 100) {
      return { success: false, data: null, confidence: 0, rawText: null }
    }

    // Check if an AI provider is available
    if (!getActiveProvider()) {
      return {
        success: false,
        data: null,
        confidence: 0,
        rawText: null,
      }
    }

    // Strip data URL prefix if present
    const base64 = imageBase64.replace(/^data:image\/\w+;base64,/, '')

    const result = await generateText({
      model: getModel('standard'),
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: EXTRACTION_PROMPT },
            {
              type: 'image',
              image: base64,
            },
          ],
        },
      ],
    })

    const rawText = result.text
    // Parse JSON from response (handle markdown code blocks)
    const jsonMatch = rawText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return { success: false, data: null, confidence: 0.3, rawText }
    }

    const parsed = JSON.parse(jsonMatch[0]) as Partial<ExtractedCrashData>

    // Calculate confidence based on how many fields were extracted
    const fields = ['crashDate', 'location', 'stateCode', 'county', 'cityName', 'streetAddress', 'severity'] as const
    const filledFields = fields.filter(f => parsed[f] != null && parsed[f] !== '').length
    const confidence = Math.round((filledFields / fields.length) * 100) / 100

    return {
      success: true,
      data: parsed,
      confidence,
      rawText,
    }
  } catch (error) {
    console.error('[OCR] Extraction failed:', error)
    return { success: false, data: null, confidence: 0, rawText: null }
  }
}

/**
 * Validate uploaded image data
 */
export function validateImageUpload(base64Data: string): { valid: boolean; error?: string } {
  if (!base64Data) return { valid: false, error: 'No image data provided' }
  if (base64Data.length < 100) return { valid: false, error: 'Image data too small' }
  if (base64Data.length > 15_000_000) return { valid: false, error: 'Image too large. Max 10MB.' }
  return { valid: true }
}

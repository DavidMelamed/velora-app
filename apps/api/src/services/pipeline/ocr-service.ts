/**
 * OCR Service — Police Report Processing
 * Stub for Unstructured.io integration
 * Accepts base64 image, returns structured crash data
 */

export interface OcrExtractionResult {
  success: boolean
  data: ExtractedCrashData | null
  confidence: number
  rawText: string | null
  processingTimeMs: number
}

export interface ExtractedCrashData {
  crashDate: string | null
  crashTime: string | null
  location: string | null
  severity: string | null
  stateCode: string | null
  county: string | null
  cityName: string | null
  streetAddress: string | null
  mannerOfCollision: string | null
  atmosphericCondition: string | null
  lightCondition: string | null
  reportNumber: string | null
  vehicles: ExtractedVehicle[]
  persons: ExtractedPerson[]
}

export interface ExtractedVehicle {
  make: string | null
  model: string | null
  modelYear: number | null
  licensePlate: string | null
}

export interface ExtractedPerson {
  personType: string | null
  injuryStatus: string | null
}

/**
 * Process a police report image using OCR
 * Currently a stub — will integrate with Unstructured.io
 */
export async function processPoliceReport(
  imageBase64: string
): Promise<OcrExtractionResult> {
  const startTime = Date.now()

  // Validate input
  if (!imageBase64 || imageBase64.length < 100) {
    return {
      success: false,
      data: null,
      confidence: 0,
      rawText: null,
      processingTimeMs: Date.now() - startTime,
    }
  }

  // TODO: Integrate with Unstructured.io API
  // const unstructuredUrl = process.env.UNSTRUCTURED_API_URL || 'https://api.unstructured.io'
  // const unstructuredKey = process.env.UNSTRUCTURED_API_KEY
  //
  // Steps:
  // 1. Send image to Unstructured.io for document parsing
  // 2. Extract text elements from response
  // 3. Use AI (Claude/GPT) to map extracted text to crash data fields
  // 4. Validate extracted data against MMUCC enums
  // 5. Return structured result

  // Stub response for development
  const stubData: ExtractedCrashData = {
    crashDate: null,
    crashTime: null,
    location: null,
    severity: null,
    stateCode: null,
    county: null,
    cityName: null,
    streetAddress: null,
    mannerOfCollision: null,
    atmosphericCondition: null,
    lightCondition: null,
    reportNumber: null,
    vehicles: [],
    persons: [],
  }

  return {
    success: false, // Stub — always returns false until Unstructured.io is connected
    data: stubData,
    confidence: 0,
    rawText: null,
    processingTimeMs: Date.now() - startTime,
  }
}

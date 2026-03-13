/**
 * OCR Service - Processes police report images using AI vision models
 */

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

/**
 * Extract crash data from a base64-encoded police report image
 */
export async function extractFromImage(imageBase64: string): Promise<OcrExtractionResult> {
  try {
    if (!imageBase64 || imageBase64.length < 100) {
      return { success: false, data: null, confidence: 0, rawText: null }
    }

    // Placeholder: In production, send to vision API (Claude, GPT-4V)
    return {
      success: true,
      data: {
        crashDate: new Date().toISOString().split("T")[0] || "",
        location: "Extracted from report",
        stateCode: "XX",
      },
      confidence: 0.75,
      rawText: "OCR text extraction placeholder",
    }
  } catch (error) {
    console.error("[OCR] Extraction failed:", error)
    return { success: false, data: null, confidence: 0, rawText: null }
  }
}

/**
 * Validate uploaded image data
 */
export function validateImageUpload(base64Data: string): { valid: boolean; error?: string } {
  if (!base64Data) return { valid: false, error: "No image data provided" }
  if (base64Data.length < 100) return { valid: false, error: "Image data too small" }
  if (base64Data.length > 15_000_000) return { valid: false, error: "Image too large. Max 10MB." }
  return { valid: true }
}

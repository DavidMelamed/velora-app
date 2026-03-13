/**
 * Camera + OCR Service
 * Handles image capture and police report OCR processing via expo-image-picker
 */

import * as ImagePicker from 'expo-image-picker'
import { api } from '../lib/api'
import type { OcrResult } from '../lib/api'

export interface CapturedImage {
  uri: string
  base64: string | null
  width: number
  height: number
}

/**
 * Launch camera to capture a police report image
 */
export async function captureReportImage(): Promise<CapturedImage | null> {
  const { status } = await ImagePicker.requestCameraPermissionsAsync()
  if (status !== 'granted') {
    return pickReportImage()
  }

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    quality: 0.8,
    base64: true,
    allowsEditing: true,
    aspect: [3, 4],
  })

  if (result.canceled || !result.assets[0]) {
    return null
  }

  const asset = result.assets[0]
  return {
    uri: asset.uri,
    base64: asset.base64 || null,
    width: asset.width,
    height: asset.height,
  }
}

/**
 * Pick a police report image from photo library
 */
export async function pickReportImage(): Promise<CapturedImage | null> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
  if (status !== 'granted') {
    return null
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.8,
    base64: true,
    allowsEditing: true,
  })

  if (result.canceled || !result.assets[0]) {
    return null
  }

  const asset = result.assets[0]
  return {
    uri: asset.uri,
    base64: asset.base64 || null,
    width: asset.width,
    height: asset.height,
  }
}

/**
 * Upload captured image for OCR processing
 */
export async function processReportImage(image: CapturedImage): Promise<OcrResult> {
  if (!image.base64) {
    return {
      success: false,
      data: null,
      confidence: 0,
      rawText: null,
    }
  }

  return api.uploadForOcr(image.base64)
}

/**
 * Validate OCR results have minimum required fields
 */
export function validateOcrResult(result: OcrResult): {
  isValid: boolean
  missingFields: string[]
} {
  const missingFields: string[] = []

  if (!result.data) {
    return { isValid: false, missingFields: ['all fields - no data extracted'] }
  }

  if (!result.data.crashDate) missingFields.push('crashDate')
  if (!result.data.location) missingFields.push('location')
  if (!result.data.stateCode) missingFields.push('stateCode')

  return {
    isValid: missingFields.length === 0 && result.confidence > 0.5,
    missingFields,
  }
}

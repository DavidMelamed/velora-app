/**
 * File Storage Service
 * Abstracts file uploads. Uses local filesystem in dev, S3 in production.
 * Set FILE_STORAGE_TYPE=s3 and S3 env vars for production.
 */

import { randomUUID } from 'crypto'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'

export interface UploadResult {
  url: string
  key: string
  size: number
  mimeType: string
}

const STORAGE_TYPE = process.env.FILE_STORAGE_TYPE || 'local'
const LOCAL_UPLOAD_DIR = process.env.LOCAL_UPLOAD_DIR || join(process.cwd(), 'uploads')
const S3_BUCKET = process.env.S3_BUCKET || ''
const S3_REGION = process.env.S3_REGION || 'us-east-1'
const PUBLIC_URL = process.env.PUBLIC_FILE_URL || 'http://localhost:4000/uploads'

/**
 * Upload a file from base64 data.
 */
export async function uploadBase64(
  base64Data: string,
  options: { mimeType: string; folder?: string; filename?: string }
): Promise<UploadResult> {
  const buffer = Buffer.from(base64Data, 'base64')
  const ext = mimeToExt(options.mimeType)
  const filename = options.filename || `${randomUUID()}.${ext}`
  const folder = options.folder || 'general'
  const key = `${folder}/${filename}`

  if (STORAGE_TYPE === 's3') {
    return uploadToS3(buffer, key, options.mimeType)
  }

  return uploadToLocal(buffer, key, options.mimeType)
}

/**
 * Upload a file from a buffer.
 */
export async function uploadBuffer(
  buffer: Buffer,
  options: { mimeType: string; folder?: string; filename?: string }
): Promise<UploadResult> {
  const ext = mimeToExt(options.mimeType)
  const filename = options.filename || `${randomUUID()}.${ext}`
  const folder = options.folder || 'general'
  const key = `${folder}/${filename}`

  if (STORAGE_TYPE === 's3') {
    return uploadToS3(buffer, key, options.mimeType)
  }

  return uploadToLocal(buffer, key, options.mimeType)
}

async function uploadToLocal(
  buffer: Buffer,
  key: string,
  mimeType: string
): Promise<UploadResult> {
  const filePath = join(LOCAL_UPLOAD_DIR, key)
  const dir = join(LOCAL_UPLOAD_DIR, key.split('/').slice(0, -1).join('/'))

  await mkdir(dir, { recursive: true })
  await writeFile(filePath, buffer)

  return {
    url: `${PUBLIC_URL}/${key}`,
    key,
    size: buffer.length,
    mimeType,
  }
}

async function uploadToS3(
  buffer: Buffer,
  key: string,
  mimeType: string
): Promise<UploadResult> {
  // Dynamic import to avoid requiring aws-sdk when using local storage
  try {
    const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3')

    const client = new S3Client({ region: S3_REGION })
    await client.send(
      new PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
      })
    )

    return {
      url: `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com/${key}`,
      key,
      size: buffer.length,
      mimeType,
    }
  } catch (error) {
    console.error('S3 upload failed, falling back to local:', error)
    return uploadToLocal(buffer, key, mimeType)
  }
}

function mimeToExt(mime: string): string {
  const map: Record<string, string> = {
    'audio/m4a': 'm4a',
    'audio/mp4': 'm4a',
    'audio/mpeg': 'mp3',
    'audio/wav': 'wav',
    'audio/webm': 'webm',
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'application/pdf': 'pdf',
    'text/plain': 'txt',
  }
  return map[mime] || 'bin'
}

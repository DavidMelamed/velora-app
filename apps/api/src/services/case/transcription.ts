/**
 * Transcription Service
 * Transcribes audio files using OpenAI Whisper API (via OpenRouter or direct).
 * Falls back to a simple placeholder when no API is configured.
 */

export interface TranscriptionResult {
  text: string
  durationSeconds: number
  language: string
  confidence: number
}

/**
 * Transcribe an audio file from a URL or base64 data.
 */
export async function transcribeAudio(
  input: { url?: string; base64?: string; mimeType?: string },
): Promise<TranscriptionResult> {
  const openaiKey = process.env.OPENAI_API_KEY
  const openrouterKey = process.env.OPENROUTER_API_KEY

  // Try OpenAI Whisper first
  if (openaiKey && input.base64) {
    return transcribeWithWhisper(input.base64, input.mimeType || 'audio/m4a', openaiKey)
  }

  // Try OpenRouter (supports Whisper)
  if (openrouterKey && input.base64) {
    return transcribeWithOpenRouter(input.base64, input.mimeType || 'audio/m4a', openrouterKey)
  }

  // Try Google Gemini (can process audio natively)
  const googleKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY
  if (googleKey && input.base64) {
    return transcribeWithGemini(input.base64, input.mimeType || 'audio/m4a', googleKey)
  }

  throw new Error(
    'No transcription provider configured. Set OPENAI_API_KEY, OPENROUTER_API_KEY, or GOOGLE_GENERATIVE_AI_API_KEY.'
  )
}

async function transcribeWithWhisper(
  base64: string,
  mimeType: string,
  apiKey: string
): Promise<TranscriptionResult> {
  const buffer = Buffer.from(base64, 'base64')
  const ext = mimeType.split('/')[1] || 'm4a'

  // Build multipart form data
  const boundary = '----FormBoundary' + Math.random().toString(36).slice(2)
  const parts: Buffer[] = []

  // Add file part
  parts.push(Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="audio.${ext}"\r\nContent-Type: ${mimeType}\r\n\r\n`
  ))
  parts.push(buffer)
  parts.push(Buffer.from('\r\n'))

  // Add model part
  parts.push(Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="model"\r\n\r\nwhisper-1\r\n`
  ))

  // Add response_format part
  parts.push(Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="response_format"\r\n\r\nverbose_json\r\n`
  ))

  parts.push(Buffer.from(`--${boundary}--\r\n`))

  const body = Buffer.concat(parts)

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
    },
    body,
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Whisper API error: ${response.status} — ${error}`)
  }

  const data = await response.json() as {
    text: string
    duration: number
    language: string
  }

  return {
    text: data.text,
    durationSeconds: Math.round(data.duration || 0),
    language: data.language || 'en',
    confidence: 0.95, // Whisper is generally high confidence
  }
}

async function transcribeWithOpenRouter(
  base64: string,
  mimeType: string,
  apiKey: string
): Promise<TranscriptionResult> {
  // OpenRouter supports Whisper via the same API format
  const buffer = Buffer.from(base64, 'base64')
  const ext = mimeType.split('/')[1] || 'm4a'

  const boundary = '----FormBoundary' + Math.random().toString(36).slice(2)
  const parts: Buffer[] = []

  parts.push(Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="audio.${ext}"\r\nContent-Type: ${mimeType}\r\n\r\n`
  ))
  parts.push(buffer)
  parts.push(Buffer.from('\r\n'))
  parts.push(Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="model"\r\n\r\nopenai/whisper-1\r\n`
  ))
  parts.push(Buffer.from(`--${boundary}--\r\n`))

  const body = Buffer.concat(parts)

  const response = await fetch('https://openrouter.ai/api/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
    },
    body,
  })

  if (!response.ok) {
    throw new Error(`OpenRouter transcription error: ${response.status}`)
  }

  const data = await response.json() as { text: string; duration?: number; language?: string }

  return {
    text: data.text,
    durationSeconds: Math.round(data.duration || 0),
    language: data.language || 'en',
    confidence: 0.90,
  }
}

async function transcribeWithGemini(
  base64: string,
  mimeType: string,
  apiKey: string
): Promise<TranscriptionResult> {
  // Use Gemini's multimodal capability to transcribe audio
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                inlineData: {
                  mimeType,
                  data: base64,
                },
              },
              {
                text: 'Transcribe this audio recording exactly. Output only the transcription text, nothing else.',
              },
            ],
          },
        ],
      }),
    }
  )

  if (!response.ok) {
    throw new Error(`Gemini transcription error: ${response.status}`)
  }

  const data = await response.json() as {
    candidates: Array<{ content: { parts: Array<{ text: string }> } }>
  }

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''

  return {
    text,
    durationSeconds: 0, // Gemini doesn't return duration
    language: 'en',
    confidence: 0.85,
  }
}

/**
 * Voice Note Transcriber
 *
 * Downloads WhatsApp voice notes and transcribes them using Deepgram.
 * Supports both Meta Cloud API and Twilio media formats.
 *
 * Voice notes arrive as OGG/Opus — Deepgram accepts this natively (no ffmpeg needed).
 */

import { createClient } from '@deepgram/sdk';

const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY;

/** Allowed hostnames for Twilio media downloads */
const TWILIO_ALLOWED_HOSTS = [
  'media.twiliocdn.com',
  'api.twilio.com',
];

/** Allowed hostnames for Meta media downloads */
const META_ALLOWED_HOSTS = [
  'lookaside.fbsbx.com',
  'scontent.whatsapp.net',
];

/**
 * Validate that a URL points to an allowed domain (prevents SSRF)
 */
function validateMediaUrl(url: string, allowedHosts: string[]): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return false;
    return allowedHosts.some(host => parsed.hostname === host || parsed.hostname.endsWith('.' + host));
  } catch {
    return false;
  }
}

/**
 * Download audio from Meta WhatsApp Cloud API
 *
 * Meta requires two steps:
 * 1. GET /v21.0/{mediaId} → returns a temporary download URL
 * 2. GET that URL with Bearer token → returns the audio bytes
 */
export async function downloadMetaAudio(mediaId: string): Promise<Buffer> {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!accessToken) throw new Error('WHATSAPP_ACCESS_TOKEN not set');

  // Step 1: Get the temporary download URL
  const metaRes = await fetch(`https://graph.facebook.com/v21.0/${mediaId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(15000),
  });

  if (!metaRes.ok) {
    const err = await metaRes.text();
    throw new Error(`Meta media lookup failed: ${err}`);
  }

  const { url } = await metaRes.json();

  // Step 2: Validate the download URL to prevent SSRF
  if (!validateMediaUrl(url, META_ALLOWED_HOSTS)) {
    throw new Error(`Meta returned untrusted media URL: ${new URL(url).hostname}`);
  }

  // Step 3: Download the actual audio file
  const audioRes = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(30000),
  });

  if (!audioRes.ok) {
    throw new Error(`Meta audio download failed: ${audioRes.status}`);
  }

  const arrayBuffer = await audioRes.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Download audio from Twilio media URL
 *
 * Twilio provides a direct URL in MediaUrl0.
 * By default no auth is needed unless the account has it enabled.
 */
export async function downloadTwilioAudio(mediaUrl: string): Promise<Buffer> {
  // Validate URL to prevent SSRF
  if (!validateMediaUrl(mediaUrl, TWILIO_ALLOWED_HOSTS)) {
    throw new Error('Untrusted Twilio media URL');
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  const headers: Record<string, string> = {};
  if (accountSid && authToken) {
    headers['Authorization'] = 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64');
  }

  const res = await fetch(mediaUrl, { headers, signal: AbortSignal.timeout(30000) });

  if (!res.ok) {
    throw new Error(`Twilio audio download failed: ${res.status}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Transcribe audio buffer using Deepgram's pre-recorded API
 *
 * Uses Nova-3 model with Spanish language for best Dominican Spanish accuracy.
 * Deepgram accepts OGG/Opus natively — no conversion needed.
 */
export async function transcribeAudio(audioBuffer: Buffer, mimeType: string = 'audio/ogg'): Promise<string | null> {
  if (!DEEPGRAM_API_KEY) {
    console.error('[Voice Transcriber] DEEPGRAM_API_KEY not set');
    return null;
  }

  try {
    const deepgram = createClient(DEEPGRAM_API_KEY);

    const { result } = await deepgram.listen.prerecorded.transcribeFile(audioBuffer, {
      model: 'nova-3',
      language: 'es',
      smart_format: true,
      punctuate: true,
    });

    const transcript = result?.results?.channels?.[0]?.alternatives?.[0]?.transcript;

    if (!transcript || transcript.trim().length === 0) {
      console.warn('[Voice Transcriber] Empty transcription result');
      return null;
    }

    console.log('[Voice Transcriber] Transcribed:', transcript.substring(0, 100) + (transcript.length > 100 ? '...' : ''));
    return transcript;
  } catch (error) {
    console.error('[Voice Transcriber] Deepgram transcription error:', error);
    return null;
  }
}

/**
 * Full pipeline: download Meta audio + transcribe
 */
export async function transcribeMetaVoiceNote(mediaId: string): Promise<string | null> {
  try {
    const audioBuffer = await downloadMetaAudio(mediaId);
    return await transcribeAudio(audioBuffer, 'audio/ogg');
  } catch (error) {
    console.error('[Voice Transcriber] Meta voice note pipeline error:', error);
    return null;
  }
}

/**
 * Full pipeline: download Twilio audio + transcribe
 */
export async function transcribeTwilioVoiceNote(mediaUrl: string): Promise<string | null> {
  try {
    const audioBuffer = await downloadTwilioAudio(mediaUrl);
    return await transcribeAudio(audioBuffer, 'audio/ogg');
  } catch (error) {
    console.error('[Voice Transcriber] Twilio voice note pipeline error:', error);
    return null;
  }
}

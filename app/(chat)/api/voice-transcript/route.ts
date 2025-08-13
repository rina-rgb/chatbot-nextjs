import { NextRequest } from 'next/server';
import { google } from '@ai-sdk/google';
import { generateText } from 'ai';

export const maxDuration = 60;

function badRequest(message: string) {
  return new Response(JSON.stringify({ error: 'bad_request', message }), {
    status: 400,
    headers: { 'Content-Type': 'application/json' },
  });
}

function serverError(message: string) {
  return new Response(JSON.stringify({ error: 'server_error', message }), {
    status: 500,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const audio = formData.get('audio');
    // Debug: basic file metadata
    try {
      console.log('[voice-transcript] received file', {
        isFile: audio instanceof File,
        type: (audio as File | null)?.type,
        size: (audio as File | null)?.size,
      });
    } catch {}

    if (!audio || !(audio instanceof File)) {
      return badRequest('Missing audio file');
    }

    // Validate file size within typical 20MB inline limit
    // If you need larger, change to Files API and pass file parts by URI.
    if (audio.size <= 0) {
      return badRequest('Empty audio file');
    }

    const mediaType = audio.type || 'audio/webm';
    const data = new Uint8Array(await audio.arrayBuffer());
    // Debug: binary size
    try {
      console.log(
        '[voice-transcript] data bytes',
        data.length,
        'mediaType',
        mediaType,
      );
    } catch {}

    // Ask Gemini to produce a transcript from the audio
    // Uses inline file input via AI SDK messages API
    const { text } = await generateText({
      model: google('gemini-2.5-flash'),
      messages: [
        {
          role: 'user' as const,
          content: [
            {
              type: 'text',
              text: 'Transcribe only spoken words from the following audio. Do NOT include any non-speech annotations or cues (e.g., [music], [applause], [high-pitched tone], [laughter], [sound effect]). Output plain text only.',
            },
            { type: 'file', data, mediaType },
          ],
        },
      ],
      temperature: 0,
    });
    try {
      console.log('[voice-transcript] gemini text length', (text || '').length);
    } catch {}
    const transcript = (text || '')
      .replace(/\s?\[[^\]]*]/g, '')
      .replace(/\s{2,}/g, ' ')
      .trim();

    return new Response(JSON.stringify({ transcript }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('voice-transcript error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return serverError(message);
  }
}

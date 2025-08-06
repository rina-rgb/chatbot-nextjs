import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import {
  saveConsultantNote,
  getConsultantNotesByChatId,
} from '@/lib/db/queries';
import { ChatSDKError } from '@/lib/errors';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return new ChatSDKError('unauthorized:chat').toResponse();
    }

    const { chatId, title, summary, details, priority } = await request.json();

    if (!chatId || !title || !summary || !priority) {
      return new ChatSDKError('bad_request:api').toResponse();
    }

    await saveConsultantNote({ chatId, title, summary, details, priority });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }
    return new ChatSDKError('bad_request:chat').toResponse();
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return new ChatSDKError('unauthorized:chat').toResponse();
    }

    const { searchParams } = new URL(request.url);
    const chatId = searchParams.get('chatId');

    if (!chatId) {
      return new ChatSDKError('bad_request:api').toResponse();
    }

    const notes = await getConsultantNotesByChatId({ chatId });

    return NextResponse.json({ notes });
  } catch (error) {
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }
    return new ChatSDKError('bad_request:chat').toResponse();
  }
}

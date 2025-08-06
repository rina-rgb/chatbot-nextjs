import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import {
  voteConsultantNote,
  getConsultantNoteVotesByChatId,
} from '@/lib/db/queries';
import { ChatSDKError } from '@/lib/errors';

export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return new ChatSDKError('unauthorized:chat').toResponse();
    }

    const { chatId, noteId, type } = await request.json();

    if (!chatId || !noteId || !type) {
      return new ChatSDKError('bad_request:api').toResponse();
    }

    await voteConsultantNote({ chatId, noteId, type });

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

    const votes = await getConsultantNoteVotesByChatId({ chatId });

    return NextResponse.json(votes);
  } catch (error) {
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }
    return new ChatSDKError('bad_request:chat').toResponse();
  }
}

import {
  convertToModelMessages,
  createUIMessageStream,
  JsonToSseTransformStream,
  smoothStream,
  stepCountIs,
  streamText,
} from 'ai';
import { auth, type UserType } from '@/app/(auth)/auth';
import { type RequestHints, systemPrompt } from '@/lib/ai/prompts';
import {
  createStreamId,
  deleteChatById,
  getChatById,
  getMessageCountByUserId,
  getMessagesByChatId,
  saveChat,
  saveMessages,
} from '@/lib/db/queries';
import { convertToUIMessages, generateUUID } from '@/lib/utils';
import { generateTitleFromUserMessage } from '../../actions';
import { createDocument } from '@/lib/ai/tools/create-document';
import { updateDocument } from '@/lib/ai/tools/update-document';
import { requestSuggestions } from '@/lib/ai/tools/request-suggestions';
import { getWeather } from '@/lib/ai/tools/get-weather';
import { isProductionEnvironment } from '@/lib/constants';
import { myProvider } from '@/lib/ai/providers';
import { entitlementsByUserType } from '@/lib/ai/entitlements';
import { postRequestBodySchema, type PostRequestBody } from './schema';
import { geolocation } from '@vercel/functions';
import {
  createResumableStreamContext,
  type ResumableStreamContext,
} from 'resumable-stream';
import { after } from 'next/server';
import { ChatSDKError } from '@/lib/errors';
import type { ChatMessage } from '@/lib/types';
import type { ChatModel } from '@/lib/ai/models';
import type { VisibilityType } from '@/components/visibility-selector';

export const maxDuration = 60;

let globalStreamContext: ResumableStreamContext | null = null;

// Simulated Patient Agents with specific roles and characteristics
const PATIENT_AGENTS = {
  'latino-veteran': {
    name: 'Carlos Rodriguez',
    description:
      'Latino male combat veteran in his early thirties with no psychological comorbidities',
    complexity: 'beginner',
    systemPrompt: `
    You are Carlos Rodriguez, a 32-year-old Latino male combat veteran participating in Written Exposure Therapy (WET).
    You served in Afghanistan and experienced combat trauma. You have no psychological comorbidities and represent a beginner level of clinical complexity.

    CHARACTERISTICS:
    - Latino male, early thirties
    - Combat veteran (Afghanistan)
    - No psychological comorbidities
    - Beginner level clinical complexity
    - Speaks with occasional Spanish phrases or cultural references
    - Respectful but sometimes guarded about military experiences
    - Values family and community support

    SPEAK ONLY as Carlos. Be realistic, concise, and authentic to his character. Do NOT give therapist advice or meta-analysis.
    Respond as if you are Carlos sharing his thoughts, feelings, and experiences during the therapy session.
    `,
  },
  'black-woman-trauma': {
    name: 'Michelle Johnson',
    description:
      'Middle-aged Black woman with history of sexual trauma, intimate partner violence, and substance use disorder',
    complexity: 'intermediate',
    systemPrompt: `
    You are Michelle Johnson, a 45-year-old Black woman participating in Written Exposure Therapy (WET).
    You have a history of sexual trauma, intimate partner violence, and substance use disorder. You represent an intermediate level of clinical complexity.

    CHARACTERISTICS:
    - Black woman, middle-aged (45)
    - History of sexual trauma
    - Survivor of intimate partner violence
    - Substance use disorder (in recovery)
    - Intermediate level clinical complexity
    - May show reluctance to engage in writing assignments
    - Risk of return to substance use
    - Occasional suicidal ideation
    - Strong but vulnerable, with moments of resistance
    - Cultural background influences her perspective and coping mechanisms

    SPEAK ONLY as Michelle. Be realistic, concise, and authentic to her character. Do NOT give therapist advice or meta-analysis.
    Respond as if you are Michelle sharing her thoughts, feelings, and experiences during the therapy session.
    `,
  },
};

export function getStreamContext() {
  if (!globalStreamContext) {
    try {
      globalStreamContext = createResumableStreamContext({
        waitUntil: after,
      });
    } catch (error: any) {
      if (error.message.includes('REDIS_URL')) {
        console.log(
          ' > Resumable streams are disabled due to missing REDIS_URL',
        );
      } else {
        console.error(error);
      }
    }
  }

  return globalStreamContext;
}

export async function POST(request: Request) {
  let requestBody: PostRequestBody;

  try {
    const json = await request.json();
    requestBody = postRequestBodySchema.parse(json);
  } catch (_) {
    return new ChatSDKError('bad_request:api').toResponse();
  }

  try {
    const {
      id,
      message,
      selectedChatModel,
      selectedVisibilityType,
      patientAgent,
    }: {
      id: string;
      message: ChatMessage;
      selectedChatModel: ChatModel['id'];
      selectedVisibilityType: VisibilityType;
      patientAgent?: 'latino-veteran' | 'black-woman-trauma';
    } = requestBody;

    const session = await auth();

    if (!session?.user) {
      return new ChatSDKError('unauthorized:chat').toResponse();
    }

    const userType: UserType = session.user.type;

    const messageCount = await getMessageCountByUserId({
      id: session.user.id,
      differenceInHours: 24,
    });

    if (messageCount > entitlementsByUserType[userType].maxMessagesPerDay) {
      return new ChatSDKError('rate_limit:chat').toResponse();
    }

    const chat = await getChatById({ id });

    if (!chat) {
      const title = await generateTitleFromUserMessage({
        message,
      });

      await saveChat({
        id,
        userId: session.user.id,
        title,
        visibility: selectedVisibilityType,
      });
    } else {
      if (chat.userId !== session.user.id) {
        return new ChatSDKError('forbidden:chat').toResponse();
      }
    }

    const messagesFromDb = await getMessagesByChatId({ id });
    const uiMessages = [...convertToUIMessages(messagesFromDb), message];

    const { longitude, latitude, city, country } = geolocation(request);

    const requestHints: RequestHints = {
      longitude,
      latitude,
      city,
      country,
    };

    await saveMessages({
      messages: [
        {
          chatId: id,
          id: generateUUID(), // Use generateUUID() instead of message.id
          role: 'user',
          parts: message.parts,
          attachments: [],
          createdAt: new Date(),
        },
      ],
    });

    const streamId = generateUUID();
    await createStreamId({ streamId, chatId: id });

    const stream = createUIMessageStream({
      execute: ({ writer: dataStream }) => {
        // Debug: Log the patientAgent value
        console.log('=== PATIENT AGENT DEBUG ===');
        console.log('patientAgent:', patientAgent);
        console.log('PATIENT_AGENTS keys:', Object.keys(PATIENT_AGENTS));
        console.log(
          'PATIENT_AGENTS[patientAgent]:',
          patientAgent &&
            PATIENT_AGENTS[patientAgent as keyof typeof PATIENT_AGENTS],
        );
        console.log('================================');

        // Use patient agent system prompt if patientAgent is selected, otherwise use default
        const selectedSystemPrompt =
          patientAgent && patientAgent in PATIENT_AGENTS
            ? PATIENT_AGENTS[patientAgent as keyof typeof PATIENT_AGENTS]
                .systemPrompt
            : systemPrompt({ selectedChatModel, requestHints });

        console.log('=== SYSTEM PROMPT DEBUG ===');
        console.log('Using patient agent:', patientAgent ? 'YES' : 'NO');
        console.log(
          'System prompt preview:',
          selectedSystemPrompt.substring(0, 100) + '...',
        );
        console.log('================================');

        const result = streamText({
          model: myProvider.languageModel(selectedChatModel),
          system: selectedSystemPrompt,
          messages: convertToModelMessages(uiMessages),
          stopWhen: stepCountIs(5),
          experimental_activeTools:
            selectedChatModel === 'chat-model-reasoning'
              ? []
              : [
                  'getWeather',
                  'createDocument',
                  'updateDocument',
                  'requestSuggestions',
                ],
          experimental_transform: smoothStream({ chunking: 'word' }),
          tools: {
            getWeather,
            createDocument: createDocument({ session, dataStream }),
            updateDocument: updateDocument({ session, dataStream }),
            requestSuggestions: requestSuggestions({
              session,
              dataStream,
            }),
          },
          experimental_telemetry: {
            isEnabled: isProductionEnvironment,
            functionId: 'stream-text',
          },
        });

        result.consumeStream();

        dataStream.merge(
          result.toUIMessageStream({
            sendReasoning: true,
          }),
        );
      },
      generateId: generateUUID,
      onFinish: async ({ messages }) => {
        await saveMessages({
          messages: messages.map((message) => ({
            id: message.id,
            role: message.role,
            parts: message.parts,
            createdAt: new Date(),
            attachments: [],
            chatId: id,
          })),
        });
      },
      onError: () => {
        return 'Oops, an error occurred!';
      },
    });

    const streamContext = getStreamContext();

    // Temporarily disable resumable streams to fix the 500 error
    // if (streamContext) {
    //   return new Response(
    //     await streamContext.resumableStream(streamId, () =>
    //       stream.pipeThrough(new JsonToSseTransformStream()),
    //     ),
    //   );
    // } else {
    //   return new Response(stream.pipeThrough(new JsonToSseTransformStream()));
    // }

    // Always use regular response for now
    return new Response(stream.pipeThrough(new JsonToSseTransformStream()));
  } catch (error) {
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }
    console.error('Chat API error:', error);
    return new ChatSDKError('bad_request:chat').toResponse();
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return new ChatSDKError('bad_request:api').toResponse();
  }

  const session = await auth();

  if (!session?.user) {
    return new ChatSDKError('unauthorized:chat').toResponse();
  }

  const chat = await getChatById({ id });

  if (chat.userId !== session.user.id) {
    return new ChatSDKError('forbidden:chat').toResponse();
  }

  const deletedChat = await deleteChatById({ id });

  return Response.json(deletedChat, { status: 200 });
}

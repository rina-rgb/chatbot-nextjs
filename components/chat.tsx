'use client';

import { DefaultChatTransport } from 'ai';
import { useChat } from '@ai-sdk/react';
import { useEffect, useRef, useState, useCallback } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { ChatHeader } from '@/components/chat-header';
import type { Vote } from '@/lib/db/schema';
import { fetcher, fetchWithErrorHandlers, generateUUID } from '@/lib/utils';
import { Artifact } from './artifact';
import { MultimodalInput } from './multimodal-input';
import { Messages } from './messages';
import type { VisibilityType } from './visibility-selector';
import { useArtifactSelector } from '@/hooks/use-artifact';
import { unstable_serialize } from 'swr/infinite';
import { getChatHistoryPaginationKey } from './sidebar-history';
import { toast } from './toast';
import type { Session } from 'next-auth';
import { useSearchParams } from 'next/navigation';
import { useChatVisibility } from '@/hooks/use-chat-visibility';
import { useAutoResume } from '@/hooks/use-auto-resume';
import { ChatSDKError } from '@/lib/errors';
import type { Attachment, ChatMessage } from '@/lib/types';
import { useDataStream } from './data-stream-provider';
import { ConsultantNoteCard } from './consultant-note-card';

function ConsultantEmptyPlaceholder() {
  return (
    <div className="rounded-xl border bg-muted/20 p-4">
      <div className="flex items-start gap-3">
        <div className="mt-1 size-2 rounded-full" />
        <div className="flex-1 min-w-0">
          <p className="mb-1 text-sm text-muted-foreground">
            AI consultant notes will appear here after the therapist receives a
            patient response each round.
          </p>
          <p className="text-xs text-muted-foreground">
            You will see a short summary and expandable details. The most recent
            note stays at the top.
          </p>
          <div className="flex flex-col gap-3 my-2 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <span className="size-2 rounded-full bg-green-500" />
              Green: doing well
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="size-2 rounded-full bg-yellow-500" />
              Yellow: suggestions available
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="size-2 rounded-full bg-red-500" />
              Red: urgent review needed
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Chat({
  id,
  initialMessages,
  initialChatModel,
  initialVisibilityType,
  isReadonly,
  session,
  autoResume,
}: {
  id: string;
  initialMessages: ChatMessage[];
  initialChatModel: string;
  initialVisibilityType: VisibilityType;
  isReadonly: boolean;
  session: Session;
  autoResume: boolean;
}) {
  const { visibilityType } = useChatVisibility({
    chatId: id,
    initialVisibilityType,
  });

  const { mutate } = useSWRConfig();
  const { dataStream, setDataStream } = useDataStream();

  const [input, setInput] = useState<string>('');
  const [verbosity, _setVerbosity] = useState<'brief' | 'detailed'>('brief');
  const [memorySummary, setMemorySummary] = useState<string>('');
  const [patientAgent, setPatientAgent] = useState<
    'latino-veteran' | 'black-woman-trauma'
  >('latino-veteran');
  const [shouldCallConsultant, setShouldCallConsultant] =
    useState<boolean>(false);
  const lastUserRef = useRef<string>('');
  const patientAgentRef = useRef(patientAgent);

  // Update ref when patientAgent changes
  useEffect(() => {
    patientAgentRef.current = patientAgent;
  }, [patientAgent]);

  // Load consultant notes from database
  const { data: consultantNotesData, mutate: mutateConsultantNotes } = useSWR<{
    notes: Array<{
      id: string;
      title: string;
      summary: string;
      details?: string;
      priority: 'green' | 'yellow' | 'red';
      createdAt: string;
    }>;
  }>(`/api/consultant-notes?chatId=${id}`, fetcher);

  const consultantNotes = consultantNotesData?.notes || [];

  // Function to call consultant API
  const callConsultant = useCallback(
    async (conversationHistory: any[], memorySummary: string) => {
      try {
        const res = await fetch('/api/consultant', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            conversationHistory,
            memorySummary,
            verbosity,
          }),
        });

        if (!res.ok) {
          console.error('Consultant API error:', res.status, res.statusText);
          return;
        }

        const data = (await res.json()) as {
          consultantNote: {
            title: string;
            summary: string;
            details?: string;
            priority: 'green' | 'yellow' | 'red';
          };
        };

        // Save consultant note to database
        await fetch('/api/consultant-notes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chatId: id,
            title: data.consultantNote.title,
            summary: data.consultantNote.summary,
            details: data.consultantNote.details,
            priority: data.consultantNote.priority,
          }),
        });

        // Refresh consultant notes data
        mutateConsultantNotes();
      } catch (error) {
        console.error('Error calling consultant API:', error);
      }
    },
    [id, verbosity, mutateConsultantNotes],
  );

  const {
    messages,
    setMessages,
    sendMessage,
    status,
    stop,
    regenerate,
    resumeStream,
  } = useChat<ChatMessage>({
    id,
    messages: initialMessages,
    experimental_throttle: 100,
    generateId: generateUUID,
    transport: new DefaultChatTransport({
      api: '/api/chat',
      fetch: fetchWithErrorHandlers,
      prepareSendMessagesRequest({ messages, id, body }) {
        const last = messages.at(-1);
        const lastUserText =
          last?.role === 'user'
            ? (last.parts ?? [])
                .filter((p: any) => p?.type === 'text')
                .map((p: any) => p.text)
                .join('\n')
            : '';
        if (lastUserText) lastUserRef.current = lastUserText;

        return {
          body: {
            id,
            message: last,
            selectedChatModel: initialChatModel,
            selectedVisibilityType: visibilityType,
            patientAgent: patientAgentRef.current, // Pass the selected patient agent
            ...body,
          },
        };
      },
    }),
    onData: (dataPart) => {
      setDataStream((ds) => (ds ? [...ds, dataPart] : []));
    },
    onFinish: async () => {
      // Get the latest user message from lastUserRef
      const latestUserMessage = lastUserRef.current;

      // Get the latest assistant response from the dataStream
      const latestAssistantResponse =
        dataStream
          ?.filter((part: any) => part.type === 'text-delta')
          ?.map((part: any) => part.delta)
          ?.join('') || '';

      // Tiny summary memory
      const nextMem = `Last turn → therapist: "${truncate(latestUserMessage, 120)}"; patient: "${truncate(
        latestAssistantResponse,
        120,
      )}"`;
      setMemorySummary(nextMem);

      // Set flag to call consultant after patient responds
      setShouldCallConsultant(true);

      mutate(unstable_serialize(getChatHistoryPaginationKey));
    },
    onError: (error) => {
      if (error instanceof ChatSDKError) {
        toast({ type: 'error', description: error.message });
      }
    },
  });

  // Call consultant when flag is set and we have conversation data
  useEffect(() => {
    if (shouldCallConsultant && messages.length > 0 && memorySummary) {
      // Get the latest conversation history including the patient's response
      const fullConversationHistory = messages.map((msg) => ({
        role: msg.role,
        parts: msg.parts,
      }));

      callConsultant(fullConversationHistory, memorySummary);
      setShouldCallConsultant(false);
    }
  }, [shouldCallConsultant, messages, memorySummary, callConsultant]);
  const searchParams = useSearchParams();
  const query = searchParams.get('query');

  const [hasAppendedQuery, setHasAppendedQuery] = useState(false);

  useEffect(() => {
    if (query && !hasAppendedQuery) {
      sendMessage({
        role: 'user' as const,
        parts: [{ type: 'text', text: query }],
      });

      setHasAppendedQuery(true);
      window.history.replaceState({}, '', `/chat/${id}`);
    }
  }, [query, sendMessage, hasAppendedQuery, id]);

  const { data: votes } = useSWR<Array<Vote>>(
    messages.length >= 2 ? `/api/vote?chatId=${id}` : null,
    fetcher,
  );

  const [attachments, setAttachments] = useState<Array<Attachment>>([]);
  const isArtifactVisible = useArtifactSelector((state) => state.isVisible);

  useAutoResume({
    autoResume,
    initialMessages,
    resumeStream,
    setMessages,
  });

  function truncate(s: string, n: number) {
    return s.length > n ? `${s.slice(0, n)}…` : s;
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-12 min-w-0 h-dvh bg-background">
        <div className="md:col-span-8 col-span-12 flex flex-col min-w-0">
          <ChatHeader
            chatId={id}
            selectedModelId={initialChatModel}
            selectedVisibilityType={initialVisibilityType}
            isReadonly={isReadonly}
            session={session}
            patientAgent={patientAgent}
            setPatientAgent={(v) => setPatientAgent(v)}
          />

          {/* Patient Agent Selector moved to header; mobile inline above */}

          <Messages
            chatId={id}
            status={status}
            votes={votes}
            messages={messages}
            setMessages={setMessages}
            regenerate={regenerate}
            isReadonly={isReadonly}
            isArtifactVisible={isArtifactVisible}
          />

          {/* Mobile AI Consultant (below Suggestions) - Carousel */}
          {consultantNotes.length === 0 && (
            <div className="md:hidden border-t p-3">
              <ConsultantEmptyPlaceholder />
            </div>
          )}
          {consultantNotes.length > 0 && (
            <div className="md:hidden border-t px-3 py-2">
              <div
                className="flex overflow-x-auto snap-x snap-mandatory gap-3"
                onWheel={(e) => {
                  const el = e.currentTarget;
                  const atStart = el.scrollLeft <= 0 && e.deltaY < 0;
                  const atEnd =
                    el.scrollLeft + el.clientWidth >= el.scrollWidth &&
                    e.deltaY > 0;
                  if (atStart || atEnd) e.preventDefault();
                }}
              >
                {[
                  consultantNotes[consultantNotes.length - 1],
                  ...consultantNotes.slice(0, -1),
                ].map((note, index) => {
                  const isLatest = index === 0;
                  return (
                    <div
                      key={note.id}
                      className="snap-center shrink-0 min-w-0 w-full"
                    >
                      <div className="mb-1.5">
                        <span
                          className={
                            isLatest
                              ? 'text-[11px] uppercase tracking-wider text-foreground/70 bg-muted px-2 py-1 rounded'
                              : 'text-[11px] uppercase tracking-wider text-muted-foreground bg-muted/60 px-2 py-1 rounded'
                          }
                        >
                          {isLatest ? 'Most recent note' : 'Note history'}
                        </span>
                      </div>
                      <div className={isLatest ? '' : 'opacity-80'}>
                        <ConsultantNoteCard
                          chatId={id}
                          note={note}
                          highlight={isLatest}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-center gap-2 mt-2 pb-2">
                {consultantNotes.map((_, i) => (
                  <span
                    key={`note-dot-${i}`}
                    className={`size-2 rounded-full ${i === 0 ? 'bg-foreground' : 'bg-muted-foreground/50'}`}
                  />
                ))}
              </div>
            </div>
          )}

          <form className="flex w-full mx-auto px-4 bg-background pb-4 md:pb-6 gap-2 w/full md:max-w-3xl">
            {!isReadonly && (
              <MultimodalInput
                chatId={id}
                input={input}
                setInput={setInput}
                status={status}
                stop={stop}
                attachments={attachments}
                setAttachments={setAttachments}
                messages={messages}
                setMessages={setMessages}
                sendMessage={sendMessage}
                selectedVisibilityType={visibilityType}
              />
            )}
          </form>
        </div>

        {/* AI Consultant (desktop sidebar) */}
        <aside className="hidden md:flex md:col-span-4 flex-col h-full md:border-l border-t">
          <div className="sticky top-0 z-10 bg-background">
            <div className="px-2 md:px-2 py-1.5 flex items-center justify-between border-b">
              <span className="text-foreground/90">AI Consultant</span>
            </div>

            {/* Sticky latest note */}
            {consultantNotes.length > 0 && (
              <div className="p-3 border-b bg-background">
                <div className="text-[11px] uppercase tracking-wider font-semibold text-foreground/70 bg-muted px-2 py-1 rounded inline-block mb-2">
                  Most recent note
                </div>
                <ConsultantNoteCard
                  chatId={id}
                  note={consultantNotes[consultantNotes.length - 1]}
                  highlight
                />
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {consultantNotes.length === 0 && <ConsultantEmptyPlaceholder />}
            {consultantNotes.length > 1 && (
              <div className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground bg-muted/60 px-2 py-1 rounded inline-block mb-2">
                Note history
              </div>
            )}
            {consultantNotes.slice(0, -1).map((n) => (
              <div
                key={n.id}
                className="opacity-70 hover:grayscale-0 transition"
              >
                <ConsultantNoteCard chatId={id} note={n} />
              </div>
            ))}
          </div>

          <div className="sticky bottom-0 z-10 p-3 text-xs text-muted-foreground border-t bg-background">
            <b>Memory:</b> {memorySummary || '—'}
          </div>
        </aside>
      </div>

      <Artifact
        chatId={id}
        input={input}
        setInput={setInput}
        status={status}
        stop={stop}
        attachments={attachments}
        setAttachments={setAttachments}
        sendMessage={sendMessage}
        messages={messages}
        setMessages={setMessages}
        regenerate={regenerate}
        votes={votes}
        isReadonly={isReadonly}
        selectedVisibilityType={visibilityType}
      />
    </>
  );
}

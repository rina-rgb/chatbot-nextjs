'use client';

import type { UIMessage } from 'ai';
import cx from 'classnames';
import type React from 'react';
import {
  useRef,
  useEffect,
  useState,
  useCallback,
  type Dispatch,
  type SetStateAction,
  type ChangeEvent,
  memo,
} from 'react';
import { toast } from 'sonner';
import { useLocalStorage, useWindowSize } from 'usehooks-ts';

import { ArrowUpIcon, PaperclipIcon, StopIcon } from './icons';
import { PreviewAttachment } from './preview-attachment';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { SuggestedActions } from './suggested-actions';
import equal from 'fast-deep-equal';
import type { UseChatHelpers } from '@ai-sdk/react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowDown, Mic, Check, X } from 'lucide-react';
import { useScrollToBottom } from '@/hooks/use-scroll-to-bottom';
import type { VisibilityType } from './visibility-selector';
import type { Attachment, ChatMessage } from '@/lib/types';

// Minimal Web Speech API type declarations for cross-browser support
type Ctor<T> = new () => T;
interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}
interface SpeechRecognitionResult {
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
  isFinal?: boolean;
}
interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}
interface SpeechRecognition extends EventTarget {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
declare global {
  interface Window {
    SpeechRecognition?: Ctor<SpeechRecognition>;
    webkitSpeechRecognition?: Ctor<SpeechRecognition>;
  }
}

function PureMultimodalInput({
  chatId,
  input,
  setInput,
  status,
  stop,
  attachments,
  setAttachments,
  messages,
  setMessages,
  sendMessage,
  className,
  selectedVisibilityType,
}: {
  chatId: string;
  input: string;
  setInput: Dispatch<SetStateAction<string>>;
  status: UseChatHelpers<ChatMessage>['status'];
  stop: () => void;
  attachments: Array<Attachment>;
  setAttachments: Dispatch<SetStateAction<Array<Attachment>>>;
  messages: Array<UIMessage>;
  setMessages: UseChatHelpers<ChatMessage>['setMessages'];
  sendMessage: UseChatHelpers<ChatMessage>['sendMessage'];
  className?: string;
  selectedVisibilityType: VisibilityType;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { width } = useWindowSize();

  useEffect(() => {
    if (textareaRef.current) {
      adjustHeight();
    }
  }, []);

  const adjustHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight + 2}px`;
    }
  };

  const resetHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = '98px';
    }
  };

  const [localStorageInput, setLocalStorageInput] = useLocalStorage(
    'input',
    '',
  );

  useEffect(() => {
    if (textareaRef.current) {
      const domValue = textareaRef.current.value;
      // Prefer DOM value over localStorage to handle hydration
      const finalValue = domValue || localStorageInput || '';
      setInput(finalValue);
      adjustHeight();
    }
    // Only run once after hydration
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setLocalStorageInput(input);
  }, [input, setLocalStorageInput]);

  // Ensure textarea resizes when input is updated programmatically (e.g., voice transcript)
  useEffect(() => {
    adjustHeight();
  }, [input]);

  const handleInput = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(event.target.value);
    adjustHeight();
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadQueue, setUploadQueue] = useState<Array<string>>([]);

  const submitForm = useCallback(() => {
    window.history.replaceState({}, '', `/chat/${chatId}`);

    sendMessage({
      role: 'user',
      parts: [
        ...attachments.map((attachment) => ({
          type: 'file' as const,
          url: attachment.url,
          name: attachment.name,
          mediaType: attachment.contentType,
        })),
        {
          type: 'text',
          text: input,
        },
      ],
    });

    setAttachments([]);
    setLocalStorageInput('');
    resetHeight();
    setInput('');

    if (width && width > 768) {
      textareaRef.current?.focus();
    }
  }, [
    input,
    setInput,
    attachments,
    sendMessage,
    setAttachments,
    setLocalStorageInput,
    width,
    chatId,
  ]);

  const uploadFile = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/files/upload', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        const { url, pathname, contentType } = data;

        return {
          url,
          name: pathname,
          contentType: contentType,
        };
      }
      const { error } = await response.json();
      toast.error(error);
    } catch (_error) {
      toast.error('Failed to upload file, please try again!');
    }
  };

  const handleFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files || []);

      setUploadQueue(files.map((file) => file.name));

      try {
        const uploadPromises = files.map((file) => uploadFile(file));
        const uploadedAttachments = await Promise.all(uploadPromises);
        const successfullyUploadedAttachments = uploadedAttachments.filter(
          (attachment) => attachment !== undefined,
        );

        setAttachments((currentAttachments) => [
          ...currentAttachments,
          ...successfullyUploadedAttachments,
        ]);
      } catch (error) {
        console.error('Error uploading files!', error);
      } finally {
        setUploadQueue([]);
      }
    },
    [setAttachments],
  );

  const { isAtBottom, scrollToBottom } = useScrollToBottom();

  useEffect(() => {
    if (status === 'submitted') {
      scrollToBottom();
    }
  }, [status, scrollToBottom]);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Array<Blob>>([]);
  const [isListening, setIsListening] = useState(false);
  const shouldSendOnStopRef = useRef(false);

  const startListening = useCallback(async () => {
    try {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices) {
        toast.error('Microphone is not available');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const mimeType =
        typeof MediaRecorder !== 'undefined' &&
        MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm';

      const recorder = new MediaRecorder(stream, { mimeType });
      audioChunksRef.current = [];

      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        try {
          const firstChunkType = audioChunksRef.current[0]?.type;
          const effectiveType =
            firstChunkType || recorder.mimeType || 'audio/webm';

          const audioBlob = new Blob(audioChunksRef.current, {
            type: effectiveType,
          });
          const ext = effectiveType.includes('webm')
            ? 'webm'
            : effectiveType.includes('ogg')
              ? 'ogg'
              : effectiveType.includes('mp4') || effectiveType.includes('m4a')
                ? 'm4a'
                : effectiveType.includes('mpeg') ||
                    effectiveType.includes('mp3')
                  ? 'mp3'
                  : effectiveType.includes('wav')
                    ? 'wav'
                    : 'dat';

          // Stop all tracks
          stream.getTracks().forEach((t) => t.stop());

          if (!shouldSendOnStopRef.current) {
            setIsListening(false);
            mediaRecorderRef.current = null;
            return;
          }

          const file = new File([audioBlob], `audio.${ext}`, {
            type: effectiveType,
          });
          const formData = new FormData();
          formData.append('audio', file);

          const response = await fetch('/api/voice-transcript', {
            method: 'POST',
            body: formData,
          });

          if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            console.error('Transcription API error:', err);
            toast.error('Failed to transcribe audio');
          } else {
            const data = (await response.json()) as { transcript?: string };
            if (data.transcript && data.transcript.trim().length > 0) {
              setInput(data.transcript.trim());
            } else {
              toast.error('No transcription received');
            }
          }
        } catch (error) {
          console.error('Transcription error:', error);
          toast.error('Failed to transcribe audio');
        } finally {
          setIsListening(false);
          mediaRecorderRef.current = null;
          audioChunksRef.current = [];
        }
      };

      mediaRecorderRef.current = recorder;
      shouldSendOnStopRef.current = false;
      setIsListening(true);
      recorder.start();
    } catch (error) {
      console.error('Could not access microphone:', error);
      toast.error('Could not access microphone');
      setIsListening(false);
      mediaRecorderRef.current = null;
      audioChunksRef.current = [];
    }
  }, [setInput]);

  const cancelListening = useCallback(() => {
    shouldSendOnStopRef.current = false;
    try {
      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state !== 'inactive'
      ) {
        mediaRecorderRef.current.stop();
      }
    } catch {}
  }, []);

  const finishListening = useCallback(() => {
    shouldSendOnStopRef.current = true;
    try {
      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state !== 'inactive'
      ) {
        mediaRecorderRef.current.stop();
      }
    } catch {}
  }, []);

  return (
    <div className="relative w-full flex flex-col gap-4">
      <AnimatePresence>
        {!isAtBottom && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          >
            <Button
              data-testid="scroll-to-bottom-button"
              className="rounded-full absolute left-1/2 bottom-28 -translate-x-1/2 z-50"
              size="icon"
              variant="outline"
              onClick={(event) => {
                event.preventDefault();
                scrollToBottom();
              }}
            >
              <ArrowDown />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {messages.length === 0 &&
        attachments.length === 0 &&
        uploadQueue.length === 0 && (
          <SuggestedActions
            sendMessage={sendMessage}
            chatId={chatId}
            selectedVisibilityType={selectedVisibilityType}
          />
        )}

      <input
        type="file"
        className="fixed -top-4 -left-4 size-0.5 opacity-0 pointer-events-none"
        ref={fileInputRef}
        multiple
        onChange={handleFileChange}
        tabIndex={-1}
      />

      {(attachments.length > 0 || uploadQueue.length > 0) && (
        <div
          data-testid="attachments-preview"
          className="flex flex-row gap-2 overflow-x-scroll items-end"
        >
          {attachments.map((attachment) => (
            <PreviewAttachment key={attachment.url} attachment={attachment} />
          ))}

          {uploadQueue.map((filename) => (
            <PreviewAttachment
              key={filename}
              attachment={{
                url: '',
                name: filename,
                contentType: '',
              }}
              isUploading={true}
            />
          ))}
        </div>
      )}

      <Textarea
        data-testid="multimodal-input"
        ref={textareaRef}
        placeholder={isListening ? 'Recording…' : 'Send a message...'}
        value={input}
        onChange={handleInput}
        className={cx(
          'min-h-[20px] max-h-[calc(75dvh)] overflow-hidden resize-none rounded-2xl !text-base bg-muted dark:border-zinc-700 w-full px-3 py-2 transition-[height] duration-200',
          className,
        )}
        rows={1}
        autoFocus
        onKeyDown={(event) => {
          if (
            event.key === 'Enter' &&
            !event.shiftKey &&
            !event.nativeEvent.isComposing
          ) {
            event.preventDefault();

            if (status !== 'ready') {
              toast.error('Please wait for the model to finish its response!');
            } else {
              submitForm();
            }
          }
        }}
      />

      <div className="absolute bottom-1 right-0 p-1 w-fit flex flex-row justify-end gap-3">
        {isListening && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ type: 'spring', stiffness: 300, damping: 22 }}
            className="flex items-center gap-2 text-xs text-red-600"
          >
            <span className="inline-block size-2 rounded-full bg-red-500 animate-pulse" />
            <span>Recording…</span>
          </motion.div>
        )}

        <div className="ml-auto flex flex-row justify-end gap-3">
          {status === 'submitted' ? (
            <StopButton stop={stop} setMessages={setMessages} />
          ) : (
            <>
              {!isListening ? (
                <VoiceButton
                  isRecording={false}
                  onClick={() => {
                    startListening();
                  }}
                  status={status}
                  disabled={status !== 'ready'}
                />
              ) : (
                <>
                  <Button
                    data-testid="voice-cancel"
                    className="rounded-full p-[6px] h-fit border dark:border-zinc-600 hover:dark:bg-zinc-900 hover:bg-zinc-200 transition-transform hover:scale-105 active:scale-95"
                    variant="ghost"
                    onClick={(e) => {
                      e.preventDefault();
                      cancelListening();
                    }}
                    title="Cancel"
                    aria-label="Cancel recording"
                  >
                    <X size={14} />
                  </Button>
                  <Button
                    data-testid="voice-finish"
                    className="rounded-full p-[6px] h-fit border dark:border-zinc-600 hover:dark:bg-zinc-900 hover:bg-zinc-200 transition-transform hover:scale-105 active:scale-95"
                    variant="ghost"
                    onClick={(e) => {
                      e.preventDefault();
                      finishListening();
                    }}
                    title="Finish"
                    aria-label="Finish recording"
                  >
                    <Check size={14} />
                  </Button>
                </>
              )}
              <SendButton
                input={input}
                submitForm={submitForm}
                uploadQueue={uploadQueue}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export const MultimodalInput = memo(
  PureMultimodalInput,
  (prevProps, nextProps) => {
    if (prevProps.input !== nextProps.input) return false;
    if (prevProps.status !== nextProps.status) return false;
    if (!equal(prevProps.attachments, nextProps.attachments)) return false;
    if (prevProps.selectedVisibilityType !== nextProps.selectedVisibilityType)
      return false;

    return true;
  },
);

function PureAttachmentsButton({
  fileInputRef,
  status,
}: {
  fileInputRef: React.MutableRefObject<HTMLInputElement | null>;
  status: UseChatHelpers<ChatMessage>['status'];
}) {
  return (
    <Button
      data-testid="attachments-button"
      className="rounded-md rounded-bl-lg p-[7px] h-fit dark:border-zinc-700 hover:dark:bg-zinc-900 hover:bg-zinc-200"
      onClick={(event) => {
        event.preventDefault();
        fileInputRef.current?.click();
      }}
      disabled={status !== 'ready'}
      variant="ghost"
    >
      <PaperclipIcon size={14} />
    </Button>
  );
}

// const AttachmentsButton = memo(PureAttachmentsButton);

function PureStopButton({
  stop,
  setMessages,
}: {
  stop: () => void;
  setMessages: UseChatHelpers<ChatMessage>['setMessages'];
}) {
  return (
    <Button
      data-testid="stop-button"
      className="rounded-full p-[6px] h-fit border dark:border-zinc-600"
      onClick={(event) => {
        event.preventDefault();
        stop();
        setMessages((messages) => messages);
      }}
    >
      <StopIcon size={14} />
    </Button>
  );
}

const StopButton = memo(PureStopButton);

function PureSendButton({
  submitForm,
  input,
  uploadQueue,
}: {
  submitForm: () => void;
  input: string;
  uploadQueue: Array<string>;
}) {
  return (
    <Button
      data-testid="send-button"
      className="rounded-full p-[6px] h-fit border dark:border-zinc-600"
      onClick={(event) => {
        event.preventDefault();
        submitForm();
      }}
      disabled={input.length === 0 || uploadQueue.length > 0}
    >
      <ArrowUpIcon size={14} />
    </Button>
  );
}

const SendButton = memo(PureSendButton, (prevProps, nextProps) => {
  if (prevProps.uploadQueue.length !== nextProps.uploadQueue.length)
    return false;
  if (prevProps.input !== nextProps.input) return false;
  return true;
});

function PureVoiceButton({
  isRecording,
  onClick,
  status,
  disabled,
}: {
  isRecording: boolean;
  onClick: () => void;
  status: UseChatHelpers<ChatMessage>['status'];
  disabled?: boolean;
}) {
  return (
    <Button
      data-testid="voice-button"
      className="rounded-full p-[6px] h-fit border dark:border-zinc-600 hover:dark:bg-zinc-900 hover:bg-zinc-200"
      onClick={(event) => {
        event.preventDefault();
        onClick();
      }}
      disabled={disabled ?? status !== 'ready'}
      variant="ghost"
      title={isRecording ? 'Finish recording' : 'Start recording'}
    >
      {isRecording ? <Check size={14} /> : <Mic size={14} />}
    </Button>
  );
}

const VoiceButton = memo(PureVoiceButton);

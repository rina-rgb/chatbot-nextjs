'use client';

import { motion } from 'framer-motion';
import { Button } from './ui/button';
import { memo } from 'react';
import type { UseChatHelpers } from '@ai-sdk/react';
import type { VisibilityType } from './visibility-selector';
import type { ChatMessage } from '@/lib/types';

interface SuggestedActionsProps {
  chatId: string;
  sendMessage: UseChatHelpers<ChatMessage>['sendMessage'];
  selectedVisibilityType: VisibilityType;
}

function PureSuggestedActions({
  chatId,
  sendMessage,
  selectedVisibilityType,
}: SuggestedActionsProps) {
  const suggestedActions = [
    {
      title: 'Treatment Rationale',
      label: 'Explain WET and today’s plan',
      action:
        'Today, I’d like to talk with you about a treatment called Written Exposure Therapy (WET). It helps you process the trauma memory so it loses power over you. Today, I’ll explain the steps and then invite you to write about the event for about 30 minutes. I’ll be here while you write, and we’ll check in after. How does that sound?',
    },
    {
      title: 'Safety + Consent',
      label: 'Confirm readiness before starting',
      action:
        'Before we begin, I want to check on your safety and comfort. Are you safe today? Any concerns about hurting yourself or anyone else? We can pause at any time. Do I have your OK to begin WET now?',
    },
    {
      title: 'Start Narrative',
      label: 'Invite 30‑minute trauma writing',
      action:
        "When you're ready, please write continuously for about 30 minutes about the most distressing part of the event—the sights, sounds, thoughts, and feelings. Use as much detail as you can. If your mind wanders, gently bring it back to the event. I'm here while you write.",
    },
    {
      title: 'Language & Culture',
      label: 'Check preferences for comfort',
      action:
        'Is there a language or way of expressing yourself that feels most natural for you to use today? Any cultural or personal preferences you’d like me to keep in mind as we go?',
    },
  ];

  return (
    <div
      data-testid="suggested-actions"
      className="grid sm:grid-cols-2 gap-2 w-full"
    >
      {suggestedActions.map((suggestedAction, index) => (
        <div className={index > 1 ? 'hidden sm:block' : 'block'}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ delay: 0.05 * index }}
            key={`suggested-action-${suggestedAction.title}-${index}`}
          >
          <Button
            variant="ghost"
            onClick={async () => {
              window.history.replaceState({}, '', `/chat/${chatId}`);

              sendMessage({
                role: 'user',
                parts: [{ type: 'text', text: suggestedAction.action }],
              });
            }}
            className="text-left border rounded-xl px-4 py-3.5 text-sm flex-1 gap-1 sm:flex-col w-full h-auto justify-start items-start"
          >
            <span className="font-medium">{suggestedAction.title}</span>
            <span className="text-muted-foreground">
              {suggestedAction.label}
            </span>
          </Button>
          </motion.div>
        </div>
      ))}
    </div>
  );
}

export const SuggestedActions = memo(
  PureSuggestedActions,
  (prevProps, nextProps) => {
    if (prevProps.chatId !== nextProps.chatId) return false;
    if (prevProps.selectedVisibilityType !== nextProps.selectedVisibilityType)
      return false;

    return true;
  },
);

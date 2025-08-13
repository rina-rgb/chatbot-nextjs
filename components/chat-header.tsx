'use client';
import { useRouter } from 'next/navigation';
import { useWindowSize } from 'usehooks-ts';

// import { ModelSelector } from '@/components/model-selector';
import { SidebarToggle } from '@/components/sidebar-toggle';
import { Button } from '@/components/ui/button';
import { PlusIcon } from './icons';
import { useSidebar } from './ui/sidebar';
import { memo, useEffect, useState } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import { type VisibilityType } from './visibility-selector';
import type { Session } from 'next-auth';

function PureChatHeader({
  chatId,
  selectedModelId,
  selectedVisibilityType,
  isReadonly,
  session,
  patientAgent,
  setPatientAgent,
}: {
  chatId: string;
  selectedModelId: string;
  selectedVisibilityType: VisibilityType;
  isReadonly: boolean;
  session: Session;
  patientAgent: 'latino-veteran' | 'black-woman-trauma';
  setPatientAgent: (value: 'latino-veteran' | 'black-woman-trauma') => void;
}) {
  const router = useRouter();
  const { open } = useSidebar();
  const [hasMounted, setHasMounted] = useState(false);

  const { width: windowWidth } = useWindowSize();

  useEffect(() => {
    setHasMounted(true);
  }, []);

  // Prevent hydration mismatch by only applying client-specific logic after mount
  const showNewChatButton = hasMounted ? !open || windowWidth < 768 : !open;

  return (
    <header className="sticky top-0 z-50 flex items-center px-2 md:px-2 py-1.5 gap-2 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <SidebarToggle />

      {/* Patient Agent selector (sticky in header, right-aligned) */}
      <div className="ml-auto flex items-center gap-2">
        <select
          className="border rounded px-2 py-1 text-sm md:text-base max-w-[260px] w-auto truncate"
          value={patientAgent}
          onChange={(e) =>
            setPatientAgent(
              (e.target as HTMLSelectElement).value as
                | 'latino-veteran'
                | 'black-woman-trauma',
            )
          }
        >
          <option value="latino-veteran">Carlos (Beginner)</option>
          <option value="black-woman-trauma">Michelle (Intermediate)</option>
        </select>
      </div>

      {showNewChatButton && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              className="order-2 md:order-1 md:px-2 px-2 md:h-fit ml-auto md:ml-0"
              onClick={() => {
                router.push('/');
                router.refresh();
              }}
            >
              <PlusIcon />
              <span className="md:sr-only hidden md:inline">New Chat</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>New Chat</TooltipContent>
        </Tooltip>
      )}

      {/* {!isReadonly && (
        <ModelSelector
          session={session}
          selectedModelId={selectedModelId}
          className="order-1 md:order-2"
        />
      )}

      {!isReadonly && (
        <VisibilitySelector
          chatId={chatId}
          selectedVisibilityType={selectedVisibilityType}
          className="order-1 md:order-3"
        />
      )} */}
    </header>
  );
}

export const ChatHeader = memo(PureChatHeader, (prevProps, nextProps) => {
  return (
    prevProps.chatId === nextProps.chatId &&
    prevProps.selectedModelId === nextProps.selectedModelId &&
    prevProps.selectedVisibilityType === nextProps.selectedVisibilityType &&
    prevProps.isReadonly === nextProps.isReadonly &&
    prevProps.patientAgent === nextProps.patientAgent
  );
});

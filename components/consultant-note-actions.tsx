import { useCopyToClipboard } from 'usehooks-ts';
import { CopyIcon, ThumbUpIcon, ThumbDownIcon } from './icons';
import { Button } from './ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './ui/tooltip';
import { toast } from 'sonner';
import { useState } from 'react';

interface ConsultantNoteActionsProps {
  chatId: string;
  note: {
    id: string;
    title: string;
    summary: string;
    details?: string;
    priority: 'green' | 'yellow' | 'red';
  };
  vote?: { chatId: string; noteId: string; isUpvoted: boolean };
  isLoading?: boolean;
}

export function ConsultantNoteActions({
  chatId,
  note,
  vote,
  isLoading = false,
}: ConsultantNoteActionsProps) {
  const [_, copyToClipboard] = useCopyToClipboard();
  const [localVote, setLocalVote] = useState<'up' | 'down' | null>(
    vote?.isUpvoted ? 'up' : vote && !vote.isUpvoted ? 'down' : null,
  );

  const noteText = `${note.title}\n\n${note.summary}${note.details ? `\n\n${note.details}` : ''}`;

  if (isLoading) return null;

  return (
    <TooltipProvider delayDuration={0}>
      <div className="flex gap-1 mt-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              className="py-1 px-2 h-fit text-muted-foreground !pointer-events-auto"
              variant="outline"
              onClick={() => {
                copyToClipboard(noteText);
                toast.success('Copied to clipboard');
              }}
            >
              <CopyIcon />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Copy feedback</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              className="py-1 px-2 h-fit text-muted-foreground !pointer-events-auto"
              disabled={localVote === 'up'}
              variant="outline"
              onClick={() => {
                setLocalVote('up');
                toast.success('Upvoted feedback!');
              }}
            >
              <ThumbUpIcon />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Helpful feedback</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              className="py-1 px-2 h-fit text-muted-foreground !pointer-events-auto"
              variant="outline"
              disabled={localVote === 'down'}
              onClick={() => {
                setLocalVote('down');
                toast.success('Downvoted feedback!');
              }}
            >
              <ThumbDownIcon />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Not helpful</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { ConsultantNoteActions } from './consultant-note-actions';
import { Markdown } from './markdown';
import useSWR from 'swr';
import { fetcher } from '@/lib/utils';

interface ConsultantNote {
  id: string;
  title: string;
  summary: string;
  details?: string;
  priority: 'green' | 'yellow' | 'red';
  createdAt: string;
}

interface ConsultantNoteCardProps {
  chatId: string;
  note: ConsultantNote;
  highlight?: boolean;
}

export function ConsultantNoteCard({
  chatId,
  note,
  highlight,
}: ConsultantNoteCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Load votes from the database
  const { data: votes } = useSWR<
    Array<{ chatId: string; noteId: string; isUpvoted: boolean }>
  >(`/api/consultant-vote?chatId=${chatId}`, fetcher);

  const vote = votes?.find((v) => v.noteId === note.id);

  // Color accents for highlighted (most recent) note; neutral otherwise
  const accentDotByPriority: Record<ConsultantNote['priority'], string> = {
    green: 'bg-green-500',
    yellow: 'bg-yellow-500',
    red: 'bg-red-500',
  };

  const accentBorderByPriority: Record<ConsultantNote['priority'], string> = {
    green: 'border-green-200 dark:border-green-800',
    yellow: 'border-yellow-200 dark:border-yellow-800',
    red: 'border-red-200 dark:border-red-800',
  };

  const accentBackgroundByPriority: Record<ConsultantNote['priority'], string> =
    {
      green: 'bg-green-50 dark:bg-green-950/40',
      yellow: 'bg-yellow-50 dark:bg-yellow-950/40',
      red: 'bg-red-50 dark:bg-red-950/40',
    };

  return (
    <div
      className={`text-sm border rounded-xl p-4 ${
        highlight
          ? `${accentBackgroundByPriority[note.priority]} ${accentBorderByPriority[note.priority]}`
          : 'bg-muted/20'
      }`}
    >
      <div className="flex items-start gap-2">
        <div
          className={`size-2 rounded-full mt-1 shrink-0 ${
            highlight
              ? accentDotByPriority[note.priority]
              : 'bg-muted-foreground/60'
          }`}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h4
              className={`${highlight ? 'text-foreground truncate font-medium' : 'text-foreground/90 truncate font-normal'}`}
            >
              {note.title}
            </h4>
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              {isExpanded ? (
                <ChevronDown size={16} />
              ) : (
                <ChevronRight size={16} />
              )}
            </button>
          </div>
          <p className="text-sm text-muted-foreground mt-1">{note.summary}</p>
          {isExpanded && note.details && (
            <div className="mt-3 pt-3 border-t border-current/20">
              <div className="text-sm">
                <Markdown>{note.details}</Markdown>
              </div>
            </div>
          )}
          <ConsultantNoteActions
            chatId={chatId}
            note={note}
            vote={vote}
            isLoading={!votes}
          />
        </div>
      </div>
    </div>
  );
}

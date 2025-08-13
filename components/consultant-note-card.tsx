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
}

export function ConsultantNoteCard({ chatId, note }: ConsultantNoteCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Load votes from the database
  const { data: votes } = useSWR<
    Array<{ chatId: string; noteId: string; isUpvoted: boolean }>
  >(`/api/consultant-vote?chatId=${chatId}`, fetcher);

  const vote = votes?.find((v) => v.noteId === note.id);

  // Neutral styling: grayscale only

  return (
    <div className={`text-sm border rounded-xl p-4 bg-muted/20`}>
      <div className="flex items-start gap-2">
        <div className="size-2 rounded-full mt-1 shrink-0 bg-muted-foreground/60" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h4 className="text-foreground/90 truncate font-normal">
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

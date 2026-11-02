import { useEffect, useRef, useState, type FormEvent } from 'react';
import { PaperAirplaneIcon } from '@heroicons/react/24/outline';
import { Button, Spinner } from '@/components/common';
import { Markdown } from '@/components/common/Markdown';
import { cn } from '@/lib/utils';

export interface ChatTurn {
  id: string;
  from: 'user' | 'agent';
  text: string;
  /** Shown under an agent turn — which collections the answer came from. */
  sources?: string[];
  /** Renders the bubble as a problem rather than as an answer. */
  failed?: boolean;
}

/**
 * The conversation surface shared by the hospital and appointment agents.
 *
 * It holds no conversation of its own: turns and the send function come from
 * the page, because the session id that threads a conversation together is
 * minted by the agent service and belongs with whoever is calling it.
 */
export function AgentChat({
  turns,
  busy,
  onSend,
  placeholder,
  suggestions = [],
  accent,
  disabled,
  disabledReason,
  emptyTitle,
  emptyDetail,
}: {
  turns: ChatTurn[];
  busy: boolean;
  onSend: (message: string) => void;
  placeholder: string;
  suggestions?: string[];
  accent: string;
  disabled?: boolean;
  disabledReason?: string;
  emptyTitle: string;
  emptyDetail: string;
}) {
  const [draft, setDraft] = useState('');
  const listRef = useRef<HTMLDivElement>(null);

  // Follow the conversation as it grows, including while the agent is
  // thinking — otherwise the typing indicator appears below the fold.
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [turns, busy]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text || busy || disabled) return;
    setDraft('');
    onSend(text);
  };

  return (
    <div className="flex h-[min(34rem,calc(100vh-22rem))] min-h-[22rem] flex-col">
      <div
        ref={listRef}
        className="flex-1 space-y-3 overflow-y-auto rounded-xl border p-4"
        style={{
          borderColor: 'var(--color-border)',
          background: 'var(--color-surface-muted)',
        }}
        aria-live="polite"
      >
        {turns.length === 0 && !busy && (
          <div className="flex h-full flex-col items-center justify-center px-6 text-center">
            <span
              className="mb-3 h-2 w-2 rounded-full"
              style={{ background: accent }}
              aria-hidden
            />
            <p className="text-[0.8125rem] font-[620]">{emptyTitle}</p>
            <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-muted">{emptyDetail}</p>
            {suggestions.length > 0 && (
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    disabled={disabled}
                    onClick={() => onSend(s)}
                    className="rounded-full border px-3 py-1.5 text-[0.75rem] transition-colors hover:bg-[var(--color-surface)] disabled:opacity-50"
                    style={{ borderColor: 'var(--color-border)' }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {turns.map((turn) => (
          <Bubble key={turn.id} turn={turn} accent={accent} />
        ))}

        {busy && (
          <div className="flex items-center gap-2 text-xs text-muted">
            <Spinner size={14} />
            Thinking — a turn can take a few seconds
          </div>
        )}
      </div>

      {disabled && disabledReason && (
        <p className="mt-2 text-[0.75rem] text-muted">{disabledReason}</p>
      )}

      <form onSubmit={submit} className="mt-3 flex items-end gap-2">
        <textarea
          value={draft}
          rows={1}
          disabled={disabled || busy}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            // Enter sends, Shift+Enter adds a line — what people expect from
            // a chat box, and the reason this is a textarea at all.
            if (e.key === 'Enter' && !e.shiftKey) submit(e);
          }}
          placeholder={placeholder}
          className="max-h-32 min-h-[2.5rem] flex-1 resize-y rounded-lg border px-3 py-2 text-[0.8125rem] outline-none transition-shadow focus:ring-4 disabled:opacity-60"
          style={{
            borderColor: 'var(--color-border-dark)',
            background: 'var(--color-surface)',
          }}
        />
        <Button type="submit" disabled={disabled || busy || !draft.trim()}>
          <PaperAirplaneIcon className="h-4 w-4" />
          Send
        </Button>
      </form>
    </div>
  );
}

function Bubble({ turn, accent }: { turn: ChatTurn; accent: string }) {
  const mine = turn.from === 'user';

  return (
    <div className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[46rem] rounded-xl border px-3.5 py-2.5 text-[0.8125rem] leading-relaxed shadow-xs',
          mine && 'text-white'
        )}
        style={
          mine
            ? { background: 'var(--color-primary-700)', borderColor: 'transparent' }
            : {
                background: turn.failed ? 'var(--color-danger-light)' : 'var(--color-surface)',
                borderColor: turn.failed ? 'var(--color-danger-border)' : 'var(--color-border)',
              }
        }
      >
        {mine ? (
          <p className="whitespace-pre-wrap">{turn.text}</p>
        ) : (
          <Markdown content={turn.text} />
        )}

        {!mine && turn.sources && turn.sources.length > 0 && (
          <div
            className="mt-2.5 border-t pt-2 text-[0.6875rem] text-faint"
            style={{ borderColor: 'var(--color-border)' }}
          >
            <span className="font-semibold" style={{ color: accent }}>
              Read from
            </span>{' '}
            {turn.sources.join(' · ')}
          </div>
        )}
      </div>
    </div>
  );
}

let counter = 0;
export const turnId = () => `t${++counter}`;

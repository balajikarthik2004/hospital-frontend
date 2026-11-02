import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { PaperAirplaneIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { Button, Callout, Spinner } from '@/components/common';
import { Markdown } from '@/components/common/Markdown';
import { cn } from '@/lib/utils';

/**
 * The conversation surface shared by the appointment and hospital agents.
 *
 * Two things it deliberately does not do:
 *
 * - It keeps no conversation state of its own beyond the transcript. The
 *   session id comes back from the server on every turn and is echoed back
 *   untouched, so the agent's memory lives where the agent does.
 * - It never renders agent output as HTML. Agents produce Markdown and the
 *   narrow renderer handles it; a model that emits a `<script>` tag should
 *   produce visible text, not a script.
 */

export interface ChatMessage {
  id: string;
  role: 'user' | 'agent';
  text: string;
  /** Set when the service flagged acute symptoms — rendered as an alert. */
  emergency?: boolean;
  /** Shown under an agent reply, e.g. which records it consulted. */
  sources?: string[];
  at: string;
}

const newId = () => Math.random().toString(36).slice(2, 10);

export function makeMessage(
  role: ChatMessage['role'],
  text: string,
  extra: Partial<ChatMessage> = {}
): ChatMessage {
  return { id: newId(), role, text, at: new Date().toISOString(), ...extra };
}

export function AgentChat({
  messages,
  onSend,
  busy,
  placeholder = 'Type your message…',
  suggestions = [],
  disabled = false,
  disabledReason,
  accent = 'var(--color-primary)',
  emptyState,
  minHeight = '24rem',
}: {
  messages: ChatMessage[];
  onSend: (text: string) => void | Promise<void>;
  busy?: boolean;
  placeholder?: string;
  /** One-tap openers, shown only while the transcript is empty. */
  suggestions?: string[];
  disabled?: boolean;
  disabledReason?: string;
  accent?: string;
  emptyState?: ReactNode;
  minHeight?: string;
}) {
  const [draft, setDraft] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Follow the conversation as it grows, the way a chat window should.
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, busy]);

  const submit = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || busy || disabled) return;
    setDraft('');
    await onSend(trimmed);
    inputRef.current?.focus();
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    void submit(draft);
  };

  return (
    <div className="flex flex-col">
      <div
        className="flex-1 space-y-4 overflow-y-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-sunken)] p-4"
        style={{ minHeight, maxHeight: '32rem' }}
        role="log"
        aria-live="polite"
        aria-label="Conversation with the assistant"
      >
        {messages.length === 0 && (
          <div className="flex h-full items-center justify-center px-6 text-center">
            <div className="max-w-sm text-[0.8125rem] leading-relaxed text-muted">
              {emptyState ?? 'Ask a question to begin.'}
            </div>
          </div>
        )}

        {messages.map((message) =>
          message.role === 'user' ? (
            <div key={message.id} className="flex justify-end">
              <div
                className="max-w-[85%] rounded-2xl rounded-br-sm px-4 py-2.5 text-[0.8125rem] leading-relaxed text-white"
                style={{ background: accent }}
              >
                {message.text}
              </div>
            </div>
          ) : (
            <div key={message.id} className="flex justify-start">
              <div className="max-w-[92%] space-y-2">
                {message.emergency ? (
                  <Callout
                    tone="danger"
                    title="This may be a medical emergency"
                    icon={<ExclamationTriangleIcon className="h-5 w-5" />}
                  >
                    <Markdown content={message.text} />
                  </Callout>
                ) : (
                  <div className="rounded-2xl rounded-bl-sm border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-[0.8125rem] leading-relaxed shadow-xs">
                    <Markdown content={message.text} />
                  </div>
                )}

                {message.sources && message.sources.length > 0 && (
                  <p className="px-1 text-[0.6875rem] text-muted">
                    Checked against: {message.sources.join(' · ')}
                  </p>
                )}
              </div>
            </div>
          )
        )}

        {busy && (
          <div className="flex items-center gap-2 px-1 text-[0.75rem] text-muted">
            <Spinner size={14} />
            <span>The assistant is checking hospital records…</span>
          </div>
        )}

        <div ref={endRef} />
      </div>

      {messages.length === 0 && suggestions.length > 0 && !disabled && (
        <div className="mt-3 flex flex-wrap gap-2">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => void submit(suggestion)}
              disabled={busy}
              className="rounded-full border border-[var(--color-border-dark)] bg-[var(--color-surface)] px-3 py-1.5 text-[0.75rem] text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] disabled:opacity-50"
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}

      {disabled && disabledReason && (
        <div className="mt-3">
          <Callout tone="warning">{disabledReason}</Callout>
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-3 flex items-center gap-2">
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={placeholder}
          disabled={busy || disabled}
          aria-label="Message"
          maxLength={2000}
          className={cn(
            'flex-1 rounded-lg border border-[var(--color-border-dark)] bg-[var(--color-surface)] px-3.5 py-2.5 text-[0.8125rem]',
            'placeholder:text-muted focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/15',
            'disabled:cursor-not-allowed disabled:opacity-60'
          )}
        />
        <Button type="submit" disabled={busy || disabled || !draft.trim()}>
          {busy ? <Spinner size={14} /> : <PaperAirplaneIcon className="h-4 w-4" />}
          <span className="ml-1.5">Send</span>
        </Button>
      </form>
    </div>
  );
}

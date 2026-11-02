import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ChatBubbleLeftRightIcon,
  PhoneIcon,
  CalendarDaysIcon,
} from '@heroicons/react/24/outline';
import { Button, Callout, Card, Spinner } from '@/components/common';
import { AgentChat, makeMessage, type ChatMessage } from '@/features/agents/AgentChat';
import { askPublicAssistant, fetchAssistantHealth } from '@/lib/multiAgentApi';
import { errorMessage } from '@/lib/api';

/**
 * The assistant on the public website.
 *
 * It answers from departments, services and published policies only — there
 * is no chart behind it, which is exactly why it can be open to visitors who
 * have not signed in. Anything that would touch a record (booking, results,
 * medications) is handed off to the portal or the booking page rather than
 * being half-answered here.
 */
export function AskAssistantPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [online, setOnline] = useState<boolean | null>(null);

  useEffect(() => {
    void fetchAssistantHealth().then(setOnline);
  }, []);

  const send = async (text: string) => {
    setMessages((prev) => [...prev, makeMessage('user', text)]);
    setBusy(true);
    try {
      const result = await askPublicAssistant({ question: text, sessionId });
      setSessionId(result.sessionId);
      setMessages((prev) => [
        ...prev,
        makeMessage('agent', result.answer, {
          emergency: result.isEmergency,
          sources: result.sources,
        }),
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        makeMessage(
          'agent',
          `Sorry — I could not answer that just now. ${errorMessage(err)}\n\nYou can call us on **+91 44 4000 1200** and someone will help.`
        ),
      ]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <div className="mb-7">
        <p className="eyebrow mb-1.5">Ask the hospital</p>
        <h1>How can we help?</h1>
        <p className="mt-2 max-w-2xl text-[0.875rem] leading-relaxed text-[var(--color-text-secondary)]">
          Ask about our departments, opening hours, visiting rules, or what to bring when you
          register. Answers come from the hospital's own records, so they are current.
        </p>
      </div>

      <Callout tone="warning" title="If this is an emergency, do not use this page" className="mb-5">
        Call <strong>108</strong> or go straight to our Emergency Room at 14 Anna Salai. The
        emergency department is open 24 hours, every day.
      </Callout>

      {online === false && (
        <Callout tone="neutral" title="The assistant is offline right now" className="mb-5">
          Please call <strong>+91 44 4000 1200</strong> and our reception team will help, or
          browse the <Link to="/departments" className="underline">departments</Link> page.
        </Callout>
      )}

      <Card>
        {online === null ? (
          <div className="flex items-center gap-2 py-10 text-[0.8125rem] text-muted">
            <Spinner size={16} />
            <span>Connecting to the assistant…</span>
          </div>
        ) : (
          <AgentChat
            messages={messages}
            onSend={send}
            busy={busy}
            disabled={online === false}
            accent="var(--color-primary)"
            placeholder="e.g. What are your visiting hours?"
            emptyState="Ask anything about visiting, departments, services or registering as a new patient."
            suggestions={[
              'What are your visiting hours?',
              'Which departments do you have?',
              'What do I need to bring to register?',
              'Where is the hospital?',
            ]}
          />
        )}
      </Card>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <Card interactive padded={false}>
          <Link to="/book" className="flex items-center gap-3 p-4">
            <span className="rounded-lg bg-[var(--color-primary-50)] p-2 text-[var(--color-primary)]">
              <CalendarDaysIcon className="h-5 w-5" />
            </span>
            <span>
              <span className="block text-[0.8125rem] font-semibold">Book an appointment</span>
              <span className="block text-[0.75rem] text-muted">
                Pick a department, doctor and time
              </span>
            </span>
          </Link>
        </Card>

        <Card padded={false}>
          <a href="tel:+914440001200" className="flex items-center gap-3 p-4">
            <span className="rounded-lg bg-[var(--color-surface-sunken)] p-2 text-[var(--color-text-secondary)]">
              <PhoneIcon className="h-5 w-5" />
            </span>
            <span>
              <span className="block text-[0.8125rem] font-semibold">+91 44 4000 1200</span>
              <span className="block text-[0.75rem] text-muted">Speak to reception</span>
            </span>
          </a>
        </Card>
      </div>

      {messages.length > 0 && (
        <div className="mt-5 text-center">
          <Button
            variant="outline"
            onClick={() => {
              setMessages([]);
              setSessionId(null);
            }}
          >
            <ChatBubbleLeftRightIcon className="h-4 w-4" />
            <span className="ml-1.5">Start a new question</span>
          </Button>
        </div>
      )}
    </div>
  );
}

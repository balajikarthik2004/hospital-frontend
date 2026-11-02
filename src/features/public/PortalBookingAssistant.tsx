import { useState } from 'react';
import { ChatBubbleLeftRightIcon, SparklesIcon } from '@heroicons/react/24/outline';
import { Button, Card, CardHeader } from '@/components/common';
import { AgentChat, makeMessage, type ChatMessage } from '@/features/agents/AgentChat';
import { sendPortalAssistantTurn } from '@/lib/multiAgentApi';
import { errorMessage } from '@/lib/api';

/**
 * Conversational booking for a patient already signed in to the portal.
 *
 * Unlike the step-by-step form on /book, this reaches the appointment agent,
 * which can search across doctors and dates in one turn. It books against
 * the chart the portal session is scoped to — the patient is never asked who
 * they are, because the token already settles that.
 *
 * It starts collapsed. The form remains the primary route to a booking, and
 * a chat window that opens itself on a page about appointments would compete
 * with it rather than complement it.
 */
export function PortalBookingAssistant({ firstName }: { firstName?: string }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const send = async (text: string) => {
    setMessages((prev) => [...prev, makeMessage('user', text)]);
    setBusy(true);
    try {
      const result = await sendPortalAssistantTurn({ message: text, sessionId });
      setSessionId(result.sessionId);
      setMessages((prev) => [...prev, makeMessage('agent', result.reply)]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        makeMessage(
          'agent',
          `Sorry — I could not do that just now. ${errorMessage(err)}\n\nYou can still book using the booking page, or call us on **+91 44 4000 1200**.`
        ),
      ]);
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <Card className="mt-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="rounded-lg bg-[var(--color-primary-50)] p-2 text-[var(--color-primary)]">
              <SparklesIcon className="h-5 w-5" />
            </span>
            <div>
              <p className="text-[0.9375rem] font-semibold">Book by chatting</p>
              <p className="mt-0.5 text-[0.8125rem] text-muted">
                Describe what you need and the assistant will find a department, show real free
                times and book it for you.
              </p>
            </div>
          </div>
          <Button onClick={() => setOpen(true)}>
            <ChatBubbleLeftRightIcon className="h-4 w-4" />
            <span className="ml-1.5">Start</span>
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="mt-8">
      <CardHeader
        icon={<SparklesIcon className="h-5 w-5" />}
        title="Booking assistant"
        subtitle="It checks real availability before offering you a time, and always asks before booking."
        action={
          <Button
            variant="outline"
            onClick={() => {
              setOpen(false);
              setMessages([]);
              setSessionId(null);
            }}
          >
            Close
          </Button>
        }
      />
      <AgentChat
        messages={messages}
        onSend={send}
        busy={busy}
        placeholder="e.g. I need to see a heart doctor next week"
        minHeight="18rem"
        emptyState={
          firstName
            ? `Hello ${firstName} — tell me what you need and I will find you an appointment.`
            : 'Tell me what you need and I will find you an appointment.'
        }
        suggestions={[
          'I need to see a heart doctor',
          'What appointments do I already have?',
          'Show me free slots this week',
        ]}
      />
    </Card>
  );
}

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import {
  ArrowUpIcon,
  ChatBubbleLeftRightIcon,
  PhoneIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { useLocation } from 'react-router-dom';
import { Logo, Spinner } from '@/components/common';
import { publicApi, errorMessage, type AgentOption, type AgentReply } from '@/lib/publicApi';
import { cn } from '@/lib/utils';

/* ═══════════════════════════════════════════════════════════════════════════
   The booking assistant, as a widget.

   This is a view onto `POST /api/public/agent` and nothing more. That
   endpoint is a deterministic state machine that books real appointments
   against real charts, so every decision about the conversation — what to
   ask, what the options are, whether the answer was understood, when to stop
   — is made on the server. This file renders what it is told and posts back
   either a typed message or the `value` of a chosen option.

   Two consequences worth stating, because they are easy to undo by accident:

   1. `state` is opaque here. It is never read, never patched, never used to
      decide what to render. The server re-validates it every turn, so a
      client that started editing it would be building a way to book a slot
      that is already taken.

   2. The assistant can end the conversation in an emergency, and when it
      does it must not be possible to carry on booking. That path is styled
      to interrupt rather than to blend in — it is the one screen here that
      is allowed to look alarming.
   ═══════════════════════════════════════════════════════════════════════════ */

const EMERGENCY_NUMBER = '108';

/** A rendered turn. The assistant's `say` array becomes one entry per line. */
interface Bubble {
  id: number;
  from: 'bot' | 'user';
  text: string;
}

/**
 * The conversation survives the widget being closed, and a reload, but not
 * the tab being closed. Someone who books and then reopens the widget should
 * still be told their reference — the server's `done` step is written on that
 * assumption — but a booking conversation containing a name and a date of
 * birth has no business outliving the session on a shared or family device.
 */
const STORE_KEY = 'aarogya.booking-chat';

interface Persisted {
  state: AgentReply['state'];
  bubbles: Bubble[];
  reply: Omit<AgentReply, 'state' | 'say'>;
}

function load(): Persisted | null {
  try {
    const raw = sessionStorage.getItem(STORE_KEY);
    return raw ? (JSON.parse(raw) as Persisted) : null;
  } catch {
    return null;
  }
}

function save(value: Persisted | null) {
  try {
    if (value) sessionStorage.setItem(STORE_KEY, JSON.stringify(value));
    else sessionStorage.removeItem(STORE_KEY);
  } catch {
    /* private mode — the conversation simply will not survive a reload */
  }
}

export function BookingChat() {
  // The booking page is already the booking flow; a second way in, floating
  // over its symptom chips, only gets in the way.
  const onBookingPage = useLocation().pathname.startsWith('/book');
  const [open, setOpen] = useState(false);
  const [booted, setBooted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [state, setState] = useState<AgentReply['state'] | null>(null);
  const [reply, setReply] = useState<Omit<AgentReply, 'state' | 'say'>>({});

  const seq = useRef(0);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);

  const nextId = () => ++seq.current;

  /** Fold a server reply into the transcript. */
  const absorb = useCallback((data: AgentReply) => {
    const said: Bubble[] = (data.say ?? []).map((text) => ({
      id: nextId(),
      from: 'bot' as const,
      text,
    }));
    const { state: nextState, say: _say, ...rest } = data;
    setBubbles((prev) => {
      const merged = [...prev, ...said];
      save({ state: nextState, bubbles: merged, reply: rest });
      return merged;
    });
    setState(nextState);
    setReply(rest);
  }, []);

  /* ── Opening ──────────────────────────────────────────────────────────
     The greeting is fetched on first open, not on mount: every visitor to
     the home page would otherwise pay for a request to an assistant most of
     them will never open. */
  useEffect(() => {
    if (!open || booted) return;
    setBooted(true);

    const saved = load();
    if (saved) {
      seq.current = saved.bubbles.reduce((m, b) => Math.max(m, b.id), 0);
      setBubbles(saved.bubbles);
      setState(saved.state);
      setReply(saved.reply);
      return;
    }

    setBusy(true);
    publicApi
      .get<AgentReply>('/agent')
      .then((res) => absorb(res.data))
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setBusy(false));
  }, [open, booted, absorb]);

  /** Send one turn. `echo` is what the visitor sees themselves having said. */
  const send = useCallback(
    async (message: string, echo?: string) => {
      if (busy || !state) return;
      setError(null);
      setDraft('');

      const mine: Bubble = { id: nextId(), from: 'user', text: echo ?? message };
      setBubbles((prev) => [...prev, mine]);
      // The previous turn's controls go away the moment an answer is given,
      // so a slow network cannot leave an option list on screen that is
      // about to be replaced by a different one.
      setReply({});
      setBusy(true);

      try {
        const res = await publicApi.post<AgentReply>('/agent', { state, message });
        absorb(res.data);
      } catch (err) {
        setError(errorMessage(err));
        // Put the controls back, so the answer can simply be given again.
        const saved = load();
        if (saved) setReply(saved.reply);
      } finally {
        setBusy(false);
      }
    },
    [busy, state, absorb]
  );

  const restart = useCallback(() => {
    save(null);
    setBubbles([]);
    setState(null);
    setReply({});
    setError(null);
    setBooted(false);
  }, []);

  /* ── Focus and scrolling ─────────────────────────────────────────────── */

  // Pin to the newest turn. `scrollTop` rather than scrollIntoView, which
  // would also scroll the page behind the widget.
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [bubbles, busy, reply]);

  useEffect(() => {
    if (open && reply.input && !busy) inputRef.current?.focus();
  }, [open, reply.input, busy]);

  // Escape closes, and focus goes back to the launcher rather than to the
  // top of the document.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        launcherRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (text) void send(text);
  };

  const emergency = state?.step === 'emergency';

  return (
    <>
      {!open && !onBookingPage && (
        <button
          ref={launcherRef}
          onClick={() => setOpen(true)}
          className={cn(
            'no-print fixed bottom-5 right-5 z-50 inline-flex items-center gap-2.5 rounded-full',
            'bg-primary-700 py-3.5 pl-4 pr-5 text-[0.875rem] font-[620] text-white',
            'shadow-lg shadow-black/15 ring-1 ring-inset ring-white/15',
            'transition-colors duration-150 hover:bg-primary-600',
            'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary-700/40'
          )}
          aria-label="Open the booking assistant"
        >
          <ChatBubbleLeftRightIcon className="h-5 w-5 shrink-0" />
          <span className="hidden sm:inline">Book an appointment</span>
          <span className="sm:hidden">Book</span>
        </button>
      )}

      {open && (
        <div
          role="dialog"
          aria-modal="false"
          aria-label="Booking assistant"
          className={cn(
            'no-print fixed z-50 flex flex-col overflow-hidden rounded-2xl border shadow-2xl',
            // Full-bleed on a phone, a panel on anything larger.
            'inset-x-3 bottom-3 top-16 sm:inset-auto sm:bottom-5 sm:right-5 sm:top-auto',
            'sm:h-[min(34rem,calc(100vh-6rem))] sm:w-[23.5rem]'
          )}
          style={{
            borderColor: 'var(--color-border)',
            background: 'var(--color-surface)',
          }}
        >
          <header
            className="flex shrink-0 items-center gap-2.5 border-b px-4 py-3"
            style={{ borderColor: 'var(--color-border)' }}
          >
            <Logo size={26} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[0.8125rem] font-[620] leading-tight">
                Booking assistant
              </p>
              <p className="truncate text-[0.6875rem] leading-tight text-faint">
                Books a real appointment · about a minute
              </p>
            </div>
            <button
              onClick={() => {
                setOpen(false);
                launcherRef.current?.focus();
              }}
              className="-mr-1 rounded-lg p-1.5 text-faint transition-colors hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-text)]"
              aria-label="Close the booking assistant"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </header>

          <div
            ref={listRef}
            className="flex-1 space-y-2.5 overflow-y-auto px-4 py-4"
            style={{ background: 'var(--color-surface-muted)' }}
            aria-live="polite"
            aria-atomic="false"
          >
            {bubbles.map((b) => (
              <Message key={b.id} from={b.from} text={b.text} />
            ))}

            {busy && <Typing />}

            {reply.emergency && <EmergencyCard advice={reply.emergency.advice} />}
            {reply.booking && <BookingCard booking={reply.booking} />}

            {error && (
              <div
                className="rounded-xl border px-3.5 py-2.5 text-[0.75rem] leading-relaxed"
                style={{
                  borderColor: 'var(--color-danger-border)',
                  background: 'var(--color-danger-light)',
                  color: 'var(--color-text)',
                }}
                role="alert"
              >
                {error}
              </div>
            )}
          </div>

          <footer
            className="shrink-0 border-t px-3 py-3"
            style={{ borderColor: 'var(--color-border)' }}
          >
            {!!reply.options?.length && !busy && (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {reply.options.map((o) => (
                  <Choice
                    key={o.value}
                    option={o}
                    onPick={() =>
                      o.value === 'restart' ? restart() : void send(o.value, o.label)
                    }
                  />
                ))}
              </div>
            )}

            {reply.input && !busy ? (
              <form onSubmit={onSubmit} className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  type={reply.input.type}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder={reply.input.placeholder}
                  // The agent asks for names, phone numbers and dates of
                  // birth. Letting the browser autofill them is a kindness
                  // on a phone, and correcting them is the visitor's call.
                  autoComplete="on"
                  enterKeyHint="send"
                  className={cn(
                    'h-9.5 min-w-0 flex-1 rounded-lg border bg-[var(--color-surface)] px-3',
                    'text-[0.8125rem] text-[var(--color-text)] shadow-xs',
                    'placeholder:text-[var(--color-text-tertiary)]',
                    'border-[var(--color-border-dark)] transition-[border-color,box-shadow] duration-150',
                    'focus:border-primary-600 focus:outline-none focus:ring-[3px] focus:ring-primary-700/15'
                  )}
                  aria-label={reply.input.placeholder}
                />
                <button
                  type="submit"
                  disabled={!draft.trim()}
                  className={cn(
                    'inline-flex h-9.5 w-9.5 shrink-0 items-center justify-center rounded-lg',
                    'bg-primary-700 text-white shadow-[inset_0_1px_0_0_rgb(255_255_255_/_0.16)]',
                    'transition-colors duration-100 hover:bg-primary-600',
                    'disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-primary-700'
                  )}
                  aria-label="Send"
                >
                  <ArrowUpIcon className="h-4 w-4 stroke-[2.5]" />
                </button>
              </form>
            ) : null}

            {!reply.input && !reply.options?.length && !busy && (
              <p className="px-1 text-[0.6875rem] leading-relaxed text-faint">
                {emergency ? (
                  <>Call {EMERGENCY_NUMBER} now, or come straight to Casualty.</>
                ) : (
                  <>This assistant books appointments. It does not give medical advice.</>
                )}
              </p>
            )}
          </footer>
        </div>
      )}
    </>
  );
}

/* ── Pieces ────────────────────────────────────────────────────────────── */

function Message({ from, text }: { from: 'bot' | 'user'; text: string }) {
  const mine = from === 'user';
  return (
    <div className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
      <p
        className={cn(
          'max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-[0.8125rem] leading-relaxed',
          mine
            ? 'rounded-br-md bg-primary-700 text-white'
            : 'rounded-bl-md border bg-[var(--color-surface)] text-[var(--color-text)]'
        )}
        style={mine ? undefined : { borderColor: 'var(--color-border)' }}
      >
        {text}
      </p>
    </div>
  );
}

function Typing() {
  return (
    <div className="flex justify-start">
      <span
        className="inline-flex items-center gap-2 rounded-2xl rounded-bl-md border bg-[var(--color-surface)] px-3.5 py-2"
        style={{ borderColor: 'var(--color-border)' }}
      >
        <Spinner size={13} className="text-[var(--color-primary)]" />
        <span className="text-[0.75rem] text-muted">Checking…</span>
      </span>
    </div>
  );
}

function Choice({ option, onPick }: { option: AgentOption; onPick: () => void }) {
  return (
    <button
      type="button"
      onClick={onPick}
      className={cn(
        'rounded-lg border px-2.5 py-1.5 text-[0.75rem] font-[560] transition-colors duration-100',
        option.subtle
          ? 'border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-muted)]'
          : 'border-[var(--color-info-border)] bg-[var(--color-primary-50)] text-[var(--color-primary)] hover:bg-[var(--color-primary-100)]'
      )}
    >
      {option.label}
    </button>
  );
}

/**
 * The one card here allowed to interrupt. Someone reading this may be having
 * a heart attack, so the number is a tap target, not a sentence to copy.
 */
function EmergencyCard({ advice }: { advice: string }) {
  return (
    <div
      className="rounded-xl border p-3.5"
      style={{
        borderColor: 'var(--color-danger-border)',
        background: 'var(--color-danger-light)',
      }}
      role="alert"
    >
      <p
        className="text-[0.75rem] font-[680] uppercase tracking-[0.08em]"
        style={{ color: 'var(--color-danger)' }}
      >
        {advice}
      </p>
      <a
        href={`tel:${EMERGENCY_NUMBER}`}
        className="mt-2.5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#b5271a] px-4 py-2.5 text-[0.875rem] font-[680] text-white shadow-[inset_0_1px_0_0_rgb(255_255_255_/_0.16)] transition-colors duration-100 hover:bg-[#c43527]"
      >
        <PhoneIcon className="h-4 w-4" />
        Call {EMERGENCY_NUMBER} now
      </a>
    </div>
  );
}

function BookingCard({ booking }: { booking: NonNullable<AgentReply['booking']> }) {
  const rows: [string, string][] = [
    ['Reference', booking.appointmentId],
    ['Doctor', booking.doctorName],
    ['Department', booking.department],
    ['When', `${booking.date} at ${booking.time}`],
  ];
  if (booking.isNew) rows.push(['Your patient ID', booking.patientId]);

  return (
    <div
      className="rounded-xl border p-3.5"
      style={{
        borderColor: 'var(--color-info-border)',
        background: 'var(--color-primary-50)',
      }}
    >
      <p
        className="text-[0.6875rem] font-[680] uppercase tracking-[0.08em]"
        style={{ color: 'var(--color-primary)' }}
      >
        Appointment confirmed
      </p>
      <dl className="mt-2.5 space-y-1.5">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-baseline justify-between gap-3">
            <dt className="shrink-0 text-[0.6875rem] text-muted">{label}</dt>
            <dd className="min-w-0 text-right text-[0.75rem] font-[620] tabular">{value}</dd>
          </div>
        ))}
      </dl>
      {booking.isNew && (
        <p className="mt-2.5 text-[0.6875rem] leading-relaxed text-muted">
          Keep your patient ID — it is how you sign in to the portal and book again.
        </p>
      )}
    </div>
  );
}

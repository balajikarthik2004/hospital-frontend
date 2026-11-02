import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  BeakerIcon,
  CalendarDaysIcon,
  PaperAirplaneIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import { Spinner } from '@/components/common';
import { Markdown } from '@/components/common/Markdown';
import {
  assistantPublicApi,
  errorMessage,
  type PortalMedication,
  type PortalMedicationExplanation,
} from '@/lib/publicApi';
import { cn } from '@/lib/utils';

/**
 * The two agents a patient may use on their own record.
 *
 * Both are scoped by the portal token alone: no patient identifier is sent
 * from the browser, so there is nothing here a person could change to reach
 * somebody else's chart. The agent service enforces the same rule a second
 * time on its side, against the identity the backend minted.
 */

type Tab = 'appointments' | 'medications';

export function PortalAssistant({ onBooked }: { onBooked?: () => void }) {
  const [tab, setTab] = useState<Tab>('appointments');

  return (
    <section
      className="overflow-hidden rounded-2xl border shadow-xs"
      style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
    >
      <header className="flex items-start gap-3 px-5 pt-5 sm:px-6">
        <span
          className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
          style={{ background: 'var(--color-primary-50)', color: 'var(--color-primary)' }}
          aria-hidden
        >
          <SparklesIcon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h2 className="text-[1.0625rem] font-semibold tracking-[-0.01em]">Your assistant</h2>
          <p className="mt-1 text-[0.8125rem] leading-relaxed text-muted">
            Book and check your own appointments, or have one of your take-home medicines
            explained in plain language.
          </p>
        </div>
      </header>

      <div
        className="mt-4 flex gap-1 border-b px-5 sm:px-6"
        style={{ borderColor: 'var(--color-border)' }}
        role="tablist"
      >
        <TabButton
          active={tab === 'appointments'}
          onClick={() => setTab('appointments')}
          icon={<CalendarDaysIcon className="h-4 w-4" />}
          label="Appointments"
        />
        <TabButton
          active={tab === 'medications'}
          onClick={() => setTab('medications')}
          icon={<BeakerIcon className="h-4 w-4" />}
          label="My medicines"
        />
      </div>

      <div className="p-5 sm:p-6">
        {tab === 'appointments' ? (
          <AppointmentThread onBooked={onBooked} />
        ) : (
          <MedicationExplainer />
        )}
      </div>
    </section>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        '-mb-px inline-flex items-center gap-2 border-b-2 px-3 py-2.5 text-[0.8125rem] font-medium transition-colors',
        active
          ? 'border-primary-600 text-primary-700 dark:text-primary-300'
          : 'border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
      )}
    >
      {icon}
      {label}
    </button>
  );
}

/* ── Appointments ─────────────────────────────────────────────────────────── */

interface Turn {
  id: number;
  from: 'you' | 'agent';
  text: string;
  failed?: boolean;
}

let nextId = 0;

const APPOINTMENT_PROMPTS = [
  'What appointments do I have coming up?',
  'Are there any cardiology slots this week?',
];

function AppointmentThread({ onBooked }: { onBooked?: () => void }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [session, setSession] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (turns.length) {
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [turns, busy]);

  const send = async (message: string) => {
    setTurns((prev) => [...prev, { id: nextId++, from: 'you', text: message }]);
    setBusy(true);
    try {
      const res = await assistantPublicApi.appointmentTurn(message, session);
      setSession(res.session_id);
      setTurns((prev) => [
        ...prev,
        { id: nextId++, from: 'agent', text: res.response, failed: res.status === 'error' },
      ]);
      // The agent writes the appointment itself, so the list above this panel
      // is stale the moment it does. Refresh rather than leaving the patient
      // to wonder whether it worked.
      if (/booked|confirmed|scheduled/i.test(res.response)) onBooked?.();
    } catch (err) {
      setTurns((prev) => [
        ...prev,
        { id: nextId++, from: 'agent', text: errorMessage(err), failed: true },
      ]);
    } finally {
      setBusy(false);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text || busy) return;
    setDraft('');
    void send(text);
  };

  return (
    <>
      {turns.length > 0 ? (
        <div
          ref={listRef}
          className="max-h-80 space-y-3 overflow-y-auto rounded-xl border p-4"
          style={{
            borderColor: 'var(--color-border)',
            background: 'var(--color-surface-muted)',
          }}
          aria-live="polite"
        >
          {turns.map((turn) => (
            <div
              key={turn.id}
              className={cn('flex', turn.from === 'you' ? 'justify-end' : 'justify-start')}
            >
              <div
                className={cn(
                  'max-w-[32rem] rounded-xl border px-3.5 py-2.5 text-[0.8125rem] leading-relaxed',
                  turn.from === 'you' && 'text-white'
                )}
                style={
                  turn.from === 'you'
                    ? { background: 'var(--color-primary-700)', borderColor: 'transparent' }
                    : {
                        background: turn.failed
                          ? 'var(--color-danger-light)'
                          : 'var(--color-surface)',
                        borderColor: turn.failed
                          ? 'var(--color-danger-border)'
                          : 'var(--color-border)',
                      }
                }
              >
                {turn.from === 'you' ? (
                  <p className="whitespace-pre-wrap">{turn.text}</p>
                ) : (
                  <Markdown content={turn.text} />
                )}
              </div>
            </div>
          ))}
          {busy && (
            <div className="flex items-center gap-2 text-xs text-muted">
              <Spinner size={14} /> Checking the schedule…
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {APPOINTMENT_PROMPTS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => void send(p)}
              disabled={busy}
              className="rounded-full border px-3.5 py-1.5 text-[0.75rem] transition-colors hover:bg-[var(--color-surface-muted)] disabled:opacity-50"
              style={{ borderColor: 'var(--color-border)' }}
            >
              {p}
            </button>
          ))}
        </div>
      )}

      <form onSubmit={submit} className="mt-4 flex items-center gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          disabled={busy}
          placeholder="Ask about your appointments, or book one…"
          className="h-11 flex-1 rounded-xl border px-4 text-[0.875rem] outline-none transition-shadow focus:ring-4 disabled:opacity-60"
          style={{ borderColor: 'var(--color-border-dark)', background: 'var(--color-surface)' }}
        />
        <button
          type="submit"
          disabled={busy || !draft.trim()}
          className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary-700 px-4 text-[0.875rem] font-semibold text-white transition-colors hover:bg-primary-600 disabled:opacity-50"
        >
          {busy ? <Spinner size={16} /> : <PaperAirplaneIcon className="h-4 w-4" />}
          Send
        </button>
      </form>

      <p className="mt-3 text-[0.75rem] text-faint">
        This books real appointments in your name. It does not give medical advice — in an
        emergency call <span className="font-semibold">108</span>.
      </p>
    </>
  );
}

/* ── Medicines ────────────────────────────────────────────────────────────── */

function MedicationExplainer() {
  const [medications, setMedications] = useState<PortalMedication[] | null>(null);
  const [selected, setSelected] = useState('');
  const [result, setResult] = useState<PortalMedicationExplanation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    assistantPublicApi
      .medications()
      .then(setMedications)
      .catch((err) => {
        setMedications([]);
        setError(errorMessage(err));
      });
  }, []);

  const explain = async (recordId: string) => {
    setSelected(recordId);
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      setResult(await assistantPublicApi.explainMedication(recordId));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (medications === null) {
    return (
      <div className="flex justify-center py-8">
        <Spinner size={20} />
      </div>
    );
  }

  if (medications.length === 0) {
    return (
      <p className="py-6 text-center text-[0.875rem] text-muted">
        {error ??
          'You have no take-home medicines on file. Anything prescribed at discharge will appear here.'}
      </p>
    );
  }

  return (
    <>
      <p className="text-[0.8125rem] text-muted">
        Pick one to have it explained — what it is for, how to take it and what to watch for.
      </p>

      <ul className="mt-3 flex flex-wrap gap-2">
        {medications.map((m) => (
          <li key={m.medicationRecordId}>
            <button
              type="button"
              disabled={busy}
              onClick={() => void explain(m.medicationRecordId)}
              className={cn(
                'rounded-xl border px-3.5 py-2 text-left text-[0.8125rem] transition-colors disabled:opacity-50',
                selected === m.medicationRecordId
                  ? 'border-primary-600 bg-[var(--color-primary-50)]'
                  : 'hover:bg-[var(--color-surface-muted)]'
              )}
              style={
                selected === m.medicationRecordId
                  ? undefined
                  : { borderColor: 'var(--color-border)' }
              }
            >
              <span className="block font-semibold">{m.drugName}</span>
              <span className="block text-[0.75rem] text-faint">
                {[m.dosage, m.frequency].filter(Boolean).join(' · ') || 'As directed'}
              </span>
            </button>
          </li>
        ))}
      </ul>

      {busy && (
        <div className="mt-4 flex items-center gap-2 text-xs text-muted">
          <Spinner size={14} /> Writing it out…
        </div>
      )}

      {error && !busy && (
        <p className="mt-4 text-[0.8125rem]" style={{ color: 'var(--color-danger)' }}>
          {error}
        </p>
      )}

      {result && !busy && (
        <div
          className="mt-4 rounded-xl border p-4 text-[0.875rem]"
          style={{
            borderColor: 'var(--color-border)',
            background: 'var(--color-surface-muted)',
          }}
        >
          <Markdown content={result.explanation} />
          <p className="mt-4 text-[0.75rem] text-faint">
            Taken from your own record. Always follow what your doctor or pharmacist told you — if
            the two differ, call the hospital.
          </p>
        </div>
      )}
    </>
  );
}

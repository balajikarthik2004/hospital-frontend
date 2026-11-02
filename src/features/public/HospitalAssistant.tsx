import { useEffect, useRef, useState, type FormEvent } from 'react';
import { PaperAirplaneIcon, SparklesIcon } from '@heroicons/react/24/outline';
import { Spinner } from '@/components/common';
import { Markdown } from '@/components/common/Markdown';
import { assistantPublicApi, errorMessage } from '@/lib/publicApi';
import { cn } from '@/lib/utils';

/**
 * "Ask the hospital", on the contact page.
 *
 * It answers from the hospital's own records — the departments that exist,
 * the doctors in them, the published policies — so the page does not have to
 * carry a list of answers that drifts out of date behind the real thing.
 *
 * Deliberately a panel on the page rather than a second floating widget: the
 * booking assistant already owns the bottom-right corner, and two launchers
 * would only make a visitor choose before they know what either one does.
 */

interface Turn {
  id: number;
  from: 'you' | 'hospital';
  text: string;
  sources?: string[];
  /** An emergency redirection or a failure — either way, not ordinary prose. */
  alert?: boolean;
}

const SUGGESTIONS = [
  'What are the visiting hours?',
  'Which departments do you have?',
  'What should I bring as a new patient?',
];

let nextId = 0;

export function HospitalAssistant() {
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

  const ask = async (question: string) => {
    setTurns((prev) => [...prev, { id: nextId++, from: 'you', text: question }]);
    setBusy(true);
    try {
      const res = await assistantPublicApi.ask(question, session);
      setSession(res.session_id ?? session);
      setTurns((prev) => [
        ...prev,
        {
          id: nextId++,
          from: 'hospital',
          text: res.answer,
          sources: res.sources,
          alert: res.status === 'emergency_alert',
        },
      ]);
    } catch (err) {
      setTurns((prev) => [
        ...prev,
        { id: nextId++, from: 'hospital', text: errorMessage(err), alert: true },
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
    void ask(text);
  };

  return (
    <section
      className="rounded-2xl border p-5 sm:p-7"
      style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
    >
      <div className="flex items-start gap-3">
        <span
          className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
          style={{ background: 'var(--color-primary-50)', color: 'var(--color-primary)' }}
          aria-hidden
        >
          <SparklesIcon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h2 className="text-[1.0625rem] font-semibold tracking-[-0.01em]">Ask the hospital</h2>
          <p className="mt-1 text-[0.8125rem] leading-relaxed text-muted">
            Departments, services, visiting hours, what to bring. Answered from our own records,
            so it is never out of step with the rest of this site.
          </p>
        </div>
      </div>

      {turns.length > 0 && (
        <div
          ref={listRef}
          className="mt-5 max-h-96 space-y-3 overflow-y-auto rounded-xl border p-4"
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
                  'max-w-[36rem] rounded-xl border px-3.5 py-2.5 text-[0.8125rem] leading-relaxed',
                  turn.from === 'you' && 'text-white'
                )}
                style={
                  turn.from === 'you'
                    ? { background: 'var(--color-primary-700)', borderColor: 'transparent' }
                    : {
                        background: turn.alert
                          ? 'var(--color-danger-light)'
                          : 'var(--color-surface)',
                        borderColor: turn.alert
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
                {turn.sources && turn.sources.length > 0 && (
                  <p
                    className="mt-2 border-t pt-2 text-[0.6875rem] text-faint"
                    style={{ borderColor: 'var(--color-border)' }}
                  >
                    From {turn.sources.join(' · ')}
                  </p>
                )}
              </div>
            </div>
          ))}
          {busy && (
            <div className="flex items-center gap-2 text-xs text-muted">
              <Spinner size={14} /> Looking that up…
            </div>
          )}
        </div>
      )}

      {turns.length === 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => void ask(s)}
              disabled={busy}
              className="rounded-full border px-3.5 py-1.5 text-[0.75rem] transition-colors hover:bg-[var(--color-surface-muted)] disabled:opacity-50"
              style={{ borderColor: 'var(--color-border)' }}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <form onSubmit={submit} className="mt-4 flex items-center gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          disabled={busy}
          placeholder="Type your question…"
          className="h-11 flex-1 rounded-xl border px-4 text-[0.875rem] outline-none transition-shadow focus:ring-4 disabled:opacity-60"
          style={{ borderColor: 'var(--color-border-dark)', background: 'var(--color-surface)' }}
        />
        <button
          type="submit"
          disabled={busy || !draft.trim()}
          className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary-700 px-4 text-[0.875rem] font-semibold text-white transition-colors hover:bg-primary-600 disabled:opacity-50"
        >
          {busy ? <Spinner size={16} /> : <PaperAirplaneIcon className="h-4 w-4" />}
          Ask
        </button>
      </form>

      <p className="mt-3 text-[0.75rem] text-faint">
        General information only — it holds no patient records and does not give medical advice.
        In an emergency call <span className="font-semibold">108</span>.
      </p>
    </section>
  );
}

import { CheckIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { Spinner } from '@/components/common';
import { cn, confidencePct, fmtDuration } from '@/lib/utils';
import type { AgentRun } from '@/types';

interface AgentMeta {
  key: string;
  label: string;
  color: string;
  kind: string;
  /** What this agent actually does, in one plain sentence. */
  story: string;
  /** Which wave of the DAG it belongs to — 1 runs first, in parallel. */
  wave: number;
}

const AGENTS: AgentMeta[] = [
  {
    key: 'clinical_summary',
    label: 'Clinical Summary',
    color: 'var(--agent-clinical)',
    kind: 'Reads notes, labs, vitals',
    story: 'Reads the admission note, labs and vitals and drafts the discharge summary.',
    wave: 1,
  },
  {
    key: 'med_reconciliation',
    label: 'Medication Reconciliation',
    color: 'var(--agent-medication)',
    kind: 'Deterministic rules engine',
    story:
      'Compares the home list against the discharge list and raises a flag for every interaction, omission and dose change.',
    wave: 1,
  },
  {
    key: 'follow_up_planning',
    label: 'Follow-Up Planning',
    color: 'var(--agent-followup)',
    kind: 'Diagnosis → protocol mapping',
    story:
      'Maps the diagnosis to its standard protocol, then adds the monitoring the new medications require.',
    wave: 2,
  },
  {
    key: 'patient_education',
    label: 'Patient Education',
    color: 'var(--agent-education)',
    kind: 'Plain-language instructions',
    story: 'Turns the clinical package into instructions the patient can read at home.',
    wave: 3,
  },
  {
    key: 'safety_validator',
    label: 'Safety & Governance',
    color: 'var(--agent-orchestrator)',
    kind: 'Blocks anything out of bounds',
    story:
      'Runs seven checks over the other four — no prescribing, no invented drugs, no auto-approval.',
    wave: 4,
  },
];

const WAVE_LABEL: Record<number, string> = {
  1: 'In parallel, first',
  2: 'Once the medication list is settled',
  3: 'Once the clinical content exists',
  4: 'Over everything, last',
};

type Status = 'queued' | 'running' | 'complete' | 'failed';

export function AgentProgress({ runs, compact }: { runs: AgentRun[]; compact?: boolean }) {
  const byKey = new Map(runs?.map((r) => [r.agent, r]) ?? []);
  const statusOf = (key: string): Status => (byKey.get(key)?.status as Status) ?? 'queued';

  const done = AGENTS.filter((a) => statusOf(a.key) === 'complete').length;
  const failed = AGENTS.filter((a) => statusOf(a.key) === 'failed').length;
  const running = AGENTS.find((a) => statusOf(a.key) === 'running');

  return (
    <div>
      {!compact && (
        <div className="mb-4 flex items-center gap-3">
          <div
            className="h-1.5 flex-1 overflow-hidden rounded-full"
            style={{ background: 'var(--color-surface-sunken)' }}
          >
            <div
              className="h-full rounded-full transition-[width] duration-700 ease-out"
              style={{
                width: `${(done / AGENTS.length) * 100}%`,
                background: failed ? 'var(--color-danger)' : 'var(--color-success)',
              }}
            />
          </div>
          <span className="shrink-0 text-[0.6875rem] font-medium tabular text-muted">
            {done} of {AGENTS.length}
          </span>
        </div>
      )}

      <ol className={cn('relative', compact ? 'space-y-1' : 'space-y-0')}>
        {AGENTS.map((agent, i) => {
          const run = byKey.get(agent.key);
          const status = statusOf(agent.key);
          const last = i === AGENTS.length - 1;
          const newWave = i > 0 && agent.wave !== AGENTS[i - 1].wave;

          const nodeColor =
            status === 'complete'
              ? agent.color
              : status === 'failed'
                ? 'var(--color-danger)'
                : status === 'running'
                  ? agent.color
                  : 'var(--color-border-dark)';

          if (compact) {
            return (
              <li
                key={agent.key}
                className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-[var(--color-surface-muted)]"
              >
                <StatusNode status={status} color={nodeColor} size={18} />
                <span className="min-w-0 flex-1 truncate text-xs font-medium">{agent.label}</span>
                <span className="shrink-0 text-[0.6875rem] tabular text-faint">
                  {status === 'complete'
                    ? `${run?.confidence ? confidencePct(run.confidence) : '—'} · ${fmtDuration(run?.durationMs)}`
                    : status}
                </span>
              </li>
            );
          }

          return (
            <li key={agent.key}>
              {newWave && (
                <div className="flex items-center gap-2 py-2 pl-[34px]">
                  <span className="eyebrow !text-[0.625rem]">{WAVE_LABEL[agent.wave]}</span>
                </div>
              )}
              <div
                className="relative flex gap-3.5 pb-3 animate-rise"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                {!last && (
                  <span
                    className="absolute bottom-0 left-[13px] top-8 w-px"
                    style={{
                      background:
                        status === 'complete' ? agent.color : 'var(--color-border)',
                      opacity: status === 'complete' ? 0.3 : 1,
                    }}
                    aria-hidden
                  />
                )}

                <StatusNode status={status} color={nodeColor} size={27} />

                <div
                  className={cn(
                    'min-w-0 flex-1 rounded-lg border px-3 py-2.5 transition-colors',
                    status === 'running'
                      ? 'bg-[var(--color-surface-muted)]'
                      : 'border-transparent'
                  )}
                  style={{
                    borderColor:
                      status === 'running' ? agent.color : 'transparent',
                  }}
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <span className="text-[0.8125rem] font-medium">{agent.label}</span>
                    <span className="shrink-0 text-[0.6875rem] tabular text-faint">
                      {status === 'complete' ? (
                        <>
                          {run?.confidence ? confidencePct(run.confidence) : '—'} confidence ·{' '}
                          {fmtDuration(run?.durationMs)}
                        </>
                      ) : status === 'running' ? (
                        <span style={{ color: agent.color }}>working…</span>
                      ) : status === 'failed' ? (
                        <span style={{ color: 'var(--color-danger)' }}>failed</span>
                      ) : (
                        'queued'
                      )}
                    </span>
                  </div>

                  <p className="mt-1 text-xs leading-relaxed text-muted">{agent.story}</p>

                  {status === 'running' && (
                    <div
                      className="mt-2 h-0.5 overflow-hidden rounded-full"
                      style={{ background: 'var(--color-surface-sunken)' }}
                      aria-hidden
                    >
                      <div
                        className="h-full w-1/4 animate-sweep rounded-full"
                        style={{ background: agent.color }}
                      />
                    </div>
                  )}

                  {run?.error && (
                    <p className="mt-1.5 text-xs" style={{ color: 'var(--color-danger)' }}>
                      {run.error}
                    </p>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      {!compact && running && (
        <p className="mt-2 text-xs text-faint">
          Currently running <strong className="font-medium">{running.label}</strong>. This page
          updates itself — no need to refresh.
        </p>
      )}
    </div>
  );
}

function StatusNode({
  status,
  color,
  size,
}: {
  status: Status;
  color: string;
  size: number;
}) {
  return (
    <span
      className={cn(
        'relative z-10 flex shrink-0 items-center justify-center rounded-full border-2 bg-[var(--color-surface)]',
        status === 'running' && 'animate-pulse-ring'
      )}
      style={{
        width: size,
        height: size,
        borderColor: color,
        background: status === 'complete' || status === 'failed' ? color : 'var(--color-surface)',
        color: status === 'complete' || status === 'failed' ? '#fff' : color,
      }}
    >
      {status === 'complete' ? (
        <CheckIcon style={{ width: size * 0.5 }} strokeWidth={3} />
      ) : status === 'failed' ? (
        <ExclamationTriangleIcon style={{ width: size * 0.5 }} />
      ) : status === 'running' ? (
        <Spinner size={size * 0.48} />
      ) : (
        <span
          className="rounded-full"
          style={{ width: size * 0.22, height: size * 0.22, background: 'currentColor' }}
        />
      )}
    </span>
  );
}

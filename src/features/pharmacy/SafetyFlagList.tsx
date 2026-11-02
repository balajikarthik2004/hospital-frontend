import { useState } from 'react';
import { CheckCircleIcon, ShieldExclamationIcon } from '@heroicons/react/24/outline';
import { Badge, Button, Input, Spinner } from '@/components/common';
import type { FlagSeverity, PrescriptionFlag } from '@/lib/prescriptionApi';
import { cn } from '@/lib/utils';

/**
 * The warnings a pharmacist has to deal with before handing medicine over.
 *
 * Severity drives the colour and the order, because the list is read under
 * time pressure at a counter. Critical and high must be signed off by name —
 * the note box is not optional decoration, it is the record of who accepted
 * the risk and why.
 */

const TONE: Record<FlagSeverity, 'danger' | 'warning' | 'info' | 'neutral'> = {
  critical: 'danger',
  high: 'danger',
  medium: 'warning',
  low: 'info',
};

const BORDER: Record<FlagSeverity, string> = {
  critical: 'var(--color-danger)',
  high: 'var(--color-danger)',
  medium: 'var(--color-warning)',
  low: 'var(--color-border-dark)',
};

const TYPE_LABEL: Record<PrescriptionFlag['type'], string> = {
  interaction: 'Interaction',
  allergy_conflict: 'Allergy conflict',
  duplication: 'Duplication',
  high_risk: 'High-risk medicine',
  unclear_instruction: 'Incomplete instruction',
};

export function SafetyFlagList({
  flags,
  onAcknowledge,
  busyFlagId,
}: {
  flags: PrescriptionFlag[];
  /** Omit to render read-only — the prescriber's view. */
  onAcknowledge?: (flagId: string, note: string) => void | Promise<void>;
  busyFlagId?: string | null;
}) {
  const [notes, setNotes] = useState<Record<string, string>>({});

  if (!flags.length) return null;

  return (
    <ul className="space-y-2.5">
      {flags.map((flag) => {
        const blocking = flag.severity === 'critical' || flag.severity === 'high';
        const needsSignOff = blocking && !flag.acknowledged && Boolean(onAcknowledge);

        return (
          <li
            key={flag.flagId}
            className="rounded-xl border-l-[3px] border border-[var(--color-border)] bg-[var(--color-surface)] p-3.5 shadow-xs"
            style={{ borderLeftColor: BORDER[flag.severity] }}
          >
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={TONE[flag.severity]}>{flag.severity.toUpperCase()}</Badge>
              <Badge tone="neutral">{TYPE_LABEL[flag.type]}</Badge>
              <span className="text-[0.8125rem] font-semibold">
                {flag.drugA}
                {flag.drugB && (
                  <>
                    <span className="mx-1.5 text-muted">+</span>
                    {flag.drugB}
                  </>
                )}
              </span>
              {flag.acknowledged && (
                <span className="ml-auto inline-flex items-center gap-1 text-[0.6875rem] text-[var(--color-success)]">
                  <CheckCircleIcon className="h-3.5 w-3.5" />
                  Accepted
                </span>
              )}
            </div>

            <p className="mt-2 text-[0.8125rem] leading-relaxed">{flag.description}</p>

            {flag.recommendation && (
              <p className="mt-1.5 flex items-start gap-1.5 text-[0.75rem] text-[var(--color-text-secondary)]">
                <ShieldExclamationIcon className="mt-px h-3.5 w-3.5 shrink-0" />
                <span>{flag.recommendation}</span>
              </p>
            )}

            {flag.acknowledged && flag.acknowledgementNote && (
              <p className="mt-2 rounded-lg bg-[var(--color-surface-sunken)] px-2.5 py-1.5 text-[0.75rem] text-muted">
                Pharmacist’s note: {flag.acknowledgementNote}
              </p>
            )}

            {needsSignOff && (
              <div className="mt-3 flex flex-wrap items-end gap-2">
                <div className="min-w-[14rem] flex-1">
                  <label className="mb-1 block text-[0.6875rem] font-medium text-[var(--color-text-secondary)]">
                    Why is it safe to proceed?
                  </label>
                  <Input
                    value={notes[flag.flagId] ?? ''}
                    onChange={(e) =>
                      setNotes((prev) => ({ ...prev, [flag.flagId]: e.target.value }))
                    }
                    placeholder="e.g. Discussed with Dr Sharma, INR monitored weekly"
                  />
                </div>
                <Button
                  variant="outline"
                  onClick={() => void onAcknowledge?.(flag.flagId, notes[flag.flagId] ?? '')}
                  disabled={busyFlagId === flag.flagId}
                >
                  {busyFlagId === flag.flagId ? <Spinner size={14} /> : null}
                  <span className={cn(busyFlagId === flag.flagId && 'ml-1.5')}>
                    Accept and record
                  </span>
                </Button>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

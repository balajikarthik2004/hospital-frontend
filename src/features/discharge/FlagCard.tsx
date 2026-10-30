import { useState } from 'react';
import {
  CheckCircleIcon,
  LightBulbIcon,
  PencilSquareIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import { Badge, Button, ErrorState, Field, Modal, Textarea } from '@/components/common';
import { api } from '@/lib/api';
import { useMutation } from '@/hooks/useApi';
import { useAuthStore } from '@/store/authStore';
import { toast } from '@/store/notificationStore';
import { SEVERITY_STYLE, confidencePct, fmtDateTime, titleCase } from '@/lib/utils';
import type { FlagType, MedFlag } from '@/types';

type Resolution = 'accepted' | 'modified' | 'dismissed';

/**
 * What each flag type means, for anyone who is not a pharmacist. Typed against
 * FlagType so a new type cannot be added without a plain-language line.
 */
const TYPE_STORY: Record<FlagType, string> = {
  interaction: 'These drugs affect each other when taken together.',
  duplication: 'Two drugs on the list do the same job.',
  omission: 'Something the discharge list should contain is missing.',
  dose_mismatch: 'The dose differs between the home list and the discharge list.',
  allergy_conflict: 'This drug conflicts with an allergy on the record.',
  unclear_instruction: 'The instructions as written could be misread at home.',
};

export function FlagCard({
  packageId,
  flag,
  onResolved,
}: {
  packageId: string;
  flag: MedFlag;
  onResolved: () => void;
}) {
  const [dialog, setDialog] = useState<Resolution | null>(null);
  const can = useAuthStore((s) => s.can);
  const palette = SEVERITY_STYLE[flag.severity];
  const isOpen = flag.resolution === 'pending';
  const mayResolve = can('discharge:review-medication') && isOpen;

  return (
    <div
      className="overflow-hidden rounded-xl border bg-[var(--color-surface)] shadow-xs"
      style={{ borderColor: 'var(--color-border)' }}
    >
      {/* Severity reads as a coloured spine down the left edge. */}
      <div className="flex">
        <span
          className="w-1 shrink-0"
          style={{ background: palette.color }}
          aria-hidden
        />

        <div className="min-w-0 flex-1 p-4">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
            <Badge
              style={{
                background: palette.bg,
                color: palette.color,
                borderColor: palette.color,
              }}
            >
              {flag.severity.toUpperCase()}
            </Badge>
            <span className="text-[0.9375rem] font-semibold tracking-[-0.01em]">
              {flag.drugA}
              {flag.drugB && (
                <>
                  <span className="mx-1 font-normal text-faint">+</span>
                  {flag.drugB}
                </>
              )}
            </span>
            <span className="text-xs text-faint">{titleCase(flag.type)}</span>
            <span className="ml-auto flex items-center gap-2.5 text-[0.6875rem] text-faint">
              <span className="tabular">{confidencePct(flag.confidence)} confidence</span>
              <span className="font-mono">{flag.flagId}</span>
            </span>
          </div>

          {TYPE_STORY[flag.type] && (
            <p className="mt-1.5 text-xs text-faint">{TYPE_STORY[flag.type]}</p>
          )}

          <p className="mt-2 text-[0.8125rem] leading-relaxed">{flag.description}</p>

          <div
            className="mt-3 flex gap-2.5 rounded-lg border px-3 py-2.5"
            style={{
              background: 'var(--color-surface-muted)',
              borderColor: 'var(--color-border)',
            }}
          >
            <LightBulbIcon
              className="mt-px h-4 w-4 shrink-0"
              style={{ color: palette.color }}
              aria-hidden
            />
            <div className="min-w-0">
              <span className="eyebrow">What the agent suggests</span>
              <p className="mt-1 text-[0.8125rem] leading-relaxed text-muted">
                {flag.recommendation}
              </p>
            </div>
          </div>

          {isOpen ? (
            mayResolve ? (
              <div className="no-print mt-3.5 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="success"
                  icon={<CheckCircleIcon className="h-4 w-4" />}
                  onClick={() => setDialog('accepted')}
                >
                  Accept
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  icon={<PencilSquareIcon className="h-4 w-4" />}
                  onClick={() => setDialog('modified')}
                >
                  I did something else
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  icon={<XCircleIcon className="h-4 w-4" />}
                  onClick={() => setDialog('dismissed')}
                >
                  Not applicable
                </Button>
              </div>
            ) : (
              <p className="mt-3 text-xs text-faint">
                Waiting on a pharmacist or physician to decide.
              </p>
            )
          ) : (
            <div
              className="mt-3 rounded-lg border px-3 py-2 text-xs"
              style={{
                background:
                  flag.resolution === 'dismissed'
                    ? 'var(--color-surface-muted)'
                    : 'var(--color-success-light)',
                borderColor:
                  flag.resolution === 'dismissed'
                    ? 'var(--color-border)'
                    : 'var(--color-success-border)',
                color:
                  flag.resolution === 'dismissed'
                    ? 'var(--color-text-secondary)'
                    : 'var(--color-success)',
              }}
            >
              <strong className="font-semibold capitalize">{flag.resolution}</strong>
              {flag.resolvedAt && ` · ${fmtDateTime(flag.resolvedAt)}`}
              {flag.resolvedNote && (
                <p className="mt-1 italic opacity-90">“{flag.resolvedNote}”</p>
              )}
            </div>
          )}
        </div>
      </div>

      <ResolveDialog
        resolution={dialog}
        onClose={() => setDialog(null)}
        packageId={packageId}
        flag={flag}
        onDone={onResolved}
      />
    </div>
  );
}

function ResolveDialog({
  resolution,
  onClose,
  packageId,
  flag,
  onDone,
}: {
  resolution: Resolution | null;
  onClose: () => void;
  packageId: string;
  flag: MedFlag;
  onDone: () => void;
}) {
  const [note, setNote] = useState('');

  const submit = useMutation(async () => {
    await api.put(`/discharge/${packageId}/resolve-flag`, {
      flagId: flag.flagId,
      resolution,
      note: note || undefined,
    });
    toast.success(`Flag ${resolution}`, `${flag.drugA}${flag.drugB ? ` + ${flag.drugB}` : ''}`);
    setNote('');
    onClose();
    onDone();
  });

  if (!resolution) return null;

  const copy: Record<Resolution, { title: string; body: string; hint: string; required: boolean }> =
    {
      accepted: {
        title: 'Accept the recommendation',
        body: 'Records that you agree with the agent and have actioned its recommendation on the discharge prescription.',
        hint: 'Optional — note what you changed',
        required: false,
      },
      modified: {
        title: 'Modify the plan',
        body: 'Records that you took a different course from the one the agent recommended.',
        hint: 'Describe what you did instead',
        required: true,
      },
      dismissed: {
        title: 'Dismiss this flag',
        body: 'Records that this finding does not apply. A reason is required so the decision can be reviewed later.',
        hint: 'Why does this flag not apply?',
        required: true,
      },
    };

  const c = copy[resolution];
  const blocked = c.required && !note.trim();

  return (
    <Modal
      open
      onClose={onClose}
      title={c.title}
      subtitle={`${flag.severity.toUpperCase()} · ${flag.drugA}${flag.drugB ? ` + ${flag.drugB}` : ''}`}
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={submit.pending}>
            Cancel
          </Button>
          <Button
            variant={resolution === 'dismissed' ? 'danger' : 'primary'}
            loading={submit.pending}
            disabled={blocked}
            onClick={() => void submit.mutate()}
          >
            Confirm
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-[0.8125rem] leading-relaxed text-muted">{c.body}</p>
        <Field label="Note" required={c.required} hint={c.required ? undefined : c.hint}>
          <Textarea
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={c.hint}
          />
        </Field>
        {submit.error && <ErrorState message={submit.error} />}
      </div>
    </Modal>
  );
}

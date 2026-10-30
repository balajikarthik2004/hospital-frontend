import {
  CheckCircleIcon,
  ClockIcon,
  LockClosedIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import { Button, Callout, Card, CardHeader, Progress } from '@/components/common';
import { useAuthStore } from '@/store/authStore';
import { AGENT_META, fmtTime, titleCase } from '@/lib/utils';
import type { DischargePackage, SectionKey } from '@/types';

const SECTIONS: SectionKey[] = [
  'clinicalSummary',
  'medicationReconciliation',
  'followUpPlan',
  'patientEducation',
];

export function ApprovalPanel({
  pkg,
  approvers,
  onComplete,
  completing,
}: {
  pkg: DischargePackage;
  approvers: Record<string, string[]>;
  onComplete: () => void;
  completing: boolean;
}) {
  const can = useAuthStore((s) => s.can);
  const user = useAuthStore((s) => s.user);
  const blockers = pkg.blockers ?? [];
  const isComplete = pkg.status === 'completed';
  const mayComplete = can('discharge:complete') && !isComplete;

  const signed = SECTIONS.filter((k) => pkg[k].status === 'approved').length;

  // The one sentence that answers "is this waiting on me?"
  const mine = SECTIONS.filter(
    (k) =>
      pkg[k].status !== 'approved' &&
      pkg[k].status !== 'pending' &&
      user &&
      (approvers[k] ?? []).includes(user.role)
  );

  return (
    <Card accent={isComplete ? 'var(--color-success)' : undefined}>
      <CardHeader
        title="Who still has to sign"
        subtitle="Each section needs a signature from the role that owns it"
      />

      <Progress
        value={signed}
        max={SECTIONS.length}
        tone={signed === SECTIONS.length ? 'success' : 'primary'}
        label={`${signed} of ${SECTIONS.length} sections signed`}
      />

      {mine.length > 0 && (
        <Callout tone="warning" className="mt-4">
          <strong className="font-semibold">
            {mine.length === 1
              ? 'One section needs your signature.'
              : `${mine.length} sections need your signature.`}
          </strong>{' '}
          As {titleCase(user?.role ?? '')} you own{' '}
          {mine.map((k) => AGENT_META[k].short).join(' and ')}.
        </Callout>
      )}

      <ul className="mt-4 space-y-3">
        {SECTIONS.map((key) => {
          const section = pkg[key];
          const approved = section.status === 'approved';
          const rejected = section.status === 'rejected';
          const approval = [...pkg.approvals]
            .reverse()
            .find((a) => a.section === key && a.action !== 'edited');

          return (
            <li key={key} className="flex items-start gap-2.5">
              {approved ? (
                <CheckCircleIcon
                  className="mt-px h-[18px] w-[18px] shrink-0"
                  style={{ color: 'var(--color-success)' }}
                />
              ) : rejected ? (
                <XCircleIcon
                  className="mt-px h-[18px] w-[18px] shrink-0"
                  style={{ color: 'var(--color-danger)' }}
                />
              ) : (
                <ClockIcon
                  className="mt-px h-[18px] w-[18px] shrink-0"
                  style={{ color: 'var(--color-text-tertiary)' }}
                />
              )}

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ background: AGENT_META[key].color }}
                    aria-hidden
                  />
                  <span className="truncate text-[0.8125rem] font-medium">
                    {AGENT_META[key].short}
                  </span>
                </div>
                <p className="mt-0.5 text-xs leading-relaxed text-muted">
                  {approved && approval
                    ? `Signed by ${approval.signature} at ${fmtTime(approval.timestamp)}`
                    : rejected && approval
                      ? `Rejected by ${approval.signature} — needs another pass`
                      : `Waiting on ${(approvers[key] ?? []).map((r) => titleCase(r)).join(' or ')}`}
                </p>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="mt-5 border-t pt-4" style={{ borderColor: 'var(--color-border)' }}>
        {isComplete ? (
          <div
            className="flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-[0.8125rem] font-medium"
            style={{
              background: 'var(--color-success-light)',
              borderColor: 'var(--color-success-border)',
              color: 'var(--color-success)',
            }}
          >
            <CheckCircleIcon className="h-[18px] w-[18px]" />
            Discharge completed
          </div>
        ) : (
          <>
            {blockers.length > 0 && (
              <div className="mb-3">
                <p className="eyebrow mb-2 flex items-center gap-1.5">
                  <LockClosedIcon className="h-3 w-3" />
                  Blocked until these clear
                </p>
                <ul className="space-y-1.5">
                  {blockers.map((b) => (
                    <li key={b} className="flex gap-2 text-xs leading-relaxed text-muted">
                      <span
                        className="mt-[6px] h-1 w-1 shrink-0 rounded-full"
                        style={{ background: 'var(--color-warning)' }}
                        aria-hidden
                      />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {mayComplete ? (
              <>
                <Button
                  variant="success"
                  fullWidth
                  disabled={blockers.length > 0}
                  loading={completing}
                  onClick={onComplete}
                >
                  Complete discharge
                </Button>
                {blockers.length === 0 && (
                  <p className="mt-2 text-center text-[0.6875rem] text-faint">
                    Closes the admission and releases the bed.
                  </p>
                )}
              </>
            ) : (
              <p className="text-center text-xs leading-relaxed text-faint">
                Only a physician or administrator can finalise the discharge.
              </p>
            )}
          </>
        )}
      </div>
    </Card>
  );
}

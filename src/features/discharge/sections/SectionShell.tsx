import { useState, type ReactNode } from 'react';
import { ChevronDownIcon, SparklesIcon } from '@heroicons/react/24/outline';
import { Badge, Button, Card, ErrorState, Field, Input, Modal, Textarea } from '@/components/common';
import { api } from '@/lib/api';
import { useMutation } from '@/hooks/useApi';
import { useAuthStore } from '@/store/authStore';
import { toast } from '@/store/notificationStore';
import {
  AGENT_META,
  SECTION_LABEL,
  SECTION_TONE,
  cn,
  confidencePct,
  fmtDateTime,
} from '@/lib/utils';
import type { DischargePackage, SectionKey, SectionStatus } from '@/types';

/** Which roles may act on each section — mirrors the server's SECTION_APPROVERS. */
const APPROVERS: Record<SectionKey, string[]> = {
  clinicalSummary: ['physician'],
  medicationReconciliation: ['physician', 'pharmacist'],
  followUpPlan: ['physician', 'care_coordinator'],
  patientEducation: ['nurse', 'physician'],
};

export function SectionShell({
  pkg,
  section,
  children,
  summary,
  editable,
  editValue,
  onChanged,
  extraActions,
  defaultOpen = true,
}: {
  pkg: DischargePackage;
  section: SectionKey;
  children: ReactNode;
  /** A one-line digest shown when the section is collapsed. */
  summary?: ReactNode;
  editable?: boolean;
  editValue?: string;
  onChanged: () => void;
  extraActions?: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [dialog, setDialog] = useState<'approve' | 'reject' | 'edit' | null>(null);
  const meta = AGENT_META[section];
  const state = pkg[section];
  const status = state.status as SectionStatus;

  const user = useAuthStore((s) => s.user);
  const mayReview =
    Boolean(user) &&
    APPROVERS[section].includes(user!.role) &&
    status !== 'pending' &&
    pkg.status !== 'completed';

  const isApproved = status === 'approved';
  const generator = 'generator' in state ? (state.generator as string | undefined) : undefined;

  return (
    <Card padded={false} accent={meta.color} className="overflow-hidden">
      {/* ─── Header ───────────────────────────────────────────────────────── */}
      <div
        className="flex flex-wrap items-start gap-3 border-b px-5 py-4"
        style={{ borderColor: 'var(--color-border)' }}
      >
        <span
          className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
          style={{ background: `color-mix(in srgb, ${meta.color} 12%, transparent)` }}
          aria-hidden
        >
          <SparklesIcon className="h-4 w-4" style={{ color: meta.color }} />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate">{meta.short}</h3>
            <Badge tone={SECTION_TONE[status]}>{SECTION_LABEL[status]}</Badge>
          </div>

          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-faint">
            {/* Say where the words came from once. Naming the agent's usual
                engine as well as the one that actually ran reads as a
                contradiction when no API key is configured. */}
            <span>
              {generator && generator !== 'pending'
                ? generator === 'claude'
                  ? 'Written by Claude'
                  : 'Deterministic template'
                : meta.kind}
            </span>
            {state.agentConfidence > 0 && (
              <>
                <span aria-hidden>·</span>
                <ConfidenceMeter value={state.agentConfidence} color={meta.color} />
              </>
            )}
            {state.reviewedAt && (
              <>
                <span aria-hidden>·</span>
                <span>reviewed {fmtDateTime(state.reviewedAt)}</span>
              </>
            )}
          </p>

          {!open && summary && <div className="mt-2 text-xs text-muted">{summary}</div>}
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {extraActions}
          <button
            onClick={() => setOpen((o) => !o)}
            className="rounded-lg p-1.5 text-faint transition-colors hover:bg-[var(--color-surface-sunken)] hover:text-[var(--color-text)]"
            aria-label={open ? 'Collapse section' : 'Expand section'}
            aria-expanded={open}
          >
            <ChevronDownIcon className={cn('h-5 w-5 transition-transform duration-200', open && 'rotate-180')} />
          </button>
        </div>
      </div>

      {open && <div className="px-5 py-5">{children}</div>}

      {/* ─── Review bar ───────────────────────────────────────────────────── */}
      {mayReview && (
        <div
          className="no-print flex flex-wrap items-center justify-between gap-3 border-t px-5 py-3.5"
          style={{
            borderColor: 'var(--color-border)',
            background: isApproved
              ? 'var(--color-success-light)'
              : 'var(--color-surface-muted)',
          }}
        >
          <p
            className="text-xs leading-relaxed"
            style={{
              color: isApproved ? 'var(--color-success)' : 'var(--color-text-secondary)',
            }}
          >
            {isApproved
              ? 'You have signed this section. Reject it if something changes.'
              : `This is a draft. ${APPROVERS[section].map(titleise).join(' or ')} must sign it before discharge.`}
          </p>
          <div className="flex gap-2">
            {editable && (
              <Button size="sm" variant="outline" onClick={() => setDialog('edit')}>
                Edit
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={() => setDialog('reject')}>
              Reject
            </Button>
            <Button
              size="sm"
              variant="success"
              onClick={() => setDialog('approve')}
              disabled={isApproved}
            >
              {isApproved ? 'Approved' : 'Approve'}
            </Button>
          </div>
        </div>
      )}

      <ReviewDialog
        mode={dialog}
        onClose={() => setDialog(null)}
        pkg={pkg}
        section={section}
        initialContent={editValue ?? ''}
        onDone={onChanged}
      />
    </Card>
  );
}

/** A five-segment bar — easier to read at a glance than a bare percentage. */
function ConfidenceMeter({ value, color }: { value: number; color: string }) {
  const filled = Math.round(value * 5);
  return (
    <span className="inline-flex items-center gap-1.5" title={`Agent confidence ${confidencePct(value)}`}>
      <span className="flex gap-[2px]" aria-hidden>
        {Array.from({ length: 5 }).map((_, i) => (
          <span
            key={i}
            className="h-2 w-[3px] rounded-sm"
            style={{
              background: i < filled ? color : 'var(--color-border-dark)',
              opacity: i < filled ? 1 : 0.45,
            }}
          />
        ))}
      </span>
      {confidencePct(value)} confidence
    </span>
  );
}

const titleise = (s: string) => s.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());

function ReviewDialog({
  mode,
  onClose,
  pkg,
  section,
  initialContent,
  onDone,
}: {
  mode: 'approve' | 'reject' | 'edit' | null;
  onClose: () => void;
  pkg: DischargePackage;
  section: SectionKey;
  initialContent: string;
  onDone: () => void;
}) {
  const user = useAuthStore((s) => s.user);
  const [signature, setSignature] = useState(user?.fullName ?? '');
  const [comments, setComments] = useState('');
  const [content, setContent] = useState(initialContent);

  const submit = useMutation(async () => {
    await api.put(`/discharge/${pkg._id}/review`, {
      section,
      action: mode === 'edit' ? 'edited' : mode === 'approve' ? 'approved' : 'rejected',
      comments: comments || null,
      content: mode === 'edit' ? content : undefined,
      signature,
    });
    toast.success(
      mode === 'edit'
        ? 'Edit saved'
        : mode === 'approve'
          ? 'Section approved'
          : 'Section rejected',
      `${AGENT_META[section].short} · signed by ${signature}`
    );
    onClose();
    onDone();
  });

  if (!mode) return null;

  const titles = {
    approve: 'Approve this section',
    reject: 'Reject this section',
    edit: 'Edit before approving',
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={titles[mode]}
      subtitle={AGENT_META[section].label}
      size={mode === 'edit' ? 'lg' : 'sm'}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={submit.pending}>
            Cancel
          </Button>
          <Button
            variant={mode === 'reject' ? 'danger' : mode === 'approve' ? 'success' : 'primary'}
            loading={submit.pending}
            disabled={!signature.trim() || (mode === 'edit' && !content.trim())}
            onClick={() => void submit.mutate()}
          >
            {mode === 'edit' ? 'Save edit' : mode === 'approve' ? 'Sign and approve' : 'Reject'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {mode === 'edit' && (
          <Field
            label="Content (Markdown)"
            hint="Your edit replaces the agent's draft. The original is kept in the audit trail."
          >
            <Textarea
              rows={18}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="font-mono text-xs"
            />
          </Field>
        )}

        {mode === 'approve' && (
          <p className="text-[0.8125rem] leading-relaxed text-muted">
            Signing records that you, as {titleise(user?.role ?? '')}, have read this section and
            accept it as clinically correct. The action is logged permanently.
          </p>
        )}

        {mode === 'reject' && (
          <p className="text-[0.8125rem] leading-relaxed text-muted">
            Rejecting sends the package back. Say what is wrong so the next clinician knows what
            to fix.
          </p>
        )}

        <Field
          label="Comments"
          required={mode === 'reject'}
          hint={mode === 'reject' ? undefined : 'Optional'}
        >
          <Textarea
            rows={3}
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            placeholder={
              mode === 'reject'
                ? 'What needs to change before this can be approved?'
                : 'Anything the rest of the team should know'
            }
          />
        </Field>

        <Field label="Digital signature" required hint="Type your full name to sign">
          <Input value={signature} onChange={(e) => setSignature(e.target.value)} />
        </Field>

        {submit.error && <ErrorState message={submit.error} />}
      </div>
    </Modal>
  );
}

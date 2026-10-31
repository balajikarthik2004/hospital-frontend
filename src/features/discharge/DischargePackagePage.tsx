import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeftIcon,
  ArrowPathIcon,
  PrinterIcon,
  ShieldCheckIcon,
  ShieldExclamationIcon,
} from '@heroicons/react/24/outline';
import {
  Avatar,
  Badge,
  Button,
  Callout,
  Card,
  CardHeader,
  ConfirmDialog,
  ErrorState,
  KeyValue,
  LoadingPane,
  Timeline,
  TimelineItem,
} from '@/components/common';
import { api } from '@/lib/api';
import { useApi, useMutation } from '@/hooks/useApi';
import { useSocketEvent, useSocketRoom } from '@/hooks/useSocket';
import { rooms } from '@/lib/socket';
import { useAuthStore } from '@/store/authStore';
import { toast } from '@/store/notificationStore';
import { fmtDateTime, fmtRelative, patientAge, patientName, titleCase } from '@/lib/utils';
import type { DischargePackage } from '@/types';
import { PackageStepper, StatusPill } from './StatusPill';
import { AgentProgress } from './AgentProgress';
import { ClinicalSummarySection } from './sections/ClinicalSummarySection';
import { MedReconciliationSection } from './sections/MedReconciliationSection';
import { FollowUpSection } from './sections/FollowUpSection';
import { PatientEducationSection } from './sections/PatientEducationSection';
import { ApprovalPanel } from './ApprovalPanel';

export function DischargePackagePage() {
  const { id } = useParams<{ id: string }>();
  const can = useAuthStore((s) => s.can);
  const [confirmComplete, setConfirmComplete] = useState(false);

  const { data, loading, error, refetch } = useApi<{
    dischargePackage: DischargePackage;
    sectionApprovers: Record<string, string[]>;
  }>(id ? `/discharge/${id}` : null);

  useSocketRoom(id ? rooms.discharge(id) : null);

  useSocketEvent<{ packageId: string }>(
    'discharge:status-update',
    (payload) => {
      if (String(payload.packageId) === id) void refetch();
    },
    [id]
  );
  useSocketEvent<{ packageId: string }>(
    'discharge:flag-resolved',
    (payload) => {
      if (String(payload.packageId) === id) void refetch();
    },
    [id]
  );
  useSocketEvent<{ packageId: string }>(
    'discharge:approved',
    (payload) => {
      if (String(payload.packageId) === id) void refetch();
    },
    [id]
  );

  const rerun = useMutation(async () => {
    await api.post(`/discharge/${id}/rerun-agents`);
    toast.info('Re-running the agents', 'Progress will stream in below.');
    await refetch();
  });

  const complete = useMutation(async () => {
    await api.put(`/discharge/${id}/complete`);
    toast.success('Discharge completed', 'The bed has been released and the record closed.');
    setConfirmComplete(false);
    await refetch();
  });

  if (loading && !data) return <LoadingPane label="Loading the discharge package" />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;
  if (!data) return null;

  const pkg = data.dischargePackage;
  const patient = pkg.patientId;
  const admission = pkg.admissionId;
  const processing = pkg.status === 'agents_processing' || pkg.status === 'initiated';
  const dayOfStay = admission
    ? Math.max(
        1,
        Math.round((Date.now() - new Date(admission.admissionDate).getTime()) / 86_400_000)
      )
    : 0;

  return (
    <>
      <Link
        to="/app/discharge"
        className="mb-4 inline-flex items-center gap-1.5 text-xs font-medium text-muted transition-colors hover:text-[var(--color-primary)]"
      >
        <ArrowLeftIcon className="h-3.5 w-3.5" />
        Back to the discharge queue
      </Link>

      {/* ─── Who this is about ────────────────────────────────────────────── */}
      <Card padded={false} className="mb-5 overflow-hidden animate-rise">
        <div className="flex flex-wrap items-start gap-5 p-5">
          <Avatar name={patientName(patient)} size={52} />

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="truncate text-xl">{patientName(patient)}</h1>
              <StatusPill status={pkg.status} />
            </div>
            <p className="mt-1 text-[0.8125rem] text-muted">
              {admission?.admittingDiagnosis ?? 'Admission'}
              {patient && ` · ${patientAge(patient)} years old`}
              {dayOfStay > 0 && ` · day ${dayOfStay} of stay`}
            </p>

            <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
              <KeyValue label="Patient ID">
                <Link
                  to={`/app/patients/${patient?._id}`}
                  className="font-mono text-[0.8125rem] text-[var(--color-primary)] hover:underline"
                >
                  {patient?.patientId ?? '—'}
                </Link>
              </KeyValue>
              <KeyValue label="Package">
                <span className="font-mono">{pkg.packageId}</span>
              </KeyValue>
              <KeyValue label="Initiated">{fmtRelative(pkg.initiatedAt)}</KeyValue>
              <KeyValue label={pkg.completedAt ? 'Completed' : 'Location'}>
                {pkg.completedAt
                  ? fmtDateTime(pkg.completedAt)
                  : admission?.bed
                    ? `${admission.bed.ward} · ${admission.bed.roomNumber}-${admission.bed.bedNumber}`
                    : '—'}
              </KeyValue>
            </dl>
          </div>

          <div className="no-print flex shrink-0 flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              icon={<PrinterIcon className="h-4 w-4" />}
              onClick={() => window.print()}
            >
              Print
            </Button>
            {can('discharge:initiate') && pkg.status !== 'completed' && (
              <Button
                variant="outline"
                size="sm"
                icon={<ArrowPathIcon className="h-4 w-4" />}
                loading={rerun.pending}
                onClick={() => void rerun.mutate()}
              >
                Re-run agents
              </Button>
            )}
          </div>
        </div>

        {/* The journey, as a rail across the bottom of the patient header. */}
        <div
          className="border-t px-5 py-5"
          style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface-muted)' }}
        >
          <PackageStepper status={pkg.status} />
        </div>
      </Card>

      {processing && (
        <Card className="mb-5" accent="var(--agent-orchestrator)">
          <CardHeader
            title="The agents are preparing this package"
            subtitle="Each one works on a different part of the discharge. Nothing here is final — every section arrives as a draft for a clinician to sign."
            accent="var(--agent-orchestrator)"
          />
          <AgentProgress runs={pkg.agentRuns} />
        </Card>
      )}

      <SafetyBanner pkg={pkg} />

      <div className="grid gap-5 xl:grid-cols-3">
        <div className="space-y-5 xl:col-span-2">
          <ClinicalSummarySection pkg={pkg} onChanged={refetch} />
          <MedReconciliationSection pkg={pkg} onChanged={refetch} />
          <FollowUpSection pkg={pkg} onChanged={refetch} />
          <PatientEducationSection pkg={pkg} onChanged={refetch} />
        </div>

        <div className="space-y-5">
          <ApprovalPanel
            pkg={pkg}
            approvers={data.sectionApprovers}
            onComplete={() => setConfirmComplete(true)}
            completing={complete.pending}
          />

          {!processing && (
            <Card>
              <CardHeader
                title="Agent run log"
                subtitle="How long each agent took and how confident it was"
              />
              <AgentProgress runs={pkg.agentRuns} compact />
            </Card>
          )}

          <Card>
            <CardHeader
              title="Governance checks"
              subtitle="Run automatically before the package opened for review"
            />
            <ul className="space-y-2.5">
              {pkg.safetyValidation?.checks?.map((check) => (
                <li key={check.name} className="flex items-start gap-2.5 text-xs">
                  {check.passed ? (
                    <ShieldCheckIcon
                      className="mt-px h-4 w-4 shrink-0"
                      style={{ color: 'var(--color-success)' }}
                    />
                  ) : (
                    <ShieldExclamationIcon
                      className="mt-px h-4 w-4 shrink-0"
                      style={{ color: 'var(--color-danger)' }}
                    />
                  )}
                  <span className="min-w-0">
                    <span className="block font-medium">{titleCase(check.name)}</span>
                    <span className="block leading-relaxed text-muted">{check.detail}</span>
                  </span>
                </li>
              )) ?? <li className="text-xs text-muted">Not run yet.</li>}
            </ul>
          </Card>

          <Card>
            <CardHeader
              title="Signature trail"
              subtitle="Every review action, in the order it happened"
            />
            {pkg.approvals.length === 0 ? (
              <p className="text-xs text-muted">
                No one has reviewed anything yet. Actions appear here the moment they are signed.
              </p>
            ) : (
              <Timeline>
                {pkg.approvals.map((a, i) => (
                  <TimelineItem
                    key={i}
                    index={i}
                    last={i === pkg.approvals.length - 1}
                    tone={
                      a.action === 'approved'
                        ? 'var(--color-success)'
                        : a.action === 'rejected'
                          ? 'var(--color-danger)'
                          : 'var(--color-info)'
                    }
                    marker={a.signature.slice(0, 1).toUpperCase()}
                    title={
                      <>
                        {a.signature}{' '}
                        <Badge tone="neutral" size="sm">
                          {titleCase(a.role)}
                        </Badge>
                      </>
                    }
                    meta={fmtDateTime(a.timestamp)}
                  >
                    <span className="capitalize">{a.action}</span> {titleCase(a.section)}
                    {a.comments && (
                      <p className="mt-1 italic text-faint">“{a.comments}”</p>
                    )}
                  </TimelineItem>
                ))}
              </Timeline>
            )}
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={confirmComplete}
        onClose={() => setConfirmComplete(false)}
        onConfirm={() => void complete.mutate()}
        pending={complete.pending}
        title="Complete this discharge?"
        confirmLabel="Complete discharge"
        tone="success"
        message={
          <>
            <p>
              This closes the admission, marks {patientName(patient)} as discharged and releases
              their bed. It cannot be undone from this screen.
            </p>
            {complete.error && (
              <div className="mt-3">
                <ErrorState message={complete.error} />
              </div>
            )}
          </>
        }
      />
    </>
  );
}

function SafetyBanner({ pkg }: { pkg: DischargePackage }) {
  const validation = pkg.safetyValidation;
  if (!validation?.validatedAt) return null;

  const failed = validation.checks?.filter((c) => !c.passed) ?? [];

  if (!failed.length) {
    return (
      <Callout
        tone="success"
        className="mb-5"
        title="Safety validation passed"
        icon={<ShieldCheckIcon className="h-[18px] w-[18px]" />}
      >
        No agent prescribed, approved or invented anything. Every section below is still a draft
        until a clinician signs it.
      </Callout>
    );
  }

  return (
    <Callout
      tone="danger"
      className="mb-5"
      title={`Safety validation flagged ${failed.length} issue${failed.length === 1 ? '' : 's'}`}
      icon={<ShieldExclamationIcon className="h-[18px] w-[18px]" />}
    >
      <ul className="mt-1 space-y-1">
        {failed.map((check) => (
          <li key={check.name} className="flex gap-1.5">
            <span aria-hidden>•</span>
            <span>{check.detail}</span>
          </li>
        ))}
      </ul>
    </Callout>
  );
}

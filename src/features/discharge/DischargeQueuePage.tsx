import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowPathIcon,
  ClipboardDocumentCheckIcon,
  FunnelIcon,
} from '@heroicons/react/24/outline';
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  LoadingPane,
  PageHeader,
  Select,
  Table,
  Td,
  Th,
  Tr,
} from '@/components/common';
import { useApi } from '@/hooks/useApi';
import { useSocketEvent } from '@/hooks/useSocket';
import { useAuthStore } from '@/store/authStore';
import { SEVERITY_STYLE, cn, fmtRelative, patientAge, patientName } from '@/lib/utils';
import type { DischargePackage, PackageStatus, Pagination } from '@/types';
import { PackageStepper, StatusPill } from './StatusPill';
import { InitiateDischargeModal } from './InitiateDischargeModal';

const STATUS_OPTIONS: { value: PackageStatus | ''; label: string }[] = [
  { value: '', label: 'All statuses' },
  { value: 'initiated', label: 'Initiated' },
  { value: 'agents_processing', label: 'Agents working' },
  { value: 'pending_review', label: 'Awaiting review' },
  { value: 'in_review', label: 'In review' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'completed', label: 'Completed' },
];

/** The four states worth seeing at a glance, in the order work flows. */
const PULSE: { key: string; label: string; match: PackageStatus[]; tone: string }[] = [
  {
    key: 'working',
    label: 'Agents working',
    match: ['initiated', 'agents_processing'],
    tone: 'var(--agent-orchestrator)',
  },
  {
    key: 'review',
    label: 'Awaiting review',
    match: ['pending_review', 'in_review'],
    tone: 'var(--color-warning)',
  },
  { key: 'rejected', label: 'Sent back', match: ['rejected'], tone: 'var(--color-danger)' },
  {
    key: 'ready',
    label: 'Ready to complete',
    match: ['approved'],
    tone: 'var(--color-success)',
  },
];

export function DischargeQueuePage() {
  const navigate = useNavigate();
  const can = useAuthStore((s) => s.can);
  const [status, setStatus] = useState('');
  const [from, setFrom] = useState('');
  const [initiating, setInitiating] = useState(false);

  const query = new URLSearchParams({ limit: '50' });
  if (status) query.set('status', status);
  if (from) query.set('from', from);

  const { data, loading, error, refetch } = useApi<{
    dischargePackages: DischargePackage[];
    pagination: Pagination;
  }>(`/discharge?${query.toString()}`, [status, from]);

  useSocketEvent('discharge:status-update', () => void refetch());

  const packages = data?.dischargePackages ?? [];
  const filtered = Boolean(status || from);

  return (
    <>
      <PageHeader
        eyebrow="Care"
        title="Discharge queue"
        story="Every package the agents have prepared, and exactly where each one is stuck. Open one to review the draft and sign the section you own."
        actions={
          <>
            <Button
              variant="ghost"
              icon={<ArrowPathIcon className="h-4 w-4" />}
              onClick={refetch}
            >
              Refresh
            </Button>
            {can('discharge:initiate') && (
              <Button onClick={() => setInitiating(true)}>Initiate discharge</Button>
            )}
          </>
        }
      />

      {/* ─── The queue at a glance ────────────────────────────────────────── */}
      <div className="stagger mb-5 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {PULSE.map((stage) => {
          const count = packages.filter((p) =>
            stage.match.includes(p.status as PackageStatus)
          ).length;
          const isFilter = status !== '' && stage.match.includes(status as PackageStatus);
          return (
            <button
              key={stage.key}
              onClick={() => setStatus(isFilter ? '' : stage.match[0])}
              className={cn(
                'rounded-xl border bg-[var(--color-surface)] p-4 text-left shadow-xs transition-all duration-200',
                'hover:-translate-y-0.5 hover:shadow-md',
                isFilter ? 'border-primary-500 ring-4 ring-primary-600/10' : 'border-[var(--color-border)]'
              )}
            >
              <div className="flex items-center gap-2">
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: stage.tone }}
                  aria-hidden
                />
                <span className="eyebrow">{stage.label}</span>
              </div>
              <p className="mt-2 text-[1.75rem] font-semibold leading-none tracking-[-0.03em] tabular">
                {count}
              </p>
            </button>
          );
        })}
      </div>

      {/* ─── Filters ──────────────────────────────────────────────────────── */}
      <Card className="mb-4" padded={false}>
        <div className="flex flex-wrap items-center gap-3 px-4 py-3">
          <FunnelIcon className="h-4 w-4 shrink-0 text-faint" aria-hidden />
          {/* Width lives on the wrapper: the field's own `w-full` would
              otherwise beat any width utility passed through className. */}
          <div className="w-[11.5rem]">
            <Select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              aria-label="Filter by status"
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </div>
          <label className="flex items-center gap-2 whitespace-nowrap text-xs text-muted">
            <span className="hidden sm:inline">Initiated after</span>
            <span className="block w-[10.5rem]">
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </span>
          </label>
          {filtered && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setStatus('');
                setFrom('');
              }}
            >
              Clear
            </Button>
          )}
          <span className="ml-auto text-xs text-faint">
            {packages.length} package{packages.length === 1 ? '' : 's'}
          </span>
        </div>
      </Card>

      {error && <ErrorState message={error} onRetry={refetch} />}

      <Card padded={false}>
        {loading && !data ? (
          <LoadingPane label="Loading the queue" />
        ) : packages.length === 0 ? (
          <EmptyState
            title={filtered ? 'Nothing matches those filters' : 'No discharge packages yet'}
            detail={
              filtered
                ? 'Clear the filters to see the whole queue.'
                : 'A physician starts the workflow from a patient chart, or with “Initiate discharge”. The agents take it from there.'
            }
            icon={<ClipboardDocumentCheckIcon className="h-6 w-6" />}
            action={
              filtered ? (
                <Button
                  variant="outline"
                  onClick={() => {
                    setStatus('');
                    setFrom('');
                  }}
                >
                  Clear filters
                </Button>
              ) : can('discharge:initiate') ? (
                <Button onClick={() => setInitiating(true)}>Initiate discharge</Button>
              ) : undefined
            }
          />
        ) : (
          <Table>
              <thead>
                <tr>
                  <Th>Patient</Th>
                  <Th>Admission</Th>
                  <Th>Stage</Th>
                  <Th>Flags</Th>
                  <Th>Initiated</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {packages.map((pkg) => (
                  <Tr key={pkg._id} onClick={() => navigate(`/discharge/${pkg._id}`)}>
                    <Td>
                      <div className="flex items-center gap-2.5">
                        <Avatar name={patientName(pkg.patientId)} size={32} />
                        <div className="min-w-0">
                          <span className="block truncate font-medium">
                            {patientName(pkg.patientId)}
                          </span>
                          <span className="block truncate text-[0.6875rem] text-faint">
                            {pkg.patientId?.patientId} ·{' '}
                            {pkg.patientId ? patientAge(pkg.patientId) : '?'}y ·{' '}
                            <span className="font-mono">{pkg.packageId}</span>
                          </span>
                        </div>
                      </div>
                    </Td>
                    <Td className="max-w-[14rem]">
                      <span className="block truncate">{pkg.admissionId?.admittingDiagnosis}</span>
                      <span className="block truncate text-[0.6875rem] text-faint">
                        {pkg.admissionId?.admissionId}
                      </span>
                    </Td>
                    <Td>
                      <StatusPill status={pkg.status} />
                      <div className="mt-1.5">
                        <PackageStepper status={pkg.status} compact />
                      </div>
                    </Td>
                    <Td>
                      <FlagChips summary={pkg.flagSummary} />
                    </Td>
                    <Td className="whitespace-nowrap text-xs text-muted">
                      {fmtRelative(pkg.initiatedAt)}
                    </Td>
                    <Td>
                      <Link to={`/discharge/${pkg._id}`} onClick={(e) => e.stopPropagation()}>
                        <Button size="sm" variant="outline">
                          Open
                        </Button>
                      </Link>
                    </Td>
                  </Tr>
                ))}
              </tbody>
          </Table>
        )}
      </Card>

      <InitiateDischargeModal
        open={initiating}
        onClose={() => setInitiating(false)}
        onCreated={(id) => navigate(`/discharge/${id}`)}
      />
    </>
  );
}

export function FlagChips({ summary }: { summary?: DischargePackage['flagSummary'] }) {
  if (!summary || summary.total === 0) {
    return <span className="text-xs text-faint">Clear</span>;
  }

  return (
    <div className="flex items-center gap-1 whitespace-nowrap">
      {(['critical', 'high', 'medium', 'low'] as const).map((severity) =>
        summary[severity] > 0 ? (
          <span
            key={severity}
            title={`${summary[severity]} ${severity}`}
            className="inline-flex h-5 min-w-5 items-center justify-center rounded-md border px-1 text-[0.625rem] font-bold tabular"
            style={{
              background: SEVERITY_STYLE[severity].bg,
              color: SEVERITY_STYLE[severity].color,
              borderColor: SEVERITY_STYLE[severity].color,
            }}
          >
            {summary[severity]}
          </span>
        ) : null
      )}
      {summary.unresolved > 0 && (
        <Badge tone="warning" size="sm">
          {summary.unresolved} open
        </Badge>
      )}
    </div>
  );
}

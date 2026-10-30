import { Suspense, lazy, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowPathIcon,
  MapIcon,
  Squares2X2Icon,
  UserGroupIcon,
  WrenchScrewdriverIcon,
} from '@heroicons/react/24/outline';
import {
  Badge,
  Button,
  Card,
  ErrorState,
  KeyValue,
  LoadingPane,
  Modal,
  PageHeader,
  SegmentedControl,
  Spinner,
} from '@/components/common';
import { api } from '@/lib/api';
import { useApi, useMutation } from '@/hooks/useApi';
import { useSocketEvent } from '@/hooks/useSocket';
import { useAuthStore } from '@/store/authStore';
import { toast } from '@/store/notificationStore';
import { cn, groupBy, patientName, titleCase } from '@/lib/utils';
import type { Bed, BedStatus, Patient } from '@/types';
import { BED_PALETTE, WardFloorPlan } from './WardFloorPlan';

/* Three.js is a heavy dependency, so the 3D ward is only fetched when someone
   actually switches to it. The other two views cost nothing. */
const Ward3DView = lazy(() => import('./Ward3D'));

type View = 'plan' | 'grid' | '3d';

const STATUS_ORDER: BedStatus[] = ['available', 'occupied', 'reserved', 'maintenance'];

export function BedMapPage() {
  const [ward, setWard] = useState('');
  const [view, setView] = useState<View>('plan');
  const [selected, setSelected] = useState<Bed | null>(null);

  const { data, loading, error, refetch } = useApi<{
    beds: Bed[];
    wards: string[];
    summary: Record<string, number>;
  }>('/beds');

  useSocketEvent('bed:status-changed', () => void refetch());

  const beds = data?.beds ?? [];
  const wards = data?.wards ?? [];

  // One ward fills the 3D view, so "all wards" resolves to the first one.
  const effectiveWard = view === '3d' && !ward ? (wards[0] ?? '') : ward;
  const filtered = effectiveWard ? beds.filter((b) => b.ward === effectiveWard) : beds;
  const byWard = useMemo(() => groupBy(filtered, (b) => b.ward), [filtered]);

  const total = filtered.length;
  const counts = useMemo(
    () =>
      STATUS_ORDER.reduce(
        (acc, status) => {
          acc[status] = filtered.filter((b) => b.status === status).length;
          return acc;
        },
        {} as Record<BedStatus, number>
      ),
    [filtered]
  );
  const occupancy = total ? Math.round((counts.occupied / total) * 100) : 0;

  return (
    <>
      <PageHeader
        eyebrow="Operations"
        title="Bed management"
        story="The ward as it is actually laid out — rooms either side of the corridor, beds against the outer wall. Click any bed to see who is in it, release it, or take it out of service."
        actions={
          <>
            <Button variant="ghost" icon={<ArrowPathIcon className="h-4 w-4" />} onClick={refetch}>
              Refresh
            </Button>
            <SegmentedControl<View>
              value={view}
              onChange={setView}
              options={[
                {
                  value: 'plan',
                  label: (
                    <span className="flex items-center gap-1.5">
                      <MapIcon className="h-3.5 w-3.5" />
                      Floor plan
                    </span>
                  ),
                },
                {
                  value: '3d',
                  label: (
                    <span className="flex items-center gap-1.5">
                      <UserGroupIcon className="h-3.5 w-3.5" />
                      Live ward
                    </span>
                  ),
                },
                {
                  value: 'grid',
                  label: (
                    <span className="flex items-center gap-1.5">
                      <Squares2X2Icon className="h-3.5 w-3.5" />
                      Grid
                    </span>
                  ),
                },
              ]}
            />
          </>
        }
      />

      {error && <ErrorState message={error} onRetry={refetch} />}

      {/* ─── Capacity at a glance ──────────────────────────────────────── */}
      <Card className="mb-5">
        <div className="flex flex-wrap items-center justify-between gap-5">
          <div>
            <p className="eyebrow">Occupancy{ward ? ` · ${ward}` : ' · whole service'}</p>
            <p className="mt-1.5 flex items-baseline gap-2">
              <span className="text-[2rem] font-semibold leading-none tracking-[-0.03em] tabular">
                {occupancy}%
              </span>
              <span className="text-[0.8125rem] text-muted">
                {counts.occupied} of {total} beds in use
              </span>
            </p>
          </div>

          <div className="flex flex-wrap gap-5">
            {STATUS_ORDER.map((status) => (
              <div key={status}>
                <div className="flex items-center gap-1.5">
                  <span
                    className="h-2.5 w-2.5 rounded-sm border"
                    style={{
                      background: BED_PALETTE[status].fill,
                      borderColor: BED_PALETTE[status].stroke,
                    }}
                    aria-hidden
                  />
                  <span className="eyebrow">{BED_PALETTE[status].label}</span>
                </div>
                <p className="mt-1 text-lg font-semibold leading-none tabular">{counts[status]}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Only the unavailable beds are drawn. What is left of the track is
            free capacity, so a fuller bar always means a tighter ward. */}
        <div className="mt-4 flex h-2.5 w-full overflow-hidden rounded-full bg-[var(--color-success-light)]">
          {(['occupied', 'reserved', 'maintenance'] as BedStatus[]).map((status) =>
            counts[status] > 0 ? (
              <span
                key={status}
                className="h-full transition-[width] duration-500 ease-out"
                style={{
                  width: `${(counts[status] / Math.max(total, 1)) * 100}%`,
                  background: BED_PALETTE[status].stroke,
                  opacity: status === 'maintenance' ? 0.4 : 0.9,
                }}
                title={`${counts[status]} ${BED_PALETTE[status].label.toLowerCase()}`}
              />
            ) : null
          )}
        </div>
        <p className="mt-2 text-[0.6875rem] text-faint">
          The unfilled part of the bar is free capacity — {counts.available} bed
          {counts.available === 1 ? '' : 's'} you could admit into right now.
        </p>
      </Card>

      {/* ─── Ward picker ───────────────────────────────────────────────── */}
      <div className="mb-5 flex flex-wrap gap-2">
        {view !== '3d' && (
          <WardChip
            label="All wards"
            count={beds.length}
            active={ward === ''}
            onClick={() => setWard('')}
          />
        )}
        {wards.map((w) => {
          const wardBeds = beds.filter((b) => b.ward === w);
          const free = wardBeds.filter((b) => b.status === 'available').length;
          return (
            <WardChip
              key={w}
              label={w}
              count={wardBeds.length}
              free={free}
              active={effectiveWard === w}
              onClick={() => setWard(view === '3d' ? w : ward === w ? '' : w)}
            />
          );
        })}
      </div>

      {loading && !data ? (
        <LoadingPane label="Loading the ward map" />
      ) : (
        <div className="space-y-5">
          {Object.entries(byWard).map(([wardName, wardBeds]) => {
            const occupied = wardBeds.filter((b) => b.status === 'occupied').length;
            const free = wardBeds.filter((b) => b.status === 'available').length;

            return (
              <Card key={wardName} padded={false} className="overflow-hidden">
                <div
                  className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-3.5"
                  style={{ borderColor: 'var(--color-border)' }}
                >
                  <div>
                    <h3>{wardName}</h3>
                    <p className="mt-0.5 text-xs text-muted">
                      {occupied} of {wardBeds.length} beds occupied ·{' '}
                      {Math.round((occupied / wardBeds.length) * 100)}% full
                    </p>
                  </div>
                  <Badge tone={free > 0 ? 'success' : 'danger'}>
                    {free > 0 ? `${free} bed${free === 1 ? '' : 's'} free` : 'Ward full'}
                  </Badge>
                </div>

                <div className="overflow-x-auto p-5">
                  {view === '3d' ? (
                    <Suspense fallback={<Ward3DLoading />}>
                      <Ward3DView
                        ward={wardName}
                        beds={wardBeds}
                        selectedId={selected?._id}
                        onSelect={setSelected}
                      />
                    </Suspense>
                  ) : view === 'plan' ? (
                    <div className="min-w-[760px]">
                      <WardFloorPlan
                        ward={wardName}
                        beds={wardBeds}
                        selectedId={selected?._id}
                        onSelect={setSelected}
                      />
                    </div>
                  ) : (
                    <WardGrid beds={wardBeds} onSelect={setSelected} />
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <BedDetailModal bed={selected} onClose={() => setSelected(null)} onChanged={refetch} />
    </>
  );
}

/* ───────────────────────────────────────────────────────────────────────── */

function Ward3DLoading() {
  return (
    <div
      className="flex flex-col items-center justify-center gap-3 rounded-xl border"
      style={{ borderColor: 'var(--color-border)', height: 640 }}
    >
      <Spinner size={22} className="text-[var(--color-primary)]" />
      <p className="text-[0.8125rem] text-muted">Building the ward…</p>
    </div>
  );
}

function WardChip({
  label,
  count,
  free,
  active,
  onClick,
}: {
  label: string;
  count: number;
  free?: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'rounded-lg border px-3.5 py-2 text-left transition-all duration-150',
        active
          ? 'border-primary-500 bg-[var(--color-primary-50)] shadow-xs'
          : 'border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-border-dark)] hover:bg-[var(--color-surface-muted)]'
      )}
    >
      <span
        className={cn(
          'block text-[0.8125rem] font-medium',
          active && 'text-[var(--color-primary-dark)]'
        )}
      >
        {label}
      </span>
      <span className="block text-[0.6875rem] text-faint">
        {count} beds
        {free !== undefined && (
          <>
            {' · '}
            <span style={{ color: free ? 'var(--color-success)' : 'var(--color-danger)' }}>
              {free} free
            </span>
          </>
        )}
      </span>
    </button>
  );
}

/** The dense fallback view, for when you want the whole ward in one glance. */
function WardGrid({ beds, onSelect }: { beds: Bed[]; onSelect: (bed: Bed) => void }) {
  const rooms = groupBy(beds, (b) => b.roomNumber);

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
      {Object.entries(rooms)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([room, roomBeds]) => (
          <div
            key={room}
            className="rounded-lg border p-2.5"
            style={{ borderColor: 'var(--color-border)' }}
          >
            <p className="eyebrow mb-2">Room {room}</p>
            <div className="flex gap-1.5">
              {roomBeds
                .sort((a, b) => a.bedNumber.localeCompare(b.bedNumber))
                .map((bed) => {
                  const palette = BED_PALETTE[bed.status];
                  const patient =
                    bed.currentPatientId && typeof bed.currentPatientId === 'object'
                      ? (bed.currentPatientId as Patient)
                      : null;
                  return (
                    <button
                      key={bed._id}
                      onClick={() => onSelect(bed)}
                      className="flex-1 rounded-md border px-1.5 py-2 text-center transition-transform hover:scale-[1.04]"
                      style={{
                        background: palette.fill,
                        borderColor: palette.stroke,
                        color: palette.ink,
                      }}
                      title={
                        patient ? `${patientName(patient)} — ${palette.label}` : palette.label
                      }
                    >
                      <span className="block text-xs font-bold">{bed.bedNumber}</span>
                      <span className="block truncate text-[0.5625rem] opacity-80">
                        {patient ? patient.demographics.lastName : palette.label}
                      </span>
                    </button>
                  );
                })}
            </div>
          </div>
        ))}
    </div>
  );
}

/* ───────────────────────────────────────────────────────────────────────── */

function BedDetailModal({
  bed,
  onClose,
  onChanged,
}: {
  bed: Bed | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const can = useAuthStore((s) => s.can);

  const release = useMutation(async () => {
    await api.put(`/beds/${bed!._id}/release`);
    toast.success('Bed released');
    onClose();
    onChanged();
  });

  const setStatus = useMutation(async (status: BedStatus) => {
    await api.put(`/beds/${bed!._id}`, { status });
    toast.success(`Bed marked ${status}`);
    onClose();
    onChanged();
  });

  if (!bed) return null;

  const patient =
    bed.currentPatientId && typeof bed.currentPatientId === 'object'
      ? (bed.currentPatientId as Patient)
      : null;
  const palette = BED_PALETTE[bed.status];

  return (
    <Modal
      open
      onClose={onClose}
      title={`Room ${bed.roomNumber}, bed ${bed.bedNumber}`}
      subtitle={bed.ward}
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          {can('patient:admit') && bed.status === 'occupied' && (
            <Button variant="danger" loading={release.pending} onClick={() => void release.mutate()}>
              Release bed
            </Button>
          )}
          {can('beds:manage') && bed.status === 'available' && (
            <Button
              variant="outline"
              icon={<WrenchScrewdriverIcon className="h-4 w-4" />}
              loading={setStatus.pending}
              onClick={() => void setStatus.mutate('maintenance')}
            >
              Take out of service
            </Button>
          )}
          {can('beds:manage') && bed.status === 'maintenance' && (
            <Button
              variant="success"
              loading={setStatus.pending}
              onClick={() => void setStatus.mutate('available')}
            >
              Return to service
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[0.6875rem] font-medium"
            style={{
              background: palette.fill,
              borderColor: palette.stroke,
              color: palette.ink,
            }}
          >
            {palette.label}
          </span>
          <Badge tone="neutral">{titleCase(bed.type)}</Badge>
        </div>

        {patient ? (
          <div
            className="rounded-xl border p-3.5"
            style={{
              background: 'var(--color-surface-muted)',
              borderColor: 'var(--color-border)',
            }}
          >
            <dl className="grid grid-cols-2 gap-3">
              <KeyValue label="Patient">{patientName(patient)}</KeyValue>
              <KeyValue label="Patient ID">
                <span className="font-mono">{patient.patientId}</span>
              </KeyValue>
            </dl>
            <Link to={`/patients/${patient._id}`} onClick={onClose}>
              <Button size="sm" variant="outline" className="mt-3">
                Open chart
              </Button>
            </Link>
          </div>
        ) : (
          <p className="text-[0.8125rem] leading-relaxed text-muted">
            {bed.status === 'maintenance'
              ? 'This bed is out of service and will not be offered when a patient is admitted.'
              : 'No patient assigned. Beds are allocated automatically when a patient is admitted to this ward.'}
          </p>
        )}

        {bed.features?.length > 0 && (
          <div>
            <p className="eyebrow mb-2">Equipment at the bedside</p>
            <div className="flex flex-wrap gap-1.5">
              {bed.features.map((f) => (
                <Badge key={f} tone="neutral">
                  {f.replace(/_/g, ' ')}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {(release.error || setStatus.error) && (
          <ErrorState message={release.error ?? setStatus.error ?? ''} />
        )}
      </div>
    </Modal>
  );
}

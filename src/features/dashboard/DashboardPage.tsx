import { Link } from 'react-router-dom';
import {
  ArrowRightIcon,
  BeakerIcon,
  BuildingOffice2Icon,
  CalendarDaysIcon,
  ClipboardDocumentCheckIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  HeartIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  LoadingPane,
  PageHeader,
  Table,
  Td,
  Th,
  Tr,
} from '@/components/common';
import { BarCard, FunnelCard, GaugeCard, KpiCard, TrendChart } from '@/components/charts';
import { Markdown } from '@/components/common/Markdown';
import { useApi } from '@/hooks/useApi';
import { useSocketEvent } from '@/hooks/useSocket';
import { useAuthStore } from '@/store/authStore';
import {
  SEVERITY_STYLE,
  fmtDate,
  fmtDayLabel,
  fmtRelative,
  fmtShort,
  patientAge,
  patientName,
  pct,
  titleCase,
} from '@/lib/utils';
import type { Admission, Appointment, DischargePackage, Patient, Severity } from '@/types';
import { StatusPill } from '@/features/discharge/StatusPill';
import { NextActions, WorkflowStrip } from './NextActions';

/**
 * One sentence per role saying what this screen is actually for. The dashboard
 * is the first thing anyone sees, so it should explain itself rather than
 * assume the reader already knows the workflow.
 */
const ROLE_STORY: Record<string, string> = {
  physician:
    'Your patients, the discharges waiting on your signature, and anything the medication agent has flagged as unsafe.',
  nurse:
    'The patients on your ward, whose vitals are due, and the discharge instructions waiting for you to approve.',
  pharmacist:
    'Every medication flag the reconciliation agent raised, worst first. Nothing completes while a critical one is open.',
  care_coordinator:
    'The follow-up appointments each discharge still needs, and the ones already on the calendar.',
  admin:
    'How the whole service is performing — throughput, bed pressure, agent reliability and the audit trail.',
  patient:
    'Your discharge instructions, your medicines and your upcoming appointments, in plain language.',
};

export function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const { data, loading, error, refetch } = useApi<any>('/dashboard');

  useSocketEvent('discharge:status-update', () => void refetch());
  useSocketEvent('discharge:completed', () => void refetch());

  if (loading && !data) return <LoadingPane label="Loading your dashboard" />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;
  if (!data) return null;

  const greeting = new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <>
      <PageHeader
        eyebrow={`${titleCase(user?.role ?? '')} · ${fmtDate(new Date())}`}
        title={`${greeting}, ${user?.firstName}`}
        story={ROLE_STORY[data.role] ?? undefined}
      />

      <WorkflowStrip variant={data.role === 'patient' ? 'patient' : 'staff'} />
      <NextActions data={data} />

      {data.role === 'physician' && <PhysicianDashboard data={data} />}
      {data.role === 'nurse' && <NurseDashboard data={data} />}
      {data.role === 'pharmacist' && <PharmacistDashboard data={data} />}
      {data.role === 'care_coordinator' && <CoordinatorDashboard data={data} />}
      {data.role === 'admin' && <AdminDashboard data={data} />}
      {data.role === 'patient' && <PatientDashboard data={data} />}
    </>
  );
}

// ─── Physician ───────────────────────────────────────────────────────────────

function PhysicianDashboard({ data }: { data: any }) {
  const admissions: Admission[] = data.activePatients ?? [];
  const packages: DischargePackage[] = data.pendingPackages ?? [];
  const appointments: Appointment[] = data.upcomingAppointments ?? [];

  return (
    <div className="space-y-5">

      <div className="stagger grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="My active patients"
          value={admissions.length}
          icon={<UserGroupIcon className="h-6 w-6" />}
        />
        <KpiCard
          label="Discharges awaiting review"
          value={data.allPendingReviews ?? 0}
          tone="warning"
          hint={`${data.pendingReviews ?? 0} of them are mine`}
          icon={<ClipboardDocumentCheckIcon className="h-6 w-6" />}
        />
        <KpiCard
          label="Critical flags open"
          value={data.criticalAlerts?.length ?? 0}
          tone={data.criticalAlerts?.length ? 'danger' : 'success'}
          icon={<ExclamationTriangleIcon className="h-6 w-6" />}
        />
        <KpiCard
          label="Appointments ahead"
          value={appointments.length}
          tone="info"
          icon={<CalendarDaysIcon className="h-6 w-6" />}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title="My active patients"
            subtitle="Patients where you are the attending physician"
            action={
              <Link to="/patients">
                <Button size="sm" variant="ghost" icon={<ArrowRightIcon className="h-4 w-4" />}>
                  All patients
                </Button>
              </Link>
            }
          />
          {admissions.length === 0 ? (
            <EmptyState title="No active patients" detail="You have no inpatients right now." />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Patient</Th>
                  <Th>Diagnosis</Th>
                  <Th>Ward</Th>
                  <Th>Day</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {admissions.map((a) => {
                  const patient = a.patientId as Patient;
                  const day = Math.max(
                    1,
                    Math.round(
                      (Date.now() - new Date(a.admissionDate).getTime()) / 86_400_000
                    )
                  );
                  return (
                    <Tr key={a._id}>
                      <Td>
                        <Link
                          to={`/patients/${patient._id}`}
                          className="font-medium text-primary-700 hover:underline"
                        >
                          {patientName(patient)}
                        </Link>
                        <div className="whitespace-nowrap text-xs text-faint">
                          {patient.patientId} · {patientAge(patient)}y
                        </div>
                      </Td>
                      <Td className="max-w-[220px] truncate text-muted">{a.admittingDiagnosis}</Td>
                      <Td className="text-muted">
                        {a.bed.ward}
                        <div className="whitespace-nowrap text-xs text-faint">
                          {a.bed.roomNumber}-{a.bed.bedNumber}
                        </div>
                      </Td>
                      <Td className="tabular-nums">{day}</Td>
                      <Td>
                        <Badge tone={patient.status === 'discharge_pending' ? 'warning' : 'primary'}>
                          {titleCase(patient.status)}
                        </Badge>
                      </Td>
                    </Tr>
                  );
                })}
              </tbody>
            </Table>
          )}
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader title="Discharge review queue" subtitle="Packages waiting on a clinician" />
            {packages.length === 0 ? (
              <EmptyState title="Queue is clear" />
            ) : (
              <ul className="space-y-2">
                {packages.slice(0, 5).map((p) => (
                  <li key={p._id}>
                    <Link
                      to={`/discharge/${p._id}`}
                      className="block rounded-lg border p-3 transition-colors hover:border-primary-600 hover:bg-[var(--color-primary-50)]"
                      style={{ borderColor: 'var(--color-border)' }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {patientName(p.patientId)}
                          </p>
                          <p className="truncate text-xs text-faint">{p.packageId}</p>
                        </div>
                        <StatusPill status={p.status} />
                      </div>
                      <p className="mt-1.5 text-xs text-muted">
                        {fmtRelative(p.initiatedAt)}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader title="Next appointments" />
            {appointments.length === 0 ? (
              <EmptyState title="Nothing scheduled" />
            ) : (
              <ul className="space-y-2.5">
                {appointments.slice(0, 5).map((a) => (
                  <li key={a._id} className="flex items-start gap-3 text-sm">
                    <span className="w-12 shrink-0 font-mono text-xs text-faint">
                      {a.scheduledTime}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">
                        {patientName(a.patientId as Patient)}
                      </span>
                      <span className="block truncate text-xs text-faint">
                        {fmtDayLabel(a.scheduledDate)} · {a.specialty || titleCase(a.type)}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      {data.admissionsDischargesSeries && (
        <TrendChart
          title="Admissions and discharges"
          subtitle="Last 14 days"
          data={data.admissionsDischargesSeries.map((d: any) => ({
            ...d,
            date: fmtShort(d.date),
          }))}
          xKey="date"
          area
          series={[
            { key: 'admissions', label: 'Admissions', color: '#0891B2' },
            { key: 'discharges', label: 'Discharges', color: '#059669' },
            { key: 'aiPackages', label: 'AI packages started', color: '#6366F1' },
          ]}
        />
      )}
    </div>
  );
}

// ─── Nurse ───────────────────────────────────────────────────────────────────

function NurseDashboard({ data }: { data: any }) {
  const beds = data.wardBeds ?? [];

  return (
    <div className="space-y-5">
      <div className="stagger grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Patients in my care"
          value={data.myPatientCount ?? 0}
          icon={<UserGroupIcon className="h-6 w-6" />}
        />
        <KpiCard
          label="Vitals overdue"
          value={data.vitalsOverdueCount ?? 0}
          tone={data.vitalsOverdueCount ? 'warning' : 'success'}
          hint="More than 4 hours since the last set"
          icon={<HeartIcon className="h-6 w-6" />}
        />
        <KpiCard
          label="Instructions to review"
          value={data.pendingEducationReviews?.length ?? 0}
          tone="info"
          icon={<ClipboardDocumentCheckIcon className="h-6 w-6" />}
        />
        <KpiCard
          label="Admitted today"
          value={data.todaysAdmissions?.length ?? 0}
          icon={<BuildingOffice2Icon className="h-6 w-6" />}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title="Vitals round"
            subtitle="Sorted by time since the last recording"
          />
          {data.vitalsDue?.length === 0 ? (
            <EmptyState title="All patients are up to date" />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Patient</Th>
                  <Th>Room</Th>
                  <Th>Last recorded</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {(data.vitalsDue ?? []).slice(0, 10).map((v: any) => (
                  <Tr key={String(v.admissionId)}>
                    <Td>
                      <Link
                        to={`/patients/${v.patient?._id}`}
                        className="font-medium text-primary-700 hover:underline"
                      >
                        {patientName(v.patient)}
                      </Link>
                      <div className="whitespace-nowrap text-xs text-faint">{v.patient?.patientId}</div>
                    </Td>
                    <Td className="text-muted">
                      {v.ward}
                      <div className="whitespace-nowrap text-xs text-faint">{v.room}</div>
                    </Td>
                    <Td>
                      {v.lastRecorded ? (
                        <span className={v.overdue ? 'font-medium' : 'text-muted'}>
                          {v.hoursSince} h ago
                        </span>
                      ) : (
                        <span className="text-muted">Never</span>
                      )}
                    </Td>
                    <Td>
                      {v.overdue && (
                        <Badge tone="warning" dot>
                          Due
                        </Badge>
                      )}
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>

        <Card>
          <CardHeader
            title="Patient instructions to review"
            subtitle="Generated by the Patient Education Agent"
          />
          {data.pendingEducationReviews?.length === 0 ? (
            <EmptyState title="Nothing waiting" />
          ) : (
            <ul className="space-y-2">
              {(data.pendingEducationReviews ?? []).map((p: DischargePackage) => (
                <li key={p._id}>
                  <Link
                    to={`/discharge/${p._id}`}
                    className="block rounded-lg border p-3 hover:border-primary-600 hover:bg-[var(--color-primary-50)]"
                    style={{ borderColor: 'var(--color-border)' }}
                  >
                    <p className="text-sm font-medium">{patientName(p.patientId)}</p>
                    <p className="whitespace-nowrap text-xs text-faint">{p.packageId}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card>
        <CardHeader
          title="My ward"
          subtitle={`${beds.filter((b: any) => b.status === 'occupied').length} of ${beds.length} beds occupied`}
          action={
            <Link to="/beds">
              <Button size="sm" variant="ghost" icon={<ArrowRightIcon className="h-4 w-4" />}>
                Full bed map
              </Button>
            </Link>
          }
        />
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-8 lg:grid-cols-12">
          {beds.map((bed: any) => (
            <BedTile key={bed._id} bed={bed} />
          ))}
        </div>
      </Card>
    </div>
  );
}

const BED_COLORS: Record<string, { bg: string; color: string }> = {
  available: { bg: 'var(--color-success-light)', color: 'var(--color-success)' },
  occupied: { bg: 'var(--color-info-light)', color: 'var(--color-info)' },
  maintenance: { bg: 'var(--color-surface-muted)', color: 'var(--color-text-tertiary)' },
  reserved: { bg: 'var(--color-warning-light)', color: 'var(--color-warning)' },
};

function BedTile({ bed }: { bed: any }) {
  const palette = BED_COLORS[bed.status] ?? BED_COLORS.maintenance;
  const patient = bed.currentPatientId;
  return (
    <div
      className="rounded-lg px-2 py-1.5 text-center"
      style={{ background: palette.bg, color: palette.color }}
      title={
        patient
          ? `${bed.roomNumber}-${bed.bedNumber} · ${patientName(patient)}`
          : `${bed.roomNumber}-${bed.bedNumber} · ${bed.status}`
      }
    >
      <div className="text-[11px] font-semibold">
        {bed.roomNumber}
        {bed.bedNumber}
      </div>
      <div className="truncate text-[9px] opacity-80">
        {patient ? patientName(patient).split(' ')[1] : titleCase(bed.status)}
      </div>
    </div>
  );
}

// ─── Pharmacist ──────────────────────────────────────────────────────────────

function PharmacistDashboard({ data }: { data: any }) {
  const counts = data.flagCounts ?? { critical: 0, high: 0, medium: 0, low: 0 };
  const flags = data.openFlags ?? [];

  return (
    <div className="space-y-5">
      <div className="stagger grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {(['critical', 'high', 'medium', 'low'] as Severity[]).map((severity) => (
          <Card key={severity} className="relative overflow-hidden">
            <span
              className="absolute inset-y-0 left-0 w-1"
              style={{ background: SEVERITY_STYLE[severity].color }}
            />
            <div className="pl-1">
              <p className="text-xs font-medium uppercase tracking-wide text-faint">
                {severity} flags open
              </p>
              <p
                className="mt-1.5 text-2xl font-bold"
                style={{ color: SEVERITY_STYLE[severity].color }}
              >
                {counts[severity]}
              </p>
            </div>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader
          title="Open medication flags"
          subtitle={`${flags.length} awaiting a pharmacist decision · ${data.resolvedToday ?? 0} resolved today`}
          accent="var(--agent-medication)"
        />
        {flags.length === 0 ? (
          <EmptyState title="Nothing to review" detail="Every flag has been resolved." />
        ) : (
          <ul className="space-y-2.5">
            {flags.slice(0, 12).map((flag: any, i: number) => (
              <li key={`${flag.packageId}-${flag.flagId}-${i}`}>
                <Link
                  to={`/discharge/${flag.packageId}`}
                  className="block rounded-lg border p-3 transition-colors hover:border-primary-600"
                  style={{ borderColor: 'var(--color-border)' }}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      style={{
                        background: SEVERITY_STYLE[flag.severity as Severity].bg,
                        color: SEVERITY_STYLE[flag.severity as Severity].color,
                      }}
                    >
                      {flag.severity}
                    </Badge>
                    <span className="text-sm font-medium">
                      {flag.drugA}
                      {flag.drugB ? ` + ${flag.drugB}` : ''}
                    </span>
                    <span className="whitespace-nowrap text-xs text-faint">{titleCase(flag.type)}</span>
                    <span className="ml-auto text-xs text-muted">{flag.patient}</span>
                  </div>
                  <p className="mt-1.5 line-clamp-2 text-xs text-muted">{flag.description}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

// ─── Care coordinator ────────────────────────────────────────────────────────

function CoordinatorDashboard({ data }: { data: any }) {
  const unscheduled = data.unscheduledFollowUps ?? [];

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard
          label="Follow-ups to book"
          value={unscheduled.length}
          tone={unscheduled.length ? 'warning' : 'success'}
          icon={<CalendarDaysIcon className="h-6 w-6" />}
        />
        <KpiCard
          label="Required and unbooked"
          value={data.requiredUnscheduled ?? 0}
          tone={data.requiredUnscheduled ? 'danger' : 'success'}
          icon={<ClockIcon className="h-6 w-6" />}
        />
        <KpiCard
          label="Active discharge packages"
          value={data.activePackages ?? 0}
          icon={<ClipboardDocumentCheckIcon className="h-6 w-6" />}
        />
      </div>

      <Card>
        <CardHeader
          title="Unscheduled follow-ups"
          subtitle="Recommended by the Follow-Up Planning Agent, awaiting a booking"
          accent="var(--agent-followup)"
        />
        {unscheduled.length === 0 ? (
          <EmptyState title="Everything is booked" />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Patient</Th>
                <Th>Recommendation</Th>
                <Th>Specialty</Th>
                <Th>Due</Th>
                <Th>Priority</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {unscheduled.map((rec: any) => (
                <Tr key={`${rec.packageId}-${rec.recommendationId}`}>
                  <Td className="font-medium">{rec.patient}</Td>
                  <Td className="max-w-[320px] text-muted">{rec.description}</Td>
                  <Td>{rec.specialty || '—'}</Td>
                  <Td className="whitespace-nowrap text-muted">{rec.timeframe}</Td>
                  <Td>
                    <Badge
                      tone={
                        rec.priority === 'required'
                          ? 'danger'
                          : rec.priority === 'recommended'
                            ? 'warning'
                            : 'neutral'
                      }
                    >
                      {rec.priority}
                    </Badge>
                  </Td>
                  <Td>
                    <Link to={`/discharge/${rec.packageId}`}>
                      <Button size="sm" variant="outline">
                        Book
                      </Button>
                    </Link>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <Card>
        <CardHeader title="Upcoming appointments" />
        {data.upcomingAppointments?.length === 0 ? (
          <EmptyState title="Nothing scheduled" />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>When</Th>
                <Th>Patient</Th>
                <Th>Doctor</Th>
                <Th>Specialty</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {(data.upcomingAppointments ?? []).slice(0, 10).map((a: any) => (
                <Tr key={a._id}>
                  <Td className="whitespace-nowrap">
                    {fmtDayLabel(a.scheduledDate)}
                    <span className="ml-2 font-mono text-xs text-faint">{a.scheduledTime}</span>
                  </Td>
                  <Td className="font-medium">{patientName(a.patientId)}</Td>
                  <Td className="text-muted">
                    Dr. {a.doctorId?.firstName} {a.doctorId?.lastName}
                  </Td>
                  <Td className="text-muted">{a.specialty || titleCase(a.type)}</Td>
                  <Td>
                    <Badge tone={a.status === 'confirmed' ? 'success' : 'info'}>{a.status}</Badge>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}

// ─── Admin ───────────────────────────────────────────────────────────────────

function AdminDashboard({ data }: { data: any }) {
  const k = data.kpis ?? {};

  return (
    <div className="space-y-5">
      <div className="stagger grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Bed occupancy"
          value={pct(k.bedOccupancyPct ?? 0)}
          hint={`${k.bedsOccupied}/${k.bedsTotal} beds · ${k.bedsAvailable} free`}
          tone="primary"
        />
        <KpiCard
          label="Avg discharge preparation"
          value={(k.avgPrepHours ?? 0).toFixed(1)}
          unit="h"
          hint={`Manual baseline ${k.baselinePrepHours} h`}
          delta={k.timeSavedPct ? { value: k.timeSavedPct, goodWhen: 'up' } : undefined}
          tone="success"
        />
        <KpiCard
          label="30-day readmission"
          value={pct(k.readmissionRatePct ?? 0)}
          tone={(k.readmissionRatePct ?? 0) > 15 ? 'danger' : 'success'}
        />
        <KpiCard
          label="Medication flags raised"
          value={k.flagsRaised ?? 0}
          hint={`${k.flagsCritical ?? 0} critical · ${k.flagsResolved ?? 0} resolved`}
          tone="warning"
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <FunnelCard
          title="Discharge pipeline"
          subtitle="Where packages are right now"
          stages={data.funnel ?? []}
        />
        <GaugeCard
          title="Preparation time saved"
          subtitle="Against the 3.2 h manual baseline"
          value={k.timeSavedPct ?? 0}
          color="#059669"
          caption={`${(k.avgPrepHours ?? 0).toFixed(1)} h average with the agents`}
        />
        <GaugeCard
          title="Bed occupancy"
          subtitle="Hospital-wide"
          value={k.bedOccupancyPct ?? 0}
          color="#0891B2"
          caption={`${k.activeAdmissions} active admissions`}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <TrendChart
          title="Admissions and discharges"
          subtitle="Last 30 days"
          data={(data.volumeSeries ?? []).map((d: any) => ({ ...d, date: fmtShort(d.date) }))}
          xKey="date"
          area
          series={[
            { key: 'admissions', label: 'Admissions', color: '#0891B2' },
            { key: 'discharges', label: 'Discharges', color: '#059669' },
          ]}
        />
        <BarCard
          title="Ward occupancy"
          subtitle="Beds by status"
          data={data.wardOccupancy ?? []}
          xKey="ward"
          horizontal
          stacked
          series={[
            { key: 'occupied', label: 'Occupied', color: '#0891B2' },
            { key: 'available', label: 'Available', color: '#059669' },
            { key: 'reserved', label: 'Reserved', color: '#D97706' },
            { key: 'maintenance', label: 'Maintenance', color: '#94A3B8' },
          ]}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <BarCard
          title="Agent acceptance rate"
          subtitle="How often clinicians approve an agent's draft without changing it"
          data={data.agentPerformance ?? []}
          xKey="agent"
          horizontal
          suffix="%"
          series={[{ key: 'acceptedPct', label: 'Accepted', color: '#059669' }]}
        />
        <Card>
          <CardHeader title="Clinician workload" subtitle="Active inpatients per attending" />
          {(data.staffWorkload ?? []).length === 0 ? (
            <EmptyState title="No active admissions" />
          ) : (
            <ul className="space-y-2.5">
              {(data.staffWorkload ?? []).map((row: any) => {
                const max = Math.max(...data.staffWorkload.map((r: any) => r.patients), 1);
                return (
                  <li key={row.name}>
                    <div className="mb-1 flex justify-between text-xs">
                      <span className="font-medium">{row.name}</span>
                      <span className="text-muted">{row.patients}</span>
                    </div>
                    <div
                      className="h-2 overflow-hidden rounded-full"
                      style={{ background: 'var(--color-surface-muted)' }}
                    >
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${(row.patients / max) * 100}%`,
                          background: 'var(--color-primary)',
                        }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

// ─── Patient portal ──────────────────────────────────────────────────────────

function PatientDashboard({ data }: { data: any }) {
  const patient: Patient | null = data.patient;
  const appointments: Appointment[] = data.appointments ?? [];

  if (!patient) {
    return <EmptyState title="No record linked to this account" />;
  }

  return (
    <div className="space-y-5">
      <Card>
        <div className="flex flex-wrap items-center gap-4">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-full text-lg font-semibold text-white"
            style={{ background: 'var(--color-primary)' }}
          >
            {patient.demographics.firstName[0]}
            {patient.demographics.lastName[0]}
          </div>
          <div className="min-w-0 flex-1">
            <h2>{patientName(patient)}</h2>
            <p className="text-sm text-muted">
              {patient.patientId} · {patientAge(patient)} years old
            </p>
          </div>
          <Badge tone={patient.status === 'discharged' ? 'success' : 'primary'}>
            {titleCase(patient.status)}
          </Badge>
        </div>

        {data.admission && (
          <div
            className="mt-4 rounded-lg p-3 text-sm"
            style={{ background: 'var(--color-primary-50)' }}
          >
            <p className="font-medium">{data.admission.admittingDiagnosis}</p>
            <p className="mt-0.5 text-xs text-muted">
              Admitted {fmtDate(data.admission.admissionDate)} · Under the care of Dr.{' '}
              {data.admission.careTeam?.attendingPhysician?.firstName}{' '}
              {data.admission.careTeam?.attendingPhysician?.lastName}
            </p>
          </div>
        )}
      </Card>

      <Card>
        <CardHeader title="Your appointments" />
        {appointments.length === 0 ? (
          <EmptyState title="No upcoming appointments" />
        ) : (
          <ul className="space-y-2.5">
            {appointments.map((a) => (
              <li
                key={a._id}
                className="flex items-center gap-4 rounded-lg border p-3"
                style={{ borderColor: 'var(--color-border)' }}
              >
                <div className="text-center">
                  <div className="text-xs font-semibold uppercase text-faint">
                    {fmtShort(a.scheduledDate)}
                  </div>
                  <div className="font-mono text-sm">{a.scheduledTime}</div>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {a.specialty || titleCase(a.type)}
                  </p>
                  <p className="truncate text-xs text-muted">
                    {a.location || 'Location to be confirmed'} · {a.reason}
                  </p>
                </div>
                <Badge tone={a.status === 'confirmed' ? 'success' : 'info'}>{a.status}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader
          title="Your going-home instructions"
          subtitle="Shown once a nurse or doctor has approved them"
          accent="var(--agent-education)"
        />
        {data.instructions ? (
          <Markdown content={data.instructions} />
        ) : (
          <EmptyState
            title="Not ready yet"
            detail={
              data.dischargeStatus
                ? `Your discharge package is ${titleCase(data.dischargeStatus)}. Your care team is still reviewing it.`
                : 'Your care team will prepare these when it is time for you to go home.'
            }
            icon={<BeakerIcon className="h-8 w-8" />}
          />
        )}
      </Card>
    </div>
  );
}

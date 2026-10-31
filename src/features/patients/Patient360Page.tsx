import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeftIcon, ExclamationTriangleIcon, PlusIcon } from '@heroicons/react/24/outline';
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  LoadingPane,
  Table,
  Tabs,
  Td,
  Th,
  Tr,
} from '@/components/common';
import { useApi } from '@/hooks/useApi';
import { useSocketEvent, useSocketRoom } from '@/hooks/useSocket';
import { rooms } from '@/lib/socket';
import { useAuthStore } from '@/store/authStore';
import { fmtDate, fmtDateTime, patientAge, patientName, titleCase } from '@/lib/utils';
import type {
  Admission,
  Appointment,
  DischargePackage,
  MedicationList,
  Patient,
  Vital,
} from '@/types';
import { VitalsTab } from '@/features/vitals/VitalsTab';
import { MedComparison } from '@/features/medications/MedComparison';
import { NotesTab } from './tabs/NotesTab';
import { OverviewTab } from './tabs/OverviewTab';
import { StatusPill } from '@/features/discharge/StatusPill';
import { InitiateDischargeModal } from '@/features/discharge/InitiateDischargeModal';

type TabKey =
  | 'overview'
  | 'vitals'
  | 'medications'
  | 'labs'
  | 'notes'
  | 'appointments'
  | 'discharge'
  | 'history';

interface PatientBundle {
  patient: Patient;
  admissions: Admission[];
  activeAdmission: Admission | null;
  vitals: Vital[];
  appointments: Appointment[];
  medications: MedicationList[];
  dischargePackages: DischargePackage[];
}

export function Patient360Page() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const can = useAuthStore((s) => s.can);
  const [tab, setTab] = useState<TabKey>('overview');
  const [initiating, setInitiating] = useState(false);

  const { data, loading, error, refetch } = useApi<PatientBundle>(id ? `/patients/${id}` : null);

  useSocketRoom(id ? rooms.patient(id) : null);
  useSocketEvent('vitals:recorded', () => void refetch());

  if (loading && !data) return <LoadingPane label="Loading the patient record" />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;
  if (!data) return null;

  const { patient, activeAdmission, admissions, vitals, appointments, medications } = data;
  const allergies = patient.medicalHistory?.allergies ?? [];
  const severeAllergies = allergies.filter(
    (a) => a.severity === 'severe' || a.severity === 'life-threatening'
  );
  const activePackage = data.dischargePackages.find((p) => p.status !== 'completed');

  const byType = (t: string) =>
    medications.find((m) => m.listType === t)?.medications ?? [];

  const TABS: { key: TabKey; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'vitals', label: 'Vitals' },
    { key: 'medications', label: 'Medications' },
    { key: 'labs', label: 'Labs' },
    { key: 'notes', label: 'Notes' },
    { key: 'appointments', label: 'Appointments' },
    { key: 'discharge', label: 'Discharge' },
    { key: 'history', label: 'History' },
  ];

  return (
    <>
      <Link
        to="/app/patients"
        className="mb-4 inline-flex items-center gap-1.5 text-xs font-medium text-muted transition-colors hover:text-[var(--color-primary)]"
      >
        <ArrowLeftIcon className="h-3.5 w-3.5" />
        Back to patients
      </Link>

      {/* One identity block. The page header used to repeat the name and ID
          that the banner below it already carried. */}
      <Card className="mb-5 animate-rise">
        <div className="flex flex-wrap items-start gap-5">
          <Avatar name={patientName(patient)} size={60} />

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="truncate text-xl">{patientName(patient)}</h1>
              <Badge
                tone={
                  patient.status === 'discharge_pending'
                    ? 'warning'
                    : patient.status === 'discharged'
                      ? 'success'
                      : 'primary'
                }
                dot={patient.status === 'discharge_pending'}
              >
                {titleCase(patient.status)}
              </Badge>
            </div>
            <p className="mt-1 text-[0.8125rem] text-muted">
              <span className="font-mono">{patient.patientId}</span> · {patientAge(patient)} years ·{' '}
              {titleCase(patient.demographics.gender)} · blood group{' '}
              {patient.demographics.bloodType}
            </p>

            <dl className="mt-4 grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
              <Fact label="Ward">
                {activeAdmission
                  ? `${activeAdmission.bed.ward} · ${activeAdmission.bed.roomNumber}-${activeAdmission.bed.bedNumber}`
                  : 'Not admitted'}
              </Fact>
              <Fact label="Attending">
                {activeAdmission && typeof activeAdmission.careTeam.attendingPhysician === 'object'
                  ? `Dr. ${(activeAdmission.careTeam.attendingPhysician as any).firstName} ${(activeAdmission.careTeam.attendingPhysician as any).lastName}`
                  : '—'}
              </Fact>
              <Fact label="Admitted">
                {activeAdmission ? fmtDate(activeAdmission.admissionDate) : '—'}
              </Fact>
            </dl>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {can('discharge:initiate') && activeAdmission && !activePackage && (
              <Button onClick={() => setInitiating(true)}>Initiate discharge</Button>
            )}
            {activePackage && (
              <Link to={`/app/discharge/${activePackage._id}`}>
                <Button variant="outline">Open discharge package</Button>
              </Link>
            )}
          </div>
        </div>

        {severeAllergies.length > 0 && (
          <div
            className="mt-4 flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2"
            style={{
              background: 'var(--color-danger-light)',
              borderColor: 'var(--color-danger-border)',
            }}
          >
            <ExclamationTriangleIcon
              className="h-4 w-4 shrink-0"
              style={{ color: 'var(--color-danger)' }}
            />
            <span className="text-xs font-semibold" style={{ color: 'var(--color-danger)' }}>
              Allergies:
            </span>
            {severeAllergies.map((a) => (
              <span key={a.substance} className="text-xs" style={{ color: 'var(--color-danger)' }}>
                <strong>{a.substance}</strong>
                {a.reaction ? ` — ${a.reaction}` : ''} ({a.severity})
              </span>
            ))}
          </div>
        )}
      </Card>

      <div className="mb-5">
        <Tabs tabs={TABS} active={tab} onChange={setTab} />
      </div>

      {tab === 'overview' && <OverviewTab bundle={data} />}

      {tab === 'vitals' && (
        <VitalsTab
          patientId={patient._id}
          admissionId={activeAdmission?._id ?? null}
          vitals={vitals}
          onRecorded={refetch}
        />
      )}

      {tab === 'medications' && (
        <Card>
          <CardHeader
            title="Medication reconciliation view"
            subtitle="Home list, inpatient list and the discharge list side by side"
            accent="var(--agent-medication)"
          />
          <MedComparison
            preAdmission={byType('pre_admission')}
            inpatient={byType('inpatient')}
            discharge={byType('discharge')}
            flags={activePackage?.medicationReconciliation?.flags ?? []}
          />
        </Card>
      )}

      {tab === 'labs' && <LabsTab admission={activeAdmission} admissions={admissions} />}

      {tab === 'notes' && (
        <NotesTab admission={activeAdmission} onChanged={refetch} />
      )}

      {tab === 'appointments' && (
        <Card padded={false}>
          <div className="p-5 pb-0">
            <CardHeader
              title="Appointments"
              subtitle={`${appointments.length} on record`}
              action={
                can('appointment:schedule') && (
                  <Button
                    size="sm"
                    icon={<PlusIcon className="h-4 w-4" />}
                    onClick={() => navigate(`/app/scheduling?patient=${patient._id}`)}
                  >
                    Schedule
                  </Button>
                )
              }
            />
          </div>
          {appointments.length === 0 ? (
            <EmptyState title="No appointments" />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Date</Th>
                  <Th>Time</Th>
                  <Th>Type</Th>
                  <Th>Specialty</Th>
                  <Th>Clinician</Th>
                  <Th>Location</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {appointments.map((a) => (
                  <Tr key={a._id}>
                    <Td className="whitespace-nowrap">{fmtDate(a.scheduledDate)}</Td>
                    <Td className="font-mono text-xs">{a.scheduledTime}</Td>
                    <Td>{titleCase(a.type)}</Td>
                    <Td className="text-muted">{a.specialty || '—'}</Td>
                    <Td className="text-muted">
                      {typeof a.doctorId === 'object'
                        ? `Dr. ${(a.doctorId as any).firstName} ${(a.doctorId as any).lastName}`
                        : '—'}
                    </Td>
                    <Td className="text-muted">{a.location || '—'}</Td>
                    <Td>
                      <Badge
                        tone={
                          a.status === 'completed'
                            ? 'success'
                            : a.status === 'cancelled' || a.status === 'no_show'
                              ? 'danger'
                              : a.status === 'confirmed'
                                ? 'info'
                                : 'neutral'
                        }
                      >
                        {titleCase(a.status)}
                      </Badge>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      )}

      {tab === 'discharge' && (
        <Card padded={false}>
          <div className="p-5 pb-0">
            <CardHeader title="Discharge packages" subtitle="This patient's AI-prepared packages" />
          </div>
          {data.dischargePackages.length === 0 ? (
            <EmptyState
              title="No discharge package yet"
              detail={
                activeAdmission
                  ? 'A physician starts the agent pipeline from here.'
                  : 'The patient is not currently admitted.'
              }
              action={
                can('discharge:initiate') && activeAdmission ? (
                  <Button onClick={() => setInitiating(true)}>Initiate discharge</Button>
                ) : undefined
              }
            />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Package</Th>
                  <Th>Status</Th>
                  <Th>Flags</Th>
                  <Th>Initiated</Th>
                  <Th>Completed</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {data.dischargePackages.map((p) => (
                  <Tr key={p._id} onClick={() => navigate(`/app/discharge/${p._id}`)}>
                    <Td className="font-mono text-xs">{p.packageId}</Td>
                    <Td>
                      <StatusPill status={p.status} />
                    </Td>
                    <Td>{p.medicationReconciliation?.flags?.length ?? 0}</Td>
                    <Td className="whitespace-nowrap text-muted">{fmtDateTime(p.initiatedAt)}</Td>
                    <Td className="whitespace-nowrap text-muted">
                      {p.completedAt ? fmtDateTime(p.completedAt) : '—'}
                    </Td>
                    <Td>
                      <Link to={`/app/discharge/${p._id}`} onClick={(e) => e.stopPropagation()}>
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
      )}

      {tab === 'history' && <HistoryTab admissions={admissions} patientId={patient._id} />}

      <InitiateDischargeModal
        open={initiating}
        onClose={() => setInitiating(false)}
        admissionId={activeAdmission?._id}
        onCreated={(pkgId) => navigate(`/app/discharge/${pkgId}`)}
      />
    </>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[0.6875rem] font-medium uppercase tracking-[0.05em] text-[var(--color-text-tertiary)]">
        {label}
      </dt>
      <dd className="mt-0.5 truncate text-[0.8125rem] font-medium">{children}</dd>
    </div>
  );
}

function LabsTab({
  admission,
  admissions,
}: {
  admission: Admission | null;
  admissions: Admission[];
}) {
  const source = admission ?? admissions[0] ?? null;
  const labs = source?.labResults ?? [];

  return (
    <Card padded={false}>
      <div className="p-5 pb-0">
        <CardHeader
          title="Laboratory results"
          subtitle={
            source
              ? `${source.admissionId} · abnormal values are highlighted`
              : 'No admission on record'
          }
        />
      </div>
      {labs.length === 0 ? (
        <EmptyState title="No laboratory results recorded" />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Test</Th>
              <Th>Result</Th>
              <Th>Reference range</Th>
              <Th>Resulted</Th>
              <Th>Flag</Th>
            </tr>
          </thead>
          <tbody>
            {[...labs]
              .sort(
                (a, b) => new Date(b.resultDate).getTime() - new Date(a.resultDate).getTime()
              )
              .map((lab) => (
                <Tr key={lab._id}>
                  <Td className="font-medium">{lab.testName}</Td>
                  <Td>
                    <span
                      className="font-mono"
                      style={{ color: lab.isAbnormal ? 'var(--color-danger)' : undefined }}
                    >
                      {lab.value} {lab.unit}
                    </span>
                  </Td>
                  <Td className="font-mono text-xs text-muted">{lab.referenceRange || '—'}</Td>
                  <Td className="whitespace-nowrap text-muted">{fmtDateTime(lab.resultDate)}</Td>
                  <Td>
                    {lab.isAbnormal ? (
                      <Badge tone="danger">Abnormal</Badge>
                    ) : (
                      <Badge tone="success">Normal</Badge>
                    )}
                  </Td>
                </Tr>
              ))}
          </tbody>
        </Table>
      )}
    </Card>
  );
}

function HistoryTab({
  admissions,
  patientId,
}: {
  admissions: Admission[];
  patientId: string;
}) {
  const { data } = useApi<{ timeline: any[] }>(`/patients/${patientId}/timeline`);
  const past = admissions.filter((a) => a.status === 'discharged');

  // A readmission is an admission that began within 30 days of a prior discharge.
  const readmissions = past.filter((a, i) => {
    const prior = past[i - 1];
    if (!prior?.actualDischargeDate) return false;
    return (
      new Date(a.admissionDate).getTime() - new Date(prior.actualDischargeDate).getTime() <=
      30 * 86_400_000
    );
  });

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card padded={false}>
        <div className="p-5 pb-0">
          <CardHeader
            title="Previous admissions"
            subtitle={
              readmissions.length
                ? `${readmissions.length} readmission within 30 days`
                : `${past.length} completed`
            }
          />
        </div>
        {past.length === 0 ? (
          <EmptyState title="No previous admissions" />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Admission</Th>
                <Th>Diagnosis</Th>
                <Th>Dates</Th>
                <Th>Stay</Th>
              </tr>
            </thead>
            <tbody>
              {past.map((a) => {
                const days = a.actualDischargeDate
                  ? Math.max(
                      1,
                      Math.round(
                        (new Date(a.actualDischargeDate).getTime() -
                          new Date(a.admissionDate).getTime()) /
                          86_400_000
                      )
                    )
                  : null;
                const isReadmit = readmissions.some((r) => r._id === a._id);
                return (
                  <Tr key={a._id}>
                    <Td className="font-mono text-xs">
                      {a.admissionId}
                      {isReadmit && (
                        <Badge tone="danger" className="ml-2">
                          Readmission
                        </Badge>
                      )}
                    </Td>
                    <Td className="text-muted">{a.admittingDiagnosis}</Td>
                    <Td className="whitespace-nowrap text-xs text-muted">
                      {fmtDate(a.admissionDate)} → {fmtDate(a.actualDischargeDate)}
                    </Td>
                    <Td className="tabular-nums">{days ? `${days} d` : '—'}</Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>

      <Card>
        <CardHeader title="Timeline" subtitle="Everything recorded for this patient" />
        {!data?.timeline?.length ? (
          <EmptyState title="Nothing recorded yet" />
        ) : (
          <ol className="relative space-y-4 pl-5">
            <span
              className="absolute bottom-2 left-[5px] top-2 w-px"
              style={{ background: 'var(--color-border)' }}
              aria-hidden
            />
            {data.timeline.slice(0, 40).map((entry, i) => (
              <li key={i} className="relative">
                <span
                  className="absolute -left-5 top-1.5 h-2.5 w-2.5 rounded-full ring-2"
                  style={{
                    background: 'var(--color-surface)',
                    borderColor: 'var(--color-primary)',
                    boxShadow: '0 0 0 2px var(--color-primary)',
                  }}
                  aria-hidden
                />
                <p className="text-sm font-medium">{entry.title}</p>
                {entry.detail && <p className="text-xs text-muted">{entry.detail}</p>}
                <p className="text-[11px] text-faint">{fmtDateTime(entry.at)}</p>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </div>
  );
}

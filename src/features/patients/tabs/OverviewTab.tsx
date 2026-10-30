import { Badge, Card, CardHeader, EmptyState } from '@/components/common';
import {
  VITAL_RANGES,
  fmtDate,
  fmtRelative,
  isVitalAbnormal,
  titleCase,
} from '@/lib/utils';
import type { Admission, Appointment, MedicationList, Patient, Vital } from '@/types';

const RISK_TONE = { low: 'success', moderate: 'warning', high: 'danger' } as const;

export function OverviewTab({
  bundle,
}: {
  bundle: {
    patient: Patient;
    activeAdmission: Admission | null;
    vitals: Vital[];
    medications: MedicationList[];
    appointments: Appointment[];
  };
}) {
  const { patient, activeAdmission, vitals, medications, appointments } = bundle;
  const latest = vitals[0];
  const activeMeds =
    medications.find((m) => m.listType === 'inpatient')?.medications ??
    medications.find((m) => m.listType === 'pre_admission')?.medications ??
    [];

  const upcoming = appointments
    .filter((a) => new Date(a.scheduledDate) >= new Date() && a.status !== 'cancelled')
    .slice(0, 4);

  const team = activeAdmission?.careTeam;
  const person = (p: unknown) =>
    p && typeof p === 'object' ? `${(p as any).firstName} ${(p as any).lastName}` : null;

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader title="Current admission" />
        {!activeAdmission ? (
          <EmptyState title="Not currently admitted" detail={`Status: ${titleCase(patient.status)}`} />
        ) : (
          <div className="space-y-4">
            <div>
              <p className="text-lg font-semibold">{activeAdmission.admittingDiagnosis}</p>
              <p className="mt-0.5 text-xs text-muted">
                {activeAdmission.diagnosisCodes.join(', ') || 'Not coded'} ·{' '}
                {activeAdmission.admissionId} · admitted {fmtDate(activeAdmission.admissionDate)}
                {activeAdmission.expectedDischargeDate &&
                  ` · expected discharge ${fmtDate(activeAdmission.expectedDischargeDate)}`}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <RiskTile
                label="Fall risk"
                level={activeAdmission.riskAssessment.fallRisk}
              />
              <RiskTile
                label="Pressure injury risk"
                level={activeAdmission.riskAssessment.pressureInjuryRisk}
              />
              <div
                className="rounded-lg px-3 py-2"
                style={{ background: 'var(--color-surface-muted)' }}
              >
                <p className="text-[11px] font-medium uppercase tracking-wide text-faint">
                  Infection flags
                </p>
                <p className="mt-0.5 text-sm font-medium">
                  {activeAdmission.riskAssessment.infectionFlags.length
                    ? activeAdmission.riskAssessment.infectionFlags.map(titleCase).join(', ')
                    : 'None'}
                </p>
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-faint">
                Care team
              </p>
              <div className="flex flex-wrap gap-2">
                {person(team?.attendingPhysician) && (
                  <Badge tone="primary">Dr. {person(team?.attendingPhysician)} · attending</Badge>
                )}
                {(team?.nurses ?? []).map((n, i) => (
                  <Badge key={i} tone="info">
                    {person(n)} · nurse
                  </Badge>
                ))}
                {person(team?.pharmacist) && (
                  <Badge tone="purple">{person(team?.pharmacist)} · pharmacist</Badge>
                )}
                {person(team?.careCoordinator) && (
                  <Badge tone="success">{person(team?.careCoordinator)} · coordinator</Badge>
                )}
              </div>
            </div>
          </div>
        )}
      </Card>

      <Card>
        <CardHeader
          title="Latest observations"
          subtitle={latest ? fmtRelative(latest.timestamp) : 'None recorded'}
        />
        {!latest ? (
          <EmptyState title="No vitals recorded" />
        ) : (
          <dl className="space-y-2">
            <VitalRow
              label="Blood pressure"
              value={`${latest.bloodPressureSystolic}/${latest.bloodPressureDiastolic}`}
              unit="mmHg"
              abnormal={
                isVitalAbnormal('bloodPressureSystolic', latest.bloodPressureSystolic) ||
                isVitalAbnormal('bloodPressureDiastolic', latest.bloodPressureDiastolic)
              }
            />
            {(
              [
                ['heartRate', latest.heartRate],
                ['temperature', latest.temperature],
                ['respiratoryRate', latest.respiratoryRate],
                ['oxygenSaturation', latest.oxygenSaturation],
              ] as const
            ).map(([key, value]) => (
              <VitalRow
                key={key}
                label={VITAL_RANGES[key].label}
                value={String(value)}
                unit={VITAL_RANGES[key].unit}
                abnormal={isVitalAbnormal(key, value)}
              />
            ))}
            <VitalRow label="Pain score" value={`${latest.painScore}`} unit="/ 10" abnormal={latest.painScore >= 7} />
          </dl>
        )}
      </Card>

      <Card>
        <CardHeader
          title="Allergies"
          subtitle={`${patient.medicalHistory?.allergies?.length ?? 0} on file`}
        />
        {!patient.medicalHistory?.allergies?.length ? (
          <p className="text-sm text-muted">No known drug allergies.</p>
        ) : (
          <ul className="space-y-2">
            {patient.medicalHistory.allergies.map((a) => (
              <li key={a.substance} className="flex items-start justify-between gap-3">
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{a.substance}</span>
                  {a.reaction && <span className="block text-xs text-muted">{a.reaction}</span>}
                </span>
                <Badge
                  tone={
                    a.severity === 'life-threatening' || a.severity === 'severe'
                      ? 'danger'
                      : a.severity === 'moderate'
                        ? 'warning'
                        : 'neutral'
                  }
                >
                  {a.severity}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader title="Conditions" subtitle="Documented medical history" />
        {!patient.medicalHistory?.conditions?.length ? (
          <p className="text-sm text-muted">None recorded.</p>
        ) : (
          <ul className="space-y-1.5">
            {patient.medicalHistory.conditions.map((c) => (
              <li key={c} className="text-sm">
                • {c}
              </li>
            ))}
          </ul>
        )}
        {patient.medicalHistory?.surgeries?.length > 0 && (
          <>
            <p className="mb-1.5 mt-4 text-xs font-semibold uppercase tracking-wide text-faint">
              Past surgery
            </p>
            <ul className="space-y-1">
              {patient.medicalHistory.surgeries.map((s, i) => (
                <li key={i} className="text-xs text-muted">
                  {s.name} — {fmtDate(s.date)}
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>

      <Card>
        <CardHeader title="Active medications" subtitle={`${activeMeds.length} on the current list`} />
        {activeMeds.length === 0 ? (
          <p className="text-sm text-muted">No medications recorded.</p>
        ) : (
          <ul className="space-y-1.5">
            {activeMeds.slice(0, 8).map((m, i) => (
              <li key={i} className="flex items-baseline justify-between gap-3 text-sm">
                <span className="truncate font-medium">{m.drugName}</span>
                <span className="shrink-0 text-xs text-muted">
                  {m.dosage} {m.frequency}
                </span>
              </li>
            ))}
            {activeMeds.length > 8 && (
              <li className="text-xs text-faint">+ {activeMeds.length - 8} more</li>
            )}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader title="Contact and cover" />
        <dl className="space-y-2 text-sm">
          <Row label="Phone" value={patient.demographics.phone || '—'} />
          <Row label="Email" value={patient.demographics.email || '—'} />
          <Row label="Language" value={patient.demographics.preferredLanguage} />
          <Row label="Literacy" value={titleCase(patient.demographics.literacyLevel)} />
          <Row label="Insurer" value={patient.insurance?.provider || '—'} />
          <Row
            label="Verified"
            value={patient.insurance?.isVerified ? 'Yes' : 'Not verified'}
          />
          <Row label="PCP" value={patient.primaryCarePhysician?.name || '—'} />
        </dl>

        {patient.emergencyContacts?.length > 0 && (
          <>
            <p className="mb-1.5 mt-4 text-xs font-semibold uppercase tracking-wide text-faint">
              Emergency contacts
            </p>
            <ul className="space-y-1">
              {patient.emergencyContacts.map((c, i) => (
                <li key={i} className="text-xs text-muted">
                  {c.name} ({c.relationship}) — {c.phone}
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>

      {upcoming.length > 0 && (
        <Card>
          <CardHeader title="Next appointments" />
          <ul className="space-y-2">
            {upcoming.map((a) => (
              <li key={a._id} className="flex items-baseline justify-between gap-3 text-sm">
                <span className="truncate">{a.specialty || titleCase(a.type)}</span>
                <span className="shrink-0 text-xs text-muted">
                  {fmtDate(a.scheduledDate)} {a.scheduledTime}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function RiskTile({ label, level }: { label: string; level: 'low' | 'moderate' | 'high' }) {
  return (
    <div className="rounded-lg px-3 py-2" style={{ background: 'var(--color-surface-muted)' }}>
      <p className="text-[11px] font-medium uppercase tracking-wide text-faint">{label}</p>
      <div className="mt-1">
        <Badge tone={RISK_TONE[level]}>{titleCase(level)}</Badge>
      </div>
    </div>
  );
}

function VitalRow({
  label,
  value,
  unit,
  abnormal,
}: {
  label: string;
  value: string;
  unit: string;
  abnormal?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-xs text-muted">{label}</dt>
      <dd
        className="font-mono text-sm font-medium"
        style={{ color: abnormal ? 'var(--color-danger)' : undefined }}
      >
        {value}
        <span className="ml-1 text-xs font-normal text-faint">{unit}</span>
      </dd>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="truncate text-right font-medium">{value}</dd>
    </div>
  );
}

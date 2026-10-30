import { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Checkbox,
  ErrorState,
  Field,
  Input,
  Modal,
  Select,
} from '@/components/common';
import { api } from '@/lib/api';
import { useApi, useMutation } from '@/hooks/useApi';
import { useDebounce } from '@/hooks/useDebounce';
import { toast } from '@/store/notificationStore';
import { cn, patientAge, patientName } from '@/lib/utils';
import type { Bed, Patient, User } from '@/types';

/** A small ICD-10 lookup covering the diagnoses this demo understands. */
const ICD10 = [
  { code: 'I50.23', label: 'Acute on chronic systolic heart failure' },
  { code: 'I50.9', label: 'Heart failure, unspecified' },
  { code: 'I48.91', label: 'Atrial fibrillation, unspecified' },
  { code: 'I21.4', label: 'Non-ST elevation myocardial infarction' },
  { code: 'J18.1', label: 'Lobar pneumonia' },
  { code: 'J18.9', label: 'Pneumonia, unspecified organism' },
  { code: 'J44.1', label: 'COPD with acute exacerbation' },
  { code: 'J45.901', label: 'Unspecified asthma with exacerbation' },
  { code: 'E11.10', label: 'Type 2 diabetes with ketoacidosis' },
  { code: 'E11.65', label: 'Type 2 diabetes with hyperglycaemia' },
  { code: 'N17.9', label: 'Acute kidney failure, unspecified' },
  { code: 'N18.3', label: 'Chronic kidney disease, stage 3' },
  { code: 'N10', label: 'Acute pyelonephritis' },
  { code: 'N39.0', label: 'Urinary tract infection' },
  { code: 'A41.51', label: 'Sepsis due to Escherichia coli' },
  { code: 'K92.2', label: 'Gastrointestinal haemorrhage, unspecified' },
  { code: 'K57.32', label: 'Diverticulitis of large intestine' },
  { code: 'Z96.641', label: 'Presence of right artificial hip joint' },
  { code: 'Z96.651', label: 'Presence of right artificial knee joint' },
  { code: 'M16.11', label: 'Unilateral primary osteoarthritis, right hip' },
  { code: 'L03.116', label: 'Cellulitis of left lower limb' },
  { code: 'G45.9', label: 'Transient cerebral ischaemic attack' },
  { code: 'R55', label: 'Syncope and collapse' },
];

export function NewAdmissionModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [patientId, setPatientId] = useState('');
  const [search, setSearch] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [codes, setCodes] = useState<string[]>([]);
  const [codeQuery, setCodeQuery] = useState('');
  const [bedId, setBedId] = useState('');
  const [attending, setAttending] = useState('');
  const [nurses, setNurses] = useState<string[]>([]);
  const [pharmacist, setPharmacist] = useState('');
  const [coordinator, setCoordinator] = useState('');
  const [fallRisk, setFallRisk] = useState<'low' | 'moderate' | 'high'>('low');
  const [pressureRisk, setPressureRisk] = useState<'low' | 'moderate' | 'high'>('low');
  const [infectionFlags, setInfectionFlags] = useState<string[]>([]);
  const [expected, setExpected] = useState('');

  const q = useDebounce(search, 250);

  const { data: patientsData } = useApi<{ patients: Patient[] }>(
    open ? `/patients?limit=200${q ? `&q=${encodeURIComponent(q)}` : ''}` : null,
    [q]
  );
  const { data: bedsData } = useApi<{ beds: Bed[] }>(open ? '/beds/available' : null);
  const { data: doctorsData } = useApi<{ doctors: User[] }>(open ? '/users/doctors' : null);
  const { data: usersData } = useApi<{ users: User[] }>(open ? '/users' : null);

  // Admin-only endpoint; fall back to an empty list for other roles.
  const staff = usersData?.users ?? [];
  const nurseList = staff.filter((u) => u.role === 'nurse');
  const pharmacistList = staff.filter((u) => u.role === 'pharmacist');
  const coordinatorList = staff.filter((u) => u.role === 'care_coordinator');

  const eligible = (patientsData?.patients ?? []).filter(
    (p) => p.status === 'registered' || p.status === 'discharged'
  );

  useEffect(() => {
    if (!attending && doctorsData?.doctors.length) setAttending(doctorsData.doctors[0].id);
  }, [doctorsData, attending]);

  const matchingCodes = useMemo(() => {
    const term = codeQuery.trim().toLowerCase();
    if (!term) return [];
    return ICD10.filter(
      (c) => c.code.toLowerCase().includes(term) || c.label.toLowerCase().includes(term)
    ).slice(0, 6);
  }, [codeQuery]);

  const submit = useMutation(async () => {
    await api.post('/admissions', {
      patientId,
      admittingDiagnosis: diagnosis,
      diagnosisCodes: codes,
      expectedDischargeDate: expected || null,
      bedId: bedId || undefined,
      careTeam: {
        attendingPhysician: attending,
        nurses,
        specialists: [],
        pharmacist: pharmacist || null,
        careCoordinator: coordinator || null,
      },
      riskAssessment: {
        fallRisk,
        pressureInjuryRisk: pressureRisk,
        infectionFlags,
      },
    });
    toast.success('Patient admitted', diagnosis);
    onCreated();
  });

  const valid = patientId && diagnosis.trim() && attending;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New admission"
      subtitle="Assign a bed and a care team"
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={submit.pending}>
            Cancel
          </Button>
          <Button loading={submit.pending} disabled={!valid} onClick={() => void submit.mutate()}>
            Admit patient
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div>
          <Field label="Patient" required hint="Only registered or previously discharged patients">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or patient ID"
            />
          </Field>
          <div
            className="mt-2 max-h-44 overflow-y-auto rounded-lg border"
            style={{ borderColor: 'var(--color-border)' }}
          >
            {eligible.length === 0 ? (
              <p className="px-3 py-4 text-center text-xs text-muted">
                No patients available to admit.
              </p>
            ) : (
              eligible.slice(0, 40).map((p) => (
                <button
                  key={p._id}
                  type="button"
                  onClick={() => setPatientId(p._id)}
                  className={cn(
                    'flex w-full items-center justify-between gap-3 border-b px-3 py-2 text-left text-sm last:border-0',
                    patientId === p._id
                      ? 'bg-[var(--color-primary-50)]'
                      : 'hover:bg-[var(--color-surface-muted)]'
                  )}
                  style={{ borderColor: 'var(--color-border)' }}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{patientName(p)}</span>
                    <span className="block text-xs text-faint">
                      {p.patientId} · {patientAge(p)}y · {p.status.replace('_', ' ')}
                    </span>
                  </span>
                  {patientId === p._id && (
                    <span className="shrink-0 text-xs font-semibold text-primary-700">
                      Selected
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>

        <Field label="Admitting diagnosis" required>
          <Input
            value={diagnosis}
            onChange={(e) => setDiagnosis(e.target.value)}
            placeholder="e.g. Acute decompensated heart failure"
          />
        </Field>

        <div>
          <Field label="ICD-10 codes" hint="Search and click to add — these drive the follow-up protocol">
            <Input
              value={codeQuery}
              onChange={(e) => setCodeQuery(e.target.value)}
              placeholder="Search code or description"
            />
          </Field>
          {matchingCodes.length > 0 && (
            <div
              className="mt-1.5 overflow-hidden rounded-lg border"
              style={{ borderColor: 'var(--color-border)' }}
            >
              {matchingCodes.map((c) => (
                <button
                  key={c.code}
                  type="button"
                  onClick={() => {
                    if (!codes.includes(c.code)) setCodes([...codes, c.code]);
                    setCodeQuery('');
                    if (!diagnosis.trim()) setDiagnosis(c.label);
                  }}
                  className="flex w-full items-baseline gap-2 border-b px-3 py-2 text-left text-sm last:border-0 hover:bg-[var(--color-surface-muted)]"
                  style={{ borderColor: 'var(--color-border)' }}
                >
                  <span className="font-mono text-xs font-semibold">{c.code}</span>
                  <span className="truncate text-muted">{c.label}</span>
                </button>
              ))}
            </div>
          )}
          {codes.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {codes.map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => setCodes(codes.filter((c) => c !== code))}
                  className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-xs"
                  style={{
                    background: 'var(--color-primary-50)',
                    color: 'var(--color-primary-dark)',
                  }}
                >
                  {code} <span className="opacity-60">×</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Bed" hint={`${bedsData?.beds.length ?? 0} available`}>
            <Select value={bedId} onChange={(e) => setBedId(e.target.value)}>
              <option value="">Assign later</option>
              {(bedsData?.beds ?? []).map((b) => (
                <option key={b._id} value={b._id}>
                  {b.ward} — {b.roomNumber}-{b.bedNumber} ({b.type.replace('_', ' ')})
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Expected discharge">
            <Input
              type="date"
              value={expected}
              min={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setExpected(e.target.value)}
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Attending physician" required>
            <Select value={attending} onChange={(e) => setAttending(e.target.value)}>
              {(doctorsData?.doctors ?? []).map((d) => (
                <option key={d.id} value={d.id}>
                  Dr. {d.firstName} {d.lastName}
                  {d.specialization ? ` — ${d.specialization}` : ''}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Primary nurse" hint={nurseList.length ? undefined : 'Admin access required'}>
            <Select
              value={nurses[0] ?? ''}
              onChange={(e) => setNurses(e.target.value ? [e.target.value] : [])}
              disabled={!nurseList.length}
            >
              <option value="">None</option>
              {nurseList.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.firstName} {n.lastName}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Pharmacist">
            <Select
              value={pharmacist}
              onChange={(e) => setPharmacist(e.target.value)}
              disabled={!pharmacistList.length}
            >
              <option value="">None</option>
              {pharmacistList.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.firstName} {p.lastName}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Care coordinator">
            <Select
              value={coordinator}
              onChange={(e) => setCoordinator(e.target.value)}
              disabled={!coordinatorList.length}
            >
              <option value="">None</option>
              {coordinatorList.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.firstName} {c.lastName}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div>
          <p className="mb-2 text-xs font-medium text-[var(--color-text-secondary)]">
            Risk assessment
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Fall risk">
              <Select value={fallRisk} onChange={(e) => setFallRisk(e.target.value as 'low')}>
                <option value="low">Low</option>
                <option value="moderate">Moderate</option>
                <option value="high">High</option>
              </Select>
            </Field>
            <Field label="Pressure injury risk">
              <Select
                value={pressureRisk}
                onChange={(e) => setPressureRisk(e.target.value as 'low')}
              >
                <option value="low">Low</option>
                <option value="moderate">Moderate</option>
                <option value="high">High</option>
              </Select>
            </Field>
          </div>
          <div className="mt-3 flex flex-wrap gap-4">
            {['contact_precautions', 'droplet_precautions', 'airborne_precautions', 'mrsa', 'c_difficile'].map(
              (flag) => (
                <Checkbox
                  key={flag}
                  label={flag.replace(/_/g, ' ')}
                  checked={infectionFlags.includes(flag)}
                  onChange={(e) =>
                    setInfectionFlags(
                      e.target.checked
                        ? [...infectionFlags, flag]
                        : infectionFlags.filter((f) => f !== flag)
                    )
                  }
                />
              )
            )}
          </div>
        </div>

        {submit.error && <ErrorState message={submit.error} />}
      </div>
    </Modal>
  );
}

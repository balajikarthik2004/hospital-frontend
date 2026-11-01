import { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Checkbox,
  ErrorState,
  Field,
  Input,
  Modal,
  Select,
  Spinner,
  Textarea,
} from '@/components/common';
import { api } from '@/lib/api';
import { useApi, useMutation } from '@/hooks/useApi';
import { useDebounce } from '@/hooks/useDebounce';
import { toast } from '@/store/notificationStore';
import { cn, localDateKey, patientAge, patientName } from '@/lib/utils';
import type { AppointmentType, Patient, User } from '@/types';

const TYPES: { value: AppointmentType; label: string }[] = [
  { value: 'follow_up', label: 'Follow-up' },
  { value: 'specialist', label: 'Specialist' },
  { value: 'lab_only', label: 'Laboratory only' },
  { value: 'telehealth', label: 'Telehealth' },
  { value: 'pre_admission', label: 'Pre-admission' },
];

export function AppointmentModal({
  open,
  onClose,
  onCreated,
  defaultPatientId,
  defaultDate,
  defaultTime,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  defaultPatientId?: string;
  defaultDate?: string;
  defaultTime?: string;
}) {
  const [patientId, setPatientId] = useState(defaultPatientId ?? '');
  const [search, setSearch] = useState('');
  const [type, setType] = useState<AppointmentType>('follow_up');
  const [specialty, setSpecialty] = useState('');
  const [doctorId, setDoctorId] = useState('');
  const [date, setDate] = useState(defaultDate ?? localDateKey());
  const [time, setTime] = useState(defaultTime ?? '');
  const [duration, setDuration] = useState(25);
  const [location, setLocation] = useState('');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [insuranceVerified, setInsuranceVerified] = useState(false);

  const q = useDebounce(search, 250);

  const { data: patientsData } = useApi<{ patients: Patient[] }>(
    open ? `/patients?limit=100${q ? `&q=${encodeURIComponent(q)}` : ''}` : null,
    [q]
  );
  const { data: doctorsData } = useApi<{ doctors: User[]; specialties: string[] }>(
    open ? '/users/doctors' : null
  );
  const { data: slotsData, loading: slotsLoading } = useApi<{
    slots: { time: string; available: boolean }[];
  }>(
    open && doctorId && date
      ? `/appointments/doctor/${doctorId}/slots?date=${date}&duration=${duration}`
      : null,
    [doctorId, date, duration]
  );

  useEffect(() => {
    if (open) {
      setPatientId(defaultPatientId ?? '');
      setDate(defaultDate ?? localDateKey());
      setTime(defaultTime ?? '');
    }
  }, [open, defaultPatientId, defaultDate, defaultTime]);

  const doctors = doctorsData?.doctors ?? [];
  const filteredDoctors = useMemo(
    () =>
      specialty
        ? doctors.filter((d) => d.specialization?.toLowerCase() === specialty.toLowerCase())
        : doctors,
    [doctors, specialty]
  );

  useEffect(() => {
    if (filteredDoctors.length && !filteredDoctors.some((d) => d.id === doctorId)) {
      setDoctorId(filteredDoctors[0].id);
    }
  }, [filteredDoctors, doctorId]);

  const selectedPatient = (patientsData?.patients ?? []).find((p) => p._id === patientId);

  const submit = useMutation(async () => {
    await api.post('/appointments', {
      patientId,
      doctorId,
      type,
      specialty,
      scheduledDate: date,
      scheduledTime: time,
      duration,
      location,
      reason,
      notes: notes || null,
      insuranceVerified,
    });
    toast.success('Appointment booked', `${date} at ${time}`);
    onCreated();
  });

  const valid = patientId && doctorId && date && /^\d{2}:\d{2}$/.test(time);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Schedule an appointment"
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={submit.pending}>
            Cancel
          </Button>
          <Button loading={submit.pending} disabled={!valid} onClick={() => void submit.mutate()}>
            Book appointment
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div>
          <Field label="Patient" required>
            <Input
              value={selectedPatient ? patientName(selectedPatient) : search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPatientId('');
              }}
              placeholder="Search by name or patient ID"
            />
          </Field>
          {!patientId && (
            <div
              className="mt-2 max-h-40 overflow-y-auto rounded-lg border"
              style={{ borderColor: 'var(--color-border)' }}
            >
              {(patientsData?.patients ?? []).slice(0, 30).map((p) => (
                <button
                  key={p._id}
                  type="button"
                  onClick={() => {
                    setPatientId(p._id);
                    setSearch('');
                  }}
                  className="flex w-full items-center justify-between gap-3 border-b px-3 py-2 text-left text-sm last:border-0 hover:bg-[var(--color-surface-muted)]"
                  style={{ borderColor: 'var(--color-border)' }}
                >
                  <span className="truncate font-medium">{patientName(p)}</span>
                  <span className="shrink-0 text-xs text-faint">
                    {p.patientId} · {patientAge(p)}y
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Appointment type" required>
            <Select value={type} onChange={(e) => setType(e.target.value as AppointmentType)}>
              {TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Specialty" hint="Filters the clinician list">
            <Select value={specialty} onChange={(e) => setSpecialty(e.target.value)}>
              <option value="">Any specialty</option>
              {(doctorsData?.specialties ?? []).map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Clinician" required>
            <Select value={doctorId} onChange={(e) => setDoctorId(e.target.value)}>
              {filteredDoctors.map((d) => (
                <option key={d.id} value={d.id}>
                  Dr. {d.firstName} {d.lastName}
                  {d.specialization ? ` — ${d.specialization}` : ''}
                  {typeof d.activePatients === 'number' ? ` (${d.activePatients} inpatients)` : ''}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Duration">
            <Select value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
              {[15, 20, 25, 30, 45, 60].map((d) => (
                <option key={d} value={d}>
                  {d} minutes
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Date" required>
            <Input
              type="date"
              value={date}
              min={localDateKey()}
              onChange={(e) => {
                setDate(e.target.value);
                setTime('');
              }}
            />
          </Field>

          <Field label="Location">
            <Input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Clinic or 'Telehealth'"
            />
          </Field>
        </div>

        <Field label="Time" required hint="Slots already booked for this clinician are disabled">
          {!doctorId || !date ? (
            <p className="text-xs text-faint">Choose a clinician and a date first.</p>
          ) : slotsLoading ? (
            <div className="flex items-center gap-2 text-xs text-muted">
              <Spinner size={14} /> Checking availability…
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-8">
              {(slotsData?.slots ?? []).map((slot) => (
                <button
                  key={slot.time}
                  type="button"
                  disabled={!slot.available}
                  onClick={() => setTime(slot.time)}
                  className={cn(
                    'rounded-lg border px-2 py-1.5 font-mono text-xs transition-colors',
                    !slot.available && 'cursor-not-allowed line-through opacity-40',
                    time === slot.time
                      ? 'border-primary-600 bg-[var(--color-primary-50)] font-semibold text-primary-700'
                      : 'hover:border-primary-600'
                  )}
                  style={{ borderColor: time === slot.time ? undefined : 'var(--color-border)' }}
                >
                  {slot.time}
                </button>
              ))}
            </div>
          )}
        </Field>

        <Field label="Reason">
          <Input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Post-discharge review, repeat bloods…"
          />
        </Field>

        <Field label="Notes">
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>

        <Checkbox
          label="Insurance coverage has been verified"
          checked={insuranceVerified}
          onChange={(e) => setInsuranceVerified(e.target.checked)}
        />

        {submit.error && <ErrorState message={submit.error} />}
      </div>
    </Modal>
  );
}

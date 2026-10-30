import { useEffect, useState } from 'react';
import { Button, ErrorState, Field, Input, Modal, Select, Spinner } from '@/components/common';
import { api } from '@/lib/api';
import { useApi, useMutation } from '@/hooks/useApi';
import { toast } from '@/store/notificationStore';
import { cn } from '@/lib/utils';
import type { FollowUpRecommendation, User } from '@/types';

export function ScheduleFollowUpModal({
  packageId,
  recommendation,
  onClose,
  onScheduled,
}: {
  packageId: string;
  recommendation: FollowUpRecommendation | null;
  onClose: () => void;
  onScheduled: () => void;
}) {
  const [doctorId, setDoctorId] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [location, setLocation] = useState('');

  const { data: doctorsData } = useApi<{ doctors: User[]; specialties: string[] }>(
    recommendation ? '/users/doctors' : null
  );

  const { data: slotsData, loading: slotsLoading } = useApi<{
    slots: { time: string; available: boolean }[];
  }>(doctorId && date ? `/appointments/doctor/${doctorId}/slots?date=${date}` : null, [
    doctorId,
    date,
  ]);

  // Default the date to the recommended interval and prefer a matching specialist.
  useEffect(() => {
    if (!recommendation) return;
    const due = new Date();
    due.setDate(due.getDate() + (recommendation.dueInDays || 7));
    setDate(due.toISOString().slice(0, 10));
    setLocation(recommendation.specialty ? `${recommendation.specialty} Clinic` : '');
    setTime('');
  }, [recommendation]);

  useEffect(() => {
    if (!recommendation || !doctorsData?.doctors.length) return;
    const match = doctorsData.doctors.find(
      (d) => d.specialization?.toLowerCase() === recommendation.specialty?.toLowerCase()
    );
    setDoctorId((match ?? doctorsData.doctors[0]).id);
  }, [recommendation, doctorsData]);

  const submit = useMutation(async () => {
    await api.post(`/discharge/${packageId}/schedule-follow-up`, {
      recommendationId: recommendation!._id,
      doctorId,
      scheduledDate: date,
      scheduledTime: time,
      location,
    });
    toast.success('Appointment booked', `${recommendation!.specialty} on ${date} at ${time}`);
    onClose();
    onScheduled();
  });

  if (!recommendation) return null;

  return (
    <Modal
      open
      onClose={onClose}
      title="Schedule follow-up"
      subtitle={recommendation.description}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={submit.pending}>
            Cancel
          </Button>
          <Button
            loading={submit.pending}
            disabled={!doctorId || !date || !time}
            onClick={() => void submit.mutate()}
          >
            Book appointment
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div
          className="rounded-lg px-3 py-2 text-xs"
          style={{ background: 'var(--color-surface-muted)' }}
        >
          Recommended <strong>{recommendation.timeframe}</strong> · priority{' '}
          <strong>{recommendation.priority}</strong>
        </div>

        <Field label="Clinician" required>
          <Select value={doctorId} onChange={(e) => setDoctorId(e.target.value)}>
            <option value="">Select a clinician</option>
            {(doctorsData?.doctors ?? []).map((d) => (
              <option key={d.id} value={d.id}>
                Dr. {d.firstName} {d.lastName}
                {d.specialization ? ` — ${d.specialization}` : ''}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Date" required>
          <Input
            type="date"
            value={date}
            min={new Date().toISOString().slice(0, 10)}
            onChange={(e) => {
              setDate(e.target.value);
              setTime('');
            }}
          />
        </Field>

        <Field label="Time" required hint="Only free slots are selectable">
          {!doctorId || !date ? (
            <p className="text-xs text-faint">Choose a clinician and date first.</p>
          ) : slotsLoading ? (
            <div className="flex items-center gap-2 text-xs text-muted">
              <Spinner size={14} /> Loading availability…
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
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
                  style={{
                    borderColor: time === slot.time ? undefined : 'var(--color-border)',
                  }}
                >
                  {slot.time}
                </button>
              ))}
            </div>
          )}
        </Field>

        <Field label="Location">
          <Input value={location} onChange={(e) => setLocation(e.target.value)} />
        </Field>

        {submit.error && <ErrorState message={submit.error} />}
      </div>
    </Modal>
  );
}

import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { ChevronLeftIcon, ChevronRightIcon, PlusIcon } from '@heroicons/react/24/outline';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  Field,
  LoadingPane,
  PageHeader,
  Select,
  Table,
  Tabs,
  Td,
  Th,
  Tr,
} from '@/components/common';
import { useApi } from '@/hooks/useApi';
import { useSocketEvent } from '@/hooks/useSocket';
import { useAuthStore } from '@/store/authStore';
import { cn, fmtDate, fmtDayLabel, patientName, titleCase } from '@/lib/utils';
import type { Appointment, Patient, User } from '@/types';
import { AppointmentModal } from './AppointmentModal';

const HOURS = Array.from({ length: 9 }, (_, i) => 9 + i); // 09:00 – 17:00

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function SchedulingPage() {
  const [params] = useSearchParams();
  const can = useAuthStore((s) => s.can);
  const [view, setView] = useState<'week' | 'day' | 'list' | 'availability'>('week');
  const [anchor, setAnchor] = useState(() => new Date());
  const [doctorFilter, setDoctorFilter] = useState('');
  const [creating, setCreating] = useState(Boolean(params.get('patient')));
  const [prefill, setPrefill] = useState<{ date?: string; time?: string }>({});

  const weekStart = startOfWeek(anchor);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const range: Record<string, string> =
    view === 'day'
      ? {
          from: new Date(new Date(anchor).setHours(0, 0, 0, 0)).toISOString(),
          to: new Date(new Date(anchor).setHours(23, 59, 59, 999)).toISOString(),
        }
      : view === 'week'
        ? { from: weekStart.toISOString(), to: weekEnd.toISOString() }
        : {};

  const query = new URLSearchParams({ limit: '300', ...range });
  if (doctorFilter) query.set('doctorId', doctorFilter);

  const { data, loading, error, refetch } = useApi<{ appointments: Appointment[] }>(
    `/appointments?${query.toString()}`,
    [view, anchor.toDateString(), doctorFilter]
  );
  const { data: doctorsData } = useApi<{ doctors: User[] }>('/users/doctors');

  useSocketEvent('appointment:created', () => void refetch());

  const appointments = data?.appointments ?? [];

  const days = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const d = new Date(weekStart);
        d.setDate(d.getDate() + i);
        return d;
      }),
    [weekStart.getTime()]
  );

  const shift = (deltaDays: number) => {
    const next = new Date(anchor);
    next.setDate(next.getDate() + deltaDays);
    setAnchor(next);
  };

  return (
    <>
      <PageHeader
        eyebrow="Operations"
        title="Scheduling"
        story="Every appointment across the service. Follow-ups the agents recommended appear here as soon as a coordinator books them."
        actions={
          can('appointment:schedule') && (
            <Button
              icon={<PlusIcon className="h-4 w-4" />}
              onClick={() => {
                setPrefill({});
                setCreating(true);
              }}
            >
              New appointment
            </Button>
          )
        }
      />

      <div className="mb-4">
        <Tabs
          tabs={[
            { key: 'week', label: 'Week' },
            { key: 'day', label: 'Day' },
            { key: 'list', label: 'List' },
            { key: 'availability', label: 'Doctor availability' },
          ]}
          active={view}
          onChange={setView}
        />
      </div>

      {view !== 'availability' && (
        <Card className="mb-4">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => shift(view === 'day' ? -1 : -7)}
                aria-label="Previous"
              >
                <ChevronLeftIcon className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => setAnchor(new Date())}>
                Today
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => shift(view === 'day' ? 1 : 7)}
                aria-label="Next"
              >
                <ChevronRightIcon className="h-4 w-4" />
              </Button>
              <span className="ml-2 text-sm font-medium">
                {view === 'day'
                  ? fmtDate(anchor)
                  : `${fmtDate(weekStart)} – ${fmtDate(days[6])}`}
              </span>
            </div>

            <Field label="Clinician" className="w-full max-w-xs">
              <Select value={doctorFilter} onChange={(e) => setDoctorFilter(e.target.value)}>
                <option value="">All clinicians</option>
                {(doctorsData?.doctors ?? []).map((d) => (
                  <option key={d.id} value={d.id}>
                    Dr. {d.firstName} {d.lastName}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </Card>
      )}

      {error && <ErrorState message={error} onRetry={refetch} />}

      {loading && !data ? (
        <LoadingPane label="Loading the calendar" />
      ) : view === 'week' ? (
        <WeekGrid
          days={days}
          appointments={appointments}
          onSlotClick={(date, time) => {
            if (!can('appointment:schedule')) return;
            setPrefill({ date, time });
            setCreating(true);
          }}
        />
      ) : view === 'day' ? (
        <DayColumn
          date={anchor}
          appointments={appointments}
          onSlotClick={(date, time) => {
            if (!can('appointment:schedule')) return;
            setPrefill({ date, time });
            setCreating(true);
          }}
        />
      ) : view === 'list' ? (
        <AppointmentTable appointments={appointments} />
      ) : (
        <AvailabilityView />
      )}

      <AppointmentModal
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={() => {
          setCreating(false);
          void refetch();
        }}
        defaultPatientId={params.get('patient') ?? undefined}
        defaultDate={prefill.date}
        defaultTime={prefill.time}
      />
    </>
  );
}

const TYPE_COLOR: Record<string, string> = {
  follow_up: '#0891B2',
  specialist: '#6366F1',
  lab_only: '#059669',
  telehealth: '#7C3AED',
  pre_admission: '#D97706',
};

function WeekGrid({
  days,
  appointments,
  onSlotClick,
}: {
  days: Date[];
  appointments: Appointment[];
  onSlotClick: (date: string, time: string) => void;
}) {
  const byDay = new Map<string, Appointment[]>();
  for (const a of appointments) {
    const key = new Date(a.scheduledDate).toISOString().slice(0, 10);
    byDay.set(key, [...(byDay.get(key) ?? []), a]);
  }

  return (
    <Card padded={false} className="overflow-x-auto">
      <div className="min-w-[900px]">
        <div
          className="grid border-b"
          style={{ gridTemplateColumns: '64px repeat(7, 1fr)', borderColor: 'var(--color-border)' }}
        >
          <div />
          {days.map((day) => {
            const isToday = day.toDateString() === new Date().toDateString();
            return (
              <div
                key={day.toISOString()}
                className="border-l px-2 py-2.5 text-center"
                style={{ borderColor: 'var(--color-border)' }}
              >
                <div
                  className={cn('text-xs font-semibold', isToday && 'text-primary-700')}
                >
                  {day.toLocaleDateString(undefined, { weekday: 'short' })}
                </div>
                <div
                  className={cn(
                    'text-sm',
                    isToday ? 'font-bold text-primary-700' : 'text-muted'
                  )}
                >
                  {day.getDate()}
                </div>
              </div>
            );
          })}
        </div>

        {HOURS.map((hour) => (
          <div
            key={hour}
            className="grid border-b"
            style={{
              gridTemplateColumns: '64px repeat(7, 1fr)',
              borderColor: 'var(--color-border)',
            }}
          >
            <div className="py-2 pr-2 text-right font-mono text-[10px] text-faint">
              {String(hour).padStart(2, '0')}:00
            </div>
            {days.map((day) => {
              const key = day.toISOString().slice(0, 10);
              const slot = (byDay.get(key) ?? []).filter(
                (a) => Number(a.scheduledTime.split(':')[0]) === hour
              );
              return (
                <button
                  key={`${key}-${hour}`}
                  onClick={() => onSlotClick(key, `${String(hour).padStart(2, '0')}:00`)}
                  className="min-h-[52px] space-y-0.5 border-l p-1 text-left transition-colors hover:bg-[var(--color-surface-muted)]"
                  style={{ borderColor: 'var(--color-border)' }}
                >
                  {slot.map((a) => (
                    <span
                      key={a._id}
                      className="block truncate rounded px-1.5 py-0.5 text-[10px] font-medium text-white"
                      style={{ background: TYPE_COLOR[a.type] ?? '#64748B' }}
                      title={`${a.scheduledTime} ${patientName(a.patientId as Patient)} — ${a.specialty || titleCase(a.type)}`}
                    >
                      {a.scheduledTime} {patientName(a.patientId as Patient).split(' ')[1]}
                    </span>
                  ))}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </Card>
  );
}

function DayColumn({
  date,
  appointments,
  onSlotClick,
}: {
  date: Date;
  appointments: Appointment[];
  onSlotClick: (date: string, time: string) => void;
}) {
  const key = date.toISOString().slice(0, 10);
  const slots: string[] = [];
  for (let h = 9; h < 17; h++) {
    slots.push(`${String(h).padStart(2, '0')}:00`, `${String(h).padStart(2, '0')}:30`);
  }

  return (
    <Card>
      <CardHeader title={fmtDayLabel(date)} subtitle={`${appointments.length} appointments`} />
      <div className="space-y-1">
        {slots.map((time) => {
          const booked = appointments.filter((a) => a.scheduledTime === time);
          return (
            <div key={time} className="flex gap-3">
              <span className="w-14 shrink-0 pt-1.5 text-right font-mono text-xs text-faint">
                {time}
              </span>
              {booked.length === 0 ? (
                <button
                  onClick={() => onSlotClick(key, time)}
                  className="flex-1 rounded-lg border border-dashed py-2 text-left text-xs text-faint transition-colors hover:border-primary-600 hover:text-primary-700"
                  style={{ borderColor: 'var(--color-border-dark)' }}
                >
                  <span className="pl-3">Free — click to book</span>
                </button>
              ) : (
                <div className="flex-1 space-y-1">
                  {booked.map((a) => (
                    <div
                      key={a._id}
                      className="rounded-lg border-l-4 px-3 py-2"
                      style={{
                        borderLeftColor: TYPE_COLOR[a.type] ?? '#64748B',
                        background: 'var(--color-surface-muted)',
                      }}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium">
                          {patientName(a.patientId as Patient)}
                        </span>
                        <Badge tone="neutral">{titleCase(a.type)}</Badge>
                        <Badge tone={a.status === 'confirmed' ? 'success' : 'info'}>
                          {titleCase(a.status)}
                        </Badge>
                      </div>
                      <p className="mt-0.5 text-xs text-muted">
                        {a.specialty} · {a.location || 'Location TBC'} ·{' '}
                        {typeof a.doctorId === 'object'
                          ? `Dr. ${(a.doctorId as any).firstName} ${(a.doctorId as any).lastName}`
                          : ''}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function AppointmentTable({ appointments }: { appointments: Appointment[] }) {
  const sorted = [...appointments].sort(
    (a, b) =>
      new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime() ||
      a.scheduledTime.localeCompare(b.scheduledTime)
  );

  return (
    <Card padded={false}>
      {sorted.length === 0 ? (
        <EmptyState title="No appointments in this range" />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Reference</Th>
              <Th>Date</Th>
              <Th>Time</Th>
              <Th>Patient</Th>
              <Th>Clinician</Th>
              <Th>Type</Th>
              <Th>Location</Th>
              <Th>Status</Th>
              <Th>Insurance</Th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((a) => (
              <Tr key={a._id}>
                <Td className="font-mono text-xs">{a.appointmentId}</Td>
                <Td className="whitespace-nowrap">{fmtDate(a.scheduledDate)}</Td>
                <Td className="font-mono text-xs">{a.scheduledTime}</Td>
                <Td>
                  <Link
                    to={`/patients/${(a.patientId as Patient)?._id}`}
                    className="font-medium text-primary-700 hover:underline"
                  >
                    {patientName(a.patientId as Patient)}
                  </Link>
                </Td>
                <Td className="text-muted">
                  {typeof a.doctorId === 'object'
                    ? `Dr. ${(a.doctorId as any).firstName} ${(a.doctorId as any).lastName}`
                    : '—'}
                </Td>
                <Td>
                  <Badge tone="neutral">{titleCase(a.type)}</Badge>
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
                <Td>
                  {a.insuranceVerified ? (
                    <Badge tone="success">Verified</Badge>
                  ) : (
                    <Badge tone="warning">Unverified</Badge>
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

function AvailabilityView() {
  const { data, loading } = useApi<{
    doctors: (User & {
      weekAppointments: number;
      weekMinutes: number;
      byDay: { date: string; count: number }[];
    })[];
  }>('/appointments/workload');

  if (loading) return <LoadingPane label="Loading clinician load" />;

  const doctors = data?.doctors ?? [];
  const max = Math.max(1, ...doctors.flatMap((d) => d.byDay.map((b) => b.count)));

  return (
    <Card padded={false}>
      <div className="p-5 pb-0">
        <CardHeader
          title="Clinician load, next seven days"
          subtitle="Appointment count per day. Darker means busier."
        />
      </div>
      <Table>
        <thead>
          <tr>
            <Th>Clinician</Th>
            <Th>Specialty</Th>
            {(doctors[0]?.byDay ?? []).map((d) => (
              <Th key={d.date} className="text-center">
                {new Date(d.date).toLocaleDateString(undefined, { weekday: 'short' })}
              </Th>
            ))}
            <Th className="text-right">Week</Th>
          </tr>
        </thead>
        <tbody>
          {doctors.map((doctor) => (
            <Tr key={doctor.id}>
              <Td className="font-medium">
                Dr. {doctor.firstName} {doctor.lastName}
              </Td>
              <Td className="text-muted">{doctor.specialization ?? '—'}</Td>
              {doctor.byDay.map((day) => (
                <Td key={day.date} className="text-center">
                  <span
                    className="inline-flex h-7 w-7 items-center justify-center rounded text-xs font-semibold"
                    style={{
                      background:
                        day.count === 0
                          ? 'var(--color-surface-muted)'
                          : `rgba(8, 145, 178, ${0.15 + (day.count / max) * 0.65})`,
                      color: day.count === 0 ? 'var(--color-text-tertiary)' : '#083344',
                    }}
                  >
                    {day.count || '·'}
                  </span>
                </Td>
              ))}
              <Td className="text-right">
                <span className="font-semibold tabular-nums">{doctor.weekAppointments}</span>
                <span className="block text-[10px] text-faint">
                  {Math.round(doctor.weekMinutes / 60)} h booked
                </span>
              </Td>
            </Tr>
          ))}
        </tbody>
      </Table>
    </Card>
  );
}

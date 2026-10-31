import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRightOnRectangleIcon,
  CalendarDaysIcon,
  ClockIcon,
  IdentificationIcon,
  LockClosedIcon,
} from '@heroicons/react/24/outline';
import { Badge, Button, Callout, Field, Input, Logo, Spinner } from '@/components/common';
import {
  errorMessage,
  portalSession,
  portalToken,
  publicApi,
  setPortalExpiredHandler,
  type PortalAppointment,
  type PortalPatient,
} from '@/lib/publicApi';

/**
 * The patient's own dashboard.
 *
 * It shows strictly less than a clinician sees: appointments, and the few
 * identity fields needed to confirm they are looking at their own record.
 * Notes, medications and admission history are deliberately absent — the
 * server does not return them, and this page would have nowhere to put them
 * if it did.
 */
export function PatientPortalPage() {
  const [token, setToken] = useState<string | null>(() => portalToken.get());
  const [patient, setPatient] = useState<PortalPatient | null>(() => portalSession.getPatient());
  const [upcoming, setUpcoming] = useState<PortalAppointment[]>([]);
  const [past, setPast] = useState<PortalAppointment[]>([]);
  const [loading, setLoading] = useState(Boolean(portalToken.get()));
  const [error, setError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);

  const signOut = useCallback(() => {
    portalToken.clear();
    setToken(null);
    setPatient(null);
    setUpcoming([]);
    setPast([]);
  }, []);

  // The interceptor clears the token on a 401; this is how the page hears
  // about it rather than sitting there showing a stale dashboard.
  useEffect(() => {
    setPortalExpiredHandler(() => {
      setExpired(true);
      signOut();
    });
    return () => setPortalExpiredHandler(null);
  }, [signOut]);

  const load = useCallback(async () => {
    if (!portalToken.get()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await publicApi.get('/portal/me');
      setPatient(res.data.patient);
      portalSession.setPatient(res.data.patient);
      setUpcoming(res.data.appointments.upcoming);
      setPast(res.data.appointments.past);
    } catch (err) {
      // A 401 is already handled by the interceptor above.
      const status = (err as { response?: { status?: number } }).response?.status;
      if (status !== 401) setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (token) void load();
  }, [token, load]);

  if (!token) {
    return (
      <PortalLogin
        expired={expired}
        onSignedIn={(t, p) => {
          portalToken.set(t);
          if (p) {
            portalSession.setPatient(p);
            setPatient(p);
          }
          setExpired(false);
          setToken(t);
        }}
      />
    );
  }

  if (loading && !patient) {
    return (
      <div className="flex justify-center py-24">
        <Spinner size={26} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow">Patient portal</p>
          <h1 className="mt-1 text-[1.75rem] tracking-[-0.02em]">
            Hello, {patient?.firstName}
          </h1>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.875rem] text-muted">
            <span className="inline-flex items-center gap-1.5">
              <IdentificationIcon className="h-4 w-4" />
              {patient?.patientId}
            </span>
            <span>
              {patient?.age} years · {patient?.gender}
            </span>
            {patient?.phone && <span>{patient.phone}</span>}
          </p>
        </div>
        <Button variant="outline" onClick={signOut} icon={<ArrowRightOnRectangleIcon className="h-4 w-4" />}>
          Sign out
        </Button>
      </div>

      {error && (
        <Callout tone="danger" className="mt-6">
          {error}
        </Callout>
      )}

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[1.125rem]">Upcoming appointments</h2>
        <Link to="/book">
          <Button>Book another</Button>
        </Link>
      </div>

      {upcoming.length === 0 ? (
        <div
          className="mt-3 rounded-xl border p-8 text-center"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <CalendarDaysIcon
            className="mx-auto h-7 w-7"
            style={{ color: 'var(--color-text-tertiary)' }}
          />
          <p className="mt-3 text-[0.9375rem] font-medium">Nothing booked</p>
          <p className="mt-1 text-[0.875rem] text-muted">
            When you book an appointment it will appear here.
          </p>
        </div>
      ) : (
        <ul className="mt-3 space-y-3">
          {upcoming.map((a) => (
            <AppointmentRow key={a._id} appointment={a} />
          ))}
        </ul>
      )}

      {past.length > 0 && (
        <>
          <h2 className="mt-10 text-[1.125rem]">Past appointments</h2>
          <ul className="mt-3 space-y-3">
            {past.map((a) => (
              <AppointmentRow key={a._id} appointment={a} muted />
            ))}
          </ul>
        </>
      )}

      <p className="mt-10 text-[0.8125rem] leading-relaxed text-faint">
        This portal shows your appointments only. For test results, prescriptions or your
        discharge summary, speak to your doctor or call the hospital on{' '}
        <a href="tel:+914440001200" className="font-medium underline">
          +91 44 4000 1200
        </a>
        .
      </p>
    </div>
  );
}

function AppointmentRow({
  appointment: a,
  muted,
}: {
  appointment: PortalAppointment;
  muted?: boolean;
}) {
  const when = new Date(a.scheduledDate);
  const tone =
    a.status === 'cancelled'
      ? 'danger'
      : a.status === 'completed'
        ? 'neutral'
        : a.status === 'confirmed'
          ? 'success'
          : 'info';

  return (
    <li
      className="flex flex-wrap items-center gap-4 rounded-xl border p-4"
      style={{
        borderColor: 'var(--color-border)',
        background: 'var(--color-surface)',
        opacity: muted ? 0.75 : 1,
      }}
    >
      <div
        className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-lg"
        style={{ background: 'var(--color-surface-sunken)' }}
      >
        <span className="text-[1.125rem] font-semibold leading-none tabular">
          {when.getDate()}
        </span>
        <span className="mt-0.5 text-[0.6875rem] uppercase tracking-wide text-faint">
          {when.toLocaleDateString(undefined, { month: 'short' })}
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-[0.9375rem] font-semibold">
          {a.doctorId ? `Dr ${a.doctorId.firstName} ${a.doctorId.lastName}` : 'Doctor to be assigned'}
        </p>
        <p className="mt-0.5 text-[0.8125rem] text-muted">
          {a.doctorId?.department || a.specialty || 'General'}
        </p>
        {a.reason && (
          <p className="mt-1 truncate text-[0.8125rem] text-faint" title={a.reason}>
            {a.reason}
          </p>
        )}
      </div>

      <div className="flex items-center gap-3">
        <span className="inline-flex items-center gap-1.5 text-[0.875rem] font-medium tabular">
          <ClockIcon className="h-4 w-4" style={{ color: 'var(--color-text-tertiary)' }} />
          {a.scheduledTime}
        </span>
        <Badge tone={tone as never}>{a.status}</Badge>
      </div>

      <p className="w-full text-[0.75rem] text-faint">{a.appointmentId}</p>
    </li>
  );
}

function PortalLogin({
  expired,
  onSignedIn,
}: {
  expired: boolean;
  onSignedIn: (token: string, patient?: PortalPatient) => void;
}) {
  const [identifier, setIdentifier] = useState('');
  const [dob, setDob] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await publicApi.post<{ token: string; patient: PortalPatient }>('/portal/login', {
        identifier: identifier.trim(),
        dateOfBirth: dob,
      });
      portalSession.setPatient(res.data.patient);
      onSignedIn(res.data.token, res.data.patient);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const ready = identifier.trim().length >= 3 && dob !== '';

  return (
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-[26rem] flex-col justify-center px-4 py-12">
      <div className="mb-7 text-center">
        <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-xs">
          <Logo size={28} />
        </span>
        <h1 className="text-[1.5rem] tracking-[-0.02em]">Patient portal</h1>
        <p className="mt-1.5 text-[0.875rem] text-muted">
          Sign in to see your appointments and book another.
        </p>
      </div>

      {expired && (
        <Callout tone="warning" className="mb-4">
          Your session timed out. Please sign in again.
        </Callout>
      )}
      {error && (
        <Callout tone="danger" className="mb-4">
          {error}
        </Callout>
      )}

      {/* The form sits on its own sheet rather than loose on the page. Two
          fields floating in the middle of a wide column read as unfinished,
          and on a sign-in screen that is the wrong thing to feel about the
          place holding your medical record. */}
      <div className="rounded-[14px] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-sm">
        <form onSubmit={submit} className="space-y-4" noValidate>
          <Field
            label="Patient ID or phone number"
            required
            hint="Your patient ID looks like PAT-20260130-0007."
          >
            <Input
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="PAT-… or 98765 43210"
              autoComplete="username"
              autoFocus
              // Phone numbers are the common case on a handset, and the
              // patient ID is still typeable on the numeric pad's letter row.
              inputMode="text"
              disabled={busy}
            />
          </Field>

          <Field
            label="Date of birth"
            required
            hint="We ask for this so nobody else can open your record with just a phone number."
          >
            <Input
              type="date"
              value={dob}
              onChange={(e) => setDob(e.target.value)}
              autoComplete="bday"
              // A date of birth in the future is never a typo worth sending.
              max={new Date().toISOString().slice(0, 10)}
              disabled={busy}
            />
          </Field>

          {/* `loading` rather than swapping the label to "Checking…": the
              button keeps its width, so the form does not jump while the
              request is in flight. */}
          <Button type="submit" size="lg" fullWidth loading={busy} disabled={!ready}>
            Sign in
          </Button>
        </form>
      </div>

      <p className="mt-5 text-center text-[0.875rem] text-muted">
        Never been here before?{' '}
        <Link
          to="/book"
          className="font-[620] underline-offset-2 hover:underline"
          style={{ color: 'var(--color-primary)' }}
        >
          Book as a new patient
        </Link>
      </p>

      <p className="mt-6 flex items-center justify-center gap-1.5 text-center text-[0.75rem] leading-relaxed text-faint">
        <LockClosedIcon className="h-3.5 w-3.5 shrink-0" aria-hidden />
        Your session lasts two hours and is not kept after you close the browser.
      </p>
    </div>
  );
}

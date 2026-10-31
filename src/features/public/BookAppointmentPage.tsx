import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  PhoneIcon,
  UserIcon,
  UserPlusIcon,
} from '@heroicons/react/24/outline';
import { Button, Callout, Field, Input, Select, Spinner, Textarea } from '@/components/common';
import {
  doctorName,
  errorMessage,
  portalSession,
  portalToken,
  publicApi,
  type PortalPatient,
  type PublicDoctor,
  type PublicSpecialty,
  type TriageResponse,
} from '@/lib/publicApi';
import { cn } from '@/lib/utils';
import { iconFor } from './departmentIcons';

/* ═══════════════════════════════════════════════════════════════════════════
   Booking an appointment at Aarogya General Hospital.

   If the patient is already logged in, we never ask them to identify again:
   they go straight to selecting the doctor or entering their complaint.
   ═══════════════════════════════════════════════════════════════════════════ */

type Step = 'who' | 'identify' | 'details' | 'symptoms' | 'doctor' | 'slot' | 'done';

const FLOW_NEW: Step[] = ['who', 'details', 'symptoms', 'doctor', 'slot'];
const FLOW_RETURNING: Step[] = ['who', 'identify', 'symptoms', 'doctor', 'slot'];

/** Chips, so somebody who cannot describe it in words still gets routed. */
const COMMON_SYMPTOMS = [
  'Fever',
  'Cough',
  'Chest pain',
  'Breathless',
  'Headache',
  'Stomach pain',
  'Back pain',
  'Joint pain',
  'Rash',
  'Itching',
  'Dizziness',
  'Vomiting',
  'Sore throat',
  'Ear pain',
  'Tiredness',
];

interface Details {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: 'male' | 'female' | 'other' | '';
  phone: string;
  email: string;
}

interface Booked {
  appointmentId: string;
  scheduledDate: string;
  scheduledTime: string;
  doctorName: string;
  specialty: string;
  patientId: string;
  firstName: string;
  isNew: boolean;
}

export function BookAppointmentPage() {
  const [params] = useSearchParams();
  const preselected = params.get('specialty');

  const [patient, setPatient] = useState<PortalPatient | null>(() => portalSession.getPatient());
  const [hasToken, setHasToken] = useState(() => Boolean(portalToken.get()));
  const isLoggedIn = Boolean(hasToken || patient);

  const [step, setStep] = useState<Step>(() => {
    const loggedIn = Boolean(portalToken.get() || portalSession.getPatient());
    if (loggedIn) {
      return preselected ? 'doctor' : 'symptoms';
    }
    return 'who';
  });
  const [isNew, setIsNew] = useState<boolean | null>(() => {
    const loggedIn = Boolean(portalToken.get() || portalSession.getPatient());
    return loggedIn ? false : null;
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Who they are
  const [details, setDetails] = useState<Details>({
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    gender: '',
    phone: '',
    email: '',
  });
  const [identifier, setIdentifier] = useState(() => {
    const p = portalSession.getPatient();
    return p?.patientId ?? '';
  });
  const [returningDob, setReturningDob] = useState('');
  const [verifiedName, setVerifiedName] = useState<string | null>(() => {
    const p = portalSession.getPatient();
    return p ? `${p.firstName} ${p.lastName ?? ''}`.trim() : null;
  });

  // What is wrong
  const [complaint, setComplaint] = useState('');
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [triage, setTriage] = useState<TriageResponse | null>(null);
  const [overrode, setOverrode] = useState(false);

  // Who they see, and when
  const [specialties, setSpecialties] = useState<PublicSpecialty[]>([]);
  const [doctors, setDoctors] = useState<PublicDoctor[]>([]);
  const [doctor, setDoctor] = useState<PublicDoctor | null>(null);
  const [date, setDate] = useState('');
  const [slots, setSlots] = useState<{ time: string; available: boolean }[]>([]);
  const [slotNote, setSlotNote] = useState<string | null>(null);
  const [time, setTime] = useState('');
  const [booked, setBooked] = useState<Booked | null>(null);

  useEffect(() => {
    const token = portalToken.get();
    setHasToken(Boolean(token));
    if (token) {
      const cached = portalSession.getPatient();
      if (cached) {
        setPatient(cached);
        setVerifiedName(`${cached.firstName} ${cached.lastName ?? ''}`.trim());
        setIdentifier(cached.patientId);
        setIsNew(false);
      } else {
        publicApi
          .get('/portal/me')
          .then((res) => {
            portalSession.setPatient(res.data.patient);
            setPatient(res.data.patient);
            setVerifiedName(
              `${res.data.patient.firstName} ${res.data.patient.lastName ?? ''}`.trim()
            );
            setIdentifier(res.data.patient.patientId);
            setIsNew(false);
          })
          .catch(() => {});
      }
    }
  }, []);

  const flow = isLoggedIn
    ? preselected
      ? (['doctor', 'slot'] as Step[])
      : (['symptoms', 'doctor', 'slot'] as Step[])
    : isNew
    ? FLOW_NEW
    : FLOW_RETURNING;
  const stepIndex = flow.indexOf(step);

  useEffect(() => {
    publicApi
      .get<{ specialties: PublicSpecialty[] }>('/specialties')
      .then((r) => setSpecialties(r.data.specialties))
      .catch(() => setSpecialties([]));
  }, []);

  /* ── Step: who ──────────────────────────────────────────────────────── */

  const chooseNew = () => {
    setIsNew(true);
    setStep('details');
    setError(null);
  };
  const chooseReturning = () => {
    setIsNew(false);
    setStep('identify');
    setError(null);
  };

  /* ── Step: identify a returning patient ─────────────────────────────── */

  const verify = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await publicApi.post<{ patient: { firstName: string; lastName: string } }>(
        '/portal/login',
        { identifier: identifier.trim(), dateOfBirth: returningDob }
      );
      setVerifiedName(`${res.data.patient.firstName} ${res.data.patient.lastName}`);
      setStep('symptoms');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  /* ── Step: symptoms → suggested department ──────────────────────────── */

  const patientAge = useMemo(() => {
    if (patient?.age) return patient.age;
    const dob = isNew ? details.dateOfBirth : returningDob;
    if (!dob) return undefined;
    const d = new Date(dob);
    if (Number.isNaN(d.getTime())) return undefined;
    const diff = Date.now() - d.getTime();
    return Math.floor(diff / (365.25 * 24 * 3600 * 1000));
  }, [patient?.age, isNew, details.dateOfBirth, returningDob]);

  const runTriage = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await publicApi.post<TriageResponse>('/triage', {
        complaint,
        symptoms,
        age: patientAge,
      });
      setTriage(res.data);
      setOverrode(false);
      setDoctors(res.data.doctors);
      setDoctor(null);
      setStep('doctor');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  /** Patient disagrees with the suggestion and picks a department themselves. */
  const switchSpecialty = async (slug: string) => {
    setBusy(true);
    setError(null);
    try {
      const res = await publicApi.get<{ doctors: PublicDoctor[] }>('/doctors', {
        params: { specialty: slug },
      });
      setDoctors(res.data.doctors);
      setDoctor(null);
      setOverrode(slug !== triage?.specialty);
      const named = specialties.find((s) => s.slug === slug);
      const displayName = named?.name ?? slug.charAt(0).toUpperCase() + slug.slice(1);
      setTriage((prev) => ({
        specialty: slug,
        specialtyName: displayName,
        reason: named?.description ?? `Department: ${displayName}`,
        confidence: 1,
        matched: prev?.matched ?? [],
        emergency: prev?.emergency ?? null,
        alternatives: prev?.alternatives ?? [],
        doctors: res.data.doctors,
      }));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  // Jumping straight in from a department card on the home page or departments page.
  useEffect(() => {
    if (preselected && step === 'doctor' && (!doctors.length || triage?.specialty !== preselected)) {
      void switchSpecialty(preselected);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preselected, step, specialties]);

  /* ── Step: slots ────────────────────────────────────────────────────── */

  const loadSlots = useCallback(
    async (doctorId: string, when: string) => {
      setBusy(true);
      setSlotNote(null);
      setTime('');
      try {
        const res = await publicApi.get<{
          slots: { time: string; available: boolean }[];
          reason?: string;
        }>(`/doctors/${doctorId}/slots`, { params: { date: when } });
        setSlots(res.data.slots);
        setSlotNote(res.data.reason ?? null);
      } catch (err) {
        setError(errorMessage(err));
        setSlots([]);
      } finally {
        setBusy(false);
      }
    },
    []
  );

  const pickDoctor = (d: PublicDoctor) => {
    setDoctor(d);
    const first = nextClinicDay(d.doctorProfile?.availableDays ?? [1, 2, 3, 4, 5]);
    setDate(first);
    setStep('slot');
    void loadSlots(d._id, first);
  };

  const changeDate = (when: string) => {
    setDate(when);
    if (doctor) void loadSlots(doctor._id, when);
  };

  /* ── Confirm ────────────────────────────────────────────────────────── */

  const confirm = async () => {
    if (!doctor || !date || !time) return;
    setBusy(true);
    setError(null);
    try {
      const res = await publicApi.post('/appointments', {
        isNewPatient: Boolean(isNew),
        ...(isLoggedIn
          ? {
              identifier: patient?.patientId ?? identifier.trim(),
              ...(returningDob ? { dateOfBirth: returningDob } : {}),
            }
          : isNew
          ? {
              firstName: details.firstName.trim(),
              lastName: details.lastName.trim(),
              dateOfBirth: details.dateOfBirth,
              gender: details.gender || 'other',
              phone: details.phone.trim(),
              ...(details.email.trim() ? { email: details.email.trim() } : {}),
            }
          : { identifier: identifier.trim(), dateOfBirth: returningDob }),
        doctorId: doctor._id,
        date,
        time,
        complaint,
        symptoms,
        triage: triage
          ? {
              specialty: triage.specialty ?? '',
              reason: triage.reason,
              confidence: triage.confidence,
              matched: triage.matched,
              overridden: overrode,
            }
          : undefined,
      });
      const d = res.data;
      setBooked({
        appointmentId: d.appointment.appointmentId,
        scheduledDate: d.appointment.scheduledDate,
        scheduledTime: d.appointment.scheduledTime,
        doctorName: d.doctor.name,
        specialty: d.doctor.department,
        patientId: d.patient.patientId,
        firstName: d.patient.firstName,
        isNew: d.patient.isNew,
      });
      setStep('done');
    } catch (err) {
      setError(errorMessage(err));
      // Almost always "someone just took that slot", so refresh the grid.
      if (doctor && date) void loadSlots(doctor._id, date);
    } finally {
      setBusy(false);
    }
  };

  const back = () => {
    setError(null);
    const prev = flow[stepIndex - 1];
    if (prev) {
      setStep(prev);
    } else if (isLoggedIn && step === 'doctor' && preselected) {
      setStep('symptoms');
    }
  };

  /* ── Render ─────────────────────────────────────────────────────────── */

  if (step === 'done' && booked) return <Confirmation booked={booked} isLoggedIn={isLoggedIn} />;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-[1.75rem] tracking-[-0.02em]">Book an appointment</h1>
      <p className="mt-1.5 text-[0.9375rem] text-muted">
        About two minutes. Nothing is booked until you confirm at the end.
      </p>

      {isLoggedIn && (
        <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-primary-200 dark:border-primary-800 bg-primary-50/70 dark:bg-primary-950/40 px-4 py-3 text-xs text-primary-900 dark:text-primary-100 shadow-xs">
          <div className="flex items-center gap-2.5">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-700 text-[0.6875rem] font-bold text-white uppercase shadow-xs shrink-0">
              {patient?.firstName ? patient.firstName[0] : 'C'}
            </span>
            <span>
              Booking as <strong>{patient ? `${patient.firstName} ${patient.lastName ?? ''}`.trim() : 'Patient'}</strong>
              {patient?.patientId && <span className="opacity-80"> ({patient.patientId})</span>}
            </span>
          </div>
          <Link
            to="/portal"
            className="font-medium underline hover:text-primary-700 dark:hover:text-primary-300 whitespace-nowrap"
          >
            My Appointments
          </Link>
        </div>
      )}

      <Stepper flow={flow} current={stepIndex} isNew={isNew} isLoggedIn={isLoggedIn} />

      {triage?.emergency && (
        <Callout tone="danger" className="mt-6">
          <p className="font-semibold">
            What you have described may be an emergency — {triage.emergency.advice.toLowerCase()}.
          </p>
          <p className="mt-1.5">
            Please do not wait for an appointment. Call{' '}
            <a href="tel:108" className="font-bold underline">
              108
            </a>{' '}
            for an ambulance, or come straight to Casualty, which is open 24 hours.
          </p>
        </Callout>
      )}

      {error && (
        <Callout tone="danger" className="mt-6">
          {error}
        </Callout>
      )}

      {/* The step sits on its own sheet. A multi-step form rendered loose on
          the page gives the controls no edge to sit against, so each step
          reads as a different layout rather than as the same panel with new
          contents in it. */}
      <div className="mt-6 rounded-[14px] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-sm lg:p-6">
        {step === 'who' && <WhoStep onNew={chooseNew} onReturning={chooseReturning} />}

        {step === 'identify' && (
          <IdentifyStep
            identifier={identifier}
            setIdentifier={setIdentifier}
            dob={returningDob}
            setDob={setReturningDob}
            busy={busy}
            onVerify={verify}
          />
        )}

        {step === 'details' && (
          <DetailsStep
            details={details}
            setDetails={setDetails}
            onNext={() => setStep('symptoms')}
          />
        )}

        {step === 'symptoms' && (
          <SymptomsStep
            verifiedName={verifiedName}
            complaint={complaint}
            setComplaint={setComplaint}
            symptoms={symptoms}
            setSymptoms={setSymptoms}
            busy={busy}
            onNext={runTriage}
          />
        )}

        {step === 'doctor' && (
          <DoctorStep
            triage={triage}
            specialties={specialties}
            doctors={doctors}
            busy={busy}
            onSwitch={switchSpecialty}
            onPick={pickDoctor}
          />
        )}

        {step === 'slot' && doctor && (
          <SlotStep
            doctor={doctor}
            date={date}
            onDate={changeDate}
            slots={slots}
            slotNote={slotNote}
            time={time}
            setTime={setTime}
            busy={busy}
            onConfirm={confirm}
          />
        )}
      </div>

      {stepIndex > 0 && step !== 'done' && (
        <button
          type="button"
          onClick={back}
          className="mt-6 inline-flex items-center gap-1.5 text-[0.8125rem] font-medium"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          <ArrowLeftIcon className="h-4 w-4" /> Back
        </button>
      )}
    </div>
  );
}

/* ── Steps ───────────────────────────────────────────────────────────── */

function Stepper({
  flow,
  current,
  isNew,
  isLoggedIn,
}: {
  flow: Step[];
  current: number;
  isNew: boolean | null;
  isLoggedIn: boolean;
}) {
  const LABELS: Record<Step, string> = {
    who: 'You',
    identify: 'Verify',
    details: 'Your details',
    symptoms: 'Symptoms',
    doctor: 'Doctor',
    slot: 'Time',
    done: 'Done',
  };
  if (!isLoggedIn && isNew === null) return null;

  return (
    <ol className="mt-7 flex flex-wrap items-center gap-x-2 gap-y-2.5">
      {flow.map((s, i) => {
        const done = i < current;
        const here = i === current;
        return (
          <li key={s} className="flex items-center gap-2">
            {/* Done, here, and still to come need to be three states rather
                than two. The old marker painted every step up to and
                including the current one identically, so the number you were
                actually on was the one thing the row did not show. */}
            <span
              className={cn(
                'flex h-6 w-6 items-center justify-center rounded-full text-[0.6875rem] font-[680] tabular',
                here && 'ring-[3px] ring-primary-700/20'
              )}
              style={{
                background: done || here ? 'var(--color-primary)' : 'var(--color-surface-sunken)',
                color: done || here ? '#fff' : 'var(--color-text-tertiary)',
              }}
            >
              {done ? <CheckIcon className="h-3.5 w-3.5 stroke-[3]" aria-hidden /> : i + 1}
            </span>
            <span
              className="text-[0.75rem]"
              style={{
                color: here ? 'var(--color-text)' : 'var(--color-text-tertiary)',
                fontWeight: here ? 620 : 500,
              }}
              aria-current={here ? 'step' : undefined}
            >
              {LABELS[s]}
            </span>
            {i < flow.length - 1 && (
              <span
                className="hidden h-px w-6 sm:block"
                style={{
                  background: done ? 'var(--color-primary)' : 'var(--color-border-dark)',
                }}
                aria-hidden
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

function WhoStep({ onNew, onReturning }: { onNew: () => void; onReturning: () => void }) {
  return (
    <>
      <h2 className="text-[1.125rem]">Have you been to this hospital before?</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <ChoiceCard
          icon={<UserPlusIcon className="h-6 w-6" />}
          title="I am a new patient"
          body="This is my first visit. We will create a hospital record and give you a patient ID."
          onClick={onNew}
        />
        <ChoiceCard
          icon={<UserIcon className="h-6 w-6" />}
          title="I have been here before"
          body="Sign in with your patient ID or the phone number we hold for you."
          onClick={onReturning}
        />
      </div>
      <p className="mt-5 text-[0.8125rem] text-faint">
        Not sure? Choose &ldquo;been here before&rdquo; and try your phone number. If we
        cannot find you, you can register as a new patient.
      </p>
    </>
  );
}

function ChoiceCard({
  icon,
  title,
  body,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-xl border p-5 text-left transition-[transform,box-shadow,border-color] duration-200 ease-out hover:-translate-y-px hover:shadow-md"
      style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
    >
      <span
        className="inline-flex h-11 w-11 items-center justify-center rounded-lg"
        style={{ background: 'var(--color-primary-50)', color: 'var(--color-primary)' }}
      >
        {icon}
      </span>
      <h3 className="mt-3.5 text-[1rem]">{title}</h3>
      <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-muted">{body}</p>
      <span
        className="mt-3 inline-flex items-center gap-1.5 text-[0.8125rem] font-semibold"
        style={{ color: 'var(--color-primary)' }}
      >
        Continue <ArrowRightIcon className="h-3.5 w-3.5" />
      </span>
    </button>
  );
}

function IdentifyStep({
  identifier,
  setIdentifier,
  dob,
  setDob,
  busy,
  onVerify,
}: {
  identifier: string;
  setIdentifier: (v: string) => void;
  dob: string;
  setDob: (v: string) => void;
  busy: boolean;
  onVerify: () => void;
}) {
  const ready = identifier.trim().length >= 3 && Boolean(dob);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (ready && !busy) onVerify();
      }}
      className="max-w-md space-y-4"
    >
      <h2 className="text-[1.125rem]">Find your hospital record</h2>
      <p className="text-[0.875rem] text-muted">
        Enter the patient ID from your discharge letter or appointment SMS, or the mobile
        number you registered with.
      </p>

      <Field label="Patient ID or mobile number" required>
        <Input
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          placeholder="PAT-100234 or 9876543210"
          autoFocus
          autoComplete="username"
        />
      </Field>

      <Field label="Date of birth" required hint="Used to confirm we have the right person.">
        <Input
          type="date"
          value={dob}
          onChange={(e) => setDob(e.target.value)}
          max={toInputDate(new Date())}
        />
      </Field>

      <Button type="submit" disabled={!ready || busy}>
        {busy ? 'Looking up…' : 'Continue'}
      </Button>
    </form>
  );
}

function DetailsStep({
  details,
  setDetails,
  onNext,
}: {
  details: Details;
  setDetails: (d: Details) => void;
  onNext: () => void;
}) {
  const set =
    <K extends keyof Details>(k: K) =>
    (v: Details[K]) =>
      setDetails({ ...details, [k]: v });

  const ready =
    details.firstName.trim().length > 0 &&
    details.lastName.trim().length > 0 &&
    Boolean(details.dateOfBirth) &&
    details.phone.trim().length >= 10;

  return (
    <>
      <h2 className="text-[1.125rem]">Your details</h2>
      <p className="mt-1 text-[0.875rem] text-muted">
        We use this to register you before you arrive. Nothing is shared outside the
        hospital.
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Field label="First name" required>
          <Input
            value={details.firstName}
            onChange={(e) => set('firstName')(e.target.value)}
            placeholder="Priya"
            autoComplete="given-name"
          />
        </Field>
        <Field label="Last name" required>
          <Input
            value={details.lastName}
            onChange={(e) => set('lastName')(e.target.value)}
            placeholder="Sharma"
            autoComplete="family-name"
          />
        </Field>
        <Field label="Date of birth" required>
          <Input
            type="date"
            value={details.dateOfBirth}
            onChange={(e) => set('dateOfBirth')(e.target.value)}
            max={toInputDate(new Date())}
          />
        </Field>
        <Field label="Gender">
          <Select value={details.gender} onChange={(e) => set('gender')(e.target.value as Details['gender'])}>
            <option value="">Prefer not to say</option>
            <option value="female">Female</option>
            <option value="male">Male</option>
            <option value="other">Other</option>
          </Select>
        </Field>
        <Field label="Mobile number" required hint="We send appointment reminders here.">
          <Input
            value={details.phone}
            onChange={(e) => set('phone')(e.target.value)}
            placeholder="98765 43210"
            inputMode="tel"
            autoComplete="tel"
          />
        </Field>
        <Field label="Email" hint="Optional.">
          <Input
            type="email"
            value={details.email}
            onChange={(e) => set('email')(e.target.value)}
            autoComplete="email"
          />
        </Field>
      </div>

      <Button className="mt-5" onClick={onNext} disabled={!ready}>
        Continue
      </Button>
    </>
  );
}

function SymptomsStep({
  verifiedName,
  complaint,
  setComplaint,
  symptoms,
  setSymptoms,
  busy,
  onNext,
}: {
  verifiedName: string | null;
  complaint: string;
  setComplaint: (v: string) => void;
  symptoms: string[];
  setSymptoms: (v: string[]) => void;
  busy: boolean;
  onNext: () => void;
}) {
  const toggle = (s: string) =>
    setSymptoms(symptoms.includes(s) ? symptoms.filter((x) => x !== s) : [...symptoms, s]);
  const ready = complaint.trim().length >= 3 || symptoms.length > 0;

  return (
    <>
      {verifiedName && (
        <Callout tone="success" className="mb-5">
          Welcome back, {verifiedName}. We found your record.
        </Callout>
      )}

      <h2 className="text-[1.125rem]">What is troubling you?</h2>
      <p className="mt-1.5 text-[0.875rem] text-muted">
        In your own words. This is what we use to suggest the right department — the
        doctor will see exactly what you write here.
      </p>

      <Field className="mt-5" label="Describe it">
        <Textarea
          rows={4}
          value={complaint}
          onChange={(e) => setComplaint(e.target.value)}
          placeholder="For example: a dull pain in my lower back for three weeks, worse in the morning."
        />
      </Field>

      <p className="mt-5 text-xs font-medium text-[var(--color-text-secondary)]">
        Or tap anything that applies
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {COMMON_SYMPTOMS.map((s) => {
          const on = symptoms.includes(s);
          return (
            <button
              key={s}
              type="button"
              onClick={() => toggle(s)}
              aria-pressed={on}
              className="rounded-full border px-3 py-1.5 text-[0.8125rem] font-medium transition-colors"
              style={{
                borderColor: on ? 'var(--color-primary)' : 'var(--color-border-dark)',
                background: on ? 'var(--color-primary-50)' : 'transparent',
                color: on ? 'var(--color-primary-dark)' : 'var(--color-text-secondary)',
              }}
            >
              {s}
            </button>
          );
        })}
      </div>

      <Button className="mt-6" onClick={onNext} disabled={!ready || busy}>
        {busy ? 'Finding the right department…' : 'Suggest a department'}
      </Button>
    </>
  );
}

function DoctorStep({
  triage,
  specialties,
  doctors,
  busy,
  onSwitch,
  onPick,
}: {
  triage: TriageResponse | null;
  specialties: PublicSpecialty[];
  doctors: PublicDoctor[];
  busy: boolean;
  onSwitch: (slug: string) => void;
  onPick: (d: PublicDoctor) => void;
}) {
  const Icon = iconFor(specialties.find((s) => s.slug === triage?.specialty)?.icon);
  const lowConfidence = (triage?.confidence ?? 0) < 0.5;

  return (
    <>
      {triage?.specialtyName && (
        <div
          className="rounded-xl border p-5"
          style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
        >
          <div className="flex items-start gap-3.5">
            <span
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg"
              style={{ background: 'var(--color-primary-50)', color: 'var(--color-primary)' }}
            >
              <Icon className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="eyebrow">We suggest</p>
              <h2 className="mt-0.5 text-[1.25rem]">{triage.specialtyName}</h2>
              <p className="mt-1.5 text-[0.875rem] leading-relaxed text-muted">
                {triage.reason}
              </p>
              {lowConfidence && (
                <p className="mt-2 text-[0.8125rem]" style={{ color: 'var(--color-warning)' }}>
                  This is a rough guess — please change it below if you know better.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      <Field className="mt-5" label="Department" hint="Change this if you would rather see someone else.">
        <Select
          value={triage?.specialty ?? ''}
          onChange={(e) => onSwitch(e.target.value)}
          disabled={busy}
        >
          {!triage?.specialty && <option value="">Choose a department</option>}
          {specialties.map((s) => (
            <option key={s.slug} value={s.slug}>
              {s.name}
            </option>
          ))}
        </Select>
      </Field>

      <h3 className="mt-7 text-[1rem]">Choose a doctor</h3>
      {busy ? (
        <div className="flex justify-center py-10">
          <Spinner size={22} />
        </div>
      ) : doctors.length === 0 ? (
        <Callout tone="warning" className="mt-3">
          No doctor in this department is taking online bookings at the moment. Please
          choose another department, or call us on{' '}
          <a href="tel:+914440001200" className="font-semibold underline">
            +91 44 4000 1200
          </a>
          .
        </Callout>
      ) : (
        <div className="mt-3 space-y-3">
          {doctors.map((d) => (
            <button
              key={d._id}
              type="button"
              onClick={() => onPick(d)}
              className="flex w-full flex-wrap items-start gap-4 rounded-xl border p-4 text-left transition-[transform,box-shadow,border-color] duration-200 ease-out hover:-translate-y-px hover:shadow-md"
              style={{
                borderColor: 'var(--color-border)',
                background: 'var(--color-surface)',
              }}
            >
              <span
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-[0.9375rem] font-semibold"
                style={{
                  background: 'var(--color-primary-50)',
                  color: 'var(--color-primary-dark)',
                }}
              >
                {d.firstName[0]}
                {d.lastName?.[0] ?? ''}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[1rem] font-semibold">{doctorName(d)}</span>
                <span className="block text-[0.8125rem] text-muted">
                  {d.doctorProfile?.qualifications || d.department}
                </span>
                {d.doctorProfile?.bio && (
                  <span className="mt-1.5 block text-[0.8125rem] leading-relaxed text-muted">
                    {d.doctorProfile.bio}
                  </span>
                )}
                <span className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[0.75rem] text-faint">
                  {d.doctorProfile?.yearsExperience > 0 && (
                    <span>{d.doctorProfile.yearsExperience} years&rsquo; experience</span>
                  )}
                  {d.doctorProfile?.consultationFee > 0 && (
                    <span>₹{d.doctorProfile.consultationFee} consultation</span>
                  )}
                  {d.doctorProfile?.languages?.length > 0 && (
                    <span>{d.doctorProfile.languages.join(', ')}</span>
                  )}
                </span>
              </span>
              <ArrowRightIcon
                className="h-4 w-4 shrink-0"
                style={{ color: 'var(--color-text-tertiary)' }}
              />
            </button>
          ))}
        </div>
      )}
    </>
  );
}

function SlotStep({
  doctor,
  date,
  onDate,
  slots,
  slotNote,
  time,
  setTime,
  busy,
  onConfirm,
}: {
  doctor: PublicDoctor;
  date: string;
  onDate: (d: string) => void;
  slots: { time: string; available: boolean }[];
  slotNote: string | null;
  time: string;
  setTime: (t: string) => void;
  busy: boolean;
  onConfirm: () => void;
}) {
  const free = slots.filter((s) => s.available);
  const days = doctor.doctorProfile?.availableDays ?? [1, 2, 3, 4, 5];

  return (
    <>
      <div
        className="rounded-xl border p-5"
        style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
      >
        <p className="eyebrow">Consultation with</p>
        <h2 className="mt-0.5 text-[1.25rem]">{doctorName(doctor)}</h2>
        <p className="mt-1 text-[0.8125rem] text-muted">
          {doctor.doctorProfile?.qualifications || doctor.department} · Clinic days:{' '}
          {dayNames(days)}
        </p>
      </div>

      <Field
        className="mt-5 max-w-xs"
        label="Date"
        hint="Only clinic days will show free appointments."
      >
        <Input
          type="date"
          value={date}
          min={toInputDate(new Date())}
          onChange={(e) => onDate(e.target.value)}
        />
      </Field>

      {busy ? (
        <div className="flex justify-center py-12">
          <Spinner size={22} />
        </div>
      ) : slotNote ? (
        <Callout tone="info" className="mt-5">
          {slotNote}
        </Callout>
      ) : slots.length === 0 ? (
        <Callout tone="warning" className="mt-5">
          No slots are listed for this day. The doctor may be fully booked or off clinic.
          Pick another date above.
        </Callout>
      ) : free.length === 0 ? (
        <Callout tone="warning" className="mt-5">
          All slots for this day are taken. Please pick another date above.
        </Callout>
      ) : (
        <>
          <p className="mt-5 text-xs font-medium text-[var(--color-text-secondary)]">
            {free.length} slot{free.length === 1 ? '' : 's'} free
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {slots.map((s) => (
              <button
                key={s.time}
                type="button"
                disabled={!s.available}
                onClick={() => setTime(s.time)}
                aria-pressed={time === s.time}
                className={cn(
                  'rounded-lg border px-3.5 py-2 text-[0.875rem] font-medium tabular transition-colors',
                  !s.available && 'cursor-not-allowed line-through opacity-40'
                )}
                style={{
                  borderColor:
                    time === s.time ? 'var(--color-primary)' : 'var(--color-border-dark)',
                  background: time === s.time ? 'var(--color-primary)' : 'transparent',
                  color:
                    time === s.time ? '#fff' : 'var(--color-text-secondary)',
                }}
              >
                {s.time}
              </button>
            ))}
          </div>
        </>
      )}

      <Button className="mt-6" onClick={onConfirm} disabled={!time || busy}>
        {busy ? 'Booking…' : 'Confirm appointment'}
      </Button>
    </>
  );
}

function Confirmation({ booked, isLoggedIn }: { booked: Booked; isLoggedIn: boolean }) {
  const when = new Date(booked.scheduledDate);
  return (
    <div className="mx-auto max-w-2xl px-4 py-14 text-center">
      <span
        className="mx-auto flex h-14 w-14 items-center justify-center rounded-full"
        style={{ background: 'var(--color-success-light)', color: 'var(--color-success)' }}
      >
        <CheckCircleIcon className="h-7 w-7" />
      </span>
      <h1 className="mt-5 text-[1.75rem] tracking-[-0.02em]">You are booked in</h1>
      <p className="mt-2 text-[0.9375rem] text-muted">
        We have confirmed your appointment with {booked.doctorName}.
      </p>

      <div
        className="mt-7 rounded-2xl border p-6 text-left"
        style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
      >
        <dl className="grid gap-4 sm:grid-cols-2">
          <Detail label="Appointment" value={booked.appointmentId} />
          <Detail label="Doctor" value={booked.doctorName} />
          <Detail
            label="When"
            value={`${when.toLocaleDateString(undefined, {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })} at ${booked.scheduledTime}`}
          />
          <Detail label="Department" value={booked.specialty} />
        </dl>

        {booked.isNew && (
          <div
            className="mt-5 rounded-xl border p-4"
            style={{
              borderColor: 'var(--color-primary)',
              background: 'var(--color-primary-50)',
            }}
          >
            <p className="text-[0.75rem] font-semibold uppercase tracking-[0.1em]">
              Your patient ID
            </p>
            <p className="mt-1 text-[1.375rem] font-semibold tabular">{booked.patientId}</p>
            <p className="mt-1.5 text-[0.8125rem] leading-relaxed">
              Write this down. You will need it, with your date of birth, to sign in to the
              patient portal and to book again.
            </p>
          </div>
        )}
      </div>

      <div
        className="mt-6 rounded-xl border p-4 text-left text-[0.8125rem] leading-relaxed text-muted"
        style={{ borderColor: 'var(--color-border)' }}
      >
        <p className="font-semibold text-[var(--color-text)]">Before you come</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Arrive 15 minutes early to complete check-in.</li>
          <li>Bring any photo ID, previous prescriptions and recent test reports.</li>
          <li>
            If you need to cancel, call{' '}
            <a href="tel:+914440001200" className="font-medium underline">
              +91 44 4000 1200
            </a>
            .
          </li>
        </ul>
      </div>

      <div className="mt-7 flex flex-wrap justify-center gap-3">
        <Link to="/portal">
          <Button>Go to my appointments</Button>
        </Link>
        <Link to={isLoggedIn ? '/portal' : '/'}>
          <Button variant="outline">{isLoggedIn ? 'Patient portal' : 'Back to the website'}</Button>
        </Link>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="eyebrow">{label}</dt>
      <dd className="mt-0.5 text-[0.9375rem] font-medium">{value}</dd>
    </div>
  );
}

/* ── helpers ─────────────────────────────────────────────────────────── */

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function dayNames(days: number[]): string {
  if (!days.length) return 'not set';
  return days
    .slice()
    .sort((a, b) => a - b)
    .map((d) => DAY_NAMES[d]?.slice(0, 3))
    .join(', ');
}

/** The soonest day the doctor actually holds clinic, starting tomorrow. */
function nextClinicDay(days: number[]): string {
  const d = new Date();
  for (let i = 1; i <= 14; i += 1) {
    const candidate = new Date(d);
    candidate.setDate(d.getDate() + i);
    if (!days.length || days.includes(candidate.getDay())) {
      return toInputDate(candidate);
    }
  }
  const fallback = new Date(d);
  fallback.setDate(d.getDate() + 1);
  return toInputDate(fallback);
}

/** Local calendar day — toISOString() would shift it across a timezone. */
function toInputDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

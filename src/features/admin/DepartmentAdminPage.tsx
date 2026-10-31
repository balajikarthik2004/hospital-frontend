import { useMemo, useState } from 'react';
import {
  CheckIcon,
  ExclamationTriangleIcon,
  PencilSquareIcon,
  PlusIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import {
  Badge,
  Button,
  Callout,
  Card,
  Checkbox,
  ConfirmDialog,
  ErrorState,
  Field,
  Input,
  LoadingPane,
  Modal,
  PageHeader,
  Select,
  Tabs,
  Textarea,
} from '@/components/common';
import { api, errorMessage } from '@/lib/api';
import { useApi } from '@/hooks/useApi';
import { toast } from '@/store/notificationStore';

/* ═══════════════════════════════════════════════════════════════════════════
   What an administrator maintains behind the public website.

   Two things live here, and they are coupled: the departments patients choose
   from, and which doctors each one offers. A department with no bookable
   doctor is a dead end in the booking flow, so the table says so out loud
   rather than leaving it to be discovered by a patient.
   ═══════════════════════════════════════════════════════════════════════════ */

interface AdminSpecialty {
  _id: string;
  slug: string;
  name: string;
  tagline: string;
  description: string;
  icon: string;
  symptomKeywords: string[];
  commonConditions: string[];
  consultationFee: number;
  location: string;
  isActive: boolean;
  displayOrder: number;
  doctorCount: number;
  bookableCount: number;
}

interface AdminDoctor {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  department: string;
  isActive: boolean;
  doctorProfile?: {
    specialty: string;
    qualifications: string;
    yearsExperience: number;
    bio: string;
    languages: string[];
    consultationFee: number;
    availableDays: number[];
    clinicStart: string;
    clinicEnd: string;
    slotMinutes: number;
    isBookable: boolean;
  };
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const ICON_NAMES = [
  'HeartIcon',
  'StethoscopeIcon',
  'BoneIcon',
  'BabyIcon',
  'SparklesIcon',
  'EarIcon',
  'BeakerIcon',
  'CloudIcon',
  'BoltIcon',
  'UserGroupIcon',
];

export function DepartmentAdminPage() {
  const [tab, setTab] = useState<'departments' | 'doctors'>('departments');

  const departments = useApi<{ specialties: AdminSpecialty[] }>('/specialties');
  const doctors = useApi<{ doctors: AdminDoctor[] }>('/specialties/doctors');

  const [editing, setEditing] = useState<AdminSpecialty | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<AdminSpecialty | null>(null);
  const [editingDoctor, setEditingDoctor] = useState<AdminDoctor | null>(null);

  const list = departments.data?.specialties ?? [];

  const orphaned = useMemo(
    () => list.filter((s) => s.isActive && s.bookableCount === 0),
    [list]
  );

  const remove = async (s: AdminSpecialty) => {
    try {
      await api.delete(`/specialties/${s._id}`);
      toast.success(`${s.name} deleted`);
      void departments.refetch();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setDeleting(null);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="Departments and doctors"
        story="What patients see on the website: the departments they can choose from, the words that route a complaint to one, and which doctors are offered for online booking."
        actions={
          tab === 'departments' ? (
            <Button icon={<PlusIcon className="h-4 w-4" />} onClick={() => setCreating(true)}>
              New department
            </Button>
          ) : null
        }
      />

      {orphaned.length > 0 && (
        <Callout tone="warning" className="mb-5">
          <p className="font-semibold">
            {orphaned.length} department{orphaned.length === 1 ? ' is' : 's are'} live with
            nobody bookable
          </p>
          <p className="mt-1">
            {orphaned.map((s) => s.name).join(', ')} —{' '}
            {orphaned.length === 1 ? 'it appears' : 'they appear'} on the website, but a
            patient choosing {orphaned.length === 1 ? 'it' : 'them'} will find no doctor to
            book. Make a doctor bookable, or deactivate the department.
          </p>
        </Callout>
      )}

      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { key: 'departments', label: 'Departments' },
          { key: 'doctors', label: 'Doctor profiles' },
        ]}
      />

      {tab === 'departments' ? (
        departments.error ? (
          <ErrorState message={departments.error} onRetry={departments.refetch} />
        ) : departments.loading && !departments.data ? (
          <LoadingPane label="Loading departments" />
        ) : (
          <div className="mt-5 space-y-3">
            {list.map((s) => (
              <Card key={s._id}>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3>{s.name}</h3>
                      <Badge tone={s.isActive ? 'success' : 'neutral'}>
                        {s.isActive ? 'Live' : 'Hidden'}
                      </Badge>
                      <Badge tone={s.bookableCount > 0 ? 'info' : 'warning'}>
                        {s.bookableCount} bookable / {s.doctorCount} doctors
                      </Badge>
                      <code className="text-[0.75rem] text-faint">{s.slug}</code>
                    </div>
                    <p className="mt-1 text-[0.875rem] text-muted">{s.tagline}</p>

                    <div className="mt-3">
                      <p className="eyebrow">Triage keywords ({s.symptomKeywords.length})</p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {s.symptomKeywords.slice(0, 12).map((k) => (
                          <span
                            key={k}
                            className="rounded-full border px-2 py-0.5 text-[0.6875rem]"
                            style={{
                              borderColor: 'var(--color-border-dark)',
                              color: 'var(--color-text-secondary)',
                            }}
                          >
                            {k}
                          </span>
                        ))}
                        {s.symptomKeywords.length > 12 && (
                          <span className="text-[0.6875rem] text-faint">
                            +{s.symptomKeywords.length - 12} more
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      icon={<PencilSquareIcon className="h-4 w-4" />}
                      onClick={() => setEditing(s)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      icon={<TrashIcon className="h-4 w-4" />}
                      onClick={() => setDeleting(s)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )
      ) : doctors.loading && !doctors.data ? (
        <LoadingPane label="Loading doctors" />
      ) : (
        <div className="mt-5 space-y-3">
          {(doctors.data?.doctors ?? []).map((d) => (
            <Card key={d._id}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3>
                      Dr {d.firstName} {d.lastName}
                    </h3>
                    <Badge tone={d.doctorProfile?.isBookable ? 'success' : 'neutral'}>
                      {d.doctorProfile?.isBookable ? 'On the website' : 'Not bookable'}
                    </Badge>
                    {!d.isActive && <Badge tone="danger">Inactive account</Badge>}
                  </div>
                  <p className="mt-1 text-[0.875rem] text-muted">
                    {d.doctorProfile?.specialty
                      ? `${d.doctorProfile.specialty} · ${d.doctorProfile.qualifications || 'no qualifications set'}`
                      : 'No department set'}
                  </p>
                  {d.doctorProfile?.isBookable && (
                    <p className="mt-1 text-[0.75rem] text-faint tabular">
                      {(d.doctorProfile.availableDays ?? [])
                        .slice()
                        .sort((a, b) => a - b)
                        .map((n) => DAYS[n])
                        .join(', ')}{' '}
                      · {d.doctorProfile.clinicStart}–{d.doctorProfile.clinicEnd} ·{' '}
                      {d.doctorProfile.slotMinutes} min slots
                    </p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  icon={<PencilSquareIcon className="h-4 w-4" />}
                  onClick={() => setEditingDoctor(d)}
                >
                  Edit profile
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {(editing || creating) && (
        <SpecialtyModal
          specialty={editing}
          onClose={() => {
            setEditing(null);
            setCreating(false);
          }}
          onSaved={() => {
            setEditing(null);
            setCreating(false);
            void departments.refetch();
          }}
        />
      )}

      {editingDoctor && (
        <DoctorModal
          doctor={editingDoctor}
          specialties={list}
          onClose={() => setEditingDoctor(null)}
          onSaved={() => {
            setEditingDoctor(null);
            void doctors.refetch();
            void departments.refetch();
          }}
        />
      )}

      {deleting && (
        <ConfirmDialog
          open
          title={`Delete ${deleting.name}?`}
          message="This cannot be undone. If any doctor or appointment still refers to this department, the server will refuse and suggest deactivating it instead."
          confirmLabel="Delete"
          tone="danger"
          onConfirm={() => void remove(deleting)}
          onClose={() => setDeleting(null)}
        />
      )}
    </>
  );
}

/* ── Department editor ───────────────────────────────────────────────── */

function SpecialtyModal({
  specialty,
  onClose,
  onSaved,
}: {
  specialty: AdminSpecialty | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    slug: specialty?.slug ?? '',
    name: specialty?.name ?? '',
    tagline: specialty?.tagline ?? '',
    description: specialty?.description ?? '',
    icon: specialty?.icon ?? 'HeartIcon',
    consultationFee: String(specialty?.consultationFee ?? 500),
    location: specialty?.location ?? '',
    displayOrder: String(specialty?.displayOrder ?? 100),
    isActive: specialty?.isActive ?? true,
    symptomKeywords: (specialty?.symptomKeywords ?? []).join(', '),
    commonConditions: (specialty?.commonConditions ?? []).join(', '),
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: keyof typeof form) => (v: string | boolean) =>
    setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    setBusy(true);
    setError(null);
    const payload = {
      name: form.name.trim(),
      tagline: form.tagline.trim(),
      description: form.description.trim(),
      icon: form.icon,
      consultationFee: Number(form.consultationFee) || 0,
      location: form.location.trim(),
      displayOrder: Number(form.displayOrder) || 100,
      isActive: form.isActive,
      symptomKeywords: splitList(form.symptomKeywords),
      commonConditions: splitList(form.commonConditions),
    };
    try {
      if (specialty) {
        await api.put(`/specialties/${specialty._id}`, payload);
      } else {
        await api.post('/specialties', { ...payload, slug: form.slug.trim().toLowerCase() });
      }
      toast.success(specialty ? `${payload.name} updated` : `${payload.name} created`);
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const ready = form.name.trim() && (specialty || /^[a-z0-9-]{2,}$/.test(form.slug.trim()));

  return (
    <Modal
      open
      onClose={onClose}
      title={specialty ? `Edit ${specialty.name}` : 'New department'}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={!ready || busy} icon={<CheckIcon className="h-4 w-4" />}>
            {busy ? 'Saving…' : 'Save'}
          </Button>
        </>
      }
    >
      {error && (
        <Callout tone="danger" className="mb-4">
          {error}
        </Callout>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {!specialty && (
          <Field
            label="Key"
            required
            hint="Lower-case, no spaces. Used in URLs and on doctor records — it cannot be changed later."
          >
            <Input
              value={form.slug}
              onChange={(e) => set('slug')(e.target.value)}
              placeholder="cardiology"
            />
          </Field>
        )}
        <Field label="Name" required>
          <Input value={form.name} onChange={(e) => set('name')(e.target.value)} />
        </Field>
        <Field label="Tagline" hint="One line, shown on the department card.">
          <Input value={form.tagline} onChange={(e) => set('tagline')(e.target.value)} />
        </Field>
        <Field label="Icon">
          <Select value={form.icon} onChange={(e) => set('icon')(e.target.value)}>
            {ICON_NAMES.map((n) => (
              <option key={n} value={n}>
                {n.replace('Icon', '')}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Consultation fee (₹)">
          <Input
            type="number"
            min={0}
            value={form.consultationFee}
            onChange={(e) => set('consultationFee')(e.target.value)}
          />
        </Field>
        <Field label="Location">
          <Input
            value={form.location}
            onChange={(e) => set('location')(e.target.value)}
            placeholder="Second floor, Block B"
          />
        </Field>
        <Field label="Display order" hint="Lower sorts first on the website.">
          <Input
            type="number"
            min={0}
            value={form.displayOrder}
            onChange={(e) => set('displayOrder')(e.target.value)}
          />
        </Field>
      </div>

      <Field className="mt-4" label="Description">
        <Textarea
          rows={3}
          value={form.description}
          onChange={(e) => set('description')(e.target.value)}
        />
      </Field>

      <Field
        className="mt-4"
        label="Triage keywords"
        hint="Comma separated. A complaint containing any of these is routed here. Write them the way a patient types — 'breathless', not 'dyspnoea'."
      >
        <Textarea
          rows={3}
          value={form.symptomKeywords}
          onChange={(e) => set('symptomKeywords')(e.target.value)}
          placeholder="chest pain, palpitations, breathless"
        />
      </Field>

      <Field
        className="mt-4"
        label="Commonly treated"
        hint="Comma separated. Listed on the department page."
      >
        <Textarea
          rows={2}
          value={form.commonConditions}
          onChange={(e) => set('commonConditions')(e.target.value)}
        />
      </Field>

      <div className="mt-4">
        <Checkbox
          checked={form.isActive}
          onChange={(e) => set('isActive')(e.target.checked)}
          label="Show on the public website"
        />
      </div>
    </Modal>
  );
}

/* ── Doctor profile editor ───────────────────────────────────────────── */

function DoctorModal({
  doctor,
  specialties,
  onClose,
  onSaved,
}: {
  doctor: AdminDoctor;
  specialties: AdminSpecialty[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const p = doctor.doctorProfile;
  const [form, setForm] = useState({
    specialty: p?.specialty ?? '',
    qualifications: p?.qualifications ?? '',
    yearsExperience: String(p?.yearsExperience ?? 0),
    bio: p?.bio ?? '',
    languages: (p?.languages ?? []).join(', '),
    consultationFee: String(p?.consultationFee ?? 0),
    availableDays: p?.availableDays ?? [1, 2, 3, 4, 5],
    clinicStart: p?.clinicStart ?? '09:00',
    clinicEnd: p?.clinicEnd ?? '17:00',
    slotMinutes: String(p?.slotMinutes ?? 30),
    isBookable: p?.isBookable ?? false,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleDay = (d: number) =>
    setForm((f) => ({
      ...f,
      availableDays: f.availableDays.includes(d)
        ? f.availableDays.filter((x) => x !== d)
        : [...f.availableDays, d].sort((a, b) => a - b),
    }));

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.put(`/specialties/doctors/${doctor._id}`, {
        specialty: form.specialty,
        qualifications: form.qualifications.trim(),
        yearsExperience: Number(form.yearsExperience) || 0,
        bio: form.bio.trim(),
        languages: splitList(form.languages),
        consultationFee: Number(form.consultationFee) || 0,
        availableDays: form.availableDays,
        clinicStart: form.clinicStart,
        clinicEnd: form.clinicEnd,
        slotMinutes: Number(form.slotMinutes) || 30,
        isBookable: form.isBookable,
      });
      toast.success(`Dr ${doctor.lastName}'s profile updated`);
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const noDays = form.availableDays.length === 0;

  return (
    <Modal
      open
      onClose={onClose}
      title={`Dr ${doctor.firstName} ${doctor.lastName}`}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={save}
            disabled={busy || (form.isBookable && (noDays || !form.specialty))}
          >
            {busy ? 'Saving…' : 'Save'}
          </Button>
        </>
      }
    >
      {error && (
        <Callout tone="danger" className="mb-4">
          {error}
        </Callout>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Department" required={form.isBookable}>
          <Select value={form.specialty} onChange={(e) => setForm({ ...form, specialty: e.target.value })}>
            <option value="">Not set</option>
            {specialties.map((s) => (
              <option key={s.slug} value={s.slug}>
                {s.name}
                {s.isActive ? '' : ' (hidden)'}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Qualifications">
          <Input
            value={form.qualifications}
            onChange={(e) => setForm({ ...form, qualifications: e.target.value })}
            placeholder="MBBS, MD, DM (Cardiology)"
          />
        </Field>
        <Field label="Years of experience">
          <Input
            type="number"
            min={0}
            value={form.yearsExperience}
            onChange={(e) => setForm({ ...form, yearsExperience: e.target.value })}
          />
        </Field>
        <Field label="Consultation fee (₹)">
          <Input
            type="number"
            min={0}
            value={form.consultationFee}
            onChange={(e) => setForm({ ...form, consultationFee: e.target.value })}
          />
        </Field>
        <Field label="Clinic starts">
          <Input
            type="time"
            value={form.clinicStart}
            onChange={(e) => setForm({ ...form, clinicStart: e.target.value })}
          />
        </Field>
        <Field label="Clinic ends">
          <Input
            type="time"
            value={form.clinicEnd}
            onChange={(e) => setForm({ ...form, clinicEnd: e.target.value })}
          />
        </Field>
        <Field label="Slot length (minutes)">
          <Input
            type="number"
            min={5}
            max={120}
            value={form.slotMinutes}
            onChange={(e) => setForm({ ...form, slotMinutes: e.target.value })}
          />
        </Field>
        <Field label="Languages" hint="Comma separated.">
          <Input
            value={form.languages}
            onChange={(e) => setForm({ ...form, languages: e.target.value })}
          />
        </Field>
      </div>

      <Field className="mt-4" label="Biography" hint="Two or three sentences, shown on the doctor card.">
        <Textarea rows={3} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} />
      </Field>

      <div className="mt-4">
        <p className="mb-1.5 text-xs font-medium text-[var(--color-text-secondary)]">
          Clinic days
        </p>
        <div className="flex flex-wrap gap-2">
          {DAYS.map((label, i) => {
            const on = form.availableDays.includes(i);
            return (
              <button
                key={label}
                type="button"
                onClick={() => toggleDay(i)}
                aria-pressed={on}
                className="rounded-lg border px-3 py-1.5 text-[0.8125rem] font-medium transition-colors"
                style={{
                  borderColor: on ? 'var(--color-primary)' : 'var(--color-border-dark)',
                  background: on ? 'var(--color-primary)' : 'transparent',
                  color: on ? '#fff' : 'var(--color-text-secondary)',
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
        {noDays && form.isBookable && (
          <p className="mt-2 flex items-center gap-1.5 text-xs" style={{ color: 'var(--color-danger)' }}>
            <ExclamationTriangleIcon className="h-3.5 w-3.5" />
            Pick at least one clinic day, or no patient can book.
          </p>
        )}
      </div>

      <div className="mt-5">
        <Checkbox
          checked={form.isBookable}
          onChange={(e) => setForm({ ...form, isBookable: e.target.checked })}
          label="Offer this doctor for online booking"
        />
        <p className="mt-1.5 pl-6 text-xs leading-relaxed text-faint">
          When off, the doctor keeps full access to the clinical system but does not
          appear on the public website.
        </p>
      </div>
    </Modal>
  );
}

const splitList = (s: string) =>
  s
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);

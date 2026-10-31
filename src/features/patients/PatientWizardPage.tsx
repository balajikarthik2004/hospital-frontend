import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeftIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import {
  Badge,
  Button,
  Card,
  Checkbox,
  ErrorState,
  Field,
  Input,
  PageHeader,
  Select,
  Textarea,
} from '@/components/common';
import { api } from '@/lib/api';
import { useMutation } from '@/hooks/useApi';
import { toast } from '@/store/notificationStore';
import { cn, titleCase } from '@/lib/utils';
import type { MedRoute, Patient } from '@/types';

const STEPS = [
  'Demographics',
  'Emergency contacts',
  'Insurance',
  'Medical history',
  'Current medications',
  'Primary care',
  'Preferences',
  'Review',
] as const;

interface FormState {
  demographics: {
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    gender: 'male' | 'female' | 'other';
    bloodType: string;
    address: { street: string; city: string; state: string; zipCode: string };
    phone: string;
    email: string;
    preferredLanguage: string;
    literacyLevel: 'basic' | 'intermediate' | 'advanced';
  };
  emergencyContacts: { name: string; relationship: string; phone: string }[];
  insurance: {
    provider: string;
    policyNumber: string;
    groupNumber: string;
    coverageType: string;
    isVerified: boolean;
  };
  medicalHistory: {
    conditions: string[];
    surgeries: { name: string; date: string }[];
    allergies: {
      substance: string;
      reaction: string;
      severity: 'mild' | 'moderate' | 'severe' | 'life-threatening';
    }[];
    familyHistory: string[];
  };
  currentMedications: {
    drugName: string;
    dosage: string;
    frequency: string;
    route: MedRoute;
    notes: string;
  }[];
  primaryCarePhysician: { name: string; clinic: string; phone: string; fax: string };
  communicationPreference: 'phone' | 'email' | 'sms' | 'portal';
}

const EMPTY: FormState = {
  demographics: {
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    gender: 'female',
    bloodType: 'O+',
    address: { street: '', city: '', state: '', zipCode: '' },
    phone: '',
    email: '',
    preferredLanguage: 'English',
    literacyLevel: 'intermediate',
  },
  emergencyContacts: [{ name: '', relationship: '', phone: '' }],
  insurance: {
    provider: '',
    policyNumber: '',
    groupNumber: '',
    coverageType: '',
    isVerified: false,
  },
  medicalHistory: { conditions: [], surgeries: [], allergies: [], familyHistory: [] },
  currentMedications: [],
  primaryCarePhysician: { name: '', clinic: '', phone: '', fax: '' },
  communicationPreference: 'phone',
};

export function PatientWizardPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [conditionInput, setConditionInput] = useState('');
  const [familyInput, setFamilyInput] = useState('');

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const submit = useMutation(async () => {
    const payload = {
      ...form,
      emergencyContacts: form.emergencyContacts.filter((c) => c.name.trim()),
      currentMedications: form.currentMedications
        .filter((m) => m.drugName.trim())
        .map((m) => ({ ...m, notes: m.notes || null })),
      medicalHistory: {
        ...form.medicalHistory,
        surgeries: form.medicalHistory.surgeries.filter((s) => s.name.trim()),
        allergies: form.medicalHistory.allergies.filter((a) => a.substance.trim()),
      },
    };
    const { data } = await api.post<{ patient: Patient }>('/patients', payload);
    toast.success(
      'Patient registered',
      `${data.patient.patientId} — ${data.patient.demographics.firstName} ${data.patient.demographics.lastName}`
    );
    navigate(`/app/patients/${data.patient._id}`);
  });

  const d = form.demographics;
  const step1Valid = Boolean(d.firstName.trim() && d.lastName.trim() && d.dateOfBirth && d.gender);
  const canAdvance = step === 0 ? step1Valid : true;

  return (
    <>
      <PageHeader
        breadcrumb={
          <Link
            to="/app/patients"
            className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-primary-700"
          >
            <ArrowLeftIcon className="h-3.5 w-3.5" />
            Back to patients
          </Link>
        }
        title="Register a patient"
        subtitle={`Step ${step + 1} of ${STEPS.length} — ${STEPS[step]}`}
      />

      {/* Stepper */}
      <ol className="mb-6 flex flex-wrap gap-1.5">
        {STEPS.map((label, i) => (
          <li key={label}>
            <button
              type="button"
              onClick={() => (i <= step || step1Valid) && setStep(i)}
              className={cn(
                'rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                i === step && 'ring-2 ring-primary-600/30'
              )}
              style={{
                background:
                  i < step
                    ? 'var(--color-success-light)'
                    : i === step
                      ? 'var(--color-primary-50)'
                      : 'var(--color-surface-muted)',
                color:
                  i < step
                    ? 'var(--color-success)'
                    : i === step
                      ? 'var(--color-primary-dark)'
                      : 'var(--color-text-tertiary)',
              }}
            >
              {i < step ? '✓ ' : `${i + 1}. `}
              {label}
            </button>
          </li>
        ))}
      </ol>

      <Card>
        {/* ─── 1. Demographics ─── */}
        {step === 0 && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="First name" required>
              <Input
                value={d.firstName}
                onChange={(e) =>
                  update('demographics', { ...d, firstName: e.target.value })
                }
              />
            </Field>
            <Field label="Last name" required>
              <Input
                value={d.lastName}
                onChange={(e) => update('demographics', { ...d, lastName: e.target.value })}
              />
            </Field>
            <Field label="Date of birth" required>
              <Input
                type="date"
                max={new Date().toISOString().slice(0, 10)}
                value={d.dateOfBirth}
                onChange={(e) => update('demographics', { ...d, dateOfBirth: e.target.value })}
              />
            </Field>
            <Field label="Gender" required>
              <Select
                value={d.gender}
                onChange={(e) =>
                  update('demographics', { ...d, gender: e.target.value as 'male' })
                }
              >
                <option value="female">Female</option>
                <option value="male">Male</option>
                <option value="other">Other</option>
              </Select>
            </Field>
            <Field label="Blood type">
              <Select
                value={d.bloodType}
                onChange={(e) => update('demographics', { ...d, bloodType: e.target.value })}
              >
                {['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'].map((b) => (
                  <option key={b}>{b}</option>
                ))}
              </Select>
            </Field>
            <Field label="Phone">
              <Input
                value={d.phone}
                onChange={(e) => update('demographics', { ...d, phone: e.target.value })}
              />
            </Field>
            <Field label="Email" className="sm:col-span-2">
              <Input
                type="email"
                value={d.email}
                onChange={(e) => update('demographics', { ...d, email: e.target.value })}
              />
            </Field>
            <Field label="Street" className="sm:col-span-2">
              <Input
                value={d.address.street}
                onChange={(e) =>
                  update('demographics', {
                    ...d,
                    address: { ...d.address, street: e.target.value },
                  })
                }
              />
            </Field>
            <Field label="City">
              <Input
                value={d.address.city}
                onChange={(e) =>
                  update('demographics', { ...d, address: { ...d.address, city: e.target.value } })
                }
              />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="State">
                <Input
                  value={d.address.state}
                  onChange={(e) =>
                    update('demographics', {
                      ...d,
                      address: { ...d.address, state: e.target.value },
                    })
                  }
                />
              </Field>
              <Field label="ZIP">
                <Input
                  value={d.address.zipCode}
                  onChange={(e) =>
                    update('demographics', {
                      ...d,
                      address: { ...d.address, zipCode: e.target.value },
                    })
                  }
                />
              </Field>
            </div>
          </div>
        )}

        {/* ─── 2. Emergency contacts ─── */}
        {step === 1 && (
          <div className="space-y-4">
            <p className="text-sm text-muted">Up to three contacts.</p>
            {form.emergencyContacts.map((contact, i) => (
              <div key={i} className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
                <Field label={i === 0 ? 'Name' : undefined}>
                  <Input
                    value={contact.name}
                    placeholder="Full name"
                    onChange={(e) => {
                      const next = [...form.emergencyContacts];
                      next[i] = { ...contact, name: e.target.value };
                      update('emergencyContacts', next);
                    }}
                  />
                </Field>
                <Field label={i === 0 ? 'Relationship' : undefined}>
                  <Input
                    value={contact.relationship}
                    placeholder="Spouse, daughter…"
                    onChange={(e) => {
                      const next = [...form.emergencyContacts];
                      next[i] = { ...contact, relationship: e.target.value };
                      update('emergencyContacts', next);
                    }}
                  />
                </Field>
                <Field label={i === 0 ? 'Phone' : undefined}>
                  <Input
                    value={contact.phone}
                    onChange={(e) => {
                      const next = [...form.emergencyContacts];
                      next[i] = { ...contact, phone: e.target.value };
                      update('emergencyContacts', next);
                    }}
                  />
                </Field>
                <div className={cn('flex', i === 0 ? 'items-end pb-[1px]' : 'items-start')}>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      update(
                        'emergencyContacts',
                        form.emergencyContacts.filter((_, idx) => idx !== i)
                      )
                    }
                    aria-label="Remove contact"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            {form.emergencyContacts.length < 3 && (
              <Button
                variant="outline"
                size="sm"
                icon={<PlusIcon className="h-4 w-4" />}
                onClick={() =>
                  update('emergencyContacts', [
                    ...form.emergencyContacts,
                    { name: '', relationship: '', phone: '' },
                  ])
                }
              >
                Add contact
              </Button>
            )}
          </div>
        )}

        {/* ─── 3. Insurance ─── */}
        {step === 2 && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Provider">
              <Input
                value={form.insurance.provider}
                onChange={(e) =>
                  update('insurance', { ...form.insurance, provider: e.target.value })
                }
              />
            </Field>
            <Field label="Coverage type">
              <Input
                value={form.insurance.coverageType}
                placeholder="PPO, HMO, Medicare Advantage…"
                onChange={(e) =>
                  update('insurance', { ...form.insurance, coverageType: e.target.value })
                }
              />
            </Field>
            <Field label="Policy number">
              <Input
                value={form.insurance.policyNumber}
                onChange={(e) =>
                  update('insurance', { ...form.insurance, policyNumber: e.target.value })
                }
              />
            </Field>
            <Field label="Group number">
              <Input
                value={form.insurance.groupNumber}
                onChange={(e) =>
                  update('insurance', { ...form.insurance, groupNumber: e.target.value })
                }
              />
            </Field>
            <div className="sm:col-span-2">
              <Checkbox
                label="Coverage has been verified"
                checked={form.insurance.isVerified}
                onChange={(e) =>
                  update('insurance', { ...form.insurance, isVerified: e.target.checked })
                }
              />
            </div>
          </div>
        )}

        {/* ─── 4. Medical history ─── */}
        {step === 3 && (
          <div className="space-y-6">
            <div>
              <Field label="Conditions" hint="Press Enter to add">
                <Input
                  value={conditionInput}
                  onChange={(e) => setConditionInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && conditionInput.trim()) {
                      e.preventDefault();
                      update('medicalHistory', {
                        ...form.medicalHistory,
                        conditions: [...form.medicalHistory.conditions, conditionInput.trim()],
                      });
                      setConditionInput('');
                    }
                  }}
                  placeholder="e.g. Chronic heart failure"
                />
              </Field>
              <TagList
                items={form.medicalHistory.conditions}
                onRemove={(i) =>
                  update('medicalHistory', {
                    ...form.medicalHistory,
                    conditions: form.medicalHistory.conditions.filter((_, idx) => idx !== i),
                  })
                }
              />
            </div>

            <div>
              <p className="mb-2 text-xs font-medium text-[var(--color-text-secondary)]">
                Allergies
              </p>
              <div className="space-y-3">
                {form.medicalHistory.allergies.map((allergy, i) => (
                  <div key={i} className="grid gap-3 sm:grid-cols-[1fr_1fr_160px_auto]">
                    <Input
                      value={allergy.substance}
                      placeholder="Substance"
                      onChange={(e) => {
                        const next = [...form.medicalHistory.allergies];
                        next[i] = { ...allergy, substance: e.target.value };
                        update('medicalHistory', { ...form.medicalHistory, allergies: next });
                      }}
                    />
                    <Input
                      value={allergy.reaction}
                      placeholder="Reaction"
                      onChange={(e) => {
                        const next = [...form.medicalHistory.allergies];
                        next[i] = { ...allergy, reaction: e.target.value };
                        update('medicalHistory', { ...form.medicalHistory, allergies: next });
                      }}
                    />
                    <Select
                      value={allergy.severity}
                      onChange={(e) => {
                        const next = [...form.medicalHistory.allergies];
                        next[i] = { ...allergy, severity: e.target.value as 'mild' };
                        update('medicalHistory', { ...form.medicalHistory, allergies: next });
                      }}
                    >
                      <option value="mild">Mild</option>
                      <option value="moderate">Moderate</option>
                      <option value="severe">Severe</option>
                      <option value="life-threatening">Life-threatening</option>
                    </Select>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        update('medicalHistory', {
                          ...form.medicalHistory,
                          allergies: form.medicalHistory.allergies.filter((_, idx) => idx !== i),
                        })
                      }
                      aria-label="Remove allergy"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
              <Button
                className="mt-2"
                variant="outline"
                size="sm"
                icon={<PlusIcon className="h-4 w-4" />}
                onClick={() =>
                  update('medicalHistory', {
                    ...form.medicalHistory,
                    allergies: [
                      ...form.medicalHistory.allergies,
                      { substance: '', reaction: '', severity: 'moderate' },
                    ],
                  })
                }
              >
                Add allergy
              </Button>
            </div>

            <div>
              <p className="mb-2 text-xs font-medium text-[var(--color-text-secondary)]">
                Past surgeries
              </p>
              {form.medicalHistory.surgeries.map((surgery, i) => (
                <div key={i} className="mb-3 grid gap-3 sm:grid-cols-[1fr_200px_auto]">
                  <Input
                    value={surgery.name}
                    placeholder="Procedure"
                    onChange={(e) => {
                      const next = [...form.medicalHistory.surgeries];
                      next[i] = { ...surgery, name: e.target.value };
                      update('medicalHistory', { ...form.medicalHistory, surgeries: next });
                    }}
                  />
                  <Input
                    type="date"
                    value={surgery.date}
                    onChange={(e) => {
                      const next = [...form.medicalHistory.surgeries];
                      next[i] = { ...surgery, date: e.target.value };
                      update('medicalHistory', { ...form.medicalHistory, surgeries: next });
                    }}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      update('medicalHistory', {
                        ...form.medicalHistory,
                        surgeries: form.medicalHistory.surgeries.filter((_, idx) => idx !== i),
                      })
                    }
                    aria-label="Remove surgery"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                icon={<PlusIcon className="h-4 w-4" />}
                onClick={() =>
                  update('medicalHistory', {
                    ...form.medicalHistory,
                    surgeries: [...form.medicalHistory.surgeries, { name: '', date: '' }],
                  })
                }
              >
                Add surgery
              </Button>
            </div>

            <div>
              <Field label="Family history" hint="Press Enter to add">
                <Input
                  value={familyInput}
                  onChange={(e) => setFamilyInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && familyInput.trim()) {
                      e.preventDefault();
                      update('medicalHistory', {
                        ...form.medicalHistory,
                        familyHistory: [...form.medicalHistory.familyHistory, familyInput.trim()],
                      });
                      setFamilyInput('');
                    }
                  }}
                />
              </Field>
              <TagList
                items={form.medicalHistory.familyHistory}
                onRemove={(i) =>
                  update('medicalHistory', {
                    ...form.medicalHistory,
                    familyHistory: form.medicalHistory.familyHistory.filter((_, idx) => idx !== i),
                  })
                }
              />
            </div>
          </div>
        )}

        {/* ─── 5. Current medications ─── */}
        {step === 4 && (
          <div className="space-y-4">
            <p className="text-sm text-muted">
              The patient's own medicines. This becomes the pre-admission list that the
              reconciliation agent compares against at discharge, so it matters.
            </p>
            {form.currentMedications.map((med, i) => (
              <div
                key={i}
                className="grid gap-3 rounded-lg border p-3 sm:grid-cols-[1.4fr_1fr_1fr_120px_auto]"
                style={{ borderColor: 'var(--color-border)' }}
              >
                <Field label={i === 0 ? 'Drug name' : undefined}>
                  <Input
                    value={med.drugName}
                    placeholder="e.g. Lisinopril"
                    onChange={(e) => {
                      const next = [...form.currentMedications];
                      next[i] = { ...med, drugName: e.target.value };
                      update('currentMedications', next);
                    }}
                  />
                </Field>
                <Field label={i === 0 ? 'Dose' : undefined}>
                  <Input
                    value={med.dosage}
                    placeholder="10 mg"
                    onChange={(e) => {
                      const next = [...form.currentMedications];
                      next[i] = { ...med, dosage: e.target.value };
                      update('currentMedications', next);
                    }}
                  />
                </Field>
                <Field label={i === 0 ? 'Frequency' : undefined}>
                  <Input
                    value={med.frequency}
                    placeholder="once daily"
                    onChange={(e) => {
                      const next = [...form.currentMedications];
                      next[i] = { ...med, frequency: e.target.value };
                      update('currentMedications', next);
                    }}
                  />
                </Field>
                <Field label={i === 0 ? 'Route' : undefined}>
                  <Select
                    value={med.route}
                    onChange={(e) => {
                      const next = [...form.currentMedications];
                      next[i] = { ...med, route: e.target.value as MedRoute };
                      update('currentMedications', next);
                    }}
                  >
                    {['oral', 'IV', 'IM', 'SC', 'topical', 'inhaled', 'rectal'].map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </Select>
                </Field>
                <div className={cn('flex', i === 0 ? 'items-end pb-[1px]' : 'items-start')}>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      update(
                        'currentMedications',
                        form.currentMedications.filter((_, idx) => idx !== i)
                      )
                    }
                    aria-label="Remove medication"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              icon={<PlusIcon className="h-4 w-4" />}
              onClick={() =>
                update('currentMedications', [
                  ...form.currentMedications,
                  { drugName: '', dosage: '', frequency: '', route: 'oral', notes: '' },
                ])
              }
            >
              Add medication
            </Button>
          </div>
        )}

        {/* ─── 6. Primary care ─── */}
        {step === 5 && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Physician name">
              <Input
                value={form.primaryCarePhysician.name}
                onChange={(e) =>
                  update('primaryCarePhysician', {
                    ...form.primaryCarePhysician,
                    name: e.target.value,
                  })
                }
              />
            </Field>
            <Field label="Clinic">
              <Input
                value={form.primaryCarePhysician.clinic}
                onChange={(e) =>
                  update('primaryCarePhysician', {
                    ...form.primaryCarePhysician,
                    clinic: e.target.value,
                  })
                }
              />
            </Field>
            <Field label="Phone">
              <Input
                value={form.primaryCarePhysician.phone}
                onChange={(e) =>
                  update('primaryCarePhysician', {
                    ...form.primaryCarePhysician,
                    phone: e.target.value,
                  })
                }
              />
            </Field>
            <Field label="Fax">
              <Input
                value={form.primaryCarePhysician.fax}
                onChange={(e) =>
                  update('primaryCarePhysician', {
                    ...form.primaryCarePhysician,
                    fax: e.target.value,
                  })
                }
              />
            </Field>
          </div>
        )}

        {/* ─── 7. Preferences ─── */}
        {step === 6 && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Preferred language">
              <Input
                value={d.preferredLanguage}
                onChange={(e) =>
                  update('demographics', { ...d, preferredLanguage: e.target.value })
                }
              />
            </Field>
            <Field
              label="Health literacy level"
              hint="Sets the reading level of the patient instructions the agent writes"
            >
              <Select
                value={d.literacyLevel}
                onChange={(e) =>
                  update('demographics', { ...d, literacyLevel: e.target.value as 'basic' })
                }
              >
                <option value="basic">Basic — short sentences, everyday words</option>
                <option value="intermediate">Intermediate — plain language</option>
                <option value="advanced">Advanced — common medical terms allowed</option>
              </Select>
            </Field>
            <Field label="Preferred contact method">
              <Select
                value={form.communicationPreference}
                onChange={(e) =>
                  update('communicationPreference', e.target.value as 'phone')
                }
              >
                <option value="phone">Phone</option>
                <option value="email">Email</option>
                <option value="sms">SMS</option>
                <option value="portal">Patient portal</option>
              </Select>
            </Field>
          </div>
        )}

        {/* ─── 8. Review ─── */}
        {step === 7 && (
          <div className="space-y-5">
            <ReviewBlock title="Demographics">
              <ReviewRow label="Name" value={`${d.firstName} ${d.lastName}`} />
              <ReviewRow label="Date of birth" value={d.dateOfBirth} />
              <ReviewRow label="Gender" value={titleCase(d.gender)} />
              <ReviewRow label="Blood type" value={d.bloodType} />
              <ReviewRow label="Phone" value={d.phone || '—'} />
              <ReviewRow label="Email" value={d.email || '—'} />
              <ReviewRow
                label="Address"
                value={
                  [d.address.street, d.address.city, d.address.state, d.address.zipCode]
                    .filter(Boolean)
                    .join(', ') || '—'
                }
              />
            </ReviewBlock>

            <ReviewBlock title="Emergency contacts">
              {form.emergencyContacts.filter((c) => c.name).length === 0 ? (
                <p className="text-xs text-faint">None recorded</p>
              ) : (
                form.emergencyContacts
                  .filter((c) => c.name)
                  .map((c, i) => (
                    <ReviewRow
                      key={i}
                      label={c.relationship || 'Contact'}
                      value={`${c.name} · ${c.phone}`}
                    />
                  ))
              )}
            </ReviewBlock>

            <ReviewBlock title="Insurance">
              <ReviewRow label="Provider" value={form.insurance.provider || '—'} />
              <ReviewRow label="Policy" value={form.insurance.policyNumber || '—'} />
              <ReviewRow label="Verified" value={form.insurance.isVerified ? 'Yes' : 'No'} />
            </ReviewBlock>

            <ReviewBlock title="Medical history">
              <ReviewRow
                label="Conditions"
                value={form.medicalHistory.conditions.join(', ') || '—'}
              />
              <ReviewRow
                label="Allergies"
                value={
                  form.medicalHistory.allergies.length ? (
                    <span className="flex flex-wrap justify-end gap-1">
                      {form.medicalHistory.allergies.map((a) => (
                        <Badge
                          key={a.substance}
                          tone={
                            a.severity === 'life-threatening' || a.severity === 'severe'
                              ? 'danger'
                              : 'warning'
                          }
                        >
                          {a.substance} ({a.severity})
                        </Badge>
                      ))}
                    </span>
                  ) : (
                    'NKDA'
                  )
                }
              />
              <ReviewRow
                label="Surgeries"
                value={
                  form.medicalHistory.surgeries.map((s) => s.name).join(', ') || '—'
                }
              />
            </ReviewBlock>

            <ReviewBlock title="Current medications">
              {form.currentMedications.filter((m) => m.drugName).length === 0 ? (
                <p className="text-xs text-faint">None recorded</p>
              ) : (
                form.currentMedications
                  .filter((m) => m.drugName)
                  .map((m, i) => (
                    <ReviewRow
                      key={i}
                      label={m.drugName}
                      value={`${m.dosage} · ${m.frequency} · ${m.route}`}
                    />
                  ))
              )}
            </ReviewBlock>

            <ReviewBlock title="Primary care and preferences">
              <ReviewRow label="PCP" value={form.primaryCarePhysician.name || '—'} />
              <ReviewRow label="Clinic" value={form.primaryCarePhysician.clinic || '—'} />
              <ReviewRow label="Language" value={d.preferredLanguage} />
              <ReviewRow label="Literacy level" value={titleCase(d.literacyLevel)} />
              <ReviewRow label="Contact by" value={titleCase(form.communicationPreference)} />
            </ReviewBlock>

            {submit.error && <ErrorState message={submit.error} />}
          </div>
        )}

        <div
          className="mt-6 flex items-center justify-between border-t pt-5"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <Button
            variant="outline"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
          >
            Back
          </Button>

          {step < STEPS.length - 1 ? (
            <Button onClick={() => setStep((s) => s + 1)} disabled={!canAdvance}>
              Continue
            </Button>
          ) : (
            <Button
              variant="success"
              loading={submit.pending}
              onClick={() => void submit.mutate()}
            >
              Register patient
            </Button>
          )}
        </div>
      </Card>
    </>
  );
}

function TagList({ items, onRemove }: { items: string[]; onRemove: (i: number) => void }) {
  if (!items.length) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {items.map((item, i) => (
        <button
          key={`${item}-${i}`}
          type="button"
          onClick={() => onRemove(i)}
          className="group inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs"
          style={{ background: 'var(--color-primary-50)', color: 'var(--color-primary-dark)' }}
        >
          {item}
          <span className="opacity-50 group-hover:opacity-100">×</span>
        </button>
      ))}
    </div>
  );
}

function ReviewBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-faint">{title}</h4>
      <dl
        className="divide-y rounded-lg border px-3"
        style={{ borderColor: 'var(--color-border)' }}
      >
        {children}
      </dl>
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div
      className="flex items-start justify-between gap-4 py-2 text-sm"
      style={{ borderColor: 'var(--color-border)' }}
    >
      <dt className="shrink-0 text-muted">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}

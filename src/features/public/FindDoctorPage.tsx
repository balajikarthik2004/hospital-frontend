import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRightIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { EmptyState, Input, Select, Spinner } from '@/components/common';
import { useApi } from '@/hooks/useApi';
import {
  doctorName,
  publicApi,
  type PublicDoctor,
  type PublicSpecialty,
} from '@/lib/publicApi';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function FindDoctorPage() {
  const [query, setQuery] = useState('');
  const [specialty, setSpecialty] = useState('');

  const { data: deptData } = useApi<{ specialties: PublicSpecialty[] }>('/specialties', [], {
    client: publicApi,
  });
  const { data, loading } = useApi<{ doctors: PublicDoctor[] }>(
    specialty ? `/doctors?specialty=${specialty}` : '/doctors',
    [specialty],
    { client: publicApi }
  );

  const specialties = deptData?.specialties ?? [];
  const nameFor = useMemo(
    () => new Map(specialties.map((s) => [s.slug, s.name])),
    [specialties]
  );

  const doctors = useMemo(() => {
    const all = data?.doctors ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return all;
    return all.filter((d) =>
      `${d.firstName} ${d.lastName} ${d.department} ${d.doctorProfile?.qualifications ?? ''}`
        .toLowerCase()
        .includes(q)
    );
  }, [data, query]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <p className="eyebrow">Our consultants</p>
      <h1 className="mt-1.5 text-[1.875rem] tracking-[-0.02em]">Find a doctor</h1>
      <p className="mt-2 max-w-2xl text-[0.9375rem] leading-relaxed text-muted">
        Everyone listed here takes online bookings. Clinic days and fees are shown so you
        can plan before you book.
      </p>

      <div className="mt-7 flex flex-wrap gap-3">
        <div className="relative min-w-[240px] flex-1">
          <MagnifyingGlassIcon
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
            style={{ color: 'var(--color-text-tertiary)' }}
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or qualification"
            className="pl-9"
          />
        </div>
        <Select
          value={specialty}
          onChange={(e) => setSpecialty(e.target.value)}
          className="min-w-[200px]"
        >
          <option value="">All departments</option>
          {specialties.map((s) => (
            <option key={s.slug} value={s.slug}>
              {s.name}
            </option>
          ))}
        </Select>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Spinner size={26} />
        </div>
      ) : doctors.length === 0 ? (
        <EmptyState
          title="No doctors match that"
          detail="Try a different department, or clear the search."
        />
      ) : (
        <div className="mt-6 grid gap-3 md:grid-cols-2">
          {doctors.map((d) => (
            <div
              key={d._id}
              className="flex flex-col rounded-xl border p-5"
              style={{
                borderColor: 'var(--color-border)',
                background: 'var(--color-surface)',
              }}
            >
              <div className="flex items-start gap-3.5">
                <span
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-[0.9375rem] font-semibold"
                  style={{
                    background: 'var(--color-primary-50)',
                    color: 'var(--color-primary-dark)',
                  }}
                >
                  {d.firstName[0]}
                  {d.lastName[0]}
                </span>
                <div className="min-w-0">
                  <h2 className="text-[1.0625rem]">{doctorName(d)}</h2>
                  <p
                    className="mt-0.5 text-[0.8125rem] font-medium"
                    style={{ color: 'var(--color-primary)' }}
                  >
                    {nameFor.get(d.doctorProfile?.specialty) ?? d.department}
                  </p>
                  <p className="mt-0.5 text-[0.8125rem] text-muted">
                    {d.doctorProfile?.qualifications}
                  </p>
                </div>
              </div>

              {d.doctorProfile?.bio && (
                <p className="mt-3.5 text-[0.875rem] leading-relaxed text-muted">
                  {d.doctorProfile.bio}
                </p>
              )}

              <dl className="mt-4 grid grid-cols-2 gap-3 text-[0.8125rem]">
                {d.doctorProfile?.yearsExperience > 0 && (
                  <Meta label="Experience" value={`${d.doctorProfile.yearsExperience} years`} />
                )}
                {d.doctorProfile?.consultationFee > 0 && (
                  <Meta label="Consultation" value={`₹${d.doctorProfile.consultationFee}`} />
                )}
                <Meta
                  label="Clinic days"
                  value={(d.doctorProfile?.availableDays ?? [])
                    .slice()
                    .sort((a, b) => a - b)
                    .map((n) => DAYS[n])
                    .join(', ')}
                />
                <Meta
                  label="Hours"
                  value={`${d.doctorProfile?.clinicStart ?? '09:00'}–${d.doctorProfile?.clinicEnd ?? '17:00'}`}
                />
              </dl>

              <Link
                to={`/book?specialty=${d.doctorProfile?.specialty ?? ''}`}
                className="mt-4 inline-flex items-center gap-1.5 text-[0.875rem] font-semibold"
                style={{ color: 'var(--color-primary)' }}
              >
                Book with {doctorName(d)} <ArrowRightIcon className="h-4 w-4" />
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="eyebrow">{label}</dt>
      <dd className="mt-0.5 font-medium tabular">{value}</dd>
    </div>
  );
}

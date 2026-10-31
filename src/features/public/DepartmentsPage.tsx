import { Link } from 'react-router-dom';
import { ArrowRightIcon, MapPinIcon } from '@heroicons/react/24/outline';
import { ErrorState, Spinner } from '@/components/common';
import { useApi } from '@/hooks/useApi';
import { publicApi, type PublicSpecialty } from '@/lib/publicApi';
import { iconFor } from './departmentIcons';

export function DepartmentsPage() {
  const { data, loading, error, refetch } = useApi<{ specialties: PublicSpecialty[] }>(
    '/specialties',
    [],
    { client: publicApi }
  );
  const specialties = data?.specialties ?? [];

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <p className="eyebrow">Specialities</p>
      <h1 className="mt-1.5 text-[1.875rem] tracking-[-0.02em]">Our departments</h1>
      <p className="mt-2 max-w-2xl text-[0.9375rem] leading-relaxed text-muted">
        Every department below takes online bookings. If you are not sure which one you
        need, start a booking and describe your symptoms — we will suggest one and you
        can always change it.
      </p>

      {error && <ErrorState message={error} onRetry={refetch} />}

      {loading ? (
        <div className="flex justify-center py-20">
          <Spinner size={26} />
        </div>
      ) : (
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {specialties.map((s) => {
            const Icon = iconFor(s.icon);
            return (
              <div
                key={s._id}
                className="flex flex-col rounded-xl border p-6"
                style={{
                  borderColor: 'var(--color-border)',
                  background: 'var(--color-surface)',
                }}
              >
                <div className="flex items-start gap-3.5">
                  <span
                    className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg"
                    style={{
                      background: 'var(--color-primary-50)',
                      color: 'var(--color-primary)',
                    }}
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <h2 className="text-[1.125rem]">{s.name}</h2>
                    <p
                      className="mt-0.5 text-[0.8125rem] font-medium"
                      style={{ color: 'var(--color-primary)' }}
                    >
                      {s.tagline}
                    </p>
                  </div>
                </div>

                <p className="mt-4 text-[0.875rem] leading-relaxed text-muted">
                  {s.description}
                </p>

                {s.commonConditions.length > 0 && (
                  <div className="mt-4">
                    <p className="eyebrow">Commonly treated</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {s.commonConditions.map((c) => (
                        <span
                          key={c}
                          className="rounded-full border px-2.5 py-1 text-[0.75rem]"
                          style={{
                            borderColor: 'var(--color-border-dark)',
                            color: 'var(--color-text-secondary)',
                          }}
                        >
                          {c}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div
                  className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t pt-4"
                  style={{ borderColor: 'var(--color-border)' }}
                >
                  <span className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.8125rem] text-muted">
                    {s.location && (
                      <span className="inline-flex items-center gap-1.5">
                        <MapPinIcon className="h-4 w-4" />
                        {s.location}
                      </span>
                    )}
                    {s.consultationFee > 0 && <span>₹{s.consultationFee} consultation</span>}
                  </span>
                  <Link
                    to={`/book?specialty=${s.slug}`}
                    className="inline-flex items-center gap-1.5 text-[0.875rem] font-semibold"
                    style={{ color: 'var(--color-primary)' }}
                  >
                    Book <ArrowRightIcon className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

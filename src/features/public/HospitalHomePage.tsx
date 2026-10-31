import { Link } from 'react-router-dom';
import {
  ArrowRightIcon,
  BeakerIcon,
  BoltIcon,
  ClockIcon,
  MapPinIcon,
  PhoneIcon,
} from '@heroicons/react/24/outline';
import { iconFor } from './departmentIcons';
import { useApi } from '@/hooks/useApi';
import { publicApi, type HospitalInfo, type PublicSpecialty } from '@/lib/publicApi';
import { Spinner } from '@/components/common';

/**
 * The hospital's front door.
 *
 * Everything here is public and read-only. The one job of the page is to get
 * a visitor to the right next step quickly — book, find a department, or in
 * an emergency, stop reading and call 108.
 */

/**
 * Photography for the public site.
 *
 * These are hotlinked from Unsplash's CDN, which is fine for a demo but is
 * the wrong answer for a real deployment: a hospital's front page should not
 * go blank because a third-party CDN is unreachable from the ward network,
 * and the images should be served from the same origin under a licence the
 * hospital actually holds. To swap them, drop files into `public/img/` and
 * change `src` below to `/img/<name>.jpg` — nothing else references these.
 *
 * Every figure sits on a muted background, so a request that fails degrades
 * to a plain tinted panel rather than a broken-image icon.
 */
const PHOTO = {
  consult: 'photo-1631217868264-e5b90bb7e133', // clinician and patient talking
  booking: 'photo-1576091160550-2173dba999ef', // hands at a laptop, stethoscope beside
  ward: 'photo-1538108149393-fbbd81895907', // made-up ward beds
  exterior: 'photo-1586773860418-d37222d8fce3', // hospital entrance from the drive
  clinic: 'photo-1629909613654-28e377c37b09', // bright, empty consulting room
} as const;

/** Unsplash sizes and compresses on the fly; ask for exactly what we render. */
const img = (id: string, w: number) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=70`;

const srcSet = (id: string, w: number) => `${img(id, w)} 1x, ${img(id, w * 2)} 2x`;

function usePublic<T>(path: string) {
  return useApi<T>(path, [], { client: publicApi });
}

export function HospitalHomePage() {
  const { data: info } = usePublic<HospitalInfo>('/hospital');
  const { data: deptData, loading } = usePublic<{ specialties: PublicSpecialty[] }>(
    '/specialties'
  );
  const specialties = deptData?.specialties ?? [];

  return (
    <>
      {/* ═══ Hero ═══════════════════════════════════════════════════════ */}
      <section
        className="relative overflow-hidden"
        style={{
          background:
            'radial-gradient(120% 110% at 15% 0%, #1E7B6B 0%, #11564C 38%, #0F2E2A 70%, #121110 100%)',
        }}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
            backgroundSize: '56px 56px',
          }}
          aria-hidden
        />
        <div className="relative mx-auto max-w-6xl px-4 py-20 lg:py-24">
          <div className="grid items-center gap-12 lg:grid-cols-12 lg:gap-10">
            <div className="lg:col-span-7">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-3.5 py-1 text-xs font-[560] text-white/75 backdrop-blur-md">
                {info?.tagline ?? 'Specialist care, close to home.'}
              </div>
              <h1
                className="mt-5 font-serif text-[2.75rem] leading-[1.1] tracking-[-0.02em] text-white lg:text-[3.5rem]"
                style={{ fontFamily: '"Source Serif 4", Georgia, serif' }}
              >
                Care that starts before you arrive.
              </h1>
              <p className="mt-5 max-w-xl text-[1.125rem] leading-relaxed text-white/80">
                Describe what is troubling you and we will suggest the right department,
                show you who is free, and book the appointment — in under two minutes.
              </p>

              <div className="mt-9 flex flex-wrap items-center gap-3.5">
                <Link
                  to="/book"
                  className="inline-flex items-center gap-2.5 rounded-xl bg-white px-7 py-3.5 text-[0.9375rem] font-[680] text-[#11564C] shadow-lg transition-transform duration-150 hover:-translate-y-px active:translate-y-0"
                >
                  Book an appointment
                  <ArrowRightIcon className="h-4 w-4 stroke-[2.5]" />
                </Link>
                <Link
                  to="/portal"
                  className="rounded-xl border border-white/20 bg-white/10 px-6 py-3.5 text-[0.9375rem] font-semibold text-white backdrop-blur-md transition-colors duration-150 hover:bg-white/15"
                >
                  I am already a patient
                </Link>
              </div>

              <dl className="mt-12 grid max-w-xl grid-cols-3 gap-6 border-t border-white/15 pt-7">
                <Stat value={info?.stats.specialties} label="Departments" />
                <Stat value={info?.stats.doctors} label="Doctors" />
                <Stat value={info?.stats.beds} label="Beds" />
              </dl>
            </div>

            {/* The photograph is the one place the page shows a person. It is
                decorative, so it is hidden rather than described on small
                screens, where it would push the booking button below the fold
                for no benefit. */}
            <div className="hidden lg:col-span-5 lg:block">
              <figure className="relative overflow-hidden rounded-2xl bg-white/[0.06] shadow-2xl ring-1 ring-white/15">
                <img
                  src={img(PHOTO.consult, 720)}
                  srcSet={srcSet(PHOTO.consult, 720)}
                  sizes="(min-width: 1024px) 40vw, 0px"
                  alt=""
                  width={720}
                  height={900}
                  // The hero image is the largest paint on the page, so it
                  // loads eagerly rather than waiting its turn. (No
                  // fetchPriority here: React DOM 18 does not recognise the
                  // prop, so it warns and drops it instead of emitting the
                  // attribute. Worth adding on the move to React 19.)
                  loading="eager"
                  decoding="async"
                  className="aspect-[4/5] w-full object-cover"
                />
                {/* Grounds the photo into the dark field so it does not sit
                    on the gradient like a pasted rectangle. */}
                <div
                  className="pointer-events-none absolute inset-0"
                  style={{
                    background:
                      'linear-gradient(to top, rgba(18,17,16,0.55) 0%, rgba(18,17,16,0) 45%)',
                  }}
                  aria-hidden
                />
                <figcaption className="absolute inset-x-4 bottom-4 rounded-xl border border-white/15 bg-black/35 px-4 py-3 backdrop-blur-md">
                  <p className="text-[0.8125rem] font-[620] text-white">
                    Casualty is open, right now
                  </p>
                  <p className="mt-0.5 text-[0.75rem] text-white/70">
                    {info?.hours.emergency ?? 'Open 24 hours, every day'} · Call 108
                  </p>
                </figcaption>
              </figure>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ Three ways in ══════════════════════════════════════════════ */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="grid gap-4 md:grid-cols-3">
          <PathCard
            icon={<ClockIcon className="h-5 w-5" />}
            title="Outpatient clinics"
            detail={info?.hours.outpatient ?? 'Mon–Sat, 9:00–17:00'}
            body="Book online and pick your own slot. Walk-ins are seen between booked appointments."
            to="/book"
            cta="Book a slot"
          />
          <PathCard
            icon={<BoltIcon className="h-5 w-5" />}
            title="Casualty"
            detail={info?.hours.emergency ?? 'Open 24 hours, every day'}
            body="Come straight in, or call 108 for an ambulance. No appointment, no booking, no waiting list."
            href="tel:108"
            cta="Call 108"
            urgent
          />
          <PathCard
            icon={<BeakerIcon className="h-5 w-5" />}
            title="Pharmacy and labs"
            detail={info?.hours.pharmacy ?? 'Mon–Sun, 8:00–22:00'}
            body="In-house pharmacy and diagnostics, so prescriptions and tests are done before you leave."
            to="/visiting"
            cta="Opening hours"
          />
        </div>
      </section>

      {/* ═══ Departments ════════════════════════════════════════════════ */}
      <section
        className="border-y py-16"
        style={{
          borderColor: 'var(--color-border)',
          background: 'var(--color-surface-muted)',
        }}
      >
        <div className="mx-auto max-w-6xl px-4">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="eyebrow">Specialities</p>
              <h2 className="mt-1.5 text-[1.75rem] tracking-[-0.02em]">
                Find the right department
              </h2>
              <p className="mt-2 max-w-xl text-[0.9375rem] text-muted">
                Not sure which one you need? Describe your symptoms when you book and we
                will suggest one.
              </p>
            </div>
            <Link
              to="/departments"
              className="inline-flex items-center gap-1.5 text-[0.875rem] font-semibold"
              style={{ color: 'var(--color-primary)' }}
            >
              All departments <ArrowRightIcon className="h-4 w-4" />
            </Link>
          </div>

          {loading ? (
            <div className="flex justify-center py-16">
              <Spinner size={24} />
            </div>
          ) : (
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {specialties.slice(0, 6).map((s) => {
                const Icon = iconFor(s.icon);
                return (
                  <Link
                    key={s._id}
                    to={`/book?specialty=${s.slug}`}
                    className="group rounded-2xl border p-6 transition-all duration-200 hover:-translate-y-1 hover:shadow-lg hover:border-primary-400 dark:hover:border-primary-600"
                    style={{
                      borderColor: 'var(--color-border)',
                      background: 'var(--color-surface)',
                    }}
                  >
                    <span
                      className="inline-flex h-11 w-11 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-105"
                      style={{
                        background: 'rgba(14, 165, 233, 0.1)',
                        color: 'var(--color-primary)',
                      }}
                    >
                      <Icon className="h-5 w-5" />
                    </span>
                    <h3 className="mt-4 text-[1.0625rem] font-semibold tracking-tight">{s.name}</h3>
                    <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-muted line-clamp-2">
                      {s.tagline}
                    </p>
                    {s.commonConditions.length > 0 && (
                      <p className="mt-3.5 text-[0.75rem] font-medium text-faint">
                        {s.commonConditions.slice(0, 3).join(' · ')}
                      </p>
                    )}
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* ═══ The building ═══════════════════════════════════════════════ */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <p className="eyebrow">The hospital</p>
        <h2 className="mt-1.5 text-[1.75rem] tracking-[-0.02em]">
          What it looks like when you get here
        </h2>
        <p className="mt-2 max-w-xl text-[0.9375rem] leading-relaxed text-muted">
          Knowing where to walk in, and what the ward is like, takes some of the
          worry out of the day before.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <Photo
            id={PHOTO.exterior}
            alt="The main entrance of the hospital, seen from the drive, with a covered canopy over the doors."
            caption="The main entrance"
            detail="Drop-off under the canopy; parking under Block C."
          />
          <Photo
            id={PHOTO.ward}
            alt="A hospital ward with made-up beds in a row, each with a curtain rail."
            caption="Inpatient wards"
            detail="Visiting 16:00–19:00 daily."
          />
          <Photo
            id={PHOTO.clinic}
            alt="A bright, empty consulting room with equipment at the bedside."
            caption="Consulting rooms"
            detail="Outpatients on the ground and first floors."
          />
        </div>
      </section>

      {/* ═══ How booking works ══════════════════════════════════════════ */}
      <section
        className="border-y py-16"
        style={{
          borderColor: 'var(--color-border)',
          background: 'var(--color-surface-muted)',
        }}
      >
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 lg:grid-cols-2">
          <div>
            <p className="eyebrow">Booking</p>
            <h2 className="mt-1.5 text-[1.75rem] tracking-[-0.02em]">
              Three steps, no phone call
            </h2>

            <ol className="mt-8 space-y-6">
              {[
                {
                  n: '01',
                  title: 'Tell us what is wrong',
                  body: 'Describe it in your own words. We match it to a department and explain why.',
                },
                {
                  n: '02',
                  title: 'Pick a doctor and a time',
                  body: 'See who works in that department, their experience, and the slots they actually have free.',
                },
                {
                  n: '03',
                  title: 'Arrive ready',
                  body: 'New patients get a hospital ID straight away, so reception already has you when you walk in.',
                },
              ].map((step) => (
                <li key={step.n} className="flex gap-4">
                  <span
                    className="mt-0.5 shrink-0 text-[0.75rem] font-bold tabular"
                    style={{ color: 'var(--color-primary)' }}
                  >
                    {step.n}
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-[1rem]">{step.title}</h3>
                    <p className="mt-1.5 text-[0.875rem] leading-relaxed text-muted">
                      {step.body}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <figure
            className="overflow-hidden rounded-2xl border shadow-sm"
            style={{
              borderColor: 'var(--color-border)',
              background: 'var(--color-surface-sunken)',
            }}
          >
            <img
              src={img(PHOTO.booking, 800)}
              srcSet={srcSet(PHOTO.booking, 800)}
              sizes="(min-width: 1024px) 45vw, 100vw"
              alt="A pair of hands typing on a laptop, a stethoscope resting on the desk beside it."
              width={800}
              height={600}
              loading="lazy"
              decoding="async"
              className="aspect-[4/3] w-full object-cover"
            />
          </figure>
        </div>

        <div className="mx-auto max-w-6xl px-4">
          <div
            className="mt-12 flex flex-wrap items-center justify-between gap-4 rounded-2xl border p-6"
            style={{
              borderColor: 'var(--color-border)',
              background: 'var(--color-surface)',
            }}
          >
            <div>
              <h3 className="text-[1.0625rem]">Ready when you are</h3>
              <p className="mt-1 text-[0.875rem] text-muted">
                Most appointments are available within three working days.
              </p>
            </div>
            <Link
              to="/book"
              className="inline-flex items-center gap-2 rounded-lg bg-primary-700 px-5 py-3 text-[0.875rem] font-[620] text-white shadow-[inset_0_1px_0_0_rgb(255_255_255_/_0.16)] transition-colors duration-100 hover:bg-primary-600"
            >
              Start booking <ArrowRightIcon className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ═══ Visiting ═══════════════════════════════════════════════════ */}
      <section
        className="border-t py-14"
        style={{
          borderColor: 'var(--color-border)',
          background: 'var(--color-surface-muted)',
        }}
      >
        <div className="mx-auto grid max-w-6xl gap-8 px-4 sm:grid-cols-3">
          <InfoBlock
            icon={<MapPinIcon className="h-5 w-5" />}
            title="Where we are"
            lines={[info?.address ?? '14 Anna Salai, Chennai 600002', 'Parking under Block C']}
          />
          <InfoBlock
            icon={<PhoneIcon className="h-5 w-5" />}
            title="Talk to someone"
            lines={[info?.phone ?? '+91 44 4000 1200', info?.email ?? 'care@aarogyahospital.example']}
          />
          <InfoBlock
            icon={<ClockIcon className="h-5 w-5" />}
            title="Visiting hours"
            lines={['Wards: 16:00–19:00 daily', 'ICU: 17:00–18:00, one visitor']}
          />
        </div>
      </section>
    </>
  );
}

/**
 * A captioned photograph of somewhere in the building.
 *
 * `alt` describes the picture and the caption carries the information, so a
 * screen reader gets both without hearing the same words twice — the usual
 * failure here is an alt that just repeats the caption underneath it.
 */
function Photo({
  id,
  alt,
  caption,
  detail,
}: {
  id: string;
  alt: string;
  caption: string;
  detail: string;
}) {
  return (
    <figure>
      <div
        className="overflow-hidden rounded-xl border"
        style={{
          borderColor: 'var(--color-border)',
          background: 'var(--color-surface-sunken)',
        }}
      >
        <img
          src={img(id, 520)}
          srcSet={srcSet(id, 520)}
          sizes="(min-width: 640px) 33vw, 100vw"
          alt={alt}
          width={520}
          height={390}
          loading="lazy"
          decoding="async"
          className="aspect-[4/3] w-full object-cover"
        />
      </div>
      <figcaption className="mt-3">
        <p className="text-[0.875rem] font-[620]">{caption}</p>
        <p className="mt-0.5 text-[0.8125rem] leading-relaxed text-muted">{detail}</p>
      </figcaption>
    </figure>
  );
}

function Stat({ value, label }: { value?: number; label: string }) {
  return (
    <div>
      <dt className="text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-white/50">
        {label}
      </dt>
      <dd className="mt-1 text-[1.75rem] font-semibold tabular text-white">
        {value ?? '—'}
      </dd>
    </div>
  );
}

function PathCard({
  icon,
  title,
  detail,
  body,
  to,
  href,
  cta,
  urgent,
}: {
  icon: React.ReactNode;
  title: string;
  detail: string;
  body: string;
  to?: string;
  href?: string;
  cta: string;
  urgent?: boolean;
}) {
  const accent = urgent ? 'var(--color-danger)' : 'var(--color-primary)';
  const inner = (
    <>
      <span
        className="inline-flex h-12 w-12 items-center justify-center rounded-xl shadow-xs transition-transform duration-200 group-hover:scale-105"
        style={{
          background: urgent ? 'rgba(239, 68, 68, 0.1)' : 'rgba(14, 165, 233, 0.1)',
          color: accent,
        }}
      >
        {icon}
      </span>
      <h3 className="mt-4 text-[1.125rem] font-bold tracking-tight">{title}</h3>
      <p className="mt-1 text-[0.8125rem] font-semibold" style={{ color: accent }}>
        {detail}
      </p>
      <p className="mt-2.5 text-[0.875rem] leading-relaxed text-muted">{body}</p>
      <span
        className="mt-5 inline-flex items-center gap-2 text-[0.8125rem] font-bold transition-transform duration-150 group-hover:translate-x-0.5"
        style={{ color: accent }}
      >
        {cta} <ArrowRightIcon className="h-4 w-4 stroke-[2.5]" />
      </span>
    </>
  );

  const className =
    'group block rounded-2xl border p-6 transition-all duration-200 hover:-translate-y-1 hover:shadow-xl';
  const style = {
    borderColor: urgent ? 'rgba(239, 68, 68, 0.3)' : 'var(--color-border)',
    background: 'var(--color-surface)',
  };

  if (href) {
    return (
      <a href={href} className={className} style={style}>
        {inner}
      </a>
    );
  }
  return (
    <Link to={to ?? '/'} className={className} style={style}>
      {inner}
    </Link>
  );
}

function InfoBlock({
  icon,
  title,
  lines,
}: {
  icon: React.ReactNode;
  title: string;
  lines: string[];
}) {
  return (
    <div>
      <span
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg"
        style={{ background: 'var(--color-surface)', color: 'var(--color-primary)' }}
      >
        {icon}
      </span>
      <h3 className="mt-3 text-[0.9375rem]">{title}</h3>
      <ul className="mt-1.5 space-y-0.5 text-[0.875rem] text-muted">
        {lines.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
    </div>
  );
}

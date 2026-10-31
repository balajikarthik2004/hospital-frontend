import {
  BeakerIcon,
  BoltIcon,
  ClockIcon,
  MapPinIcon,
  PhoneIcon,
  TruckIcon,
} from '@heroicons/react/24/outline';
import { Callout } from '@/components/common';
import { useApi } from '@/hooks/useApi';
import { publicApi, type HospitalInfo } from '@/lib/publicApi';

export function VisitingPage() {
  const { data } = useApi<HospitalInfo>('/hospital', [], { client: publicApi });

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <p className="eyebrow">Practical information</p>
      <h1 className="mt-1.5 text-[1.875rem] tracking-[-0.02em]">Contact us & Visiting</h1>

      <Callout tone="danger" className="mt-7">
        <p className="font-semibold">In an emergency, do not use this page.</p>
        <p className="mt-1">
          Call{' '}
          <a href="tel:108" className="font-bold underline">
            108
          </a>{' '}
          for an ambulance, or come straight to Casualty at the Anna Salai entrance. It is
          open 24 hours and never requires an appointment.
        </p>
      </Callout>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <Panel
          icon={<ClockIcon className="h-5 w-5" />}
          title="Opening hours"
          rows={[
            ['Outpatient clinics', data?.hours.outpatient ?? 'Mon–Sat, 9:00–17:00'],
            ['Casualty', data?.hours.emergency ?? 'Open 24 hours, every day'],
            ['Pharmacy', data?.hours.pharmacy ?? 'Mon–Sun, 8:00–22:00'],
            ['Diagnostics lab', 'Mon–Sat, 7:00–19:00'],
          ]}
        />
        <Panel
          icon={<PhoneIcon className="h-5 w-5" />}
          title="Contact"
          rows={[
            ['Reception', data?.phone ?? '+91 44 4000 1200'],
            ['Emergency', data?.emergencyPhone ?? '108'],
            ['Email', data?.email ?? 'care@aarogyahospital.example'],
          ]}
        />
        <Panel
          icon={<MapPinIcon className="h-5 w-5" />}
          title="Getting here"
          rows={[
            ['Address', data?.address ?? '14 Anna Salai, Chennai 600002'],
            ['Parking', 'Basement, Block C — free for the first two hours'],
            ['Bus', 'Routes 21G, 23C and M1 stop outside'],
            ['Metro', 'Thousand Lights, a seven-minute walk'],
          ]}
        />
        <Panel
          icon={<BoltIcon className="h-5 w-5" />}
          title="Ward visiting"
          rows={[
            ['General wards', '16:00–19:00 daily'],
            ['ICU', '17:00–18:00, one visitor at a time'],
            ['Paediatrics', 'A parent may stay overnight'],
            ['Maternity', '15:00–20:00'],
          ]}
        />
      </div>

      <h2 className="mt-12 text-[1.25rem]">What to bring to an appointment</h2>
      <ul className="mt-3 grid gap-3 sm:grid-cols-2">
        {[
          {
            icon: <BeakerIcon className="h-4 w-4" />,
            text: 'Any recent test reports, scans or discharge summaries.',
          },
          {
            icon: <TruckIcon className="h-4 w-4" />,
            text: 'All medicines you are currently taking — the boxes, not a list.',
          },
          {
            icon: <MapPinIcon className="h-4 w-4" />,
            text: 'Photo ID, and your insurance card if you have one.',
          },
          {
            icon: <ClockIcon className="h-4 w-4" />,
            text: 'Arrive 15 minutes early to complete registration.',
          },
        ].map((item) => (
          <li
            key={item.text}
            className="flex items-start gap-3 rounded-xl border p-4"
            style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
          >
            <span
              className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
              style={{ background: 'var(--color-primary-50)', color: 'var(--color-primary)' }}
            >
              {item.icon}
            </span>
            <span className="text-[0.875rem] leading-relaxed text-muted">{item.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Panel({
  icon,
  title,
  rows,
}: {
  icon: React.ReactNode;
  title: string;
  rows: [string, string][];
}) {
  return (
    <section
      className="rounded-xl border p-5"
      style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
    >
      <div className="flex items-center gap-2.5">
        <span
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg"
          style={{ background: 'var(--color-primary-50)', color: 'var(--color-primary)' }}
        >
          {icon}
        </span>
        <h2 className="text-[1rem]">{title}</h2>
      </div>
      <dl className="mt-4 space-y-2.5">
        {rows.map(([k, v]) => (
          <div key={k} className="flex flex-wrap justify-between gap-2 text-[0.875rem]">
            <dt className="text-muted">{k}</dt>
            <dd className="font-medium">{v}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

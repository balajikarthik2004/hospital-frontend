import { useState, type FormEvent } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { CheckIcon } from '@heroicons/react/24/outline';
import { Button, ErrorState, Field, Input, Logo } from '@/components/common';
import { useAuthStore } from '@/store/authStore';
import { cn } from '@/lib/utils';

const DEMO_ACCOUNTS = [
  {
    role: 'Physician',
    email: 'dr.sharma@safedischarge.demo',
    detail: 'Starts the discharge and signs the clinical summary',
  },
  {
    role: 'Pharmacist',
    email: 'rx.patel@safedischarge.demo',
    detail: 'Resolves the medication flags',
  },
  {
    role: 'Nurse',
    email: 'rn.iyer@safedischarge.demo',
    detail: 'Records vitals, approves patient instructions',
  },
  {
    role: 'Care coordinator',
    email: 'cc.kulkarni@safedischarge.demo',
    detail: 'Books the follow-up appointments',
  },
  {
    role: 'Administrator',
    email: 'admin@safedischarge.demo',
    detail: 'KPIs, audit log, users and beds',
  },
  {
    role: 'Patient',
    email: 'patient@safedischarge.demo',
    detail: 'Reads their own discharge instructions',
  },
];

const DEMO_PASSWORD = 'Demo@1234';

/** The three beats of the product story, told before anyone signs in. */
const STORY = [
  {
    step: '01',
    title: 'The agents prepare',
    body: 'Five specialists read the chart in parallel — summary, medications, follow-up, instructions — then a safety layer checks their work.',
  },
  {
    step: '02',
    title: 'The team reviews',
    body: 'Every section arrives as a draft. The physician, pharmacist, nurse and coordinator each sign only the part they own.',
  },
  {
    step: '03',
    title: 'The patient goes home',
    body: 'Nothing completes while a critical flag is open or a signature is missing. The whole trail is recorded.',
  },
];

export function LoginPage() {
  const [email, setEmail] = useState('dr.sharma@safedischarge.demo');
  const [password, setPassword] = useState(DEMO_PASSWORD);
  const { login, loading, error, user } = useAuthStore();
  const location = useLocation();

  if (user) {
    const from = (location.state as { from?: string } | null)?.from ?? '/';
    return <Navigate to={from} replace />;
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await login(email, password);
  };

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--color-bg)' }}>
      {/* ─── Narrative panel ─────────────────────────────────────────────── */}
      <div
        className="relative hidden w-[52%] flex-col justify-between overflow-hidden p-12 text-white xl:p-16 lg:flex"
        style={{
          background:
            'radial-gradient(120% 120% at 12% 0%, #0E7490 0%, #103A56 48%, #0A1424 100%)',
        }}
      >
        <div className="bg-grid pointer-events-none absolute inset-0 opacity-50" aria-hidden />
        <div
          className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full opacity-25 blur-3xl"
          style={{ background: '#22D3EE' }}
          aria-hidden
        />

        <div className="relative flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/20 backdrop-blur">
            <Logo size={24} />
          </span>
          <span className="text-[0.9375rem] font-semibold tracking-[-0.01em]">SafeDischarge</span>
        </div>

        <div className="relative max-w-xl">
          <p className="eyebrow !text-white/55">Care transitions, coordinated</p>
          <h1 className="display mt-4 text-[2.75rem] leading-[1.1] xl:text-[3.25rem]">
            The discharge is written before the round ends.
          </h1>
          <p className="mt-5 max-w-lg text-[0.9375rem] leading-relaxed text-white/75">
            SafeDischarge drafts the whole package in minutes. It never discharges anyone —
            that decision stays with the clinician who signs.
          </p>

          <ol className="mt-11 space-y-5">
            {STORY.map((beat) => (
              <li key={beat.step} className="flex gap-4">
                <span className="mt-0.5 font-mono text-xs text-white/40">{beat.step}</span>
                <div className="border-l border-white/15 pl-4">
                  <p className="text-[0.8125rem] font-semibold text-white/95">{beat.title}</p>
                  <p className="mt-1 max-w-md text-[0.8125rem] leading-relaxed text-white/60">
                    {beat.body}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <div className="relative">
          <dl className="flex flex-wrap gap-x-12 gap-y-6 border-t border-white/15 pt-7">
            {[
              ['3.2 h → minutes', 'Preparation time'],
              ['100%', 'Clinician-signed'],
              ['Every action', 'Audit logged'],
            ].map(([value, label]) => (
              <div key={label}>
                <dt className="text-xl font-semibold tracking-[-0.02em]">{value}</dt>
                <dd className="eyebrow mt-1 !text-white/45">{label}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-7 text-[0.6875rem] text-white/35">
            Demonstration environment. All patient data is synthetic and clearly fictional.
          </p>
        </div>
      </div>

      {/* ─── Sign-in ─────────────────────────────────────────────────────── */}
      <div className="flex w-full flex-col justify-center px-6 py-12 lg:w-[48%] lg:px-14 xl:px-20">
        <div className="mx-auto w-full max-w-[25rem]">
          <div className="mb-10 flex items-center gap-2.5 lg:hidden">
            <Logo size={32} />
            <span className="text-[0.9375rem] font-semibold">SafeDischarge</span>
          </div>

          <h2 className="text-2xl font-semibold tracking-[-0.02em]">Sign in</h2>
          <p className="mt-1.5 text-[0.8125rem] text-muted">
            Each role sees a different part of the workflow. Pick one below to explore it.
          </p>

          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            <Field label="Email" required>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
                required
              />
            </Field>

            <Field label="Password" required>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </Field>

            {error && <ErrorState message={error} />}

            <Button type="submit" size="lg" loading={loading} fullWidth>
              Sign in
            </Button>
          </form>

          <div className="mt-9">
            <div className="mb-3 flex items-baseline justify-between">
              <p className="eyebrow">Demo accounts</p>
              <p className="font-mono text-[0.6875rem] text-faint">{DEMO_PASSWORD}</p>
            </div>
            <div className="space-y-1.5">
              {DEMO_ACCOUNTS.map((account) => {
                const selected = email === account.email;
                return (
                  <button
                    key={account.email}
                    type="button"
                    onClick={() => {
                      setEmail(account.email);
                      setPassword(DEMO_PASSWORD);
                    }}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-all duration-150',
                      selected
                        ? 'border-primary-500 bg-[var(--color-primary-50)] shadow-xs'
                        : 'border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-border-dark)] hover:bg-[var(--color-surface-muted)]'
                    )}
                  >
                    <span
                      className={cn(
                        'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors',
                        selected
                          ? 'border-primary-600 bg-primary-600 text-white'
                          : 'border-[var(--color-border-dark)]'
                      )}
                      aria-hidden
                    >
                      {selected && <CheckIcon className="h-3 w-3" strokeWidth={3} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[0.8125rem] font-medium">{account.role}</span>
                      <span className="block truncate text-[0.6875rem] text-faint">
                        {account.detail}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

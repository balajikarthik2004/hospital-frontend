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
    // Staff belong in the application, not on the public website. `from` is
    // whatever route turned them away, so only honour it when it is one of
    // ours — a stale bookmark to "/" would otherwise drop a clinician on the
    // hospital's marketing page after a successful sign-in.
    const attempted = (location.state as { from?: string } | null)?.from;
    const from = attempted?.startsWith('/app') ? attempted : '/app';
    return <Navigate to={from} replace />;
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await login(email, password);
  };

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--color-bg)' }}>
      {/* ─── Narrative panel ─────────────────────────────────────────────── */}
      {/* A single deep field with one light source, rather than the previous
          three-stop sweep plus two coloured blur orbs. The orbs were doing
          the work a photograph would do in a real marketing panel, and at
          laptop width they landed behind the body copy and greyed it out. */}
      <div
        className="relative hidden w-[52%] flex-col justify-between overflow-hidden p-12 text-white xl:p-16 lg:flex"
        style={{
          background:
            'radial-gradient(120% 110% at 15% 0%, #1E7B6B 0%, #11564C 38%, #0F2E2A 70%, #121110 100%)',
        }}
      >
        <div className="bg-grid pointer-events-none absolute inset-0 opacity-25" aria-hidden />

        <div className="relative flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/[0.08] ring-1 ring-white/15">
            <Logo size={28} />
          </span>
          <span className="text-base font-[680] tracking-[-0.02em] text-white">SafeDischarge</span>
        </div>

        <div className="relative max-w-xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-3 py-1 text-[0.6875rem] font-[620] uppercase tracking-[0.08em] text-white/70">
            Multi-agent clinical transitions
          </div>
          <h1 className="display mt-5 text-[2.75rem] leading-[1.08] xl:text-[3.25rem]">
            The discharge is written before the round ends.
          </h1>
          <p className="mt-5 max-w-lg text-[0.9375rem] leading-relaxed text-white/75">
            SafeDischarge drafts the complete multi-specialty discharge package in parallel.
            It never executes autonomous discharge — clinicians verify, adjust, and sign.
          </p>

          {/* The beats are a numbered list, not three stacked glass cards.
              Framing each one in its own bordered box gave equal weight to
              the chrome and to the sentence inside it. */}
          <ol className="mt-10 space-y-5 border-l border-white/15 pl-6">
            {STORY.map((beat) => (
              <li key={beat.step} className="relative">
                <span
                  className="absolute -left-[1.78rem] top-1 font-mono text-[0.625rem] font-[680] text-white/35"
                  aria-hidden
                >
                  {beat.step}
                </span>
                <p className="text-[0.8125rem] font-[620] text-white">{beat.title}</p>
                <p className="mt-0.5 text-[0.8125rem] leading-relaxed text-white/60">
                  {beat.body}
                </p>
              </li>
            ))}
          </ol>
        </div>

        <div className="relative">
          <dl className="flex flex-wrap gap-x-12 gap-y-6 border-t border-white/15 pt-7">
            {[
              ['3.2 h → minutes', 'Preparation time'],
              ['100%', 'Clinician-signed'],
              ['Multi-agent', 'Consensus safety checks'],
            ].map(([value, label]) => (
              <div key={label}>
                <dt className="text-xl font-[680] tracking-[-0.02em] text-white">{value}</dt>
                <dd className="eyebrow mt-1 !text-white/45">{label}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-6 text-[0.6875rem] text-white/35">
            HIPAA-ready architecture · Synthetic simulation data · Fictional patient records
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

          <div className="mt-8">
            <div className="mb-3 flex items-baseline justify-between">
              <p className="eyebrow">Demo credentials</p>
              <span className="rounded-md border border-[var(--color-info-border)] bg-[var(--color-primary-50)] px-2 py-0.5 font-mono text-[0.6875rem] font-[620] text-[var(--color-primary)]">
                Key: {DEMO_PASSWORD}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
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
                      'flex flex-col items-start rounded-lg border p-2.5 text-left transition-colors duration-100',
                      selected
                        ? 'border-primary-600 bg-[var(--color-primary-50)]'
                        : 'border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-muted)]'
                    )}
                  >
                    <div className="flex w-full items-center justify-between">
                      <span className="text-[0.75rem] font-[680] text-[var(--color-text)]">
                        {account.role}
                      </span>
                      {selected && (
                        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary-700 text-white">
                          <CheckIcon className="h-2.5 w-2.5" strokeWidth={3} />
                        </span>
                      )}
                    </div>
                    <span className="mt-1 line-clamp-2 text-[0.625rem] leading-tight text-faint">
                      {account.detail}
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

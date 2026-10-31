import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  Bars3Icon,
  PhoneIcon,
  XMarkIcon,
  MoonIcon,
  SunIcon,
} from '@heroicons/react/24/outline';
import { Logo } from '@/components/common';
import { cn } from '@/lib/utils';

/**
 * Chrome for everything a member of the public sees.
 *
 * Kept entirely separate from AppLayout: that one assumes a signed-in user,
 * a sidebar and a permission set. A visitor has none of those, and the two
 * surfaces want to look different anyway — one is a hospital's front door,
 * the other is a clinical workstation.
 */

const NAV = [
  { to: '/', label: 'Home', end: true },
  { to: '/departments', label: 'Departments' },
  { to: '/doctors', label: 'Find a doctor' },
  { to: '/visiting', label: 'Visiting' },
];

function useTheme() {
  const [dark, setDark] = useState(() =>
    document.documentElement.classList.contains('dark')
  );
  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
    try {
      localStorage.setItem('safedischarge.theme', next ? 'dark' : 'light');
    } catch {
      /* private mode — the choice just will not persist */
    }
  };
  return { dark, toggle };
}

export function PublicLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { dark, toggle } = useTheme();
  const location = useLocation();

  // A route change with the mobile menu still open leaves it covering the
  // page the visitor just asked for.
  useEffect(() => setMenuOpen(false), [location.pathname]);

  return (
    <div className="flex min-h-screen flex-col" style={{ background: 'var(--color-bg)' }}>
      {/* ── Emergency bar ──────────────────────────────────────────────
          Commented out on request. The same guidance is still reachable
          from the "Casualty" card on the home page, which carries the 108
          number and the 24/7 hours.

      <div
        className="px-4 py-2 text-center text-[0.75rem] font-semibold shadow-xs"
        style={{ background: 'linear-gradient(90deg, #DC2626 0%, #EF4444 50%, #B91C1C 100%)', color: '#fff' }}
      >
        <span className="opacity-95">Medical emergency?</span>{' '}
        <a href="tel:108" className="font-bold underline underline-offset-2 hover:opacity-100">
          Call 108
        </a>{' '}
        <span className="opacity-90">
          — or come directly to Casualty (open 24/7). Do not book online.
        </span>
      </div>
      ─────────────────────────────────────────────────────────────── */}

      <header
        className="sticky top-0 z-40 border-b backdrop-blur-xl"
        style={{
          background: 'color-mix(in srgb, var(--color-surface) 84%, transparent)',
          borderColor: 'var(--color-border)',
        }}
      >
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
          <Link to="/" className="flex min-w-0 items-center gap-2.5">
            <Logo size={32} />
            <span className="min-w-0">
              <span className="block truncate text-[0.9375rem] font-bold leading-tight tracking-tight">
                Aarogya General Hospital
              </span>
              <span className="eyebrow block truncate text-[0.625rem]">
                Multi-speciality care
              </span>
            </span>
          </Link>

          <nav className="ml-6 hidden items-center gap-1.5 md:flex" aria-label="Main">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'rounded-lg px-3.5 py-2 text-[0.8125rem] font-medium transition-colors duration-100',
                    isActive
                      ? 'bg-[var(--color-primary-50)] text-[var(--color-primary)] font-[620]'
                      : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-text)]'
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2.5">
            <a
              href="tel:+914440001200"
              className="hidden items-center gap-1.5 text-[0.8125rem] font-medium lg:flex"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              <PhoneIcon className="h-4 w-4" />
              +91 44 4000 1200
            </a>

            <button
              type="button"
              onClick={toggle}
              aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
              className="rounded-xl p-2 transition-colors hover:bg-[var(--color-surface-muted)]"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              {dark ? <SunIcon className="h-5 w-5" /> : <MoonIcon className="h-5 w-5" />}
            </button>

            <Link
              to="/portal"
              className="hidden rounded-xl border border-[var(--color-border)] px-3.5 py-2 text-[0.8125rem] font-medium transition-all hover:bg-[var(--color-surface-muted)] sm:block shadow-xs"
              style={{
                color: 'var(--color-text)',
              }}
            >
              Patient login
            </Link>

            <Link
              to="/book"
              className="rounded-lg bg-primary-700 px-4 py-2 text-[0.8125rem] font-[620] text-white shadow-[inset_0_1px_0_0_rgb(255_255_255_/_0.16)] transition-colors duration-100 hover:bg-primary-600"
            >
              Book appointment
            </Link>

            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              aria-label="Menu"
              aria-expanded={menuOpen}
              className="rounded-lg p-2 md:hidden"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              {menuOpen ? <XMarkIcon className="h-5 w-5" /> : <Bars3Icon className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {menuOpen && (
          <nav
            className="border-t px-4 py-2 md:hidden"
            style={{ borderColor: 'var(--color-border)' }}
            aria-label="Main"
          >
            {[...NAV, { to: '/portal', label: 'Patient login', end: false }].map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className="block rounded-lg px-3 py-2.5 text-[0.875rem] font-medium"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        )}
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer
        className="mt-16 border-t"
        style={{ borderColor: 'var(--color-border)', background: 'var(--color-chrome)' }}
      >
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="flex items-center gap-2.5">
              <Logo size={28} />
              <span
                className="text-[0.9375rem] font-semibold"
                style={{ color: 'var(--color-chrome-text)' }}
              >
                Aarogya
              </span>
            </div>
            <p
              className="mt-3 text-[0.8125rem] leading-relaxed"
              style={{ color: 'var(--color-chrome-text-muted)' }}
            >
              A multi-speciality hospital serving the city since 1998.
            </p>
          </div>

          <FooterColumn
            title="Patients"
            links={[
              { to: '/book', label: 'Book an appointment' },
              { to: '/portal', label: 'Patient portal' },
              { to: '/doctors', label: 'Find a doctor' },
              { to: '/visiting', label: 'Visiting hours' },
            ]}
          />
          <FooterColumn
            title="Hospital"
            links={[
              { to: '/departments', label: 'Departments' },
              { to: '/visiting', label: 'Getting here' },
            ]}
          />

          <div>
            <p
              className="text-[0.6875rem] font-semibold uppercase tracking-[0.1em]"
              style={{ color: 'var(--color-chrome-text-muted)' }}
            >
              Contact
            </p>
            <ul
              className="mt-3 space-y-2 text-[0.8125rem]"
              style={{ color: 'var(--color-chrome-text-muted)' }}
            >
              <li>14 Anna Salai, Chennai 600002</li>
              <li>
                <a href="tel:+914440001200" className="hover:underline">
                  +91 44 4000 1200
                </a>
              </li>
              <li style={{ color: 'var(--color-danger)' }} className="font-semibold">
                Emergency: 108
              </li>
            </ul>
          </div>
        </div>

        <div
          className="border-t px-4 py-5"
          style={{ borderColor: 'var(--color-chrome-border)' }}
        >
          <div
            className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 text-[0.75rem]"
            style={{ color: 'var(--color-chrome-text-muted)' }}
          >
            <span>
              Demonstration environment. All patient data is synthetic and clearly fictional.
            </span>
            <Link to="/login" className="hover:underline">
              Staff sign-in
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: { to: string; label: string }[];
}) {
  return (
    <div>
      <p
        className="text-[0.6875rem] font-semibold uppercase tracking-[0.1em]"
        style={{ color: 'var(--color-chrome-text-muted)' }}
      >
        {title}
      </p>
      <ul className="mt-3 space-y-2">
        {links.map((l) => (
          <li key={l.to + l.label}>
            <Link
              to={l.to}
              className="text-[0.8125rem] hover:underline"
              style={{ color: 'var(--color-chrome-text-muted)' }}
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

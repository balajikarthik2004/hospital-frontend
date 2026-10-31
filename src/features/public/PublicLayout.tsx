import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  Bars3Icon,
  XMarkIcon,
  MoonIcon,
  SunIcon,
  UserCircleIcon,
} from '@heroicons/react/24/outline';
import { Logo } from '@/components/common';
import { BookingChat } from './BookingChat';
import { cn } from '@/lib/utils';
import { portalSession, portalToken, publicApi, type PortalPatient } from '@/lib/publicApi';

/**
 * Chrome for everything a member of the public sees.
 *
 * Kept entirely separate from AppLayout: that one assumes a signed-in user,
 * a sidebar and a permission set. A visitor has none of those, and the two
 * surfaces want to look different anyway — one is a hospital's front door,
 * the other is a clinical workstation.
 */

const PUBLIC_NAV = [
  { to: '/', label: 'Home', end: true },
  { to: '/departments', label: 'Departments' },
  { to: '/doctors', label: 'Find a doctor' },
  { to: '/visiting', label: 'Contact us' },
];

const PATIENT_NAV = [
  { to: '/departments', label: 'Departments' },
  { to: '/portal', label: 'My Appointments', end: true },
  { to: '/visiting', label: 'Contact us' },
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

  const [patient, setPatient] = useState<PortalPatient | null>(() => portalSession.getPatient());
  const [hasToken, setHasToken] = useState(() => Boolean(portalToken.get()));

  useEffect(() => {
    const syncSession = () => {
      const token = portalToken.get();
      setHasToken(Boolean(token));
      if (token) {
        const cached = portalSession.getPatient();
        if (cached) {
          setPatient(cached);
        } else {
          publicApi
            .get('/portal/me')
            .then((res) => {
              portalSession.setPatient(res.data.patient);
              setPatient(res.data.patient);
            })
            .catch(() => {
              setPatient(null);
            });
        }
      } else {
        setPatient(null);
      }
    };

    syncSession();
    window.addEventListener('portal-session-changed', syncSession);
    window.addEventListener('storage', syncSession);

    return () => {
      window.removeEventListener('portal-session-changed', syncSession);
      window.removeEventListener('storage', syncSession);
    };
  }, [location.pathname]);

  const isLoggedIn = Boolean(hasToken || patient);
  const navItems = isLoggedIn ? PATIENT_NAV : PUBLIC_NAV;

  return (
    <div className="flex min-h-screen flex-col" style={{ background: 'var(--color-bg)' }}>
      <header
        className="sticky top-0 z-40 border-b backdrop-blur-xl"
        style={{
          background: 'color-mix(in srgb, var(--color-surface) 88%, transparent)',
          borderColor: 'var(--color-border)',
        }}
      >
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-6 px-6 sm:px-8 lg:px-12">
          <Link
            to={isLoggedIn ? '/portal' : '/'}
            className="flex shrink-0 items-center gap-3.5 transition-opacity hover:opacity-95"
          >
            <Logo size={36} />
            <div className="flex flex-col justify-center shrink-0">
              <span className="whitespace-nowrap text-[0.9375rem] sm:text-base font-bold leading-tight tracking-tight text-[var(--color-text)]">
                Aarogya General Hospital
              </span>
              <span className="eyebrow whitespace-nowrap text-[0.6875rem] font-medium tracking-wider text-[var(--color-text-muted)]">
                Multi-speciality care
              </span>
            </div>
          </Link>

          <nav className="hidden lg:flex items-center gap-2 xl:gap-4 shrink-0" aria-label="Main">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'whitespace-nowrap shrink-0 rounded-lg px-4 py-2 text-[0.875rem] font-medium transition-colors duration-150',
                    isActive
                      ? 'bg-[var(--color-primary-50)] text-[var(--color-primary)] font-semibold'
                      : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-text)]'
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-3 sm:gap-4 lg:gap-5 shrink-0">
            <button
              type="button"
              onClick={toggle}
              aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
              className="rounded-xl p-2.5 text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-muted)] shrink-0"
            >
              {dark ? <SunIcon className="h-5 w-5" /> : <MoonIcon className="h-5 w-5" />}
            </button>

            {isLoggedIn ? (
              <Link
                to="/portal"
                title={patient ? `${patient.firstName} ${patient.lastName ?? ''}`.trim() : 'Patient Portal'}
                aria-label={patient ? `Profile: ${patient.firstName}` : 'Patient profile'}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-700 text-white font-bold text-sm shadow-xs transition-transform hover:scale-105 hover:bg-primary-800 focus:outline-none focus:ring-2 focus:ring-primary-600 focus:ring-offset-2 shrink-0 uppercase cursor-pointer"
              >
                {patient?.firstName ? patient.firstName[0] : 'C'}
              </Link>
            ) : (
              <Link
                to="/portal"
                className="hidden sm:inline-flex items-center gap-1.5 rounded-xl border border-[var(--color-border)] px-4 py-2 text-[0.8125rem] font-medium text-[var(--color-text)] transition-all hover:bg-[var(--color-surface-muted)] shadow-xs whitespace-nowrap shrink-0"
              >
                <UserCircleIcon className="h-4 w-4 text-[var(--color-text-secondary)]" />
                <span>Patient login</span>
              </Link>
            )}

            <Link
              to="/book"
              className="whitespace-nowrap shrink-0 rounded-xl bg-primary-700 px-4 py-2.5 text-[0.8125rem] font-semibold text-white shadow-xs transition-colors duration-150 hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-600 focus:ring-offset-2"
            >
              Book appointment
            </Link>

            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              aria-label="Menu"
              aria-expanded={menuOpen}
              className="rounded-xl p-2 text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-muted)] lg:hidden shrink-0"
            >
              {menuOpen ? <XMarkIcon className="h-6 w-6" /> : <Bars3Icon className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {menuOpen && (
          <nav
            className="border-t px-6 py-4 lg:hidden flex flex-col gap-2 bg-[var(--color-surface)] shadow-lg"
            style={{ borderColor: 'var(--color-border)' }}
            aria-label="Mobile Navigation"
          >
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'block rounded-xl px-4 py-2.5 text-[0.9375rem] font-medium transition-colors',
                    isActive
                      ? 'bg-[var(--color-primary-50)] text-[var(--color-primary)] font-semibold'
                      : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-muted)]'
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}

            <div className="pt-3 mt-1 border-t flex flex-col gap-2.5" style={{ borderColor: 'var(--color-border)' }}>
              <Link
                to="/portal"
                className="flex items-center justify-between rounded-xl px-4 py-2.5 text-[0.9375rem] font-medium border border-[var(--color-border)] hover:bg-[var(--color-surface-muted)]"
              >
                <span className="flex items-center gap-2.5">
                  {isLoggedIn ? (
                    <>
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-700 text-[0.6875rem] font-bold text-white uppercase shrink-0">
                        {patient?.firstName ? patient.firstName[0] : 'P'}
                      </span>
                      <span className="font-semibold text-[var(--color-text)]">
                        {patient ? `${patient.firstName} ${patient.lastName ?? ''}`.trim() : 'Patient Portal'}
                      </span>
                    </>
                  ) : (
                    <>
                      <UserCircleIcon className="h-5 w-5 text-[var(--color-text-secondary)]" />
                      <span>Patient login</span>
                    </>
                  )}
                </span>
                <span className="text-xs text-[var(--color-text-muted)] font-normal">
                  {isLoggedIn ? 'Dashboard' : 'Sign in'}
                </span>
              </Link>
            </div>
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

      {/* Mounted on the layout rather than on the home page, so a visitor who
          has clicked through to Departments or Find a doctor — the two places
          people most often stall — can still book without going back. It
          keeps its own conversation in sessionStorage, so navigating between
          those pages does not restart it. */}
      <BookingChat />
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

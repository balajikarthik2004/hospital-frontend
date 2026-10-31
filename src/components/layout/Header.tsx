import { Fragment, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Menu, Transition } from '@headlessui/react';
import {
  BellIcon,
  Bars3Icon,
  MagnifyingGlassIcon,
  MoonIcon,
  SunIcon,
} from '@heroicons/react/24/outline';
import { api } from '@/lib/api';
import { Avatar, Logo } from '@/components/common';
import { useNotificationStore } from '@/store/notificationStore';
import { useSocketStatus } from '@/hooks/useSocket';
import { useDebounce } from '@/hooks/useDebounce';
import { cn, fmtRelative, patientAge, patientName } from '@/lib/utils';
import type { Patient } from '@/types';

export function Header({ onMenuClick }: { onMenuClick: () => void }) {
  const connected = useSocketStatus();
  const notifications = useNotificationStore((s) => s.notifications);
  const markAllRead = useNotificationStore((s) => s.markAllRead);
  const unread = notifications.filter((n) => !n.read).length;

  return (
    <header
      className="no-print sticky top-0 z-30 flex h-16 items-center gap-3 border-b px-4 lg:px-6"
      style={{
        borderColor: 'var(--color-border)',
        background: 'color-mix(in srgb, var(--color-surface) 84%, transparent)',
        backdropFilter: 'saturate(180%) blur(16px)',
        WebkitBackdropFilter: 'saturate(180%) blur(16px)',
      }}
    >
      <button
        onClick={onMenuClick}
        className="-ml-1 rounded-lg p-2 text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-muted)] lg:hidden"
        aria-label="Open navigation"
      >
        <Bars3Icon className="h-5 w-5" />
      </button>

      <Link to="/" className="lg:hidden" aria-label="SafeDischarge home">
        <Logo size={26} />
      </Link>

      <PatientSearch />

      <div className="ml-auto flex items-center gap-1">
        <LiveIndicator connected={connected} />

        <ThemeToggle />

        <Menu as="div" className="relative">
          <Menu.Button
            onClick={() => setTimeout(markAllRead, 1200)}
            className="relative rounded-lg p-2 text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-muted)]"
            aria-label={`Notifications${unread ? ` (${unread} unread)` : ''}`}
          >
            <BellIcon className="h-5 w-5" />
            {unread > 0 && (
              <span
                className="absolute right-1 top-1 flex h-[17px] min-w-[17px] items-center justify-center rounded-full px-1 text-[0.625rem] font-bold text-white ring-2"
                style={{
                  background: 'var(--color-danger)',
                  ['--tw-ring-color' as string]: 'var(--color-surface)',
                }}
              >
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </Menu.Button>
          <Transition
            as={Fragment}
            enter="transition duration-150 ease-out"
            enterFrom="opacity-0 scale-95 -translate-y-1"
            enterTo="opacity-100 scale-100 translate-y-0"
          >
            <Menu.Items className="absolute right-0 mt-2 w-[22rem] origin-top-right overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-xl focus:outline-none">
              <div
                className="flex items-center justify-between border-b px-4 py-3"
                style={{ borderColor: 'var(--color-border)' }}
              >
                <span className="text-[0.8125rem] font-semibold">Activity</span>
                {unread > 0 && (
                  <span className="text-[0.6875rem] text-faint">{unread} new</span>
                )}
              </div>
              <div className="max-h-[26rem] overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="px-4 py-10 text-center">
                    <p className="text-[0.8125rem] font-medium">All quiet</p>
                    <p className="mt-1 text-xs text-muted">
                      Flags, approvals and bookings land here as they happen.
                    </p>
                  </div>
                ) : (
                  notifications.map((n) => (
                    <Menu.Item key={n.id}>
                      {({ active }) => (
                        <Link
                          to={n.href ?? '#'}
                          className={cn(
                            'block border-b px-4 py-3 transition-colors last:border-0',
                            active && 'bg-[var(--color-surface-muted)]'
                          )}
                          style={{ borderColor: 'var(--color-border)' }}
                        >
                          <div className="flex items-start gap-2.5">
                            <span
                              className="mt-[5px] h-2 w-2 shrink-0 rounded-full"
                              style={{
                                background:
                                  n.tone === 'error'
                                    ? 'var(--color-danger)'
                                    : n.tone === 'warning'
                                      ? 'var(--color-warning)'
                                      : n.tone === 'success'
                                        ? 'var(--color-success)'
                                        : 'var(--color-info)',
                              }}
                            />
                            <div className="min-w-0">
                              <p className="text-xs font-medium leading-snug">{n.title}</p>
                              {n.detail && (
                                <p className="mt-0.5 text-xs leading-snug text-muted">
                                  {n.detail}
                                </p>
                              )}
                              <p className="mt-1 text-[0.625rem] text-faint">
                                {fmtRelative(n.at)}
                              </p>
                            </div>
                          </div>
                        </Link>
                      )}
                    </Menu.Item>
                  ))
                )}
              </div>
            </Menu.Items>
          </Transition>
        </Menu>
      </div>
    </header>
  );
}

function LiveIndicator({ connected }: { connected: boolean }) {
  return (
    <span
      className="mr-1 hidden items-center gap-2 rounded-full border px-3 py-1 text-[0.6875rem] font-semibold sm:inline-flex shadow-xs"
      style={{
        background: connected ? 'rgba(42, 127, 76, 0.10)' : 'var(--color-surface-muted)',
        borderColor: connected ? 'rgba(42, 127, 76, 0.28)' : 'var(--color-border)',
        color: connected ? 'var(--color-success)' : 'var(--color-text-tertiary)',
      }}
      title={
        connected
          ? 'Connected — this screen updates itself as the team works'
          : 'Not receiving live updates. Refresh to catch up.'
      }
    >
      <span className="relative flex h-2 w-2" aria-hidden>
        {connected && (
          <span
            className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"
            style={{ background: 'currentColor' }}
          />
        )}
        <span
          className="relative inline-flex h-2 w-2 rounded-full"
          style={{ background: 'currentColor' }}
        />
      </span>
      {connected ? 'Live Sync' : 'Offline'}
    </span>
  );
}

function PatientSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Patient[]>([]);
  const [open, setOpen] = useState(false);
  const debounced = useDebounce(query, 250);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  // "/" focuses search from anywhere, the way clinical tools behave.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable);
      if ((e.key === '/' || ((e.metaKey || e.ctrlKey) && e.key === 'k')) && !typing) {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === 'Escape') inputRef.current?.blur();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (debounced.trim().length < 2) {
      setResults([]);
      return;
    }
    api
      .get<{ patients: Patient[] }>('/patients/search', { params: { q: debounced } })
      .then((res) => {
        if (!cancelled) setResults(res.data.patients);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [debounced]);

  const noMatches = open && debounced.trim().length >= 2 && results.length === 0;

  return (
    <div className="relative w-full max-w-md">
      <MagnifyingGlassIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-tertiary)]" />
      <input
        ref={inputRef}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Quick search patients (name, ID, diagnosis)..."
        className="h-9.5 w-full rounded-lg border bg-[var(--color-surface-muted)] pl-10 pr-12 text-[0.8125rem] transition-[border-color,box-shadow,background-color] duration-150 placeholder:text-[var(--color-text-tertiary)] focus:border-primary-600 focus:bg-[var(--color-surface)] focus:outline-none focus:ring-[3px] focus:ring-primary-700/15"
        style={{ borderColor: 'var(--color-border)' }}
        aria-label="Search patients by name, ID or phone"
      />
      {!query && (
        <kbd
          className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-1.5 py-0.5 font-mono text-[0.625rem] font-semibold text-[var(--color-text-tertiary)] sm:block shadow-xs"
        >
          ⌘K
        </kbd>
      )}

      {(results.length > 0 || noMatches) && open && (
        <div className="absolute left-0 right-0 top-12 z-50 overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl">
          {noMatches ? (
            <p className="px-4 py-5 text-center text-xs text-muted">
              No patient matches “{debounced}”.
            </p>
          ) : (
            results.slice(0, 8).map((p) => (
              <button
                key={p._id}
                onMouseDown={() => {
                  navigate(`/app/patients/${p._id}`);
                  setQuery('');
                  setResults([]);
                }}
                className="flex w-full items-center gap-3 border-b px-4 py-3 text-left transition-colors last:border-0 hover:bg-[var(--color-surface-muted)]"
                style={{ borderColor: 'var(--color-border)' }}
              >
                <Avatar name={patientName(p)} size={32} color="#1E7B6B" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[0.8125rem] font-semibold">
                    {patientName(p)}
                  </span>
                  <span className="block truncate text-[0.6875rem] text-faint">
                    {p.patientId} · {patientAge(p)}y · {p.status.replace('_', ' ')}
                  </span>
                </span>
                <span className="shrink-0 text-xs font-semibold text-primary-600 dark:text-primary-400">
                  Open →
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function ThemeToggle() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('safedischarge.theme', dark ? 'dark' : 'light');
  }, [dark]);

  return (
    <button
      onClick={() => setDark((d) => !d)}
      className="rounded-lg p-2 text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-muted)]"
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={dark ? 'Light mode' : 'Dark mode'}
    >
      {dark ? <SunIcon className="h-5 w-5" /> : <MoonIcon className="h-5 w-5" />}
    </button>
  );
}

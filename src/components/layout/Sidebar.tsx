import { Fragment } from 'react';
import { NavLink } from 'react-router-dom';
import { Menu, Transition } from '@headlessui/react';
import {
  ArrowRightOnRectangleIcon,
  BuildingOffice2Icon,
  BuildingStorefrontIcon,
  CalendarDaysIcon,
  ChartBarIcon,
  ClipboardDocumentCheckIcon,
  Cog6ToothIcon,
  EllipsisHorizontalIcon,
  HomeIcon,
  ShieldCheckIcon,
  Squares2X2Icon,
  UserCircleIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline';
import { Avatar, Wordmark } from '@/components/common';
import { useAuthStore } from '@/store/authStore';
import { cn } from '@/lib/utils';
import type { Permission } from '@/types';

interface NavItem {
  to: string;
  label: string;
  icon: typeof HomeIcon;
  /** Shown only if the user holds at least one of these. Empty = everyone. */
  permissions?: Permission[];
  badgeKey?: 'discharge';
}

interface NavGroup {
  /** Names the stage of work the items belong to, not the data they contain. */
  label: string | null;
  items: NavItem[];
}

/**
 * Grouped so the rail reads as the shape of the job: today's work, then the
 * patient's journey through the hospital, then oversight.
 */
const NAV: NavGroup[] = [
  {
    label: null,
    items: [{ to: '/app', label: 'Dashboard', icon: HomeIcon }],
  },
  {
    label: 'Care',
    items: [
      { to: '/app/patients', label: 'Patients', icon: UserGroupIcon },
      {
        to: '/app/admissions',
        label: 'Admissions',
        icon: BuildingOffice2Icon,
        permissions: ['patient:view:any'],
      },
      {
        to: '/app/discharge',
        label: 'Discharge',
        icon: ClipboardDocumentCheckIcon,
        permissions: ['patient:view:any'],
        badgeKey: 'discharge',
      },
    ],
  },
  {
    label: 'Operations',
    items: [
      { to: '/app/beds', label: 'Beds', icon: Squares2X2Icon, permissions: ['beds:view'] },
      {
        to: '/app/scheduling',
        label: 'Scheduling',
        icon: CalendarDaysIcon,
        permissions: ['appointment:schedule'],
      },
    ],
  },
  {
    label: 'Oversight',
    items: [
      { to: '/app/analytics', label: 'Analytics', icon: ChartBarIcon, permissions: ['analytics:view'] },
      { to: '/app/audit', label: 'Audit log', icon: ShieldCheckIcon, permissions: ['audit:view'] },
      {
        to: '/app/admin/departments',
        label: 'Departments',
        icon: BuildingStorefrontIcon,
        permissions: ['catalogue:manage'],
      },
    ],
  },
];

export function Sidebar({
  open,
  onNavigate,
  dischargeBadge,
}: {
  open: boolean;
  onNavigate?: () => void;
  dischargeBadge?: number;
}) {
  const user = useAuthStore((s) => s.user);
  const can = useAuthStore((s) => s.can);
  const logout = useAuthStore((s) => s.logout);

  const groups = NAV.map((group) => ({
    ...group,
    items: group.items.filter(
      (item) => !item.permissions || item.permissions.some((p) => can(p))
    ),
  })).filter((group) => group.items.length > 0);

  return (
    <aside
      className={cn(
        // 16rem, matching the lg:pl-64 the main column reserves. These were
        // 15.5rem and 16rem, leaving an 8px strip of page showing through
        // beside the rail on every desktop screen.
        'chrome no-print fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r',
        'transition-transform duration-300 ease-out lg:translate-x-0',
        open ? 'translate-x-0 shadow-2xl lg:shadow-none' : '-translate-x-full'
      )}
      style={{
        // Flat carbon. The old vertical gradient lightened towards the
        // bottom, which put the brightest part of the rail behind the
        // account row and made the nav items above it look dimmed out.
        background: 'var(--color-chrome)',
        borderColor: 'var(--color-chrome-border)',
        color: 'var(--color-chrome-text)',
      }}
    >
      <div
        className="flex h-16 shrink-0 items-center justify-between border-b px-5"
        style={{ borderColor: 'var(--color-chrome-border)' }}
      >
        <Wordmark />
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-5" aria-label="Main">
        {groups.map((group, gi) => (
          <div key={group.label ?? gi} className={cn(gi > 0 && 'mt-6')}>
            {group.label && (
              <div className="mb-1.5 px-3 text-[0.625rem] font-[680] uppercase tracking-[0.1em] text-[var(--color-chrome-text-muted)]">
                {group.label}
              </div>
            )}
            <ul className="space-y-0.5">
              {group.items.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.to === '/app'}
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      cn(
                        'group relative flex items-center gap-3 rounded-lg py-2 pl-3 pr-2.5 text-[0.8125rem]',
                        'transition-colors duration-100',
                        isActive
                          ? 'bg-white/[0.08] font-[620] text-white'
                          : 'font-medium text-[var(--color-chrome-text-muted)] hover:bg-white/[0.045] hover:text-white'
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {/* The rail is the whole active treatment. A coloured
                            fill plus a border plus an outer glow was three
                            signals for one bit of state, and the glow bled
                            into the items above and below it. */}
                        {isActive && (
                          <span
                            className="absolute inset-y-1.5 left-0 w-[3px] rounded-r-full bg-[var(--color-chrome-active-text)]"
                            aria-hidden
                          />
                        )}
                        <item.icon
                          className={cn(
                            'h-[18px] w-[18px] shrink-0 transition-colors',
                            isActive
                              ? 'text-[var(--color-chrome-active-text)]'
                              : 'text-[var(--color-chrome-text-muted)] group-hover:text-white'
                          )}
                        />
                        <span className="flex-1 truncate">{item.label}</span>
                        {item.badgeKey === 'discharge' && !!dischargeBadge && (
                          <span
                            className="rounded px-1.5 py-0.5 text-[0.625rem] font-[680] tabular"
                            style={{
                              background: 'rgba(224, 176, 85, 0.16)',
                              color: '#E0B055',
                            }}
                            title={`${dischargeBadge} package${dischargeBadge === 1 ? '' : 's'} awaiting review`}
                          >
                            {dischargeBadge}
                          </span>
                        )}
                      </>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t p-3" style={{ borderColor: 'var(--color-chrome-border)' }}>
        <Menu as="div" className="relative">
          <Menu.Button className="flex w-full items-center gap-2.5 rounded-lg p-2 text-left transition-colors duration-100 hover:bg-white/[0.06]">
            <div className="relative shrink-0">
              <Avatar name={user?.fullName ?? '?'} size={32} color="#1E7B6B" />
              {/* The ring has to be the rail's own colour to read as a
                  cut-out; it was hard-coded to the old gradient's midpoint,
                  so it sat on the avatar as a visible grey hoop. */}
              <span
                className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2"
                style={{
                  background: '#2A7F4C',
                  ['--tw-ring-color' as string]: 'var(--color-chrome)',
                }}
              />
            </div>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[0.8125rem] font-[620] text-white">
                {user?.fullName}
              </span>
              <span className="block truncate text-[0.6875rem] font-medium capitalize text-[var(--color-chrome-text-muted)]">
                {user?.role.replace('_', ' ')}
                {user?.department ? ` · ${user.department}` : ''}
              </span>
            </span>
            <EllipsisHorizontalIcon className="h-4 w-4 shrink-0 text-[var(--color-chrome-text-muted)]" />
          </Menu.Button>

          <Transition
            as={Fragment}
            enter="transition duration-150 ease-out"
            enterFrom="opacity-0 translate-y-1"
            enterTo="opacity-100 translate-y-0"
          >
            <Menu.Items className="absolute bottom-full left-0 right-0 mb-2 overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-lg focus:outline-none">
              <Menu.Item>
                {({ active }) => (
                  <NavLink
                    to="/app/profile"
                    onClick={onNavigate}
                    className={cn(
                      'flex items-center gap-2.5 px-3 py-2.5 text-[0.8125rem]',
                      active && 'bg-[var(--color-surface-muted)]'
                    )}
                  >
                    <UserCircleIcon className="h-4 w-4 text-faint" />
                    Your profile
                  </NavLink>
                )}
              </Menu.Item>
              <Menu.Item>
                {({ active }) => (
                  <NavLink
                    to="/app/settings"
                    onClick={onNavigate}
                    className={cn(
                      'flex items-center gap-2.5 px-3 py-2.5 text-[0.8125rem]',
                      active && 'bg-[var(--color-surface-muted)]'
                    )}
                  >
                    <Cog6ToothIcon className="h-4 w-4 text-faint" />
                    Settings
                  </NavLink>
                )}
              </Menu.Item>
              <Menu.Item>
                {({ active }) => (
                  <button
                    onClick={logout}
                    className={cn(
                      'flex w-full items-center gap-2.5 border-t border-[var(--color-border)] px-3 py-2.5 text-[0.8125rem]',
                      active && 'bg-[var(--color-surface-muted)]'
                    )}
                  >
                    <ArrowRightOnRectangleIcon className="h-4 w-4 text-faint" />
                    Sign out
                  </button>
                )}
              </Menu.Item>
            </Menu.Items>
          </Transition>
        </Menu>

        <p className="mt-2 px-2 text-[0.625rem] text-faint">
          SafeDischarge v1.0 · © 2026 GWC Data AI
        </p>
      </div>
    </aside>
  );
}

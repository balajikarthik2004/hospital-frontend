import { Fragment } from 'react';
import { NavLink } from 'react-router-dom';
import { Menu, Transition } from '@headlessui/react';
import {
  ArrowRightOnRectangleIcon,
  BuildingOffice2Icon,
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
    items: [{ to: '/', label: 'Dashboard', icon: HomeIcon }],
  },
  {
    label: 'Care',
    items: [
      { to: '/patients', label: 'Patients', icon: UserGroupIcon },
      {
        to: '/admissions',
        label: 'Admissions',
        icon: BuildingOffice2Icon,
        permissions: ['patient:view:any'],
      },
      {
        to: '/discharge',
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
      { to: '/beds', label: 'Beds', icon: Squares2X2Icon, permissions: ['beds:view'] },
      {
        to: '/scheduling',
        label: 'Scheduling',
        icon: CalendarDaysIcon,
        permissions: ['appointment:schedule'],
      },
    ],
  },
  {
    label: 'Oversight',
    items: [
      { to: '/analytics', label: 'Analytics', icon: ChartBarIcon, permissions: ['analytics:view'] },
      { to: '/audit', label: 'Audit log', icon: ShieldCheckIcon, permissions: ['audit:view'] },
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
        'chrome no-print fixed inset-y-0 left-0 z-40 flex w-[15.5rem] flex-col border-r',
        'transition-transform duration-300 ease-out lg:translate-x-0',
        open ? 'translate-x-0 shadow-xl lg:shadow-none' : '-translate-x-full'
      )}
      style={{
        background: 'var(--color-chrome)',
        borderColor: 'var(--color-chrome-border)',
        color: 'var(--color-chrome-text)',
      }}
    >
      <div
        className="flex h-16 shrink-0 items-center border-b px-5"
        style={{ borderColor: 'var(--color-chrome-border)' }}
      >
        <Wordmark />
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Main">
        {groups.map((group, gi) => (
          <div key={group.label ?? gi} className={cn(gi > 0 && 'mt-6')}>
            {group.label && <div className="eyebrow mb-1.5 px-3">{group.label}</div>}
            <ul className="space-y-0.5">
              {group.items.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.to === '/'}
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      cn(
                        'group relative flex items-center gap-3 rounded-lg px-3 py-2 text-[0.8125rem] font-medium',
                        'transition-colors duration-150',
                        isActive
                          ? 'bg-[var(--color-chrome-active)] text-[var(--color-chrome-active-text)]'
                          : 'text-[var(--color-chrome-text-muted)] hover:bg-[var(--color-chrome-hover)] hover:text-[var(--color-chrome-text)]'
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {/* The active marker is a rail, not a fill, so the eye
                            can find the current page at a glance. */}
                        <span
                          className={cn(
                            'absolute -left-3 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full transition-all duration-200',
                            isActive ? 'opacity-100' : 'opacity-0'
                          )}
                          style={{ background: 'var(--color-chrome-active-text)' }}
                          aria-hidden
                        />
                        <item.icon
                          className={cn(
                            'h-[18px] w-[18px] shrink-0 transition-colors',
                            isActive
                              ? 'text-[var(--color-chrome-active-text)]'
                              : 'text-[var(--color-chrome-text-muted)] group-hover:text-[var(--color-chrome-text)]'
                          )}
                        />
                        <span className="flex-1 truncate">{item.label}</span>
                        {item.badgeKey === 'discharge' && !!dischargeBadge && (
                          <span
                            className="rounded-full border px-1.5 py-px text-[0.625rem] font-bold tabular"
                            style={{
                              background: 'var(--color-warning-light)',
                              borderColor: 'var(--color-warning-border)',
                              color: 'var(--color-warning)',
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
          <Menu.Button className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors hover:bg-[var(--color-chrome-hover)]">
            <Avatar name={user?.fullName ?? '?'} size={32} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[0.8125rem] font-medium">
                {user?.fullName}
              </span>
              <span
                className="block truncate text-[0.6875rem] capitalize"
                style={{ color: 'var(--color-chrome-text-muted)' }}
              >
                {user?.role.replace('_', ' ')}
                {user?.department ? ` · ${user.department}` : ''}
              </span>
            </span>
            <EllipsisHorizontalIcon className="h-4 w-4 shrink-0 text-faint" />
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
                    to="/profile"
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
                    to="/settings"
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

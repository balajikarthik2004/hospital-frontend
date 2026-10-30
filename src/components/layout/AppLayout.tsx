import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { api } from '@/lib/api';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { Toaster } from '@/components/common/Toaster';
import { useSocketEvent } from '@/hooks/useSocket';
import { useAuthStore } from '@/store/authStore';
import { useNotificationStore } from '@/store/notificationStore';

export function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dischargeBadge, setDischargeBadge] = useState(0);
  const location = useLocation();
  const can = useAuthStore((s) => s.can);
  const notify = useNotificationStore((s) => s.notify);
  const push = useNotificationStore((s) => s.push);

  useEffect(() => setSidebarOpen(false), [location.pathname]);

  // Keep the sidebar badge in step with the review queue.
  const refreshBadge = () => {
    if (!can('patient:view:any')) return;
    api
      .get<{ pagination: { total: number } }>('/discharge', {
        params: { status: 'pending_review', limit: 1 },
      })
      .then((res) => setDischargeBadge(res.data.pagination.total))
      .catch(() => undefined);
  };

  useEffect(refreshBadge, [location.pathname]);

  // ─── Live events (spec §9) ───
  useSocketEvent<{ packageId: string; status: string }>('discharge:status-update', () => {
    refreshBadge();
  });

  useSocketEvent<{
    packageId: string;
    count: number;
    flags: { drugA: string; drugB: string | null }[];
  }>('alert:critical-medication', (payload) => {
    const pairs = payload.flags
      .map((f) => (f.drugB ? `${f.drugA} + ${f.drugB}` : f.drugA))
      .join(', ');
    push({
      tone: 'error',
      title: `${payload.count} critical medication flag${payload.count === 1 ? '' : 's'}`,
      detail: pairs,
    });
    notify({
      tone: 'error',
      title: `Critical medication flag: ${pairs}`,
      detail: 'Pharmacist review required before discharge.',
      href: `/discharge/${payload.packageId}`,
    });
  });

  useSocketEvent<{ packageId: string }>('discharge:completed', () => {
    push({ tone: 'success', title: 'A discharge was completed' });
    refreshBadge();
  });

  useSocketEvent<{ appointment: { appointmentId: string; specialty: string } }>(
    'appointment:created',
    (payload) => {
      notify({
        tone: 'info',
        title: `Appointment booked — ${payload.appointment?.specialty || 'follow-up'}`,
        detail: payload.appointment?.appointmentId,
        href: '/scheduling',
      });
    }
  );

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-bg)' }}>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-primary-600 focus:px-4 focus:py-2 focus:text-sm focus:text-white"
      >
        Skip to content
      </a>

      <Sidebar
        open={sidebarOpen}
        onNavigate={() => setSidebarOpen(false)}
        dischargeBadge={dischargeBadge}
      />

      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-ink-950/40 backdrop-blur-[2px] lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden
        />
      )}

      <div className="lg:pl-[15.5rem]">
        <Header onMenuClick={() => setSidebarOpen(true)} />
        {/* Keyed on the path so every navigation gets a short settle-in
            animation instead of snapping. */}
        <main
          id="main"
          key={location.pathname}
          className="mx-auto max-w-[1600px] animate-fade-in px-4 py-7 lg:px-8"
        >
          <Outlet />
        </main>
      </div>

      <Toaster />
    </div>
  );
}

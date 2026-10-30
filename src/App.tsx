import { useEffect } from 'react';
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button, EmptyState, LoadingPane } from '@/components/common';
import { LockClosedIcon } from '@heroicons/react/24/outline';
import { useAuthStore } from '@/store/authStore';
import type { Permission } from '@/types';

import { LoginPage } from '@/features/auth/LoginPage';
import { ProfilePage } from '@/features/auth/ProfilePage';
import { DashboardPage } from '@/features/dashboard/DashboardPage';
import { PatientListPage } from '@/features/patients/PatientListPage';
import { PatientWizardPage } from '@/features/patients/PatientWizardPage';
import { Patient360Page } from '@/features/patients/Patient360Page';
import { AdmissionsPage } from '@/features/admissions/AdmissionsPage';
import { BedMapPage } from '@/features/admissions/BedMapPage';
import { SchedulingPage } from '@/features/scheduling/SchedulingPage';
import { DischargeQueuePage } from '@/features/discharge/DischargeQueuePage';
import { DischargePackagePage } from '@/features/discharge/DischargePackagePage';
import { AnalyticsPage } from '@/features/analytics/AnalyticsPage';
import { AuditLogPage } from '@/features/audit/AuditLogPage';
import { SettingsPage } from '@/features/settings/SettingsPage';
import { NotFoundPage } from '@/features/NotFoundPage';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const initialising = useAuthStore((s) => s.initialising);
  const location = useLocation();

  if (initialising) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingPane label="Restoring your session" />
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <>{children}</>;
}

/**
 * Routes are guarded as well as hidden. The sidebar already omits links the
 * role cannot use, but a typed URL or a stale bookmark must land on a proper
 * screen rather than the API's raw permission error.
 */
function RequirePermission({
  permission,
  children,
}: {
  permission: Permission;
  children: React.ReactNode;
}) {
  const can = useAuthStore((s) => s.can);
  const user = useAuthStore((s) => s.user);

  if (can(permission)) return <>{children}</>;

  return (
    <EmptyState
      icon={<LockClosedIcon className="h-6 w-6" />}
      title="This area isn't open to your role"
      detail={`Signed in as ${user?.role.replace('_', ' ') ?? 'an unknown role'}. Someone with the right permission can show you what's here, or an administrator can change your access.`}
      action={
        <Link to="/">
          <Button variant="outline">Back to dashboard</Button>
        </Link>
      }
    />
  );
}

export default function App() {
  const restore = useAuthStore((s) => s.restore);

  useEffect(() => {
    void restore();
  }, [restore]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route
          element={
            <RequireAuth>
              <AppLayout />
            </RequireAuth>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="patients" element={<PatientListPage />} />
          <Route path="patients/new" element={<PatientWizardPage />} />
          <Route path="patients/:id" element={<Patient360Page />} />
          <Route
            path="admissions"
            element={
              <RequirePermission permission="patient:view:any">
                <AdmissionsPage />
              </RequirePermission>
            }
          />
          <Route
            path="beds"
            element={
              <RequirePermission permission="beds:view">
                <BedMapPage />
              </RequirePermission>
            }
          />
          <Route
            path="scheduling"
            element={
              <RequirePermission permission="appointment:schedule">
                <SchedulingPage />
              </RequirePermission>
            }
          />
          <Route
            path="discharge"
            element={
              <RequirePermission permission="patient:view:any">
                <DischargeQueuePage />
              </RequirePermission>
            }
          />
          <Route path="discharge/:id" element={<DischargePackagePage />} />
          <Route
            path="analytics"
            element={
              <RequirePermission permission="analytics:view">
                <AnalyticsPage />
              </RequirePermission>
            }
          />
          <Route
            path="audit"
            element={
              <RequirePermission permission="audit:view">
                <AuditLogPage />
              </RequirePermission>
            }
          />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

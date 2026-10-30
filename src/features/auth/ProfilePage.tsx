import { useState, type FormEvent } from 'react';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  ErrorState,
  Field,
  Input,
  PageHeader,
} from '@/components/common';
import { api } from '@/lib/api';
import { useMutation } from '@/hooks/useApi';
import { useAuthStore } from '@/store/authStore';
import { toast } from '@/store/notificationStore';
import { fmtDateTime, titleCase } from '@/lib/utils';
import type { User } from '@/types';

export function ProfilePage() {
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);

  const [profile, setProfile] = useState({
    firstName: user?.firstName ?? '',
    lastName: user?.lastName ?? '',
    phone: user?.phone ?? '',
    department: user?.department ?? '',
  });
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '', confirm: '' });

  const saveProfile = useMutation(async () => {
    const { data } = await api.put<{ user: User }>('/auth/profile', profile);
    updateUser(data.user);
    toast.success('Profile updated');
  });

  const changePassword = useMutation(async () => {
    await api.put('/auth/change-password', {
      currentPassword: passwords.currentPassword,
      newPassword: passwords.newPassword,
    });
    setPasswords({ currentPassword: '', newPassword: '', confirm: '' });
    toast.success('Password changed');
  });

  if (!user) return null;

  const passwordMismatch =
    passwords.confirm.length > 0 && passwords.newPassword !== passwords.confirm;

  return (
    <>
      <PageHeader
        eyebrow="Account"
        title="My profile"
        story="Your account details and the permissions your role carries. Change your password here."
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <div className="flex flex-col items-center text-center">
            <div
              className="flex h-20 w-20 items-center justify-center rounded-full text-2xl font-semibold text-white"
              style={{ background: 'var(--color-primary-dark)' }}
            >
              {user.firstName[0]}
              {user.lastName[0]}
            </div>
            <h3 className="mt-3">{user.fullName}</h3>
            <Badge tone="primary" className="mt-2">
              {titleCase(user.role)}
            </Badge>
            <p className="mt-3 text-xs text-muted">{user.email}</p>
          </div>

          <dl className="mt-5 space-y-2.5 border-t pt-4 text-xs" style={{ borderColor: 'var(--color-border)' }}>
            {[
              ['Department', user.department || '—'],
              ['Specialisation', user.specialization || '—'],
              ['Licence', user.licenseNumber || '—'],
              ['Last sign-in', fmtDateTime(user.lastLogin)],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between gap-3">
                <dt className="text-faint">{label}</dt>
                <dd className="text-right font-medium">{value}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-5 border-t pt-4" style={{ borderColor: 'var(--color-border)' }}>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-faint">
              What this role may do
            </p>
            <div className="flex flex-wrap gap-1.5">
              {user.permissions.map((p) => (
                <span
                  key={p}
                  className="rounded px-1.5 py-0.5 font-mono text-[10px]"
                  style={{
                    background: 'var(--color-surface-muted)',
                    color: 'var(--color-text-secondary)',
                  }}
                >
                  {p}
                </span>
              ))}
            </div>
          </div>
        </Card>

        <div className="space-y-5 lg:col-span-2">
          <Card>
            <CardHeader title="Details" subtitle="Keep your contact information current" />
            <form
              onSubmit={(e: FormEvent) => {
                e.preventDefault();
                void saveProfile.mutate();
              }}
              className="space-y-4"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="First name" required>
                  <Input
                    value={profile.firstName}
                    onChange={(e) => setProfile({ ...profile, firstName: e.target.value })}
                    required
                  />
                </Field>
                <Field label="Last name" required>
                  <Input
                    value={profile.lastName}
                    onChange={(e) => setProfile({ ...profile, lastName: e.target.value })}
                    required
                  />
                </Field>
                <Field label="Phone">
                  <Input
                    value={profile.phone}
                    onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                  />
                </Field>
                <Field label="Department">
                  <Input
                    value={profile.department}
                    onChange={(e) => setProfile({ ...profile, department: e.target.value })}
                  />
                </Field>
              </div>

              {saveProfile.error && <ErrorState message={saveProfile.error} />}

              <div className="flex justify-end">
                <Button type="submit" loading={saveProfile.pending}>
                  Save changes
                </Button>
              </div>
            </form>
          </Card>

          <Card>
            <CardHeader title="Password" subtitle="At least 8 characters" />
            <form
              onSubmit={(e: FormEvent) => {
                e.preventDefault();
                if (passwordMismatch) return;
                void changePassword.mutate();
              }}
              className="space-y-4"
            >
              <Field label="Current password" required>
                <Input
                  type="password"
                  value={passwords.currentPassword}
                  onChange={(e) =>
                    setPasswords({ ...passwords, currentPassword: e.target.value })
                  }
                  autoComplete="current-password"
                  required
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="New password" required>
                  <Input
                    type="password"
                    value={passwords.newPassword}
                    onChange={(e) => setPasswords({ ...passwords, newPassword: e.target.value })}
                    autoComplete="new-password"
                    minLength={8}
                    required
                  />
                </Field>
                <Field
                  label="Confirm new password"
                  required
                  error={passwordMismatch ? 'The passwords do not match' : undefined}
                >
                  <Input
                    type="password"
                    value={passwords.confirm}
                    onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
                    autoComplete="new-password"
                    required
                  />
                </Field>
              </div>

              {changePassword.error && <ErrorState message={changePassword.error} />}

              <div className="flex justify-end">
                <Button
                  type="submit"
                  variant="outline"
                  loading={changePassword.pending}
                  disabled={passwordMismatch}
                >
                  Change password
                </Button>
              </div>
            </form>
          </Card>
        </div>
      </div>
    </>
  );
}

import { useState } from 'react';
import { PlusIcon } from '@heroicons/react/24/outline';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  Checkbox,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Field,
  Input,
  LoadingPane,
  Modal,
  PageHeader,
  Select,
  Table,
  Tabs,
  Td,
  Th,
  Tr,
} from '@/components/common';
import { api } from '@/lib/api';
import { useApi, useMutation } from '@/hooks/useApi';
import { useAuthStore } from '@/store/authStore';
import { toast } from '@/store/notificationStore';
import { confidencePct, fmtDateTime, titleCase } from '@/lib/utils';
import type { Bed, Role, User } from '@/types';

const ROLES: Role[] = [
  'physician',
  'pharmacist',
  'nurse',
  'care_coordinator',
  'admin',
  'patient',
];

export function SettingsPage() {
  const can = useAuthStore((s) => s.can);
  const isAdmin = can('users:manage');
  const [tab, setTab] = useState<'agents' | 'users' | 'wards' | 'system'>(
    isAdmin ? 'users' : 'agents'
  );

  const tabs = isAdmin
    ? ([
        { key: 'users', label: 'Users' },
        { key: 'wards', label: 'Wards and beds' },
        { key: 'agents', label: 'AI agents' },
        { key: 'system', label: 'System' },
      ] as const)
    : ([{ key: 'agents', label: 'AI agents' }] as const);

  return (
    <>
      <PageHeader
        eyebrow="Account"
        title="Settings"
        story={
          isAdmin
            ? 'Users, wards and the agent configuration for this deployment — including which engine and model are actually running.'
            : 'How the agents are configured for this deployment, and which engine is currently answering.'
        }
      />

      <div className="mb-5">
        <Tabs tabs={tabs as any} active={tab} onChange={(k) => setTab(k as typeof tab)} />
      </div>

      {tab === 'users' && isAdmin && <UsersPanel />}
      {tab === 'wards' && isAdmin && <WardsPanel />}
      {tab === 'agents' && <AgentsPanel />}
      {tab === 'system' && isAdmin && <SystemPanel />}
    </>
  );
}

// ─── Users ───────────────────────────────────────────────────────────────────

function UsersPanel() {
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [deactivating, setDeactivating] = useState<User | null>(null);
  const { data, loading, error, refetch } = useApi<{ users: User[] }>('/users');

  const deactivate = useMutation(async (id: string) => {
    await api.delete(`/users/${id}`);
    toast.success('User deactivated');
    setDeactivating(null);
    await refetch();
  });

  const users = data?.users ?? [];

  return (
    <>
      <Card padded={false}>
        <div className="p-5 pb-0">
          <CardHeader
            title="Users"
            subtitle={`${users.filter((u) => u.isActive).length} active of ${users.length}`}
            action={
              <Button
                size="sm"
                icon={<PlusIcon className="h-4 w-4" />}
                onClick={() => setCreating(true)}
              >
                Create user
              </Button>
            }
          />
        </div>

        {error && (
          <div className="px-5 pb-4">
            <ErrorState message={error} onRetry={refetch} />
          </div>
        )}

        {loading && !data ? (
          <LoadingPane label="Loading users" />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Name</Th>
                <Th>Email</Th>
                <Th>Role</Th>
                <Th>Department</Th>
                <Th>Licence</Th>
                <Th>Last sign-in</Th>
                <Th>Status</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <Tr key={user.id}>
                  <Td className="font-medium">{user.fullName}</Td>
                  <Td className="text-muted">{user.email}</Td>
                  <Td>
                    <Badge tone={user.role === 'admin' ? 'purple' : 'primary'}>
                      {titleCase(user.role)}
                    </Badge>
                  </Td>
                  <Td className="text-muted">{user.department || '—'}</Td>
                  <Td className="font-mono text-xs text-muted">{user.licenseNumber || '—'}</Td>
                  <Td className="whitespace-nowrap text-xs text-muted">
                    {user.lastLogin ? fmtDateTime(user.lastLogin) : 'Never'}
                  </Td>
                  <Td>
                    <Badge tone={user.isActive ? 'success' : 'neutral'}>
                      {user.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </Td>
                  <Td>
                    <div className="flex gap-1.5">
                      <Button size="sm" variant="ghost" onClick={() => setEditing(user)}>
                        Edit
                      </Button>
                      {user.isActive && (
                        <Button size="sm" variant="ghost" onClick={() => setDeactivating(user)}>
                          Deactivate
                        </Button>
                      )}
                    </div>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <CreateUserModal
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={() => {
          setCreating(false);
          void refetch();
        }}
      />

      <EditUserModal
        user={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          void refetch();
        }}
      />

      <ConfirmDialog
        open={Boolean(deactivating)}
        onClose={() => setDeactivating(null)}
        onConfirm={() => deactivating && void deactivate.mutate(deactivating.id)}
        pending={deactivate.pending}
        tone="danger"
        confirmLabel="Deactivate"
        title="Deactivate this user?"
        message={`${deactivating?.fullName} will no longer be able to sign in. Their audit history is kept.`}
      />
    </>
  );
}

function CreateUserModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    role: 'nurse' as Role,
    department: '',
    specialization: '',
    licenseNumber: '',
    phone: '',
  });

  const submit = useMutation(async () => {
    await api.post('/auth/register', {
      ...form,
      specialization: form.specialization || null,
      licenseNumber: form.licenseNumber || null,
    });
    toast.success('User created', form.email);
    onCreated();
  });

  const valid =
    form.firstName && form.lastName && form.email.includes('@') && form.password.length >= 8;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create a user"
      subtitle="The account is active immediately"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={submit.pending}>
            Cancel
          </Button>
          <Button loading={submit.pending} disabled={!valid} onClick={() => void submit.mutate()}>
            Create user
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="First name" required>
          <Input
            value={form.firstName}
            onChange={(e) => setForm({ ...form, firstName: e.target.value })}
          />
        </Field>
        <Field label="Last name" required>
          <Input
            value={form.lastName}
            onChange={(e) => setForm({ ...form, lastName: e.target.value })}
          />
        </Field>
        <Field label="Email" required className="sm:col-span-2">
          <Input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </Field>
        <Field label="Password" required hint="Minimum 8 characters">
          <Input
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
        </Field>
        <Field label="Role" required>
          <Select
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value as Role })}
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {titleCase(r)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Department">
          <Input
            value={form.department}
            onChange={(e) => setForm({ ...form, department: e.target.value })}
          />
        </Field>
        <Field label="Specialisation">
          <Input
            value={form.specialization}
            onChange={(e) => setForm({ ...form, specialization: e.target.value })}
          />
        </Field>
        <Field label="Licence number">
          <Input
            value={form.licenseNumber}
            onChange={(e) => setForm({ ...form, licenseNumber: e.target.value })}
          />
        </Field>
        <Field label="Phone">
          <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </Field>

        {submit.error && (
          <div className="sm:col-span-2">
            <ErrorState message={submit.error} />
          </div>
        )}
      </div>
    </Modal>
  );
}

function EditUserModal({
  user,
  onClose,
  onSaved,
}: {
  user: User | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState(() => ({
    firstName: user?.firstName ?? '',
    lastName: user?.lastName ?? '',
    role: (user?.role ?? 'nurse') as Role,
    department: user?.department ?? '',
    specialization: user?.specialization ?? '',
    phone: user?.phone ?? '',
    isActive: user?.isActive ?? true,
  }));

  // Reset the form whenever a different user is opened.
  const [loadedFor, setLoadedFor] = useState(user?.id);
  if (user && user.id !== loadedFor) {
    setLoadedFor(user.id);
    setForm({
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      department: user.department,
      specialization: user.specialization ?? '',
      phone: user.phone,
      isActive: user.isActive,
    });
  }

  const submit = useMutation(async () => {
    await api.put(`/users/${user!.id}`, {
      ...form,
      specialization: form.specialization || null,
    });
    toast.success('User updated');
    onSaved();
  });

  if (!user) return null;

  return (
    <Modal
      open
      onClose={onClose}
      title={`Edit ${user.fullName}`}
      subtitle={user.email}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={submit.pending}>
            Cancel
          </Button>
          <Button loading={submit.pending} onClick={() => void submit.mutate()}>
            Save changes
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="First name">
          <Input
            value={form.firstName}
            onChange={(e) => setForm({ ...form, firstName: e.target.value })}
          />
        </Field>
        <Field label="Last name">
          <Input
            value={form.lastName}
            onChange={(e) => setForm({ ...form, lastName: e.target.value })}
          />
        </Field>
        <Field label="Role" hint="Changes what this person can see and do">
          <Select
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value as Role })}
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {titleCase(r)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Department">
          <Input
            value={form.department}
            onChange={(e) => setForm({ ...form, department: e.target.value })}
          />
        </Field>
        <Field label="Specialisation">
          <Input
            value={form.specialization}
            onChange={(e) => setForm({ ...form, specialization: e.target.value })}
          />
        </Field>
        <Field label="Phone">
          <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </Field>
        <div className="sm:col-span-2">
          <Checkbox
            label="Account is active"
            checked={form.isActive}
            onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
          />
        </div>
        {submit.error && (
          <div className="sm:col-span-2">
            <ErrorState message={submit.error} />
          </div>
        )}
      </div>
    </Modal>
  );
}

// ─── Wards and beds ──────────────────────────────────────────────────────────

function WardsPanel() {
  const [creating, setCreating] = useState(false);
  const { data, loading, refetch } = useApi<{
    beds: Bed[];
    wards: string[];
    summary: Record<string, number>;
  }>('/beds');

  const beds = data?.beds ?? [];

  return (
    <>
      <Card padded={false}>
        <div className="p-5 pb-0">
          <CardHeader
            title="Wards and beds"
            subtitle={`${data?.wards?.length ?? 0} wards · ${beds.length} beds`}
            action={
              <Button
                size="sm"
                icon={<PlusIcon className="h-4 w-4" />}
                onClick={() => setCreating(true)}
              >
                Add bed
              </Button>
            }
          />
        </div>

        {loading && !data ? (
          <LoadingPane label="Loading beds" />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Ward</Th>
                <Th>Beds</Th>
                <Th>Available</Th>
                <Th>Occupied</Th>
                <Th>Maintenance</Th>
                <Th>Types</Th>
              </tr>
            </thead>
            <tbody>
              {(data?.wards ?? []).map((ward) => {
                const wardBeds = beds.filter((b) => b.ward === ward);
                return (
                  <Tr key={ward}>
                    <Td className="font-medium">{ward}</Td>
                    <Td className="tabular-nums">{wardBeds.length}</Td>
                    <Td className="tabular-nums">
                      {wardBeds.filter((b) => b.status === 'available').length}
                    </Td>
                    <Td className="tabular-nums">
                      {wardBeds.filter((b) => b.status === 'occupied').length}
                    </Td>
                    <Td className="tabular-nums">
                      {wardBeds.filter((b) => b.status === 'maintenance').length}
                    </Td>
                    <Td>
                      <div className="flex flex-wrap gap-1">
                        {[...new Set(wardBeds.map((b) => b.type))].map((t) => (
                          <Badge key={t} tone="neutral">
                            {t.replace('_', ' ')}
                          </Badge>
                        ))}
                      </div>
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>

      <AddBedModal
        open={creating}
        wards={data?.wards ?? []}
        onClose={() => setCreating(false)}
        onCreated={() => {
          setCreating(false);
          void refetch();
        }}
      />
    </>
  );
}

function AddBedModal({
  open,
  wards,
  onClose,
  onCreated,
}: {
  open: boolean;
  wards: string[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState({
    ward: wards[0] ?? '',
    roomNumber: '',
    bedNumber: 'A',
    type: 'general',
    features: [] as string[],
  });

  const submit = useMutation(async () => {
    await api.post('/beds', form);
    toast.success('Bed added', `${form.ward} ${form.roomNumber}-${form.bedNumber}`);
    onCreated();
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add a bed"
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={submit.pending}>
            Cancel
          </Button>
          <Button
            loading={submit.pending}
            disabled={!form.ward || !form.roomNumber || !form.bedNumber}
            onClick={() => void submit.mutate()}
          >
            Add bed
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Ward" required>
          <Input
            value={form.ward}
            list="wards"
            onChange={(e) => setForm({ ...form, ward: e.target.value })}
          />
          <datalist id="wards">
            {wards.map((w) => (
              <option key={w} value={w} />
            ))}
          </datalist>
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Room number" required>
            <Input
              value={form.roomNumber}
              onChange={(e) => setForm({ ...form, roomNumber: e.target.value })}
            />
          </Field>
          <Field label="Bed number" required>
            <Input
              value={form.bedNumber}
              onChange={(e) => setForm({ ...form, bedNumber: e.target.value })}
            />
          </Field>
        </div>
        <Field label="Bed type">
          <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
            {['general', 'icu', 'semi_private', 'private', 'pediatric'].map((t) => (
              <option key={t} value={t}>
                {titleCase(t)}
              </option>
            ))}
          </Select>
        </Field>
        <div>
          <p className="mb-2 text-xs font-medium text-[var(--color-text-secondary)]">Equipment</p>
          <div className="grid grid-cols-2 gap-2">
            {['cardiac_monitor', 'oxygen', 'suction', 'ventilator', 'telemetry', 'dialysis_ready'].map(
              (f) => (
                <Checkbox
                  key={f}
                  label={f.replace(/_/g, ' ')}
                  checked={form.features.includes(f)}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      features: e.target.checked
                        ? [...form.features, f]
                        : form.features.filter((x) => x !== f),
                    })
                  }
                />
              )
            )}
          </div>
        </div>
        {submit.error && <ErrorState message={submit.error} />}
      </div>
    </Modal>
  );
}

// ─── AI agents ───────────────────────────────────────────────────────────────

function AgentsPanel() {
  const { data, loading } = useApi<{
    engine: string;
    pythonService: { url: string; online: boolean };
    llm: { configured: boolean; model: string | null; note: string };
    agents: { name: string; key: string; type: string; color: string }[];
  }>('/agents/health');

  if (loading && !data) return <LoadingPane label="Checking the agent service" />;

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader
          title="Orchestration engine"
          subtitle="Which service is actually running the discharge DAG"
          accent="var(--agent-orchestrator)"
        />
        <dl className="grid gap-4 sm:grid-cols-3">
          <div>
            <dt className="text-xs uppercase tracking-wide text-faint">Engine</dt>
            <dd className="mt-1">
              <Badge tone={data?.engine === 'python-langgraph' ? 'success' : 'info'}>
                {data?.engine === 'python-langgraph'
                  ? 'Python LangGraph service'
                  : 'Built-in TypeScript orchestrator'}
              </Badge>
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-faint">Python service</dt>
            <dd className="mt-1 flex items-center gap-2">
              <Badge tone={data?.pythonService.online ? 'success' : 'neutral'} dot>
                {data?.pythonService.online ? 'Online' : 'Not running'}
              </Badge>
              <span className="font-mono text-[11px] text-faint">{data?.pythonService.url}</span>
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-faint">Language model</dt>
            <dd className="mt-1">
              <Badge tone={data?.llm.configured ? 'success' : 'warning'}>
                {data?.llm.configured ? data.llm.model : 'Not configured'}
              </Badge>
            </dd>
          </div>
        </dl>
        <p className="mt-4 text-xs text-muted">{data?.llm.note}</p>
      </Card>

      <Card>
        <CardHeader
          title="Agents"
          subtitle="Which agents run, and whether each one uses a model or deterministic rules"
        />
        <ul className="space-y-2.5">
          {(data?.agents ?? []).map((agent) => (
            <li
              key={agent.key}
              className="flex flex-wrap items-center gap-3 rounded-lg border p-3"
              style={{ borderColor: 'var(--color-border)' }}
            >
              <span
                className="h-3 w-3 shrink-0 rounded-full"
                style={{ background: agent.color }}
              />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{agent.name}</span>
                <span className="block font-mono text-[11px] text-faint">{agent.key}</span>
              </span>
              <Badge tone={agent.type === 'rules' ? 'success' : agent.type === 'llm' ? 'purple' : 'warning'}>
                {agent.type === 'rules'
                  ? 'Deterministic rules'
                  : agent.type === 'llm'
                    ? 'Claude'
                    : 'Template fallback'}
              </Badge>
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <CardHeader
          title="Safety configuration"
          subtitle="Fixed guardrails, enforced by the governance layer on every run"
        />
        <dl className="space-y-3 text-sm">
          <ConfigRow
            label="Confidence threshold"
            value={confidencePct(0.6)}
            detail="A package is held if any agent reports confidence below this."
          />
          <ConfigRow
            label="Autonomous approval"
            value="Disabled"
            detail="No agent may approve its own output or finalise a discharge."
          />
          <ConfigRow
            label="Autonomous dosing"
            value="Blocked"
            detail="Agents flag and recommend. They never prescribe or change a dose."
          />
          <ConfigRow
            label="Medication decisions"
            value="Rules only"
            detail="The reconciliation decision path contains no language model. Claude only rewrites explanations."
          />
          <ConfigRow
            label="Hallucination check"
            value="Enforced"
            detail="Patient instructions may only name medicines from the approved discharge or home list."
          />
          <ConfigRow
            label="Audit"
            value="Every action"
            detail="AI recommendations, human edits, approvals and rejections are all written to the audit log."
          />
        </dl>
      </Card>
    </div>
  );
}

function ConfigRow({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div
      className="flex flex-wrap items-baseline justify-between gap-2 border-b pb-3 last:border-0 last:pb-0"
      style={{ borderColor: 'var(--color-border)' }}
    >
      <div className="min-w-0">
        <dt className="font-medium">{label}</dt>
        <dd className="text-xs text-muted">{detail}</dd>
      </div>
      <Badge tone="primary">{value}</Badge>
    </div>
  );
}

// ─── System ──────────────────────────────────────────────────────────────────

function SystemPanel() {
  const [prefs, setPrefs] = useState(() => {
    try {
      return JSON.parse(
        localStorage.getItem('safedischarge.prefs') ??
          '{"appointmentDuration":30,"requirePharmacistSignature":true,"blockOnCriticalFlags":true,"autoScheduleFollowUps":false}'
      );
    } catch {
      return {
        appointmentDuration: 30,
        requirePharmacistSignature: true,
        blockOnCriticalFlags: true,
        autoScheduleFollowUps: false,
      };
    }
  });

  const save = (next: typeof prefs) => {
    setPrefs(next);
    localStorage.setItem('safedischarge.prefs', JSON.stringify(next));
    toast.success('Preference saved');
  };

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader
          title="Scheduling defaults"
          subtitle="Applied to newly created appointments"
        />
        <Field label="Default appointment duration" className="max-w-xs">
          <Select
            value={prefs.appointmentDuration}
            onChange={(e) => save({ ...prefs, appointmentDuration: Number(e.target.value) })}
          >
            {[15, 20, 30, 45, 60].map((d) => (
              <option key={d} value={d}>
                {d} minutes
              </option>
            ))}
          </Select>
        </Field>
      </Card>

      <Card>
        <CardHeader
          title="Discharge workflow rules"
          subtitle="These mirror the server-side completion rules"
        />
        <div className="space-y-3">
          <Checkbox
            label="Require a pharmacist signature before a discharge can complete"
            checked={prefs.requirePharmacistSignature}
            onChange={(e) => save({ ...prefs, requirePharmacistSignature: e.target.checked })}
            disabled
          />
          <Checkbox
            label="Block completion while a critical medication flag is unresolved"
            checked={prefs.blockOnCriticalFlags}
            onChange={(e) => save({ ...prefs, blockOnCriticalFlags: e.target.checked })}
            disabled
          />
          <Checkbox
            label="Book recommended follow-ups automatically when a package is approved"
            checked={prefs.autoScheduleFollowUps}
            onChange={(e) => save({ ...prefs, autoScheduleFollowUps: e.target.checked })}
          />
        </div>
        <p className="mt-3 text-xs text-muted">
          The first two are enforced by the server and cannot be turned off from the interface —
          they are patient-safety rules, not preferences.
        </p>
      </Card>

      <Card>
        <CardHeader title="About" />
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted">Version</dt>
            <dd className="font-medium">SafeDischarge 1.0.0</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">Data</dt>
            <dd className="font-medium">Synthetic only — no real patient information</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">Built by</dt>
            <dd className="font-medium">GWC Data AI</dd>
          </div>
        </dl>
      </Card>
    </div>
  );
}

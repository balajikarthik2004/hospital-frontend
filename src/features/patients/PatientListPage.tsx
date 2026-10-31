import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PlusIcon, UserGroupIcon } from '@heroicons/react/24/outline';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Field,
  Input,
  LoadingPane,
  PageHeader,
  Select,
  Table,
  Td,
  Th,
  Tr,
} from '@/components/common';
import { useApi } from '@/hooks/useApi';
import { useDebounce } from '@/hooks/useDebounce';
import { useAuthStore } from '@/store/authStore';
import { fmtDate, initials, patientAge, patientName, titleCase } from '@/lib/utils';
import type { Pagination, Patient, PatientStatus } from '@/types';

const STATUS_TONE: Record<PatientStatus, 'neutral' | 'primary' | 'info' | 'warning' | 'success'> = {
  registered: 'neutral',
  admitted: 'primary',
  in_treatment: 'info',
  discharge_pending: 'warning',
  discharged: 'success',
};

type SortKey = 'name' | 'age' | 'status' | 'admitted';

export function PatientListPage() {
  const navigate = useNavigate();
  const can = useAuthStore((s) => s.can);

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [ward, setWard] = useState('');
  const [sort, setSort] = useState<SortKey>('name');
  const [asc, setAsc] = useState(true);

  const q = useDebounce(search, 300);

  const params = new URLSearchParams({ limit: '200' });
  if (q) params.set('q', q);
  if (status) params.set('status', status);
  if (ward) params.set('ward', ward);

  const { data, loading, error, refetch } = useApi<{
    patients: Patient[];
    pagination: Pagination;
  }>(`/patients?${params.toString()}`, [q, status, ward]);

  const patients = data?.patients ?? [];

  const wards = useMemo(
    () =>
      [...new Set(patients.map((p) => p.activeAdmission?.ward).filter(Boolean))].sort() as string[],
    [patients]
  );

  const sorted = useMemo(() => {
    const dir = asc ? 1 : -1;
    return [...patients].sort((a, b) => {
      switch (sort) {
        case 'age':
          return (patientAge(a) - patientAge(b)) * dir;
        case 'status':
          return a.status.localeCompare(b.status) * dir;
        case 'admitted':
          return (
            ((a.activeAdmission ? new Date(a.activeAdmission.admissionDate).getTime() : 0) -
              (b.activeAdmission ? new Date(b.activeAdmission.admissionDate).getTime() : 0)) * dir
          );
        default:
          return patientName(a).localeCompare(patientName(b)) * dir;
      }
    });
  }, [patients, sort, asc]);

  const toggleSort = (key: SortKey) => {
    if (sort === key) setAsc((v) => !v);
    else {
      setSort(key);
      setAsc(true);
    }
  };

  const arrow = (key: SortKey) => (sort === key ? (asc ? ' ↑' : ' ↓') : '');

  return (
    <>
      <PageHeader
        eyebrow="Care"
        title="Patients"
        subtitle={`${patients.length} record${patients.length === 1 ? '' : 's'}`}
        story="Everyone known to the service, admitted or not. Open a record for the full chart: admissions, medications, vitals, appointments and discharge history."
        actions={
          can('patient:register') && (
            <Link to="/app/patients/new">
              <Button icon={<PlusIcon className="h-4 w-4" />}>Register patient</Button>
            </Link>
          )
        }
      />

      <Card className="mb-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Search" className="lg:col-span-2">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name, patient ID or phone"
            />
          </Field>
          <Field label="Status">
            <Select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All statuses</option>
              {(
                ['registered', 'admitted', 'in_treatment', 'discharge_pending', 'discharged'] as const
              ).map((s) => (
                <option key={s} value={s}>
                  {titleCase(s)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Ward">
            <Select value={ward} onChange={(e) => setWard(e.target.value)}>
              <option value="">All wards</option>
              {wards.map((w) => (
                <option key={w} value={w}>
                  {w}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </Card>

      {error && <ErrorState message={error} onRetry={refetch} />}

      <Card padded={false}>
        {loading && !data ? (
          <LoadingPane label="Loading patients" />
        ) : sorted.length === 0 ? (
          <EmptyState
            title="No patients match"
            detail="Adjust the filters, or register a new patient."
            icon={<UserGroupIcon className="h-8 w-8" />}
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th onClick={() => toggleSort('name')}>Patient{arrow('name')}</Th>
                <Th onClick={() => toggleSort('age')}>Age{arrow('age')}</Th>
                <Th onClick={() => toggleSort('status')}>Status{arrow('status')}</Th>
                <Th>Ward / bed</Th>
                <Th>Attending</Th>
                <Th onClick={() => toggleSort('admitted')}>Admitted{arrow('admitted')}</Th>
                <Th>Allergies</Th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((p) => (
                <Tr key={p._id} onClick={() => navigate(`/app/patients/${p._id}`)}>
                  <Td>
                    <div className="flex items-center gap-3">
                      <span
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold text-white shadow-xs"
                        style={{
                          background: 'linear-gradient(135deg, #2A9280 0%, #11564C 100%)',
                        }}
                      >
                        {initials(patientName(p))}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate font-bold text-[var(--color-text)] tracking-tight">
                          {patientName(p)}
                        </span>
                        <span className="block font-mono text-[11px] text-faint">
                          {p.patientId}
                        </span>
                      </span>
                    </div>
                  </Td>
                  <Td className="tabular-nums font-medium">{patientAge(p)}</Td>
                  <Td>
                    <Badge
                      tone={STATUS_TONE[p.status]}
                      dot={p.status === 'in_treatment' || p.status === 'discharge_pending'}
                    >
                      {titleCase(p.status)}
                    </Badge>
                  </Td>
                  <Td className="text-muted font-medium">
                    {p.activeAdmission ? (
                      <>
                        <span className="text-[var(--color-text)] font-semibold">{p.activeAdmission.ward}</span>
                        <span className="block text-xs text-faint">
                          Room {p.activeAdmission.room} · Bed {p.activeAdmission.bed}
                        </span>
                      </>
                    ) : (
                      '—'
                    )}
                  </Td>
                  <Td className="text-muted font-medium">{p.activeAdmission?.attendingPhysician || '—'}</Td>
                  <Td className="whitespace-nowrap text-muted tabular-nums font-medium">
                    {p.activeAdmission ? fmtDate(p.activeAdmission.admissionDate) : '—'}
                  </Td>
                  <Td>
                    {p.medicalHistory?.allergies?.length ? (
                      <div className="flex flex-wrap gap-1">
                        {p.medicalHistory.allergies.slice(0, 2).map((a) => (
                          <Badge
                            key={a.substance}
                            tone={
                              a.severity === 'life-threatening' || a.severity === 'severe'
                                ? 'danger'
                                : 'warning'
                            }
                          >
                            {a.substance}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs font-medium text-faint">NKDA</span>
                    )}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}

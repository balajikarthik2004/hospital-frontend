import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlusIcon } from '@heroicons/react/24/outline';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Field,
  LoadingPane,
  PageHeader,
  Select,
  Table,
  Tabs,
  Td,
  Th,
  Tr,
} from '@/components/common';
import { useApi } from '@/hooks/useApi';
import { useAuthStore } from '@/store/authStore';
import { fmtDate, patientAge, patientName, titleCase } from '@/lib/utils';
import type { Admission, Patient } from '@/types';
import { NewAdmissionModal } from './NewAdmissionModal';

export function AdmissionsPage() {
  const navigate = useNavigate();
  const can = useAuthStore((s) => s.can);
  const [tab, setTab] = useState<'active' | 'today' | 'all'>('active');
  const [ward, setWard] = useState('');
  const [creating, setCreating] = useState(false);

  const { data, loading, error, refetch } = useApi<{ admissions: Admission[] }>(
    '/admissions?limit=200'
  );

  const all = data?.admissions ?? [];
  const wards = [...new Set(all.map((a) => a.bed?.ward).filter(Boolean))].sort();

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  let rows = all;
  if (tab === 'active') rows = all.filter((a) => a.status === 'active');
  if (tab === 'today')
    rows = all.filter((a) => new Date(a.admissionDate) >= startOfToday);
  if (ward) rows = rows.filter((a) => a.bed?.ward === ward);

  return (
    <>
      <PageHeader
        eyebrow="Care"
        title="Admissions"
        story="Everyone currently in a bed. Open an admission to see the full chart, or start a discharge once the patient is ready to go home."
        actions={
          can('patient:admit') && (
            <Button icon={<PlusIcon className="h-4 w-4" />} onClick={() => setCreating(true)}>
              New admission
            </Button>
          )
        }
      />

      <div className="mb-4">
        <Tabs
          tabs={[
            { key: 'active', label: 'Active' },
            { key: 'today', label: 'Admitted today' },
            { key: 'all', label: 'All' },
          ]}
          active={tab}
          onChange={setTab}
          counts={{
            active: all.filter((a) => a.status === 'active').length,
            today: all.filter((a) => new Date(a.admissionDate) >= startOfToday).length,
            all: all.length,
          }}
        />
      </div>

      <Card className="mb-4">
        <Field label="Ward" className="max-w-xs">
          <Select value={ward} onChange={(e) => setWard(e.target.value)}>
            <option value="">All wards</option>
            {wards.map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
          </Select>
        </Field>
      </Card>

      {error && <ErrorState message={error} onRetry={refetch} />}

      <Card padded={false}>
        {loading && !data ? (
          <LoadingPane label="Loading admissions" />
        ) : rows.length === 0 ? (
          <EmptyState title="No admissions match" />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Admission</Th>
                <Th>Patient</Th>
                <Th>Diagnosis</Th>
                <Th>Bed</Th>
                <Th>Attending</Th>
                <Th>Admitted</Th>
                <Th>Day</Th>
                <Th>Risk</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => {
                const patient = a.patientId as Patient;
                const doctor = a.careTeam?.attendingPhysician as any;
                const days = Math.max(
                  1,
                  Math.round(
                    ((a.actualDischargeDate
                      ? new Date(a.actualDischargeDate).getTime()
                      : Date.now()) -
                      new Date(a.admissionDate).getTime()) /
                      86_400_000
                  )
                );
                return (
                  <Tr key={a._id} onClick={() => navigate(`/app/patients/${patient?._id}`)}>
                    <Td className="font-mono text-xs">{a.admissionId}</Td>
                    <Td>
                      <span className="font-medium">{patientName(patient)}</span>
                      <span className="block text-xs text-faint">
                        {patient?.patientId} · {patient ? patientAge(patient) : '?'}y
                      </span>
                    </Td>
                    <Td className="max-w-[240px]">
                      <span className="block truncate text-muted">{a.admittingDiagnosis}</span>
                      <span className="block truncate font-mono text-[10px] text-faint">
                        {a.diagnosisCodes?.join(', ')}
                      </span>
                    </Td>
                    <Td className="text-muted">
                      {a.bed?.ward}
                      <span className="block text-xs text-faint">
                        {a.bed?.roomNumber}-{a.bed?.bedNumber}
                      </span>
                    </Td>
                    <Td className="text-muted">
                      {doctor ? `Dr. ${doctor.firstName} ${doctor.lastName}` : '—'}
                    </Td>
                    <Td className="whitespace-nowrap text-muted">{fmtDate(a.admissionDate)}</Td>
                    <Td className="tabular-nums">{days}</Td>
                    <Td>
                      {a.riskAssessment?.fallRisk !== 'low' && (
                        <Badge
                          tone={a.riskAssessment.fallRisk === 'high' ? 'danger' : 'warning'}
                        >
                          Fall: {a.riskAssessment.fallRisk}
                        </Badge>
                      )}
                    </Td>
                    <Td>
                      <Badge
                        tone={
                          a.status === 'active'
                            ? 'primary'
                            : a.status === 'discharged'
                              ? 'success'
                              : 'neutral'
                        }
                      >
                        {titleCase(a.status)}
                      </Badge>
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>

      <NewAdmissionModal
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={() => {
          setCreating(false);
          void refetch();
        }}
      />
    </>
  );
}

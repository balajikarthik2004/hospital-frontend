import { useMemo, useState } from 'react';
import { PlusIcon } from '@heroicons/react/24/outline';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  Field,
  Input,
  Modal,
  Table,
  Td,
  Textarea,
  Th,
  Tr,
} from '@/components/common';
import { TrendChart } from '@/components/charts';
import { api } from '@/lib/api';
import { useMutation } from '@/hooks/useApi';
import { useAuthStore } from '@/store/authStore';
import { toast } from '@/store/notificationStore';
import { VITAL_RANGES, fmtDateTime, fmtTime, isVitalAbnormal } from '@/lib/utils';
import type { Vital } from '@/types';

export function VitalsTab({
  patientId,
  admissionId,
  vitals,
  onRecorded,
}: {
  patientId: string;
  admissionId: string | null;
  vitals: Vital[];
  onRecorded: () => void;
}) {
  const [recording, setRecording] = useState(false);
  const can = useAuthStore((s) => s.can);

  const series = useMemo(
    () =>
      [...vitals]
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
        .slice(-48)
        .map((v) => ({
          t: fmtTime(v.timestamp),
          systolic: v.bloodPressureSystolic,
          diastolic: v.bloodPressureDiastolic,
          heartRate: v.heartRate,
          temperature: v.temperature,
          oxygenSaturation: v.oxygenSaturation,
          respiratoryRate: v.respiratoryRate,
        })),
    [vitals]
  );

  const sorted = useMemo(
    () =>
      [...vitals].sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      ),
    [vitals]
  );

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        {can('vitals:record') && admissionId && (
          <Button icon={<PlusIcon className="h-4 w-4" />} onClick={() => setRecording(true)}>
            Record vitals
          </Button>
        )}
      </div>

      {series.length === 0 ? (
        <Card>
          <EmptyState
            title="No vitals recorded"
            detail="Record a set of observations to start the chart."
          />
        </Card>
      ) : (
        <div className="grid gap-5 xl:grid-cols-2">
          <TrendChart
            title="Blood pressure"
            subtitle="Systolic and diastolic, mmHg"
            data={series}
            xKey="t"
            suffix=" mmHg"
            series={[
              { key: 'systolic', label: 'Systolic', color: '#0891B2' },
              { key: 'diastolic', label: 'Diastolic', color: '#A5B4FC' },
            ]}
          />
          <TrendChart
            title="Heart and respiratory rate"
            subtitle="Beats and breaths per minute"
            data={series}
            xKey="t"
            series={[
              { key: 'heartRate', label: 'Heart rate', color: '#DC2626' },
              { key: 'respiratoryRate', label: 'Respiratory rate', color: '#6366F1' },
            ]}
          />
          <TrendChart
            title="Temperature"
            subtitle="Degrees Fahrenheit"
            data={series}
            xKey="t"
            area
            suffix=" °F"
            series={[{ key: 'temperature', label: 'Temperature', color: '#D97706' }]}
          />
          <TrendChart
            title="Oxygen saturation"
            subtitle="Percent on room air"
            data={series}
            xKey="t"
            area
            suffix="%"
            series={[{ key: 'oxygenSaturation', label: 'SpO₂', color: '#059669' }]}
          />
        </div>
      )}

      <Card padded={false}>
        <div className="p-5 pb-0">
          <CardHeader
            title="All recordings"
            subtitle={`${vitals.length} set${vitals.length === 1 ? '' : 's'} · values outside the normal range are shown in red`}
          />
        </div>
        {sorted.length === 0 ? (
          <EmptyState title="Nothing recorded" />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Recorded</Th>
                <Th>BP</Th>
                <Th>HR</Th>
                <Th>Temp</Th>
                <Th>RR</Th>
                <Th>SpO₂</Th>
                <Th>Pain</Th>
                <Th>By</Th>
                <Th>Alerts</Th>
              </tr>
            </thead>
            <tbody>
              {sorted.slice(0, 60).map((v) => (
                <Tr key={v._id}>
                  <Td className="whitespace-nowrap text-xs text-muted">
                    {fmtDateTime(v.timestamp)}
                  </Td>
                  <Td>
                    <Val
                      value={`${v.bloodPressureSystolic}/${v.bloodPressureDiastolic}`}
                      abnormal={
                        isVitalAbnormal('bloodPressureSystolic', v.bloodPressureSystolic) ||
                        isVitalAbnormal('bloodPressureDiastolic', v.bloodPressureDiastolic)
                      }
                    />
                  </Td>
                  <Td>
                    <Val value={v.heartRate} abnormal={isVitalAbnormal('heartRate', v.heartRate)} />
                  </Td>
                  <Td>
                    <Val
                      value={v.temperature}
                      abnormal={isVitalAbnormal('temperature', v.temperature)}
                    />
                  </Td>
                  <Td>
                    <Val
                      value={v.respiratoryRate}
                      abnormal={isVitalAbnormal('respiratoryRate', v.respiratoryRate)}
                    />
                  </Td>
                  <Td>
                    <Val
                      value={`${v.oxygenSaturation}%`}
                      abnormal={isVitalAbnormal('oxygenSaturation', v.oxygenSaturation)}
                    />
                  </Td>
                  <Td>
                    <Val value={`${v.painScore}/10`} abnormal={v.painScore >= 7} />
                  </Td>
                  <Td className="text-xs text-muted">
                    {typeof v.recordedBy === 'object' && v.recordedBy
                      ? `${(v.recordedBy as any).firstName} ${(v.recordedBy as any).lastName}`
                      : '—'}
                  </Td>
                  <Td>
                    {v.alerts?.length ? (
                      <Badge tone="danger">{v.alerts.length}</Badge>
                    ) : (
                      <span className="text-xs text-faint">—</span>
                    )}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      {admissionId && (
        <RecordVitalsModal
          open={recording}
          onClose={() => setRecording(false)}
          patientId={patientId}
          admissionId={admissionId}
          onSaved={onRecorded}
        />
      )}
    </div>
  );
}

function Val({ value, abnormal }: { value: string | number; abnormal?: boolean }) {
  return (
    <span
      className="font-mono text-sm"
      style={{ color: abnormal ? 'var(--color-danger)' : undefined, fontWeight: abnormal ? 600 : 400 }}
    >
      {value}
    </span>
  );
}

const FIELDS = [
  { key: 'bloodPressureSystolic', label: 'Systolic BP', unit: 'mmHg', default: 120 },
  { key: 'bloodPressureDiastolic', label: 'Diastolic BP', unit: 'mmHg', default: 78 },
  { key: 'heartRate', label: 'Heart rate', unit: 'bpm', default: 76 },
  { key: 'temperature', label: 'Temperature', unit: '°F', default: 98.4, step: 0.1 },
  { key: 'respiratoryRate', label: 'Respiratory rate', unit: '/min', default: 16 },
  { key: 'oxygenSaturation', label: 'SpO₂', unit: '%', default: 97 },
  { key: 'painScore', label: 'Pain score', unit: '0-10', default: 0 },
  { key: 'weight', label: 'Weight', unit: 'kg', default: '', step: 0.1 },
] as const;

function RecordVitalsModal({
  open,
  onClose,
  patientId,
  admissionId,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  patientId: string;
  admissionId: string;
  onSaved: () => void;
}) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(FIELDS.map((f) => [f.key, String(f.default)]))
  );
  const [notes, setNotes] = useState('');

  const submit = useMutation(async () => {
    const payload: Record<string, unknown> = { patientId, admissionId, notes: notes || null };
    for (const field of FIELDS) {
      const raw = values[field.key];
      if (field.key === 'weight') {
        payload.weight = raw === '' ? null : Number(raw);
      } else {
        payload[field.key] = Number(raw);
      }
    }
    const { data } = await api.post<{ alerts: string[] }>('/vitals', payload);
    if (data.alerts?.length) {
      toast.warning(
        `Recorded with ${data.alerts.length} alert${data.alerts.length === 1 ? '' : 's'}`,
        data.alerts.join('; ')
      );
    } else {
      toast.success('Vitals recorded');
    }
    onClose();
    onSaved();
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Record vitals"
      subtitle="Values outside the normal range raise an alert for the care team"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={submit.pending}>
            Cancel
          </Button>
          <Button loading={submit.pending} onClick={() => void submit.mutate()}>
            Save observations
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          {FIELDS.map((field) => {
            const numeric = Number(values[field.key]);
            const range = VITAL_RANGES[field.key as keyof typeof VITAL_RANGES];
            const abnormal =
              range && values[field.key] !== '' && !Number.isNaN(numeric)
                ? numeric < range.min || numeric > range.max
                : false;

            return (
              <Field
                key={field.key}
                label={`${field.label} (${field.unit})`}
                hint={range ? `Normal ${range.min}–${range.max}` : 'Optional'}
                error={abnormal ? 'Outside the normal range' : undefined}
              >
                <Input
                  type="number"
                  step={'step' in field ? field.step : 1}
                  value={values[field.key]}
                  onChange={(e) => setValues({ ...values, [field.key]: e.target.value })}
                />
              </Field>
            );
          })}
        </div>

        <Field label="Notes">
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>

        {submit.error && <ErrorState message={submit.error} />}
      </div>
    </Modal>
  );
}

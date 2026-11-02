import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowPathIcon,
  BeakerIcon,
  BuildingOffice2Icon,
  CalendarDaysIcon,
  ClipboardDocumentCheckIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import {
  Badge,
  Button,
  Callout,
  Card,
  CardHeader,
  EmptyState,
  Field,
  PageHeader,
  Select,
  Spinner,
  Tabs,
} from '@/components/common';
import { Markdown } from '@/components/common/Markdown';
import { AgentChat, turnId, type ChatTurn } from './AgentChat';
import { useApi } from '@/hooks/useApi';
import { errorMessage } from '@/lib/api';
import {
  assistantApi,
  type AssistantHealth,
  type AssistantPatientContext,
  type DischargeReport,
  type MedicationExplanation,
} from '@/lib/assistantApi';
import type { Pagination, Patient } from '@/types';
import { useDebounce } from '@/hooks/useDebounce';

/**
 * The four independent specialist agents, on one screen.
 *
 * They are deliberately not an orchestrated pipeline: each answers one kind
 * of question against the same database this application writes, so what the
 * agent says and what the chart says cannot drift apart. The discharge DAG
 * on the Discharge screen is a different thing entirely — that one drafts a
 * package for review, these answer questions about records that already exist.
 */

type TabKey = 'hospital' | 'appointment' | 'medication' | 'discharge';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'hospital', label: 'Hospital' },
  { key: 'appointment', label: 'Appointments' },
  { key: 'medication', label: 'Medications' },
  { key: 'discharge', label: 'Discharge summary' },
];

const ACCENT: Record<TabKey, string> = {
  hospital: '#0891B2',
  appointment: '#7C3AED',
  medication: '#D97706',
  discharge: '#059669',
};

export function AssistantPage() {
  const [tab, setTab] = useState<TabKey>('hospital');
  const {
    data: health,
    loading: healthLoading,
    refetch: refetchHealth,
  } = useApi<AssistantHealth>('/assistant/health');

  const offline = Boolean(health && !health.online);

  return (
    <div>
      <PageHeader
        eyebrow="AI assistants"
        title="Specialist agents"
        story="Four independent agents, each with its own narrow set of database queries. They read the same records the rest of this application writes — nothing clinical is invented, and nothing here changes a chart except booking an appointment, which goes through the same guards as the scheduling screen."
        actions={
          <Button variant="outline" onClick={() => void refetchHealth()} disabled={healthLoading}>
            {healthLoading ? <Spinner size={14} /> : <ArrowPathIcon className="h-4 w-4" />}
            Recheck
          </Button>
        }
        meta={<ServiceStatus health={health} loading={healthLoading} />}
      />

      {offline && (
        <Callout tone="warning" title="The agent service is not running" className="mb-5">
          {health?.error ? `${health.error}. ` : ''}
          Start it from the repository root with <code>npm run dev:multiagents</code> — it listens
          on {health?.url}. Everything else in the application works without it.
        </Callout>
      )}

      {health?.online && health.llmConfigured === false && (
        <Callout tone="info" title="No model key configured" className="mb-5">
          The service is up and reading the database, but without a <code>GROQ_API_KEY</code> in{' '}
          <code>MultiAgents/.env</code> the agents answer from verified records alone rather than
          phrasing them.
        </Callout>
      )}

      <Tabs tabs={TABS} active={tab} onChange={setTab} />

      <div className="mt-5">
        {tab === 'hospital' && <HospitalPanel disabled={offline} />}
        {tab === 'appointment' && <AppointmentPanel disabled={offline} />}
        {tab === 'medication' && <MedicationPanel disabled={offline} />}
        {tab === 'discharge' && <DischargePanel disabled={offline} />}
      </div>
    </div>
  );
}

/* ── Status ───────────────────────────────────────────────────────────────── */

function ServiceStatus({
  health,
  loading,
}: {
  health: AssistantHealth | null;
  loading: boolean;
}) {
  if (loading && !health) return <Badge tone="neutral">Checking the agent service…</Badge>;
  if (!health) return null;

  if (!health.online) return <Badge tone="danger">Agent service offline</Badge>;

  return (
    <>
      <Badge tone={health.databaseConnected ? 'success' : 'warning'}>
        {health.databaseConnected ? 'Reading the live database' : 'Database unreachable'}
      </Badge>
      <Badge tone="neutral">{health.engine ?? 'adk'}</Badge>
      {health.llmConfigured ? (
        <Badge tone="info">{health.model}</Badge>
      ) : (
        <Badge tone="warning">No model key</Badge>
      )}
    </>
  );
}

/* ── 1. General hospital assistant ────────────────────────────────────────── */

function HospitalPanel({ disabled }: { disabled: boolean }) {
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [session, setSession] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const send = useCallback(
    async (message: string) => {
      setTurns((prev) => [...prev, { id: turnId(), from: 'user', text: message }]);
      setBusy(true);
      try {
        const res = await assistantApi.ask(message, session);
        setSession(res.session_id ?? session);
        setTurns((prev) => [
          ...prev,
          {
            id: turnId(),
            from: 'agent',
            text: res.answer,
            sources: res.sources,
            // The agent screens for acute symptoms before the model is even
            // called; that answer is a redirection, not an answer, and should
            // not look like ordinary prose.
            failed: res.status === 'emergency_alert',
          },
        ]);
      } catch (err) {
        setTurns((prev) => [
          ...prev,
          { id: turnId(), from: 'agent', text: errorMessage(err), failed: true },
        ]);
      } finally {
        setBusy(false);
      }
    },
    [session]
  );

  return (
    <Card>
      <CardHeader
        accent={ACCENT.hospital}
        icon={<BuildingOffice2Icon className="h-5 w-5" />}
        title="General Hospital Assistant"
        subtitle="Departments, services, visiting hours and policies — answered from the specialties and users collections, with every answer naming what it read."
      />
      <AgentChat
        turns={turns}
        busy={busy}
        onSend={(m) => void send(m)}
        disabled={disabled}
        accent={ACCENT.hospital}
        placeholder="Ask about departments, services, visiting hours…"
        emptyTitle="Ask the hospital anything non-clinical"
        emptyDetail="This agent holds no patient data at all. Acute symptoms are caught before the model runs and redirected to emergency care."
        suggestions={[
          'What departments are available?',
          'What are the visiting hours?',
          'What documents does a new patient need to bring?',
        ]}
      />
    </Card>
  );
}

/* ── 2. Appointment agent ─────────────────────────────────────────────────── */

function AppointmentPanel({ disabled }: { disabled: boolean }) {
  const [patientId, setPatientId] = useState('');
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [session, setSession] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Switching patient mid-conversation would carry the previous chart's
  // context into the new one, so the thread starts again.
  useEffect(() => {
    setTurns([]);
    setSession(null);
  }, [patientId]);

  const send = useCallback(
    async (message: string) => {
      setTurns((prev) => [...prev, { id: turnId(), from: 'user', text: message }]);
      setBusy(true);
      try {
        const res = await assistantApi.appointmentTurn(message, session, patientId || null);
        setSession(res.session_id);
        setTurns((prev) => [
          ...prev,
          {
            id: turnId(),
            from: 'agent',
            text: res.response,
            failed: res.status === 'error',
          },
        ]);
      } catch (err) {
        setTurns((prev) => [
          ...prev,
          { id: turnId(), from: 'agent', text: errorMessage(err), failed: true },
        ]);
      } finally {
        setBusy(false);
      }
    },
    [session, patientId]
  );

  return (
    <Card>
      <CardHeader
        accent={ACCENT.appointment}
        icon={<CalendarDaysIcon className="h-5 w-5" />}
        title="Appointment Agent"
        subtitle="Finds specialties, doctors and live slots, and books them. Slots are computed from each doctor's clinic hours exactly as the public website computes them, so the two can never offer different times."
        action={<PatientPicker value={patientId} onChange={setPatientId} />}
      />

      {!patientId && (
        <Callout tone="neutral" className="mb-4">
          With no patient selected the agent can look up doctors and availability but has no chart
          in scope, so it cannot book or list anyone's appointments. Choose a patient to act for
          them.
        </Callout>
      )}

      <AgentChat
        turns={turns}
        busy={busy}
        onSend={(m) => void send(m)}
        disabled={disabled}
        accent={ACCENT.appointment}
        placeholder={
          patientId ? 'Ask about slots, or book one…' : 'Ask about doctors and availability…'
        }
        emptyTitle={patientId ? 'Acting for the selected patient' : 'No patient in scope'}
        emptyDetail={
          patientId
            ? 'Every tool call is pinned to this patient, so the agent cannot read or book for anyone else even if asked to.'
            : 'Availability and doctor questions work as they are. Select a patient above to book.'
        }
        suggestions={
          patientId
            ? [
                'What appointments do I have coming up?',
                'Any cardiology slots this week?',
                'Book the earliest orthopaedics slot',
              ]
            : ['Which doctors work in cardiology?', 'What specialties does the hospital have?']
        }
      />
    </Card>
  );
}

/** Loads a short patient list once and lets the clinician pick one. */
function PatientPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (id: string) => void;
}) {
  const [search, setSearch] = useState('');
  const q = useDebounce(search, 300);
  const params = new URLSearchParams({ limit: '100' });
  if (q) params.set('q', q);

  const { data, loading } = useApi<{ patients: Patient[]; pagination: Pagination }>(
    `/patients?${params.toString()}`,
    [q]
  );

  const patients = data?.patients ?? [];

  return (
    <div className="flex items-end gap-2">
      <Field label="Find a patient">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Name or patient ID"
          className="h-9 w-44 rounded-lg border px-3 text-[0.8125rem] outline-none focus:ring-4"
          style={{
            borderColor: 'var(--color-border-dark)',
            background: 'var(--color-surface)',
          }}
        />
      </Field>
      <Field label="Acting for">
        <Select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-56"
          disabled={loading}
        >
          <option value="">No patient (general questions)</option>
          {patients.map((p) => (
            <option key={p._id} value={p._id}>
              {p.demographics.firstName} {p.demographics.lastName} · {p.patientId}
            </option>
          ))}
        </Select>
      </Field>
    </div>
  );
}

/* ── 3. Medication agent ──────────────────────────────────────────────────── */

function MedicationPanel({ disabled }: { disabled: boolean }) {
  const [patientId, setPatientId] = useState('');
  const [recordId, setRecordId] = useState('');
  const [result, setResult] = useState<MedicationExplanation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const { data: context, loading } = useApi<AssistantPatientContext>(
    patientId ? `/assistant/patients/${patientId}/context` : null,
    [patientId]
  );

  useEffect(() => {
    setRecordId('');
    setResult(null);
    setError(null);
  }, [patientId]);

  const medications = useMemo(() => context?.medications ?? [], [context]);

  const run = async () => {
    if (!recordId) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      setResult(await assistantApi.explainMedication(recordId));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader
        accent={ACCENT.medication}
        icon={<BeakerIcon className="h-5 w-5" />}
        title="Medication Agent"
        subtitle="Explains one medication record in language a patient can act on. The drug, strength, route and instructions come from the record verbatim — the agent only phrases them."
        action={<PatientPicker value={patientId} onChange={setPatientId} />}
      />

      {!patientId ? (
        <EmptyState
          icon={<BeakerIcon className="h-6 w-6" />}
          title="Choose a patient"
          detail="Their medication records appear here, and any one of them can be explained."
        />
      ) : loading ? (
        <div className="flex justify-center py-10">
          <Spinner size={22} />
        </div>
      ) : medications.length === 0 ? (
        <EmptyState
          icon={<BeakerIcon className="h-6 w-6" />}
          title="No medication records"
          detail="This patient has no medication list on any admission yet."
        />
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Medication record" className="min-w-[20rem] flex-1">
              <Select value={recordId} onChange={(e) => setRecordId(e.target.value)}>
                <option value="">Select a medication…</option>
                {medications.map((m) => (
                  <option key={m.medicationRecordId} value={m.medicationRecordId}>
                    {m.drugName} {m.dosage} · {m.listLabel}
                    {m.isActive ? '' : ' (stopped)'}
                  </option>
                ))}
              </Select>
            </Field>
            <Button onClick={() => void run()} disabled={disabled || busy || !recordId}>
              {busy ? <Spinner size={14} /> : <SparklesIcon className="h-4 w-4" />}
              Explain
            </Button>
          </div>

          {error && (
            <Callout tone="danger" className="mt-4">
              {error}
            </Callout>
          )}

          {result && (
            <div className="mt-5">
              {result.record && (
                <div
                  className="mb-4 grid gap-x-6 gap-y-2 rounded-xl border p-4 sm:grid-cols-2 lg:grid-cols-3"
                  style={{
                    borderColor: 'var(--color-border)',
                    background: 'var(--color-surface-muted)',
                  }}
                >
                  <Fact label="Medication" value={result.record.medication_name} />
                  <Fact label="Strength" value={result.record.strength} />
                  <Fact label="Route" value={result.record.route} />
                  <Fact label="Class" value={result.record.drug_class} />
                  <Fact label="List" value={result.record.medication_type} />
                  <Fact label="Status" value={result.record.medication_status} />
                </div>
              )}
              <Markdown content={result.explanation} />
            </div>
          )}
        </>
      )}
    </Card>
  );
}

function Fact({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div>
      <div className="text-[0.625rem] font-semibold uppercase tracking-[0.06em] text-faint">
        {label}
      </div>
      <div className="text-[0.8125rem]">{value}</div>
    </div>
  );
}

/* ── 4. Discharge summary agent ───────────────────────────────────────────── */

function DischargePanel({ disabled }: { disabled: boolean }) {
  const [patientId, setPatientId] = useState('');
  const [packageId, setPackageId] = useState('');
  const [result, setResult] = useState<DischargeReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const { data: context, loading } = useApi<AssistantPatientContext>(
    patientId ? `/assistant/patients/${patientId}/context` : null,
    [patientId]
  );

  useEffect(() => {
    setPackageId('');
    setResult(null);
    setError(null);
  }, [patientId]);

  const packages = context?.dischargePackages ?? [];

  const run = async () => {
    if (!packageId) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      setResult(await assistantApi.dischargeSummary(packageId));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader
        accent={ACCENT.discharge}
        icon={<ClipboardDocumentCheckIcon className="h-5 w-5" />}
        title="Discharge Summary Report Agent"
        subtitle="Compiles one structured report from the admission, medications, procedures, labs, notes and vitals — and says plainly what is still missing rather than filling the gap."
        action={<PatientPicker value={patientId} onChange={setPatientId} />}
      />

      {!patientId ? (
        <EmptyState
          icon={<ClipboardDocumentCheckIcon className="h-6 w-6" />}
          title="Choose a patient"
          detail="Their discharge packages appear here."
        />
      ) : loading ? (
        <div className="flex justify-center py-10">
          <Spinner size={22} />
        </div>
      ) : packages.length === 0 ? (
        <EmptyState
          icon={<ClipboardDocumentCheckIcon className="h-6 w-6" />}
          title="No discharge packages"
          detail="Nothing has been initiated for this patient yet. Start one from the Discharge screen."
        />
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Discharge package" className="min-w-[18rem] flex-1">
              <Select value={packageId} onChange={(e) => setPackageId(e.target.value)}>
                <option value="">Select a package…</option>
                {packages.map((p) => (
                  <option key={p._id} value={p.packageId}>
                    {p.packageId} · {p.status.replace(/_/g, ' ')}
                  </option>
                ))}
              </Select>
            </Field>
            <Button onClick={() => void run()} disabled={disabled || busy || !packageId}>
              {busy ? <Spinner size={14} /> : <SparklesIcon className="h-4 w-4" />}
              Compile report
            </Button>
          </div>

          {error && (
            <Callout tone="danger" className="mt-4">
              {error}
            </Callout>
          )}

          {result && (
            <div className="mt-5">
              {result.missing_information.length > 0 && (
                <Callout tone="warning" title="Not recorded" className="mb-4">
                  <ul className="list-disc space-y-0.5 pl-4">
                    {result.missing_information.map((m) => (
                      <li key={m}>{m}</li>
                    ))}
                  </ul>
                </Callout>
              )}
              <Markdown content={result.report} />
              <p className="mt-5 text-[0.75rem] text-faint">
                A draft compiled from the record. It is not a signed discharge summary — approval
                happens on the Discharge screen.
              </p>
            </div>
          )}
        </>
      )}
    </Card>
  );
}

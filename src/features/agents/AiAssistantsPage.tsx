import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowPathIcon,
  BeakerIcon,
  BuildingOffice2Icon,
  CalendarDaysIcon,
  ClipboardDocumentListIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline';
import {
  Badge,
  Button,
  Callout,
  Card,
  CardHeader,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Select,
  Spinner,
  StatPill,
  Tabs,
} from '@/components/common';
import { Markdown } from '@/components/common/Markdown';
import { AgentChat, makeMessage, type ChatMessage } from './AgentChat';
import { errorMessage } from '@/lib/api';
import { useNotificationStore } from '@/store/notificationStore';
import {
  askHospitalAgent,
  explainMedication,
  fetchExplainableMedications,
  fetchMultiAgentHealth,
  fetchSummarisablePackages,
  generateDischargeSummary,
  sendAppointmentTurn,
  type ExplainableMedication,
  type MultiAgentHealth,
  type SummarisablePackage,
} from '@/lib/multiAgentApi';

/* ═══════════════════════════════════════════════════════════════════════════
   The four independent specialist agents.

   They are presented side by side rather than as one chat box with a mode
   switch, because they are genuinely four services with four different
   inputs: two are conversations, one takes a medication record, one takes a
   discharge package. Flattening them into a single prompt would hide the one
   thing a clinician needs to know — which records an answer came from.
   ═══════════════════════════════════════════════════════════════════════════ */

type TabKey = 'appointment' | 'medication' | 'discharge' | 'hospital';

const LIST_LABEL: Record<ExplainableMedication['listType'], string> = {
  pre_admission: 'Pre-admission',
  inpatient: 'Inpatient',
  discharge: 'Discharge',
};

export function AiAssistantsPage() {
  const [tab, setTab] = useState<TabKey>('appointment');
  const [health, setHealth] = useState<MultiAgentHealth | null>(null);
  const [healthLoading, setHealthLoading] = useState(true);

  const loadHealth = useCallback(async () => {
    setHealthLoading(true);
    try {
      setHealth(await fetchMultiAgentHealth());
    } catch {
      setHealth(null);
    } finally {
      setHealthLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadHealth();
  }, [loadHealth]);

  const online = Boolean(health?.online && health.service.databaseConnected !== false);

  return (
    <div>
      <PageHeader
        eyebrow="AI assistants"
        title="Specialist agents"
        story="Four independent agents, each reading the hospital's own records. They draft and explain — they do not decide. Every answer is built from records in the database, and anything the records do not contain is reported as missing rather than filled in."
        meta={
          <>
            <StatPill
              label="Service"
              value={healthLoading ? 'Checking…' : online ? 'Online' : 'Offline'}
              tone={healthLoading ? 'neutral' : online ? 'success' : 'danger'}
            />
            <StatPill label="Agents" value={String(health?.agents.length ?? 4)} />
          </>
        }
        actions={
          <Button variant="outline" onClick={() => void loadHealth()} disabled={healthLoading}>
            {healthLoading ? <Spinner size={14} /> : <ArrowPathIcon className="h-4 w-4" />}
            <span className="ml-1.5">Recheck</span>
          </Button>
        }
      />

      {!healthLoading && !online && (
        <Callout tone="warning" title="The agent service is not reachable" className="mb-5">
          {health?.service.databaseError
            ? `It answered, but cannot read the hospital database: ${health.service.databaseError}`
            : (health?.service.error ??
              'Start it with "uv run uvicorn main:app --port 8001" in hospital-multi-agent, then press Recheck.')}
          {health?.service.url && (
            <span className="mt-1 block text-[0.75rem] opacity-80">
              Expected at {health.service.url}
            </span>
          )}
        </Callout>
      )}

      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { key: 'appointment', label: 'Appointments' },
          { key: 'medication', label: 'Medications' },
          { key: 'discharge', label: 'Discharge summary' },
          { key: 'hospital', label: 'Hospital info' },
        ]}
      />

      <div className="mt-5">
        {tab === 'appointment' && <AppointmentAgentPanel online={online} />}
        {tab === 'medication' && <MedicationAgentPanel online={online} />}
        {tab === 'discharge' && <DischargeSummaryPanel online={online} />}
        {tab === 'hospital' && <HospitalAgentPanel online={online} />}
      </div>
    </div>
  );
}

/* ── Appointment agent ──────────────────────────────────────────────────── */

function AppointmentAgentPanel({ online }: { online: boolean }) {
  const push = useNotificationStore((s) => s.push);
  const [patientId, setPatientId] = useState('');
  const [confirmedPatient, setConfirmedPatient] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const send = async (text: string) => {
    setMessages((prev) => [...prev, makeMessage('user', text)]);
    setBusy(true);
    try {
      const result = await sendAppointmentTurn({
        message: text,
        patientId: confirmedPatient ?? patientId,
        sessionId,
      });
      setSessionId(result.sessionId);
      setConfirmedPatient(result.patientId);
      setMessages((prev) => [...prev, makeMessage('agent', result.reply)]);
    } catch (err) {
      const detail = errorMessage(err);
      setMessages((prev) => [
        ...prev,
        makeMessage('agent', `I could not complete that. ${detail}`),
      ]);
      push({ tone: 'error', title: 'Appointment assistant failed', detail });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
      <Card>
        <CardHeader
          icon={<CalendarDaysIcon className="h-5 w-5" />}
          accent="#0891B2"
          title="Appointment agent"
          subtitle="Finds doctors, checks live availability and books — with the same double-booking protection the website uses."
        />

        {!patientId.trim() && !confirmedPatient ? (
          <EmptyState
            icon={<CalendarDaysIcon className="h-6 w-6" />}
            title="Choose a patient first"
            detail="The assistant books against a real chart, so it needs to know whose appointment this is before the conversation starts."
          />
        ) : (
          <AgentChat
            messages={messages}
            onSend={send}
            busy={busy}
            disabled={!online}
            disabledReason="The agent service is offline, so the assistant cannot answer right now."
            accent="#0891B2"
            placeholder="e.g. Is there a cardiologist free on Thursday morning?"
            emptyState="Describe what the patient needs. The assistant will suggest a department, show real free slots and ask for confirmation before booking anything."
            suggestions={[
              'Which cardiologists do you have?',
              'Show me free slots this week',
              'What appointments does this patient already have?',
            ]}
          />
        )}
      </Card>

      <div className="space-y-4">
        <Card>
          <CardHeader title="Booking for" subtitle="Patient ID or record ID" />
          <Field label="Patient">
            <Input
              value={patientId}
              onChange={(e) => {
                setPatientId(e.target.value);
                setConfirmedPatient(null);
              }}
              placeholder="PAT-20261031-0001"
              disabled={busy}
            />
          </Field>
          {confirmedPatient && (
            <p className="mt-2 text-[0.75rem] text-muted">
              Confirmed against the chart as <strong>{confirmedPatient}</strong>.
            </p>
          )}
          {messages.length > 0 && (
            <Button
              variant="outline"
              className="mt-3 w-full"
              onClick={() => {
                setMessages([]);
                setSessionId(null);
              }}
            >
              Start a new conversation
            </Button>
          )}
        </Card>

        <Card>
          <CardHeader title="What it can do" />
          <ul className="space-y-1.5 text-[0.75rem] text-[var(--color-text-secondary)]">
            <li>• List departments and doctors</li>
            <li>• Show real free slots for a date</li>
            <li>• Re-check a slot before booking it</li>
            <li>• Book, with explicit confirmation</li>
            <li>• List and cancel existing appointments</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}

/* ── Medication agent ───────────────────────────────────────────────────── */

function MedicationAgentPanel({ online }: { online: boolean }) {
  const push = useNotificationStore((s) => s.push);
  const [patientId, setPatientId] = useState('');
  const [records, setRecords] = useState<ExplainableMedication[] | null>(null);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [selected, setSelected] = useState<string>('');
  const [explanation, setExplanation] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!patientId.trim()) return;
    setLoadingRecords(true);
    setRecords(null);
    setExplanation(null);
    setSelected('');
    try {
      const result = await fetchExplainableMedications(patientId.trim());
      setRecords(result.records);
      if (result.records.length === 0) {
        push({ tone: 'info', title: 'No medication records found for that patient' });
      }
    } catch (err) {
      push({ tone: 'error', title: 'Could not load medications', detail: errorMessage(err) });
    } finally {
      setLoadingRecords(false);
    }
  };

  const explain = async () => {
    if (!selected) return;
    setBusy(true);
    setExplanation(null);
    try {
      const result = await explainMedication({ medicationRecordId: selected });
      setExplanation(result.explanation);
    } catch (err) {
      push({ tone: 'error', title: 'Could not explain that record', detail: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  const chosen = useMemo(
    () => records?.find((r) => r.medicationRecordId === selected) ?? null,
    [records, selected]
  );

  return (
    <div className="grid gap-5 lg:grid-cols-[22rem_1fr]">
      <Card>
        <CardHeader
          icon={<BeakerIcon className="h-5 w-5" />}
          accent="#7C3AED"
          title="Medication agent"
          subtitle="Explains one verified medication record in plain language."
        />

        <Field label="Patient" hint="Patient ID, e.g. PAT-20261031-0001">
          <div className="flex gap-2">
            <Input
              value={patientId}
              onChange={(e) => setPatientId(e.target.value)}
              placeholder="PAT-20261031-0001"
              onKeyDown={(e) => e.key === 'Enter' && void load()}
            />
            <Button onClick={() => void load()} disabled={loadingRecords || !patientId.trim()}>
              {loadingRecords ? <Spinner size={14} /> : 'Load'}
            </Button>
          </div>
        </Field>

        {records && records.length > 0 && (
          <>
            <Field label={`Medication record (${records.length})`} className="mt-4">
              <Select value={selected} onChange={(e) => setSelected(e.target.value)}>
                <option value="">Choose a medication…</option>
                {records.map((record) => (
                  <option key={record.medicationRecordId} value={record.medicationRecordId}>
                    {record.drugName} {record.dosage} — {LIST_LABEL[record.listType]}
                  </option>
                ))}
              </Select>
            </Field>

            <Button
              className="mt-3 w-full"
              onClick={() => void explain()}
              disabled={!selected || busy || !online}
            >
              {busy ? <Spinner size={14} /> : <DocumentTextIcon className="h-4 w-4" />}
              <span className="ml-1.5">Explain this medication</span>
            </Button>
          </>
        )}

        {records && records.length === 0 && (
          <p className="mt-4 text-[0.8125rem] text-muted">
            No medication records are recorded for that patient.
          </p>
        )}
      </Card>

      <Card>
        <CardHeader
          title="Explanation"
          subtitle={
            chosen
              ? `${chosen.drugName} ${chosen.dosage} · ${chosen.route} · ${LIST_LABEL[chosen.listType]}`
              : 'Choose a medication record to explain'
          }
          action={
            chosen ? <Badge tone="purple">{chosen.drugClass || 'Unclassified'}</Badge> : undefined
          }
        />

        {busy && (
          <div className="flex items-center gap-2 py-8 text-[0.8125rem] text-muted">
            <Spinner size={16} />
            <span>Reading the record and writing an explanation…</span>
          </div>
        )}

        {!busy && explanation && (
          <div className="prose-clinical">
            <Markdown content={explanation} />
          </div>
        )}

        {!busy && !explanation && (
          <EmptyState
            icon={<BeakerIcon className="h-6 w-6" />}
            title="Nothing explained yet"
            detail="Load a patient, pick one of their medication records, and the agent will explain what it is, how it is taken and what the record says — using only what is written in the chart."
          />
        )}
      </Card>
    </div>
  );
}

/* ── Discharge summary agent ────────────────────────────────────────────── */

function DischargeSummaryPanel({ online }: { online: boolean }) {
  const push = useNotificationStore((s) => s.push);
  const [packages, setPackages] = useState<SummarisablePackage[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState('');
  const [report, setReport] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        const result = await fetchSummarisablePackages();
        setPackages(result.packages);
      } catch (err) {
        push({ tone: 'error', title: 'Could not load packages', detail: errorMessage(err) });
      } finally {
        setLoading(false);
      }
    })();
  }, [push]);

  const generate = async () => {
    if (!selected) return;
    setBusy(true);
    setReport(null);
    try {
      const result = await generateDischargeSummary({ packageId: selected });
      setReport(result.report);
    } catch (err) {
      push({ tone: 'error', title: 'Could not compile the report', detail: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  const chosen = packages?.find((p) => p.packageId === selected) ?? null;

  return (
    <div className="grid gap-5 lg:grid-cols-[22rem_1fr]">
      <Card>
        <CardHeader
          icon={<ClipboardDocumentListIcon className="h-5 w-5" />}
          accent="#059669"
          title="Discharge summary agent"
          subtitle="Compiles a verified package — admission, medications, procedures, labs, notes and vitals — into one report."
        />

        {loading ? (
          <div className="flex items-center gap-2 py-6 text-[0.8125rem] text-muted">
            <Spinner size={16} />
            <span>Loading discharge packages…</span>
          </div>
        ) : (
          <>
            <Field label={`Discharge package (${packages?.length ?? 0})`}>
              <Select value={selected} onChange={(e) => setSelected(e.target.value)}>
                <option value="">Choose a package…</option>
                {(packages ?? []).map((pkg) => (
                  <option key={pkg.packageId} value={pkg.packageId}>
                    {pkg.packageId} — {pkg.patientName ?? 'Unknown patient'}
                  </option>
                ))}
              </Select>
            </Field>

            {chosen && (
              <div className="mt-4 space-y-1.5 rounded-lg bg-[var(--color-surface-sunken)] p-3 text-[0.75rem]">
                <Row label="Patient" value={`${chosen.patientName ?? '—'} (${chosen.patientId ?? '—'})`} />
                <Row label="Admission" value={chosen.admissionId ?? '—'} />
                <Row label="Diagnosis" value={chosen.admittingDiagnosis ?? '—'} />
                <Row label="Status" value={chosen.status.replace(/_/g, ' ')} />
              </div>
            )}

            <Button
              className="mt-3 w-full"
              onClick={() => void generate()}
              disabled={!selected || busy || !online}
            >
              {busy ? <Spinner size={14} /> : <DocumentTextIcon className="h-4 w-4" />}
              <span className="ml-1.5">Compile report</span>
            </Button>
          </>
        )}
      </Card>

      <Card>
        <CardHeader
          title="Discharge summary report"
          subtitle={chosen ? chosen.packageId : 'Choose a package to compile'}
          action={
            report ? (
              <Button
                variant="outline"
                onClick={() => {
                  void navigator.clipboard?.writeText(report);
                  push({ tone: 'success', title: 'Report copied to the clipboard' });
                }}
              >
                Copy
              </Button>
            ) : undefined
          }
        />

        {busy && (
          <div className="flex items-center gap-2 py-10 text-[0.8125rem] text-muted">
            <Spinner size={16} />
            <span>Reading the episode and compiling the report…</span>
          </div>
        )}

        {!busy && report && (
          <div className="prose-clinical max-h-[40rem] overflow-y-auto">
            <Markdown content={report} />
          </div>
        )}

        {!busy && !report && (
          <EmptyState
            icon={<ClipboardDocumentListIcon className="h-6 w-6" />}
            title="No report compiled yet"
            detail="The agent reads only what the package and its admission actually contain. Anything missing — an unrecorded discharge date, absent labs — is listed as missing rather than invented."
          />
        )}
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

/* ── General hospital agent ─────────────────────────────────────────────── */

function HospitalAgentPanel({ online }: { online: boolean }) {
  const push = useNotificationStore((s) => s.push);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const send = async (text: string) => {
    setMessages((prev) => [...prev, makeMessage('user', text)]);
    setBusy(true);
    try {
      const result = await askHospitalAgent({ question: text, sessionId });
      setSessionId(result.sessionId);
      setMessages((prev) => [
        ...prev,
        makeMessage('agent', result.answer, {
          emergency: result.isEmergency,
          sources: result.sources,
        }),
      ]);
    } catch (err) {
      const detail = errorMessage(err);
      setMessages((prev) => [...prev, makeMessage('agent', `I could not answer that. ${detail}`)]);
      push({ tone: 'error', title: 'Hospital assistant failed', detail });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader
        icon={<BuildingOffice2Icon className="h-5 w-5" />}
        accent="#D97706"
        title="General hospital assistant"
        subtitle="Departments, services, visiting hours, admission and registration policies — with emergency screening."
        action={
          messages.length > 0 ? (
            <Button
              variant="outline"
              onClick={() => {
                setMessages([]);
                setSessionId(null);
              }}
            >
              Clear
            </Button>
          ) : undefined
        }
      />
      <AgentChat
        messages={messages}
        onSend={send}
        busy={busy}
        disabled={!online}
        disabledReason="The agent service is offline, so the assistant cannot answer right now."
        accent="#D97706"
        placeholder="e.g. Which departments run on Saturdays?"
        emptyState="Ask about departments, services, visiting hours or admission and registration policies. Answers are drawn from the hospital's own records and published policies."
        suggestions={[
          'What departments do you have?',
          'What are the visiting hours?',
          'What does a new patient need to register?',
        ]}
      />
    </Card>
  );
}

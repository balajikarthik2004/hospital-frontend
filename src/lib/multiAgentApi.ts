import { api } from './api';
import { publicApi } from './publicApi';

/**
 * The four independent specialist agents.
 *
 * Everything here goes through the Node backend rather than straight to the
 * Python service. That is not indirection for its own sake: the backend is
 * where the caller's identity is established, and the agent service decides
 * what a caller may read from the identity it is sent. A browser that could
 * choose that value could read any chart.
 */

export interface AgentDescriptor {
  key: 'appointment' | 'medication' | 'discharge_summary' | 'general_hospital';
  name: string;
  description: string;
  endpoint: string;
  color: string;
  capabilities: string[];
}

export interface MultiAgentHealth {
  online: boolean;
  service: {
    url: string;
    status: string | null;
    name: string | null;
    databaseConnected: boolean | null;
    databaseError: string | null;
    error: string | null;
  };
  agents: AgentDescriptor[];
}

export interface AppointmentTurn {
  sessionId: string;
  reply: string;
  status: 'success' | 'error' | 'rate_limited';
  patientId: string;
}

export interface ExplainableMedication {
  medicationRecordId: string;
  drugName: string;
  genericName: string;
  drugClass: string;
  dosage: string;
  frequency: string;
  route: string;
  listType: 'pre_admission' | 'inpatient' | 'discharge';
  isActive: boolean;
}

export interface MedicationExplanation {
  medicationRecordId: string;
  status: string;
  record: Record<string, unknown> | null;
  explanation: string;
}

export interface SummarisablePackage {
  packageId: string;
  status: string;
  patientId: string | null;
  patientName: string | null;
  admissionId: string | null;
  admittingDiagnosis: string | null;
  initiatedAt: string | null;
  completedAt: string | null;
}

export interface GeneratedSummary {
  packageId: string;
  status: string;
  report: string;
  sourceData: Record<string, unknown> | null;
}

export interface HospitalAnswer {
  question: string;
  status: string;
  answer: string;
  sources: string[];
  sessionId: string | null;
  isEmergency: boolean;
}

/* ── Staff ──────────────────────────────────────────────────────────────── */

export async function fetchMultiAgentHealth(): Promise<MultiAgentHealth> {
  const res = await api.get<MultiAgentHealth>('/multi-agent/health');
  return res.data;
}

export async function sendAppointmentTurn(input: {
  message: string;
  patientId?: string;
  sessionId?: string | null;
}): Promise<AppointmentTurn> {
  const res = await api.post<AppointmentTurn>('/multi-agent/appointments/chat', input);
  return res.data;
}

export async function fetchExplainableMedications(
  patientId: string
): Promise<{ patientId: string; count: number; records: ExplainableMedication[] }> {
  const res = await api.get(`/multi-agent/medications/${encodeURIComponent(patientId)}`);
  return res.data;
}

export async function explainMedication(input: {
  medicationRecordId: string;
  sessionId?: string | null;
}): Promise<MedicationExplanation> {
  const res = await api.post<MedicationExplanation>('/multi-agent/medications/explain', input);
  return res.data;
}

export async function fetchSummarisablePackages(): Promise<{
  count: number;
  packages: SummarisablePackage[];
}> {
  const res = await api.get('/multi-agent/discharge-summaries');
  return res.data;
}

export async function generateDischargeSummary(input: {
  packageId: string;
  sessionId?: string | null;
}): Promise<GeneratedSummary> {
  const res = await api.post<GeneratedSummary>(
    '/multi-agent/discharge-summaries/generate',
    input
  );
  return res.data;
}

export async function askHospitalAgent(input: {
  question: string;
  sessionId?: string | null;
}): Promise<HospitalAnswer> {
  const res = await api.post<HospitalAnswer>('/multi-agent/hospital/ask', input);
  return res.data;
}

/* ── Public website and patient portal ──────────────────────────────────── */

/** Whether to show the assistant at all. Never throws: a failure means "hide it". */
export async function fetchAssistantHealth(): Promise<boolean> {
  try {
    const res = await publicApi.get<{ online: boolean }>('/assistant/health');
    return Boolean(res.data?.online);
  } catch {
    return false;
  }
}

export async function askPublicAssistant(input: {
  question: string;
  sessionId?: string | null;
}): Promise<HospitalAnswer> {
  const res = await publicApi.post<HospitalAnswer>('/assistant/ask', input);
  return res.data;
}

/** Conversational booking for a patient signed in to the portal. */
export async function sendPortalAssistantTurn(input: {
  message: string;
  sessionId?: string | null;
}): Promise<{ sessionId: string; reply: string; status: string }> {
  const res = await publicApi.post('/portal/assistant', input);
  return res.data;
}

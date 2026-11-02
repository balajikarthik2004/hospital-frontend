import { api } from './api';

/**
 * The four independent specialist agents, as the staff application sees them.
 *
 * Everything goes through the Node backend at /api/assistant, never to the
 * Python service directly. The backend is what mints the agent identity from
 * the signed-in session, so a browser that could reach the agents itself
 * could also claim to be any patient.
 */

export interface AssistantAgentCard {
  key: 'general_hospital' | 'appointment' | 'medication' | 'discharge_summary';
  name: string;
  blurb: string;
  color: string;
  scope: string;
}

export interface AssistantHealth {
  online: boolean;
  url: string;
  status?: string;
  appName?: string;
  databaseConnected?: boolean;
  databaseError?: string | null;
  engine?: string;
  llmConfigured?: boolean;
  model?: string | null;
  error?: string;
  agents: AssistantAgentCard[];
}

export interface HospitalAnswer {
  question: string;
  status: string;
  answer: string;
  sources: string[];
  session_id?: string | null;
  error?: string | null;
}

export interface AppointmentTurn {
  session_id: string;
  response: string;
  status: string;
  error?: string | null;
}

export interface MedicationExplanation {
  medication_record_id: string;
  status: string;
  record: {
    medication_name?: string;
    drug_class?: string;
    strength?: string;
    route?: string;
    medication_type?: string;
    dose_instructions?: string;
    medication_status?: string;
  } | null;
  explanation: string;
  patient_id?: string | null;
  error?: string | null;
}

export interface DischargeReport {
  package_id: string;
  status: string;
  report: string;
  source_data: Record<string, unknown> | null;
  missing_information: string[];
  patient_id?: string | null;
  error?: string | null;
}

/** The identifiers the medication and discharge agents can be pointed at. */
export interface AssistantPatientContext {
  patient: { _id: string; patientId: string; name: string };
  medications: {
    medicationRecordId: string;
    drugName: string;
    dosage: string;
    frequency: string;
    route: string;
    isActive: boolean;
    listType: string;
    listLabel: string;
  }[];
  dischargePackages: {
    _id: string;
    packageId: string;
    status: string;
    initiatedAt: string;
  }[];
  admissions: {
    _id: string;
    admissionId: string;
    admissionDate: string;
    admittingDiagnosis: string;
    status: string;
  }[];
}

export const assistantApi = {
  health: () => api.get<AssistantHealth>('/assistant/health').then((r) => r.data),

  ask: (question: string, sessionId?: string | null) =>
    api
      .post<HospitalAnswer>('/assistant/hospital/ask', { question, sessionId: sessionId ?? null })
      .then((r) => r.data),

  appointmentTurn: (message: string, sessionId?: string | null, patientId?: string | null) =>
    api
      .post<AppointmentTurn>('/assistant/appointments/chat', {
        message,
        sessionId: sessionId ?? null,
        patientId: patientId ?? null,
      })
      .then((r) => r.data),

  explainMedication: (medicationRecordId: string, sessionId?: string | null) =>
    api
      .post<MedicationExplanation>('/assistant/medications/explain', {
        medicationRecordId,
        sessionId: sessionId ?? null,
      })
      .then((r) => r.data),

  dischargeSummary: (packageId: string, sessionId?: string | null) =>
    api
      .post<DischargeReport>('/assistant/discharge/summary', {
        packageId,
        sessionId: sessionId ?? null,
      })
      .then((r) => r.data),

  patientContext: (patientId: string) =>
    api
      .get<AssistantPatientContext>(`/assistant/patients/${patientId}/context`)
      .then((r) => r.data),
};

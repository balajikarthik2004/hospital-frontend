import { api } from './api';

/**
 * Prescribing and the in-house pharmacy counter.
 *
 * The shapes here mirror `models/Prescription.ts`. The status ladder is
 * enforced on the server, not here — this client only ever asks for a
 * transition, and a refusal comes back as an ordinary error with a sentence
 * explaining why.
 */

export const PRESCRIPTION_STATUSES = [
  'draft',
  'sent_to_pharmacy',
  'preparing',
  'ready',
  'dispensed',
  'cancelled',
] as const;
export type PrescriptionStatus = (typeof PRESCRIPTION_STATUSES)[number];

export type PrescriptionPriority = 'routine' | 'urgent' | 'stat';
export type FlagSeverity = 'critical' | 'high' | 'medium' | 'low';

export interface PrescriptionItem {
  _id: string;
  drugName: string;
  genericName: string;
  drugClass: string;
  dosage: string;
  frequency: string;
  route: string;
  durationDays: number;
  quantity: number;
  instructions: string;
  substitutionAllowed: boolean;
  isDispensed: boolean;
  dispensedQuantity: number;
  substitutedWith: string | null;
  pharmacyNote: string | null;
}

export interface PrescriptionFlag {
  flagId: string;
  type: 'interaction' | 'allergy_conflict' | 'duplication' | 'high_risk' | 'unclear_instruction';
  severity: FlagSeverity;
  drugA: string;
  drugB: string | null;
  description: string;
  recommendation: string;
  acknowledged: boolean;
  acknowledgedAt: string | null;
  acknowledgementNote: string | null;
}

interface NamedUser {
  _id: string;
  firstName: string;
  lastName: string;
  department?: string;
}

export interface Prescription {
  _id: string;
  prescriptionId: string;
  patientId: {
    _id: string;
    patientId: string;
    demographics: {
      firstName: string;
      lastName: string;
      dateOfBirth?: string;
    };
    medicalHistory?: { allergies?: { substance: string; severity: string }[] };
  } | null;
  admissionId: string | null;
  prescribedBy: NamedUser | null;
  prescribedAt: string;
  status: PrescriptionStatus;
  priority: PrescriptionPriority;
  diagnosis: string;
  notes: string;
  items: PrescriptionItem[];
  safety: {
    checkedAt: string | null;
    passed: boolean;
    flags: PrescriptionFlag[];
  };
  pharmacy: {
    verifiedBy: NamedUser | null;
    verifiedAt: string | null;
    readyAt: string | null;
    dispensedBy: NamedUser | null;
    dispensedAt: string | null;
    collectedBy: string;
    notes: string;
  };
  counselling: {
    content: string;
    generatedAt: string | null;
    generator: string;
  };
  sentToPharmacyAt: string | null;
  cancelledAt: string | null;
  cancelReason: string;
  createdAt: string;
}

export interface PrescriptionItemInput {
  drugName: string;
  genericName?: string;
  dosage: string;
  frequency: string;
  route?: string;
  durationDays?: number;
  quantity?: number;
  instructions?: string;
  substitutionAllowed?: boolean;
}

export interface QueueSummary {
  counts: Record<PrescriptionStatus, number>;
  waiting: number;
  urgent: number;
}

export const STATUS_LABEL: Record<PrescriptionStatus, string> = {
  draft: 'Draft',
  sent_to_pharmacy: 'With pharmacy',
  preparing: 'Preparing',
  ready: 'Ready',
  dispensed: 'Dispensed',
  cancelled: 'Cancelled',
};

/* ── Reading ────────────────────────────────────────────────────────────── */

export async function fetchPrescriptions(params: {
  status?: PrescriptionStatus;
  patientId?: string;
  scope?: 'all' | 'queue' | 'mine';
  search?: string;
  limit?: number;
}): Promise<{ prescriptions: Prescription[]; total: number }> {
  const res = await api.get('/prescriptions', { params });
  return res.data;
}

export async function fetchQueueSummary(): Promise<QueueSummary> {
  const res = await api.get<QueueSummary>('/prescriptions/queue/summary');
  return res.data;
}

export async function fetchPrescription(id: string): Promise<Prescription> {
  const res = await api.get<{ prescription: Prescription }>(`/prescriptions/${id}`);
  return res.data.prescription;
}

/* ── The doctor ─────────────────────────────────────────────────────────── */

export async function createPrescription(input: {
  patientId: string;
  admissionId?: string | null;
  diagnosis?: string;
  notes?: string;
  priority?: PrescriptionPriority;
  items: PrescriptionItemInput[];
}): Promise<Prescription> {
  const res = await api.post<{ prescription: Prescription }>('/prescriptions', input);
  return res.data.prescription;
}

export async function updatePrescription(
  id: string,
  input: Partial<{
    diagnosis: string;
    notes: string;
    priority: PrescriptionPriority;
    items: PrescriptionItemInput[];
  }>
): Promise<Prescription> {
  const res = await api.patch<{ prescription: Prescription }>(`/prescriptions/${id}`, input);
  return res.data.prescription;
}

export async function sendToPharmacy(id: string): Promise<Prescription> {
  const res = await api.post<{ prescription: Prescription }>(`/prescriptions/${id}/send`);
  return res.data.prescription;
}

/* ── The pharmacy counter ───────────────────────────────────────────────── */

export async function verifyPrescription(id: string): Promise<Prescription> {
  const res = await api.post<{ prescription: Prescription }>(`/prescriptions/${id}/verify`);
  return res.data.prescription;
}

export async function markReady(id: string): Promise<Prescription> {
  const res = await api.post<{ prescription: Prescription }>(`/prescriptions/${id}/ready`);
  return res.data.prescription;
}

export async function acknowledgeFlag(
  id: string,
  flagId: string,
  note: string
): Promise<Prescription> {
  const res = await api.post<{ prescription: Prescription }>(
    `/prescriptions/${id}/flags/ack`,
    { flagId, note }
  );
  return res.data.prescription;
}

export async function dispensePrescription(
  id: string,
  input: {
    collectedBy: string;
    notes?: string;
    items?: {
      itemId: string;
      dispensedQuantity?: number;
      substitutedWith?: string | null;
      pharmacyNote?: string | null;
    }[];
  }
): Promise<Prescription> {
  const res = await api.post<{ prescription: Prescription }>(
    `/prescriptions/${id}/dispense`,
    input
  );
  return res.data.prescription;
}

export async function cancelPrescription(id: string, reason: string): Promise<Prescription> {
  const res = await api.post<{ prescription: Prescription }>(`/prescriptions/${id}/cancel`, {
    reason,
  });
  return res.data.prescription;
}

/* ── The Medication Agent ───────────────────────────────────────────────── */

/** Asks the agent to write the plain-language sheet the patient takes home. */
export async function generateCounselling(
  id: string
): Promise<{ prescriptionId: string; counselling: string; status: string }> {
  const res = await api.post(`/prescriptions/${id}/counselling`);
  return res.data;
}

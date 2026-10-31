// TypeScript mirrors of the MongoDB models (spec §4).

export type Role =
  | 'physician'
  | 'pharmacist'
  | 'nurse'
  | 'admin'
  | 'care_coordinator'
  | 'patient';

export type Permission =
  | 'patient:view:own'
  | 'patient:view:any'
  | 'patient:register'
  | 'patient:admit'
  | 'vitals:record'
  | 'notes:write'
  | 'medication:modify'
  | 'discharge:initiate'
  | 'discharge:review-medication'
  | 'discharge:approve-summary'
  | 'discharge:approve-instructions'
  | 'discharge:complete'
  | 'appointment:schedule'
  | 'referral:manage'
  | 'analytics:view'
  | 'audit:view'
  | 'users:manage'
  | 'beds:manage'
  | 'beds:view'
  | 'catalogue:manage';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  role: Role;
  department: string;
  specialization: string | null;
  licenseNumber: string | null;
  phone: string;
  avatar: string | null;
  patientRef: string | null;
  isActive: boolean;
  lastLogin: string | null;
  permissions: Permission[];
  activePatients?: number;
}

export type PatientStatus =
  | 'registered'
  | 'admitted'
  | 'in_treatment'
  | 'discharge_pending'
  | 'discharged';

export interface Allergy {
  substance: string;
  reaction: string;
  severity: 'mild' | 'moderate' | 'severe' | 'life-threatening';
}

export interface Patient {
  _id: string;
  patientId: string;
  demographics: {
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    gender: 'male' | 'female' | 'other';
    bloodType: string;
    address: { street: string; city: string; state: string; zipCode: string };
    phone: string;
    email: string;
    preferredLanguage: string;
    literacyLevel: 'basic' | 'intermediate' | 'advanced';
  };
  emergencyContacts: { name: string; relationship: string; phone: string }[];
  insurance: {
    provider: string;
    policyNumber: string;
    groupNumber: string;
    coverageType: string;
    isVerified: boolean;
  };
  medicalHistory: {
    conditions: string[];
    surgeries: { name: string; date: string }[];
    allergies: Allergy[];
    familyHistory: string[];
  };
  primaryCarePhysician: { name: string; clinic: string; phone: string; fax: string };
  communicationPreference: string;
  status: PatientStatus;
  createdAt: string;
  updatedAt: string;
  activeAdmission?: {
    _id: string;
    admissionId: string;
    admittingDiagnosis: string;
    admissionDate: string;
    ward: string;
    room: string;
    bed: string;
    attendingPhysician: string;
    attendingPhysicianId: string | null;
  } | null;
}

export type RiskLevel = 'low' | 'moderate' | 'high';

export interface ClinicalNote {
  _id: string;
  author: Pick<User, 'firstName' | 'lastName' | 'role'> | string;
  type: 'progress' | 'assessment' | 'consultation' | 'procedure' | 'nursing';
  content: string;
  createdAt: string;
}

export interface LabResult {
  _id: string;
  testName: string;
  value: string;
  unit: string;
  referenceRange: string;
  isAbnormal: boolean;
  resultDate: string;
}

export interface Admission {
  _id: string;
  admissionId: string;
  patientId: Patient | string;
  admittingDiagnosis: string;
  diagnosisCodes: string[];
  admissionDate: string;
  expectedDischargeDate: string | null;
  actualDischargeDate: string | null;
  bed: { ward: string; roomNumber: string; bedNumber: string };
  careTeam: {
    attendingPhysician: User | string;
    nurses: (User | string)[];
    specialists: (User | string)[];
    pharmacist: User | string | null;
    careCoordinator: User | string | null;
  };
  riskAssessment: {
    fallRisk: RiskLevel;
    pressureInjuryRisk: RiskLevel;
    infectionFlags: string[];
  };
  status: 'active' | 'discharged' | 'transferred';
  clinicalNotes: ClinicalNote[];
  labResults: LabResult[];
  procedures: { _id: string; name: string; date: string; notes: string }[];
  lengthOfStayDays?: number;
}

export type MedRoute = 'oral' | 'IV' | 'IM' | 'SC' | 'topical' | 'inhaled' | 'rectal';
export type ListType = 'pre_admission' | 'inpatient' | 'discharge';

export interface MedicationItem {
  _id?: string;
  drugName: string;
  genericName?: string;
  drugClass?: string;
  dosage: string;
  frequency: string;
  route: MedRoute;
  startDate?: string;
  endDate?: string | null;
  isActive?: boolean;
  notes?: string | null;
}

export interface MedicationList {
  _id: string;
  patientId: string;
  admissionId: string;
  listType: ListType;
  medications: MedicationItem[];
}

export interface Vital {
  _id: string;
  patientId: string;
  admissionId: string;
  recordedBy?: Pick<User, 'firstName' | 'lastName'> | string | null;
  timestamp: string;
  bloodPressureSystolic: number;
  bloodPressureDiastolic: number;
  heartRate: number;
  temperature: number;
  respiratoryRate: number;
  oxygenSaturation: number;
  painScore: number;
  weight: number | null;
  notes: string | null;
  alerts?: string[];
}

export type AppointmentType =
  | 'follow_up'
  | 'specialist'
  | 'lab_only'
  | 'telehealth'
  | 'pre_admission';
export type AppointmentStatus =
  | 'scheduled'
  | 'confirmed'
  | 'completed'
  | 'cancelled'
  | 'no_show';

export interface Appointment {
  _id: string;
  appointmentId: string;
  patientId: Patient | string;
  doctorId: User | string;
  admissionId: string | null;
  type: AppointmentType;
  specialty: string;
  scheduledDate: string;
  scheduledTime: string;
  duration: number;
  location: string;
  status: AppointmentStatus;
  reason: string;
  notes: string | null;
  insuranceVerified: boolean;
  reminderSent: boolean;
}

export type BedStatus = 'available' | 'occupied' | 'maintenance' | 'reserved';

export interface Bed {
  _id: string;
  ward: string;
  roomNumber: string;
  bedNumber: string;
  label?: string;
  type: 'general' | 'icu' | 'semi_private' | 'private' | 'pediatric';
  status: BedStatus;
  currentPatientId: Patient | string | null;
  currentAdmissionId: Admission | string | null;
  features: string[];
}

export type PackageStatus =
  | 'initiated'
  | 'agents_processing'
  | 'pending_review'
  | 'in_review'
  | 'approved'
  | 'rejected'
  | 'completed';

export type SectionStatus = 'pending' | 'generated' | 'reviewed' | 'approved' | 'rejected';
export type Severity = 'critical' | 'high' | 'medium' | 'low';
export type FlagType =
  | 'omission'
  | 'duplication'
  | 'dose_mismatch'
  | 'interaction'
  | 'allergy_conflict'
  | 'unclear_instruction';

export interface MedFlag {
  flagId: string;
  type: FlagType;
  severity: Severity;
  drugA: string;
  drugB: string | null;
  description: string;
  recommendation: string;
  confidence: number;
  resolution: 'pending' | 'accepted' | 'modified' | 'dismissed';
  resolvedBy: string | null;
  resolvedAt: string | null;
  resolvedNote: string | null;
}

export interface FollowUpRecommendation {
  _id: string;
  type:
    | 'pcp_visit'
    | 'specialist'
    | 'lab_work'
    | 'home_health'
    | 'physical_therapy'
    | 'dme'
    | 'other';
  description: string;
  timeframe: string;
  priority: 'required' | 'recommended' | 'optional';
  specialty: string;
  dueInDays: number;
  appointmentId: string | null;
  isScheduled: boolean;
}

export interface AgentRun {
  agent: string;
  status: 'queued' | 'running' | 'complete' | 'failed';
  startedAt?: string;
  finishedAt?: string;
  durationMs?: number;
  confidence?: number;
  error?: string;
}

export interface SafetyCheck {
  name: string;
  passed: boolean;
  detail: string;
}

export interface Approval {
  role: 'physician' | 'pharmacist' | 'nurse';
  userId: User | string;
  section: string;
  action: 'approved' | 'rejected' | 'edited';
  comments: string | null;
  signature: string;
  timestamp: string;
}

export type SectionKey =
  | 'clinicalSummary'
  | 'medicationReconciliation'
  | 'followUpPlan'
  | 'patientEducation';

export interface DischargePackage {
  _id: string;
  packageId: string;
  patientId: Patient;
  admissionId: Admission;
  initiatedBy: User | string;
  initiatedAt: string;
  status: PackageStatus;

  clinicalSummary: {
    status: SectionStatus;
    content: string;
    generatedAt: string | null;
    reviewedBy: User | string | null;
    reviewedAt: string | null;
    edits: string | null;
    agentConfidence: number;
    generator: string;
  };

  medicationReconciliation: {
    status: SectionStatus;
    preAdmissionMeds: MedicationItem[];
    inpatientMeds: MedicationItem[];
    dischargeMeds: MedicationItem[];
    flags: MedFlag[];
    agentConfidence: number;
    reviewedBy: User | string | null;
    reviewedAt: string | null;
  };

  followUpPlan: {
    status: SectionStatus;
    recommendations: FollowUpRecommendation[];
    agentConfidence: number;
    reviewedBy: User | string | null;
    reviewedAt: string | null;
  };

  patientEducation: {
    status: SectionStatus;
    content: string;
    readingLevel: string;
    language: string;
    generatedAt: string | null;
    reviewedBy: User | string | null;
    reviewedAt: string | null;
    agentConfidence: number;
    generator: string;
  };

  safetyValidation: {
    passed: boolean;
    checks: SafetyCheck[];
    validatedAt: string | null;
  };

  agentRuns: AgentRun[];
  approvals: Approval[];
  completedAt: string | null;

  flagSummary: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    unresolved: number;
  };
  blockers: string[];
}

export interface AuditLogEntry {
  _id: string;
  timestamp: string;
  userId: Pick<User, 'firstName' | 'lastName' | 'role' | 'email'> | null;
  userRole: string;
  action: string;
  entity: string;
  entityId: string | null;
  patientId: { patientId: string; demographics?: { firstName: string; lastName: string } } | null;
  details: { before: unknown; after: unknown; description: string };
  ipAddress: string;
  userAgent: string;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

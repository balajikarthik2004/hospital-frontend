import { format, formatDistanceToNow, isToday, isTomorrow, parseISO } from 'date-fns';
import type { Patient, Severity, SectionStatus, PackageStatus } from '@/types';

export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

// ─── Dates ───────────────────────────────────────────────────────────────────

const toDate = (value: string | Date): Date =>
  typeof value === 'string' ? parseISO(value) : value;

export const fmtDate = (v?: string | Date | null) => (v ? format(toDate(v), 'd MMM yyyy') : '—');
export const fmtDateTime = (v?: string | Date | null) =>
  v ? format(toDate(v), 'd MMM yyyy, HH:mm') : '—';
export const fmtTime = (v?: string | Date | null) => (v ? format(toDate(v), 'HH:mm') : '—');
export const fmtShort = (v?: string | Date | null) => (v ? format(toDate(v), 'd MMM') : '—');

export function fmtRelative(v?: string | Date | null): string {
  if (!v) return '—';
  return formatDistanceToNow(toDate(v), { addSuffix: true });
}

export function fmtDayLabel(v: string | Date): string {
  const d = toDate(v);
  if (isToday(d)) return 'Today';
  if (isTomorrow(d)) return 'Tomorrow';
  return format(d, 'EEE d MMM');
}

export function fmtDuration(ms?: number): string {
  if (!ms && ms !== 0) return '—';
  if (ms < 1000) return `${ms} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`;
  return `${Math.round(ms / 60_000)} min`;
}

// ─── Patients ────────────────────────────────────────────────────────────────

export function patientAge(patient: Pick<Patient, 'demographics'>): number {
  const dob = toDate(patient.demographics.dateOfBirth);
  return Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 3600 * 1000));
}

export function patientName(patient?: Pick<Patient, 'demographics'> | null): string {
  if (!patient?.demographics) return 'Unknown patient';
  return `${patient.demographics.firstName} ${patient.demographics.lastName}`;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

// ─── Labels ──────────────────────────────────────────────────────────────────

export function titleCase(value: string): string {
  return value
    .replace(/[_-]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

export const SEVERITY_LABEL: Record<Severity, string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

export const SEVERITY_STYLE: Record<Severity, { color: string; bg: string }> = {
  critical: { color: 'var(--severity-critical)', bg: 'var(--severity-critical-bg)' },
  high: { color: 'var(--severity-high)', bg: 'var(--severity-high-bg)' },
  medium: { color: 'var(--severity-medium)', bg: 'var(--severity-medium-bg)' },
  low: { color: 'var(--severity-low)', bg: 'var(--severity-low-bg)' },
};

export const SEVERITY_ORDER: Severity[] = ['critical', 'high', 'medium', 'low'];

export const AGENT_META = {
  clinicalSummary: {
    key: 'clinical_summary',
    label: 'Clinical Summary Agent',
    short: 'Clinical Summary',
    color: 'var(--agent-clinical)',
    kind: 'Claude-generated draft',
  },
  medicationReconciliation: {
    key: 'med_reconciliation',
    label: 'Medication Reconciliation Agent',
    short: 'Medication Reconciliation',
    color: 'var(--agent-medication)',
    kind: 'Deterministic rules engine',
  },
  followUpPlan: {
    key: 'follow_up_planning',
    label: 'Follow-Up Planning Agent',
    short: 'Follow-Up Planning',
    color: 'var(--agent-followup)',
    kind: 'Deterministic rules engine',
  },
  patientEducation: {
    key: 'patient_education',
    label: 'Patient Education Agent',
    short: 'Patient Education',
    color: 'var(--agent-education)',
    kind: 'Claude-generated draft',
  },
} as const;

export const PACKAGE_STEPS: { key: PackageStatus; label: string }[] = [
  { key: 'initiated', label: 'Initiated' },
  { key: 'agents_processing', label: 'Agents' },
  { key: 'pending_review', label: 'Review' },
  { key: 'approved', label: 'Approved' },
  { key: 'completed', label: 'Complete' },
];

export function packageStepIndex(status: PackageStatus): number {
  switch (status) {
    case 'initiated':
      return 0;
    case 'agents_processing':
      return 1;
    case 'pending_review':
    case 'in_review':
    case 'rejected':
      return 2;
    case 'approved':
      return 3;
    case 'completed':
      return 4;
    default:
      return 0;
  }
}

export const SECTION_TONE: Record<SectionStatus, 'neutral' | 'info' | 'warning' | 'success' | 'danger'> =
  {
    pending: 'neutral',
    generated: 'warning',
    reviewed: 'info',
    approved: 'success',
    rejected: 'danger',
  };

export const SECTION_LABEL: Record<SectionStatus, string> = {
  pending: 'Pending',
  generated: 'Awaiting review',
  reviewed: 'Edited',
  approved: 'Approved',
  rejected: 'Rejected',
};

// ─── Numbers ─────────────────────────────────────────────────────────────────

export const pct = (n: number) => `${n.toFixed(n % 1 === 0 ? 0 : 1)}%`;
export const confidencePct = (n: number) => `${Math.round(n * 100)}%`;

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

// ─── Vitals ──────────────────────────────────────────────────────────────────

export const VITAL_RANGES = {
  bloodPressureSystolic: { min: 90, max: 140, unit: 'mmHg', label: 'Systolic BP' },
  bloodPressureDiastolic: { min: 60, max: 90, unit: 'mmHg', label: 'Diastolic BP' },
  heartRate: { min: 60, max: 100, unit: 'bpm', label: 'Heart rate' },
  temperature: { min: 97, max: 99.5, unit: '°F', label: 'Temperature' },
  respiratoryRate: { min: 12, max: 20, unit: '/min', label: 'Respiratory rate' },
  oxygenSaturation: { min: 94, max: 100, unit: '%', label: 'SpO₂' },
} as const;

export function isVitalAbnormal(key: keyof typeof VITAL_RANGES, value: number): boolean {
  const range = VITAL_RANGES[key];
  return value < range.min || value > range.max;
}

// ─── Misc ────────────────────────────────────────────────────────────────────

export function downloadBlob(data: BlobPart, filename: string, type = 'text/csv') {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function groupBy<T, K extends string>(items: T[], key: (item: T) => K): Record<K, T[]> {
  return items.reduce(
    (acc, item) => {
      const k = key(item);
      (acc[k] ||= []).push(item);
      return acc;
    },
    {} as Record<K, T[]>
  );
}

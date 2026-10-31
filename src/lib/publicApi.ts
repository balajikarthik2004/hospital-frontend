import axios, { AxiosError } from 'axios';
import { API_URL, errorMessage } from './api';

/**
 * The client for everything a visitor can reach without a staff login.
 *
 * Deliberately a separate axios instance from `api`. That one attaches the
 * staff token to every request and signs the user out on a 401 — behaviour
 * that is actively wrong here: a visitor browsing departments has no session
 * to lose, and sending a logged-in clinician's bearer token to a public
 * endpoint would quietly widen what the endpoint returns.
 */
export const publicApi = axios.create({
  baseURL: `${API_URL}/public`,
  headers: { 'Content-Type': 'application/json' },
});

/* ── The patient portal session ──────────────────────────────────────────
   Kept under its own key, and in sessionStorage rather than localStorage: a
   medical record left open on a shared or family device should not survive
   the browser being closed. */

const PORTAL_KEY = 'safedischarge.portal';

export const portalToken = {
  get: () => {
    try {
      return sessionStorage.getItem(PORTAL_KEY);
    } catch {
      return null;
    }
  },
  set: (token: string) => {
    try {
      sessionStorage.setItem(PORTAL_KEY, token);
    } catch {
      /* private mode — the session simply will not persist a reload */
    }
  },
  clear: () => {
    try {
      sessionStorage.removeItem(PORTAL_KEY);
    } catch {
      /* ignore */
    }
  },
};

publicApi.interceptors.request.use((config) => {
  const token = portalToken.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let onPortalExpired: (() => void) | null = null;
export function setPortalExpiredHandler(fn: (() => void) | null) {
  onPortalExpired = fn;
}

publicApi.interceptors.response.use(
  (res) => res,
  (error: AxiosError) => {
    // Only a portal route can expire a portal session. A 401 from, say, a
    // mistyped URL must not log the patient out mid-booking.
    const url = error.config?.url ?? '';
    if (error.response?.status === 401 && url.includes('/portal/') && portalToken.get()) {
      portalToken.clear();
      onPortalExpired?.();
    }
    return Promise.reject(error);
  }
);

export { errorMessage };

/* ── Shapes returned by the public API ───────────────────────────────── */

export interface PublicSpecialty {
  _id: string;
  slug: string;
  name: string;
  tagline: string;
  description: string;
  icon: string;
  commonConditions: string[];
  consultationFee: number;
  location: string;
}

export interface PublicDoctor {
  _id: string;
  firstName: string;
  lastName: string;
  department: string;
  specialization: string | null;
  doctorProfile: {
    specialty: string;
    qualifications: string;
    yearsExperience: number;
    bio: string;
    languages: string[];
    consultationFee: number;
    availableDays: number[];
    clinicStart: string;
    clinicEnd: string;
    slotMinutes: number;
    isBookable: boolean;
  };
}

export interface TriageResponse {
  specialty: string | null;
  specialtyName: string | null;
  reason: string;
  confidence: number;
  matched: string[];
  emergency: { advice: string } | null;
  alternatives: { slug: string; name: string; score: number }[];
  doctors: PublicDoctor[];
}

export interface HospitalInfo {
  name: string;
  tagline: string;
  about: string;
  address: string;
  phone: string;
  emergencyPhone: string;
  email: string;
  hours: { outpatient: string; emergency: string; pharmacy: string };
  stats: { specialties: number; doctors: number; beds: number };
}

export interface PortalPatient {
  patientId: string;
  firstName: string;
  lastName: string;
  age: number;
  gender: string;
  phone: string;
  email: string;
}

export interface PortalAppointment {
  _id: string;
  appointmentId: string;
  scheduledDate: string;
  scheduledTime: string;
  status: string;
  specialty: string;
  reason: string;
  duration: number;
  doctorId: {
    firstName: string;
    lastName: string;
    department: string;
    doctorProfile?: { specialty?: string };
  } | null;
}

/* ── The booking assistant ────────────────────────────────────────────────
   Mirrors `AgentReply` in server/src/services/bookingAgent.ts. The whole
   conversation is server-driven: `state` is opaque to us and handed straight
   back on the next turn, and the client decides nothing about the flow — it
   renders what it is told. Keep these in step with the server if the agent
   grows a step. */

export interface AgentOption {
  label: string;
  value: string;
  /** Rendered quieter — used for "something else" style escapes. */
  subtle?: boolean;
}

export interface AgentReply {
  /** Opaque conversation state. Echo it back untouched on the next turn. */
  state: Record<string, unknown> & { step: string };
  /** Several short bubbles read better than one wall of text. */
  say: string[];
  options?: AgentOption[];
  input?: { type: 'text' | 'tel' | 'date'; placeholder: string } | null;
  booking?: {
    appointmentId: string;
    patientId: string;
    isNew: boolean;
    doctorName: string;
    department: string;
    date: string;
    time: string;
  };
  emergency?: { advice: string };
}

export const doctorName = (d: Pick<PublicDoctor, 'firstName' | 'lastName'>) =>
  `Dr ${d.firstName} ${d.lastName}`;

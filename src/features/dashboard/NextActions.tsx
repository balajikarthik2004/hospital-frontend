import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRightIcon,
  BeakerIcon,
  CalendarDaysIcon,
  CheckCircleIcon,
  ChevronRightIcon,
  ClipboardDocumentCheckIcon,
  CpuChipIcon,
  ExclamationTriangleIcon,
  HeartIcon,
  HomeModernIcon,
  PencilSquareIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { Card, CardHeader } from '@/components/common';
import { cn } from '@/lib/utils';

/* ═══════════════════════════════════════════════════════════════════════════
   Two pieces of orientation that sit above every dashboard:

   · NextActions  — the queue of work, ranked, so nobody has to read four
                    tables to work out what to do first.
   · WorkflowStrip — what the product does, in five steps, for anyone opening
                    it for the first time.
   ═══════════════════════════════════════════════════════════════════════════ */

type Urgency = 'critical' | 'high' | 'normal';

interface Action {
  id: string;
  urgency: Urgency;
  title: string;
  detail: string;
  /** Null for a row that is information only, with nowhere to go. */
  href: string | null;
  cta: string;
  icon: typeof HeartIcon;
}

const URGENCY: Record<Urgency, { ink: string; bg: string; border: string; label: string }> = {
  critical: {
    ink: 'var(--color-danger)',
    bg: 'rgba(239, 68, 68, 0.08)',
    border: 'rgba(239, 68, 68, 0.25)',
    label: 'Do this first',
  },
  high: {
    ink: 'var(--color-warning)',
    bg: 'rgba(245, 158, 11, 0.08)',
    border: 'rgba(245, 158, 11, 0.25)',
    label: 'Waiting on you',
  },
  normal: {
    ink: 'var(--color-info)',
    bg: 'rgba(2, 132, 199, 0.08)',
    border: 'rgba(2, 132, 199, 0.25)',
    label: 'Coming up',
  },
};

const plural = (n: number, one: string, many = `${one}s`) => (n === 1 ? one : many);

/**
 * Turns whatever the role's dashboard endpoint returned into a ranked list of
 * things to actually do. Everything is derived on the client, so the API shape
 * is untouched.
 */
function buildActions(data: any): Action[] {
  const out: Action[] = [];
  const n = (value: unknown) => (typeof value === 'number' ? value : 0);

  switch (data?.role) {
    case 'physician': {
      const critical = n(data.criticalAlerts?.length);
      if (critical) {
        out.push({
          id: 'crit',
          urgency: 'critical',
          title: `Resolve ${critical} critical medication ${plural(critical, 'flag')}`,
          detail:
            'These discharges are blocked. A pharmacist or physician has to accept, change or dismiss each one.',
          href: '/discharge',
          cta: 'Open the queue',
          icon: ExclamationTriangleIcon,
        });
      }
      const mine = n(data.pendingReviews);
      if (mine) {
        out.push({
          id: 'mine',
          urgency: 'high',
          title: `Sign ${mine} discharge ${plural(mine, 'package')} for your patients`,
          detail: 'The agents have drafted them. Nothing goes home until you have read and signed.',
          href: '/discharge',
          cta: 'Review drafts',
          icon: PencilSquareIcon,
        });
      }
      const others = n(data.allPendingReviews) - mine;
      if (others > 0) {
        out.push({
          id: 'others',
          urgency: 'normal',
          title: `${others} other ${plural(others, 'discharge')} in review on the service`,
          detail: 'Owned by another attending, but you can read them.',
          href: '/discharge',
          cta: 'See all',
          icon: ClipboardDocumentCheckIcon,
        });
      }
      const appts = n(data.upcomingAppointments?.length);
      if (appts) {
        out.push({
          id: 'appts',
          urgency: 'normal',
          title: `${appts} upcoming ${plural(appts, 'appointment')} in your clinic`,
          detail: 'Booked follow-ups where you are the named clinician.',
          href: '/scheduling',
          cta: 'Open calendar',
          icon: CalendarDaysIcon,
        });
      }
      break;
    }

    case 'nurse': {
      const overdue = n(data.vitalsOverdueCount);
      if (overdue) {
        out.push({
          id: 'vitals',
          urgency: 'high',
          title: `${overdue} ${plural(overdue, 'patient')} ${plural(overdue, 'is', 'are')} overdue for observations`,
          detail: 'Last recorded more than four hours ago.',
          href: '/patients',
          cta: 'Find the patient',
          icon: HeartIcon,
        });
      }
      const education = n(data.pendingEducationReviews?.length);
      if (education) {
        out.push({
          id: 'education',
          urgency: 'high',
          title: `Approve ${education} ${plural(education, 'set')} of patient instructions`,
          detail:
            'The patient cannot see their instructions until a nurse or physician has signed them off.',
          href: '/discharge',
          cta: 'Review instructions',
          icon: PencilSquareIcon,
        });
      }
      const admitted = n(data.todaysAdmissions?.length);
      if (admitted) {
        out.push({
          id: 'admitted',
          urgency: 'normal',
          title: `${admitted} ${plural(admitted, 'admission')} today`,
          detail: 'New patients who will need a baseline set of observations.',
          href: '/admissions',
          cta: 'See admissions',
          icon: HomeModernIcon,
        });
      }
      break;
    }

    case 'pharmacist': {
      const critical = n(data.flagCounts?.critical);
      if (critical) {
        out.push({
          id: 'crit',
          urgency: 'critical',
          title: `${critical} critical medication ${plural(critical, 'flag')} open`,
          detail: 'Interactions and allergy conflicts. No discharge completes while one is open.',
          href: '/discharge',
          cta: 'Resolve now',
          icon: ExclamationTriangleIcon,
        });
      }
      const high = n(data.flagCounts?.high);
      if (high) {
        out.push({
          id: 'high',
          urgency: 'high',
          title: `${high} high-severity ${plural(high, 'flag')} to decide on`,
          detail: 'Omissions and dose changes on high-risk drugs.',
          href: '/discharge',
          cta: 'Review flags',
          icon: BeakerIcon,
        });
      }
      const queue = n(data.queue?.length);
      if (queue) {
        out.push({
          id: 'queue',
          urgency: 'normal',
          title: `${queue} medication ${plural(queue, 'list')} awaiting your signature`,
          detail: 'The reconciliation is drafted; it needs a pharmacist to accept it.',
          href: '/discharge',
          cta: 'Open the queue',
          icon: ClipboardDocumentCheckIcon,
        });
      }
      break;
    }

    case 'care_coordinator': {
      const required = n(data.requiredUnscheduled);
      if (required) {
        out.push({
          id: 'required',
          urgency: 'high',
          title: `Book ${required} required follow-${plural(required, 'up')}`,
          detail:
            'The protocol says these are mandatory for the diagnosis. Discharges wait on them.',
          href: '/discharge',
          cta: 'Book appointments',
          icon: CalendarDaysIcon,
        });
      }
      const optional = n(data.unscheduledFollowUps?.length) - required;
      if (optional > 0) {
        out.push({
          id: 'optional',
          urgency: 'normal',
          title: `${optional} recommended follow-${plural(optional, 'up')} not yet booked`,
          detail: 'Advisory rather than mandatory, but worth clearing.',
          href: '/discharge',
          cta: 'See recommendations',
          icon: CalendarDaysIcon,
        });
      }
      break;
    }

    case 'admin': {
      const pending = n(data.kpis?.packagesPendingReview);
      if (pending) {
        out.push({
          id: 'pending',
          urgency: 'normal',
          title: `${pending} ${plural(pending, 'discharge')} sitting in review`,
          detail: 'Anything stuck here is a patient waiting longer than they need to.',
          href: '/discharge',
          cta: 'Open the queue',
          icon: ClipboardDocumentCheckIcon,
        });
      }
      const occupancy = n(data.kpis?.bedOccupancyPct);
      if (occupancy >= 85) {
        out.push({
          id: 'beds',
          urgency: 'high',
          title: `Beds are ${occupancy}% full`,
          detail: 'Capacity is tight. Completing approved discharges releases beds immediately.',
          href: '/beds',
          cta: 'Open bed map',
          icon: HomeModernIcon,
        });
      }
      const falsePositives = n(data.kpis?.falsePositiveRatePct);
      if (falsePositives >= 25) {
        out.push({
          id: 'fp',
          urgency: 'normal',
          title: `${falsePositives}% of resolved flags were dismissed`,
          detail:
            'A high dismissal rate means the rules are firing too often and clinicians will start ignoring them.',
          href: '/analytics',
          cta: 'Open AI performance',
          icon: CpuChipIcon,
        });
      }
      break;
    }

    case 'patient': {
      // Written for the person, not the ward. No jargon, no agent talk.
      if (data.instructions) {
        out.push({
          id: 'instructions',
          urgency: 'high',
          title: 'Your going-home instructions are ready',
          detail:
            'Your medicines, what to watch out for, and when to call someone. They are further down this page.',
          href: null,
          cta: '',
          icon: ClipboardDocumentCheckIcon,
        });
      } else if (data.dischargeStatus) {
        out.push({
          id: 'preparing',
          urgency: 'normal',
          title: 'Your team is preparing your going-home pack',
          detail:
            'A doctor and a pharmacist have to check and sign it before you can see it. Nothing to do yet.',
          href: null,
          cta: '',
          icon: HeartIcon,
        });
      }
      const mine = n(data.appointments?.length);
      if (mine) {
        out.push({
          id: 'appts',
          urgency: 'normal',
          title: `You have ${mine} ${plural(mine, 'appointment')} booked`,
          detail: 'Your follow-up visits after you leave hospital.',
          href: '/scheduling',
          cta: 'See dates',
          icon: CalendarDaysIcon,
        });
      }
      break;
    }
  }

  const rank: Record<Urgency, number> = { critical: 0, high: 1, normal: 2 };
  return out.sort((a, b) => rank[a.urgency] - rank[b.urgency]);
}

export function NextActions({ data }: { data: any }) {
  const actions = buildActions(data);
  const urgent = actions.filter((a) => a.urgency !== 'normal').length;

  if (actions.length === 0) {
    return (
      <Card className="mb-5">
        <div className="flex items-center gap-3.5">
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
            style={{ background: 'var(--color-success-light)' }}
            aria-hidden
          >
            <CheckCircleIcon
              className="h-[22px] w-[22px]"
              style={{ color: 'var(--color-success)' }}
            />
          </span>
          <div>
            <p className="text-[0.9375rem] font-semibold tracking-[-0.01em]">
              Nothing is waiting on you
            </p>
            <p className="mt-0.5 text-[0.8125rem] text-muted">
              No open flags, no unsigned sections. Anything new will appear here the moment it
              lands.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="mb-5" padded={false}>
      <div className="px-5 pt-5">
        <CardHeader
          title="What needs you now"
          subtitle={
            urgent > 0
              ? `${urgent} ${plural(urgent, 'item')} ${plural(urgent, 'is', 'are')} holding up a discharge`
              : 'Nothing urgent — these are the next things in your queue'
          }
        />
      </div>

      <ul>
        {actions.map((action, i) => {
          const tone = URGENCY[action.urgency];
          // An informational row is a plain div: a link to nowhere is worse
          // than no link at all.
          const Row = action.href
            ? ({ children }: { children: React.ReactNode }) => (
                <Link
                  to={action.href!}
                  className="group flex items-center gap-4 border-t px-6 py-4 transition-all duration-150 hover:bg-[var(--color-surface-muted)]"
                  style={{ borderColor: 'var(--color-border)' }}
                >
                  {children}
                </Link>
              )
            : ({ children }: { children: React.ReactNode }) => (
                <div
                  className="flex items-center gap-4 border-t px-6 py-4"
                  style={{ borderColor: 'var(--color-border)' }}
                >
                  {children}
                </div>
              );

          return (
            <li key={action.id} style={{ animationDelay: `${i * 50}ms` }}>
              <Row>
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border shadow-xs transition-transform duration-200 group-hover:scale-105"
                  style={{ background: tone.bg, borderColor: tone.border, color: tone.ink }}
                  aria-hidden
                >
                  <action.icon className="h-5 w-5" />
                </span>

                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2.5">
                    <span className="text-[0.875rem] font-bold tracking-tight">{action.title}</span>
                    <span
                      className="rounded-full border px-2 py-0.5 text-[0.625rem] font-bold uppercase tracking-wider"
                      style={{ background: tone.bg, color: tone.ink, borderColor: tone.border }}
                    >
                      {tone.label}
                    </span>
                  </span>
                  <span className="mt-1 block text-xs leading-relaxed text-muted">
                    {action.detail}
                  </span>
                </span>

                {action.href && (
                  <span className="flex shrink-0 items-center gap-1.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--color-primary)] shadow-xs transition-all group-hover:border-primary-400 group-hover:bg-primary-50 dark:group-hover:bg-primary-950">
                    <span>{action.cta}</span>
                    <ChevronRightIcon className="h-3.5 w-3.5 stroke-[2.5] transition-transform group-hover:translate-x-0.5" />
                  </span>
                )}
              </Row>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

/* ───────────────────────────────────────────────────────────────────────── */

const STAFF_STEPS = [
  {
    label: 'Admit',
    body: 'The patient is admitted to a bed and the chart starts filling: notes, labs, observations.',
    icon: HomeModernIcon,
    tone: 'var(--color-text-tertiary)',
  },
  {
    label: 'Draft',
    body: 'A physician opens the discharge. Five agents read the chart and draft the whole package.',
    icon: CpuChipIcon,
    tone: 'var(--agent-orchestrator)',
  },
  {
    label: 'Check',
    body: 'A safety layer runs seven checks — no prescribing, no invented drugs, no self-approval.',
    icon: ExclamationTriangleIcon,
    tone: 'var(--agent-medication)',
  },
  {
    label: 'Sign',
    body: 'Each role signs the one section it owns. Physician, pharmacist, nurse, coordinator.',
    icon: PencilSquareIcon,
    tone: 'var(--color-warning)',
  },
  {
    label: 'Discharge',
    body: 'Only once every section is signed and no critical flag is open. The bed is released.',
    icon: CheckCircleIcon,
    tone: 'var(--color-success)',
  },
];

/** The same journey told from the bed rather than the nurses' station. */
const PATIENT_STEPS = [
  {
    label: "You're in hospital",
    body: 'Your care team look after you and keep your record up to date each day.',
    icon: HomeModernIcon,
    tone: 'var(--color-text-tertiary)',
  },
  {
    label: 'We prepare your pack',
    body: 'Your doctor, pharmacist and nurse put together your medicines, instructions and follow-up visits.',
    icon: ClipboardDocumentCheckIcon,
    tone: 'var(--agent-orchestrator)',
  },
  {
    label: 'A clinician checks it',
    body: 'Nothing reaches you until a doctor or nurse has read it and signed their name to it.',
    icon: PencilSquareIcon,
    tone: 'var(--color-warning)',
  },
  {
    label: 'You go home',
    body: 'Your instructions and appointment dates appear on this page, and you can print them.',
    icon: CheckCircleIcon,
    tone: 'var(--color-success)',
  },
];

const DISMISS_KEY = 'safedischarge.workflow-strip-dismissed';

/** A one-glance explanation of the product, for anyone seeing it cold. */
export function WorkflowStrip({ variant = 'staff' }: { variant?: 'staff' | 'patient' }) {
  const isPatient = variant === 'patient';
  const steps = isPatient ? PATIENT_STEPS : STAFF_STEPS;
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === '1';
    } catch {
      return false;
    }
  });

  if (dismissed) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* private mode — it will simply reappear next session */
    }
  };

  return (
    <Card className="mb-6 overflow-hidden rounded-[14px] border border-[var(--color-border)] shadow-xs" padded={false}>
      <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-1">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[var(--color-primary)]" />
            <p className="eyebrow">
              {isPatient ? 'What happens before you go home' : 'How SafeDischarge works'}
            </p>
          </div>
          <p className="mt-1 text-[0.8125rem] text-muted">
            {isPatient
              ? 'Four steps, and a person signs their name at every one of them.'
              : 'Multi-agent AI prepares the draft package; clinicians verify and decide.'}
          </p>
        </div>
        <button
          onClick={dismiss}
          className="-mr-1 -mt-1 rounded-lg p-1.5 text-faint transition-colors hover:bg-[var(--color-surface-sunken)] hover:text-[var(--color-text)]"
          aria-label="Hide this explanation"
        >
          <XMarkIcon className="h-4 w-4" />
        </button>
      </div>

      <ol
        className={cn(
          'stagger mt-4 grid gap-px border-t border-[var(--color-border)] bg-[var(--color-border)]',
          isPatient ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-3 lg:grid-cols-5'
        )}
      >
        {steps.map((step, i) => (
          <li
            key={step.label}
            className="group relative bg-[var(--color-surface)] p-5 transition-colors hover:bg-[var(--color-surface-muted)]"
            style={{ ['--i' as string]: i }}
          >
            <div className="flex items-center justify-between">
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-105"
                style={{
                  background: `color-mix(in srgb, ${step.tone} 14%, transparent)`,
                  color: step.tone,
                }}
                aria-hidden
              >
                <step.icon className="h-4 w-4" />
              </span>
              <span className="font-mono text-[0.6875rem] font-bold text-faint opacity-60">
                0{i + 1}
              </span>
            </div>
            <h4 className="mt-3 text-[0.875rem] font-bold tracking-tight">{step.label}</h4>
            <p className="mt-1.5 text-xs leading-relaxed text-muted">{step.body}</p>
          </li>
        ))}
      </ol>
    </Card>
  );
}

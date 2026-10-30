import { CheckIcon } from '@heroicons/react/24/outline';
import { Badge, type BadgeTone } from '@/components/common';
import { PACKAGE_STEPS, cn, packageStepIndex, titleCase } from '@/lib/utils';
import type { PackageStatus } from '@/types';

const TONES: Record<PackageStatus, BadgeTone> = {
  initiated: 'neutral',
  agents_processing: 'purple',
  pending_review: 'warning',
  in_review: 'info',
  approved: 'success',
  rejected: 'danger',
  completed: 'success',
};

const LABELS: Record<PackageStatus, string> = {
  initiated: 'Initiated',
  agents_processing: 'Agents working',
  pending_review: 'Awaiting review',
  in_review: 'In review',
  approved: 'Approved',
  rejected: 'Rejected',
  completed: 'Completed',
};

export function StatusPill({ status }: { status: PackageStatus }) {
  return (
    <Badge tone={TONES[status] ?? 'neutral'} dot={status === 'agents_processing'}>
      {LABELS[status] ?? titleCase(status)}
    </Badge>
  );
}

/**
 * Plain-language explanation of each stage, so somebody looking at the screen
 * for the first time knows what is happening and who it is waiting on.
 */
const STEP_STORY: Record<string, { done: string; now: string; next: string }> = {
  initiated: {
    done: 'Discharge opened',
    now: 'The physician has opened the discharge.',
    next: 'A physician opens the discharge.',
  },
  agents_processing: {
    done: 'Draft prepared',
    now: 'Five agents are reading the chart and drafting the package.',
    next: 'The agents will draft the package.',
  },
  pending_review: {
    done: 'Reviewed by the team',
    now: 'Each role is reviewing and signing the section it owns.',
    next: 'The care team reviews and signs each section.',
  },
  approved: {
    done: 'All sections signed',
    now: 'Every section is signed. The discharge can be finalised.',
    next: 'All four sections must be signed.',
  },
  completed: {
    done: 'Patient discharged',
    now: 'The admission is closed and the bed released.',
    next: 'The admission closes and the bed is released.',
  },
};

/**
 * The journey rail. Reads left to right as a story: what is done, what is
 * happening now, and what is still ahead.
 */
export function PackageStepper({
  status,
  showStory = true,
  compact,
}: {
  status: PackageStatus;
  showStory?: boolean;
  /** Dots only, no labels — for a table cell. */
  compact?: boolean;
}) {
  // A completed package has finished the last step too, so every node is ticked.
  const current =
    status === 'completed' ? PACKAGE_STEPS.length : packageStepIndex(status);
  const rejected = status === 'rejected';
  const currentStep = PACKAGE_STEPS[Math.min(current, PACKAGE_STEPS.length - 1)];
  const story = STEP_STORY[currentStep?.key ?? 'initiated'];

  if (compact) {
    return (
      <ol
        className="flex items-center"
        aria-label={`Step ${Math.min(current + 1, PACKAGE_STEPS.length)} of ${PACKAGE_STEPS.length}`}
      >
        {PACKAGE_STEPS.map((step, i) => {
          const done = i < current;
          const active = i === current;
          const last = i === PACKAGE_STEPS.length - 1;
          const colour = done
            ? 'var(--color-success)'
            : active
              ? rejected
                ? 'var(--color-danger)'
                : 'var(--color-primary)'
              : 'var(--color-border-dark)';
          return (
            <li key={step.key} className="flex items-center" title={step.label}>
              <span
                className={cn('block rounded-full', active && !rejected && 'ring-4')}
                style={{
                  width: active ? 9 : 7,
                  height: active ? 9 : 7,
                  background: colour,
                  ['--tw-ring-color' as string]: `color-mix(in srgb, ${colour} 22%, transparent)`,
                }}
              />
              {!last && (
                <span
                  className="block h-0.5 w-5"
                  style={{
                    background: done ? 'var(--color-success)' : 'var(--color-border)',
                  }}
                  aria-hidden
                />
              )}
            </li>
          );
        })}
      </ol>
    );
  }

  return (
    <div className="w-full">
      <ol className="flex w-full items-start" aria-label="Discharge progress">
        {PACKAGE_STEPS.map((step, i) => {
          const done = i < current;
          const active = i === current;
          const last = i === PACKAGE_STEPS.length - 1;

          const nodeColor = done
            ? 'var(--color-success)'
            : active
              ? rejected
                ? 'var(--color-danger)'
                : 'var(--color-primary)'
              : 'var(--color-border-dark)';

          return (
            <li key={step.key} className={cn('flex min-w-0', !last && 'flex-1')}>
              <div className="flex min-w-0 flex-col items-center gap-2">
                <span
                  className={cn(
                    'relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-[0.6875rem] font-bold transition-colors duration-300',
                    active && !rejected && 'animate-pulse-ring'
                  )}
                  style={{
                    borderColor: nodeColor,
                    background: done || active ? nodeColor : 'var(--color-surface)',
                    color: done || active ? '#fff' : 'var(--color-text-tertiary)',
                  }}
                >
                  {done ? <CheckIcon className="h-3.5 w-3.5" strokeWidth={3} /> : i + 1}
                </span>
                <span
                  className={cn(
                    'max-w-[6.5rem] text-center text-[0.6875rem] font-medium leading-tight',
                    done || active
                      ? 'text-[var(--color-text)]'
                      : 'text-[var(--color-text-tertiary)]'
                  )}
                >
                  {step.label}
                </span>
              </div>

              {!last && (
                <span
                  className="mt-[13px] h-0.5 min-w-4 flex-1 overflow-hidden rounded-full"
                  style={{ background: 'var(--color-border)' }}
                  aria-hidden
                >
                  <span
                    className="block h-full rounded-full transition-[width] duration-700 ease-out"
                    style={{
                      width: done ? '100%' : '0%',
                      background: 'var(--color-success)',
                    }}
                  />
                </span>
              )}
            </li>
          );
        })}
      </ol>

      {showStory && story && (
        <p className="mt-4 text-center text-xs leading-relaxed text-muted">
          {rejected ? (
            <span style={{ color: 'var(--color-danger)' }}>
              A section was rejected and sent back. Read the reviewer's comment, fix it, and
              re-submit.
            </span>
          ) : (
            story.now
          )}
        </p>
      )}
    </div>
  );
}

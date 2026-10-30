import { useState } from 'react';
import { CalendarDaysIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import { Badge, Button, EmptyState, ErrorState } from '@/components/common';
import { api } from '@/lib/api';
import { useMutation } from '@/hooks/useApi';
import { useAuthStore } from '@/store/authStore';
import { toast } from '@/store/notificationStore';
import { titleCase } from '@/lib/utils';
import type { DischargePackage, FollowUpRecommendation } from '@/types';
import { SectionShell } from './SectionShell';
import { ScheduleFollowUpModal } from '../ScheduleFollowUpModal';

const PRIORITY_TONE = {
  required: 'danger',
  recommended: 'warning',
  optional: 'neutral',
} as const;

export function FollowUpSection({
  pkg,
  onChanged,
}: {
  pkg: DischargePackage;
  onChanged: () => void;
}) {
  const [scheduling, setScheduling] = useState<FollowUpRecommendation | null>(null);
  const can = useAuthStore((s) => s.can);

  const section = pkg.followUpPlan;
  const recs = section.recommendations ?? [];
  const unscheduled = recs.filter((r) => !r.isScheduled);
  const maySchedule = can('appointment:schedule') && pkg.status !== 'completed';

  const scheduleAll = useMutation(async () => {
    const { data } = await api.post<{ created: number }>(
      `/discharge/${pkg._id}/schedule-all-follow-ups`
    );
    toast.success(
      `${data.created} appointment${data.created === 1 ? '' : 's'} booked`,
      'Dates default to the recommended interval and can be adjusted in Scheduling.'
    );
    onChanged();
  });

  return (
    <SectionShell
      pkg={pkg}
      section="followUpPlan"
      onChanged={onChanged}
      summary={`${recs.length} recommendation${recs.length === 1 ? '' : 's'}, ${unscheduled.length} not yet booked.`}
      extraActions={
        maySchedule && unscheduled.length > 0 ? (
          <Button
            size="sm"
            variant="ghost"
            loading={scheduleAll.pending}
            onClick={() => void scheduleAll.mutate()}
          >
            Schedule all
          </Button>
        ) : undefined
      }
    >
      {section.status === 'pending' ? (
        <EmptyState
          title="Not generated yet"
          detail="The Follow-Up Planning Agent maps the diagnosis to a standard protocol."
        />
      ) : recs.length === 0 ? (
        <EmptyState title="No follow-up recommended" />
      ) : (
        <>
          {scheduleAll.error && (
            <div className="mb-3">
              <ErrorState message={scheduleAll.error} />
            </div>
          )}
          <ul className="space-y-2.5">
            {recs.map((rec) => (
              <li
                key={rec._id}
                className="flex flex-wrap items-start gap-3 rounded-lg border p-3"
                style={{ borderColor: 'var(--color-border)' }}
              >
                <span
                  className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                  style={{
                    background: rec.isScheduled
                      ? 'var(--color-success-light)'
                      : 'var(--color-surface-muted)',
                    color: rec.isScheduled
                      ? 'var(--color-success)'
                      : 'var(--agent-followup)',
                  }}
                >
                  {rec.isScheduled ? (
                    <CheckCircleIcon className="h-4 w-4" />
                  ) : (
                    <CalendarDaysIcon className="h-4 w-4" />
                  )}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">
                      {rec.specialty || titleCase(rec.type)}
                    </span>
                    <Badge tone={PRIORITY_TONE[rec.priority]}>{rec.priority}</Badge>
                    <span className="text-xs text-muted">{rec.timeframe}</span>
                    {rec.isScheduled && (
                      <Badge tone="success" dot>
                        Booked
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-muted">{rec.description}</p>
                </div>

                {maySchedule && !rec.isScheduled && (
                  <Button size="sm" variant="outline" onClick={() => setScheduling(rec)}>
                    Schedule
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </>
      )}

      <ScheduleFollowUpModal
        packageId={pkg._id}
        recommendation={scheduling}
        onClose={() => setScheduling(null)}
        onScheduled={onChanged}
      />
    </SectionShell>
  );
}

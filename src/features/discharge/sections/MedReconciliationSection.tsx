import { useState } from 'react';
import { Button, EmptyState } from '@/components/common';
import type { DischargePackage } from '@/types';
import { SectionShell } from './SectionShell';
import { FlagCard } from '../FlagCard';
import { MedComparison } from '@/features/medications/MedComparison';

export function MedReconciliationSection({
  pkg,
  onChanged,
}: {
  pkg: DischargePackage;
  onChanged: () => void;
}) {
  const [showLists, setShowLists] = useState(false);
  const section = pkg.medicationReconciliation;
  const flags = section.flags ?? [];
  const unresolved = flags.filter((f) => f.resolution === 'pending');

  const summary =
    flags.length === 0
      ? 'No discrepancies found.'
      : `${flags.length} flag${flags.length === 1 ? '' : 's'}, ${unresolved.length} still open.`;

  return (
    <SectionShell
      pkg={pkg}
      section="medicationReconciliation"
      onChanged={onChanged}
      summary={summary}
      extraActions={
        section.status !== 'pending' && (
          <Button size="sm" variant="ghost" onClick={() => setShowLists((s) => !s)}>
            {showLists ? 'Hide lists' : 'View full reconciliation'}
          </Button>
        )
      }
    >
      {section.status === 'pending' ? (
        <EmptyState
          title="Not generated yet"
          detail="The rules engine compares the home, inpatient and discharge lists."
        />
      ) : (
        <div className="space-y-5">
          {showLists && (
            <MedComparison
              preAdmission={section.preAdmissionMeds}
              inpatient={section.inpatientMeds}
              discharge={section.dischargeMeds}
              flags={flags}
            />
          )}

          {flags.length === 0 ? (
            <div
              className="rounded-lg px-4 py-3 text-sm"
              style={{ background: 'var(--color-success-light)', color: 'var(--color-success)' }}
            >
              The reconciliation agent found no discrepancies between the home, inpatient and
              discharge medication lists.
            </div>
          ) : (
            <div>
              <div className="mb-3 flex items-baseline justify-between">
                <h4 className="text-sm font-semibold">
                  {flags.length} finding{flags.length === 1 ? '' : 's'}
                </h4>
                {unresolved.length > 0 && (
                  <span className="text-xs text-muted">
                    {unresolved.length} awaiting a pharmacist decision
                  </span>
                )}
              </div>
              <ul className="space-y-3">
                {flags.map((flag) => (
                  <li key={flag.flagId}>
                    <FlagCard packageId={pkg._id} flag={flag} onResolved={onChanged} />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </SectionShell>
  );
}

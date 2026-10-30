import { EmptyState } from '@/components/common';
import { Markdown } from '@/components/common/Markdown';
import type { DischargePackage } from '@/types';
import { SectionShell } from './SectionShell';

export function ClinicalSummarySection({
  pkg,
  onChanged,
}: {
  pkg: DischargePackage;
  onChanged: () => void;
}) {
  const section = pkg.clinicalSummary;
  const firstLine = section.content
    .split('\n')
    .find((l) => l.trim() && !l.startsWith('#'))
    ?.slice(0, 160);

  return (
    <SectionShell
      pkg={pkg}
      section="clinicalSummary"
      onChanged={onChanged}
      editable
      editValue={section.content}
      summary={firstLine}
    >
      {section.status === 'pending' ? (
        <EmptyState
          title="Not generated yet"
          detail="The Clinical Summary Agent runs as part of the discharge pipeline."
        />
      ) : (
        <>
          {section.edits && (
            <div
              className="mb-4 rounded-lg px-3 py-2 text-xs"
              style={{ background: 'var(--color-info-light)', color: 'var(--color-info)' }}
            >
              A clinician has edited this summary. The agent's original draft is preserved in the
              audit log.
            </div>
          )}
          <Markdown content={section.content} />
        </>
      )}
    </SectionShell>
  );
}

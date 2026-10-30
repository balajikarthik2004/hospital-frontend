import { useState } from 'react';
import { PrinterIcon } from '@heroicons/react/24/outline';
import { Badge, Button, EmptyState, Modal } from '@/components/common';
import { Markdown } from '@/components/common/Markdown';
import type { DischargePackage } from '@/types';
import { SectionShell } from './SectionShell';

export function PatientEducationSection({
  pkg,
  onChanged,
}: {
  pkg: DischargePackage;
  onChanged: () => void;
}) {
  const [preview, setPreview] = useState(false);
  const section = pkg.patientEducation;

  return (
    <SectionShell
      pkg={pkg}
      section="patientEducation"
      onChanged={onChanged}
      editable
      editValue={section.content}
      summary={`Written at ${section.readingLevel} reading level in ${section.language}.`}
      extraActions={
        section.status !== 'pending' && (
          <Button size="sm" variant="ghost" onClick={() => setPreview(true)}>
            Preview full
          </Button>
        )
      }
    >
      {section.status === 'pending' ? (
        <EmptyState
          title="Not generated yet"
          detail="The Patient Education Agent waits for the summary and the reconciled medication list."
        />
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge tone="warning">Reading level: {section.readingLevel}</Badge>
            <Badge tone="neutral">{section.language}</Badge>
            <span className="text-xs text-faint">
              Only shown to the patient once a nurse or doctor approves it.
            </span>
          </div>
          <div
            className="max-h-96 overflow-y-auto rounded-lg border p-4"
            style={{ borderColor: 'var(--color-border)' }}
          >
            <Markdown content={section.content} />
          </div>
        </>
      )}

      <Modal
        open={preview}
        onClose={() => setPreview(false)}
        title="Patient instructions — print preview"
        subtitle="This is what the patient receives"
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setPreview(false)}>
              Close
            </Button>
            <Button icon={<PrinterIcon className="h-4 w-4" />} onClick={() => window.print()}>
              Print
            </Button>
          </>
        }
      >
        <div className="print-full">
          <Markdown content={section.content} />
        </div>
      </Modal>
    </SectionShell>
  );
}
